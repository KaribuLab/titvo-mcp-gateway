import { Injectable, Logger } from '@nestjs/common';
import { Worker, Job, WorkerOptions } from 'bullmq';
import { QueueConsumerPort } from 'src/packages/cloud-contracts/ports/queue-consumer.port';
import { LocalOptions } from '../types/local-options.interface';

/**
 * Type para el handler de mensajes
 * Define la firma de la función que procesa cada job de BullMQ
 */
interface MessageHandler {
  (msg: {
    id: string;
    data: Buffer;
    attrs: Record<string, string>;
    ack: () => Promise<void>;
    nack: () => Promise<void>;
  }): Promise<void> | void;
}

/**
 * LocalQueueConsumerAdapter - Implementación de QueueConsumerPort para ambiente local
 *
 * Este adapter consume mensajes de una cola BullMQ (Redis) para desarrollo local.
 * Usa BullMQ Worker para procesar jobs de forma similar a SQS o Pub/Sub.
 *
 * Características:
 * - Procesamiento concurrente (hasta 10 jobs simultáneos)
 * - Reintentos automáticos configurables
 * - ACK/NACK manual para control preciso
 * - Stalled jobs detection (jobs que se quedaron colgados)
 * - Rate limiting y throttling
 * - UI de monitoreo con Bull Board
 *
 * Flujo de procesamiento:
 * 1. onMessage() - Registrar handler
 * 2. start() - Crear Worker y comenzar a procesar
 * 3. Worker event 'active' - Job empieza a procesarse
 * 4. processJob() - Llamar handler del usuario
 * 5. ack()/nack() - Job completado o fallido
 * 6. stop() - Detener Worker
 *
 * @see https://docs.bullmq.io/guide/workers
 */
@Injectable()
export class LocalQueueConsumerAdapter implements QueueConsumerPort {
  private readonly logger = new Logger(LocalQueueConsumerAdapter.name);
  private readonly queueName: string;
  private readonly connection: any;
  private worker?: Worker;
  private isRunning = false;
  private messageHandler?: MessageHandler;

  /**
   * Constructor del adapter
   *
   * Prepara la configuración de conexión a Redis.
   * El Worker se crea cuando se llama a start().
   *
   * @param options - Configuración local (Redis, queue name, etc.)
   */
  constructor(private readonly options: LocalOptions) {
    // Nota: Para consumir resultados, usamos resultQueueName
    // Si quieres consumir eventos, usa queueName
    this.queueName = options.resultQueueName;

    // Configurar conexión a Redis
    this.connection = {
      host: options.redisHost,
      port: options.redisPort,
      password: options.redisPassword,
      db: options.redisDb || 0,
    };

    this.logger.log(
      `Initialized BullMQ consumer - Redis: ${options.redisHost}:${options.redisPort}, Queue: ${this.queueName}`,
    );
  }

  /**
   * Registra el handler que procesará los jobs
   *
   * Debe llamarse antes de start(). Solo se permite un handler por consumer.
   *
   * @param subscription - Nombre de la suscripción (para logging)
   * @param handler - Función que procesa cada job recibido
   */
  onMessage(subscription: string, handler: MessageHandler): void {
    this.messageHandler = handler;
    this.logger.log(`Message handler registered for: ${subscription}`);
  }

  /**
   * Inicia el consumidor de jobs
   *
   * Proceso:
   * 1. Verifica que no esté ya corriendo
   * 2. Valida que haya un handler registrado
   * 3. Crea el Worker de BullMQ
   * 4. Configura event listeners
   * 5. Worker empieza a procesar jobs automáticamente
   *
   * El Worker procesará jobs de forma concurrente (hasta 10 simultáneos).
   *
   * @throws Error si no hay handler registrado
   */
  async start(): Promise<void> {
    // Validar que no esté ya corriendo
    if (this.isRunning) {
      this.logger.warn('Consumer already running');
      return;
    }

    // Validar que haya un handler registrado
    if (!this.messageHandler) {
      throw new Error('No message handler registered. Call onMessage() first.');
    }

    // Configurar opciones del Worker
    const workerOptions: WorkerOptions = {
      connection: this.connection,
      concurrency: 10, // Procesar hasta 10 jobs en paralelo
      limiter: {
        max: 100, // Máximo 100 jobs por periodo
        duration: 1000, // Periodo de 1 segundo
      },
    };

    // Crear el Worker
    // El procesador se ejecuta por cada job
    this.worker = new Worker(
      this.queueName,
      async (job: Job) => {
        await this.processJob(job);
      },
      workerOptions,
    );

    // Event listeners
    this.worker.on('active', (job: Job) => {
      this.logger.debug(`Job ${job.id} started processing`);
    });

    this.worker.on('completed', (job: Job) => {
      this.logger.debug(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      this.logger.error(`Job ${job?.id} failed: ${error.message}`, error.stack);
    });

    this.worker.on('error', (error: Error) => {
      this.logger.error(`Worker error: ${error.message}`, error.stack);
    });

    // Marcar como activo
    this.isRunning = true;
    this.logger.log('BullMQ consumer started');
  }

  /**
   * Detiene el consumidor de jobs
   *
   * Proceso:
   * 1. Marca el consumer como inactivo
   * 2. Cierra el Worker (espera a que terminen jobs en proceso)
   * 3. Limpia recursos
   *
   * Los jobs que están siendo procesados terminarán su ejecución.
   */
  async stop(): Promise<void> {
    // Validar que esté corriendo
    if (!this.isRunning) {
      this.logger.warn('Consumer not running');
      return;
    }

    // Detener el Worker
    if (this.worker) {
      await this.worker.close();
      this.worker = undefined;
    }

    this.isRunning = false;
    this.logger.log('BullMQ consumer stopped');
  }

  /**
   * Procesa un job individual de BullMQ
   *
   * Este método prepara el job y lo pasa al handler registrado por el usuario.
   * El handler decide si hacer ACK (completar) o NACK (fallar).
   *
   * Proceso:
   * 1. Validar que haya handler
   * 2. Extraer datos del job
   * 3. Convertir data a Buffer
   * 4. Crear funciones ack/nack para el handler
   * 5. Llamar al handler del usuario
   * 6. Si hay error, se propaga y BullMQ reintenta automáticamente
   *
   * ACK vs NACK:
   * - ACK: Retornar normalmente (job se marca como completed)
   * - NACK: Lanzar error (job se marca como failed y se reintenta)
   *
   * BullMQ reintenta automáticamente según la configuración (attempts: 3).
   *
   * @param job - Job de BullMQ a procesar
   */
  private async processJob(job: Job): Promise<void> {
    // Validar que tengamos handler
    if (!this.messageHandler) {
      return;
    }

    const jobId = job.id || 'unknown';

    try {
      // Paso 1: Extraer datos del job
      const data = job.data;

      // Paso 2: Convertir data a Buffer (para mantener compatibilidad con el port)
      const dataBuffer = Buffer.from(JSON.stringify(data), 'utf-8');

      // Paso 3: Extraer atributos/metadata
      // En BullMQ no hay "attributes" nativos, pero podemos usar job.name y otros
      const attrs: Record<string, string> = {
        jobName: job.name,
        timestamp: new Date(job.timestamp).toISOString(),
        attemptsMade: job.attemptsMade.toString(),
        // Si guardaste attrs en el data, puedes extraerlos aquí
      };

      // Paso 4: Crear funciones ack/nack para el handler
      // ACK: No hacer nada, retornar normalmente
      const ack = async () => {
        // En BullMQ, si el procesador retorna sin error, el job se marca como completed
        this.logger.debug(`Job ${jobId} acknowledged`);
      };

      // NACK: Lanzar error para que BullMQ lo reintente
      const nack = async () => {
        throw new Error('Job rejected by handler');
      };

      // Paso 5: Llamar al handler del usuario con el job preparado
      await this.messageHandler({
        id: jobId,
        data: dataBuffer,
        attrs,
        ack,
        nack,
      });

      // Si llegamos aquí sin error, el job se completa automáticamente
    } catch (error) {
      // Si hay error, BullMQ automáticamente reintentará el job
      this.logger.error(
        `Error processing job ${jobId}: ${(error as Error).message}`,
        (error as Error).stack,
      );

      // Re-lanzar error para que BullMQ lo maneje
      throw error;
    }
  }

  /**
   * Limpia recursos al destruir el adapter
   *
   * Cierra el Worker y libera conexiones.
   */
  async onModuleDestroy() {
    await this.stop();
  }
}
