import { Injectable, Logger } from '@nestjs/common';
import { Queue, QueueOptions } from 'bullmq';
import { PublishEventPort } from 'src/packages/cloud-contracts/ports/publish-event.port';
import { InvokeInputFactory } from '../../../shared/helpers/invoke-input.factory';
import { MessageConverterHelper } from '../../../shared/helpers/message-converter.helper';
import { InvokeOutputDto } from '../../../core/invocations/dto/invoke-output.dto';
import { LocalOptions } from '../types/local-options.interface';

/**
 * LocalPublishEventAdapter - Implementación de PublishEventPort para ambiente local
 *
 * Este adapter publica eventos a una cola BullMQ (Redis) para desarrollo local.
 * BullMQ proporciona funcionalidad similar a EventBridge/Pub/Sub pero usando Redis.
 *
 * Características:
 * - Persistencia en Redis
 * - Reintentos automáticos configurables
 * - Priorización de mensajes
 * - Delayed jobs (scheduled events)
 * - UI de monitoreo con Bull Board
 *
 * Ideal para:
 * - Desarrollo local sin necesidad de cloud
 * - Testing e integración continua
 * - Ambientes donde no se requiere infraestructura cloud
 *
 * @see https://docs.bullmq.io/
 */
@Injectable()
export class LocalPublishEventAdapter implements PublishEventPort {
  private readonly logger = new Logger(LocalPublishEventAdapter.name);
  private readonly queue: Queue;
  private readonly queueName: string;

  /**
   * Constructor del adapter
   *
   * Inicializa la Queue de BullMQ conectada a Redis.
   * La Queue es el equivalente local a EventBridge Topic o Pub/Sub Topic.
   *
   * Configuración:
   * - connection: Configuración de Redis
   * - defaultJobOptions: Opciones por defecto para todos los jobs
   *
   * @param options - Configuración local (Redis, queue name, etc.)
   */
  constructor(private readonly options: LocalOptions) {
    this.queueName = options.queueName;

    // Configurar conexión a Redis
    const connection = {
      host: options.redisHost,
      port: options.redisPort,
      password: options.redisPassword,
      db: options.redisDb || 0,
    };

    // Opciones por defecto para jobs
    const queueOptions: QueueOptions = {
      connection,
      defaultJobOptions: {
        attempts: 3, // Reintentar hasta 3 veces
        backoff: {
          type: 'exponential', // Backoff exponencial
          delay: 2000, // Empezar con 2s de delay
        },
        removeOnComplete: 100, // Mantener últimos 100 jobs completados
        removeOnFail: 500, // Mantener últimos 500 jobs fallidos
      },
    };

    // Crear la Queue
    this.queue = new Queue(this.queueName, queueOptions);

    this.logger.log(
      `Initialized BullMQ publisher - Redis: ${options.redisHost}:${options.redisPort}, Queue: ${this.queueName}`,
    );
  }

  /**
   * Publica un evento a la Queue de BullMQ
   *
   * Proceso:
   * 1. Crea un job con el nombre del evento (topic)
   * 2. El payload se guarda como data del job
   * 3. Los atributos se guardan en el job.opts
   * 4. BullMQ persiste el job en Redis
   * 5. Workers pueden consumir el job
   *
   * El job será procesado por cualquier Worker escuchando esta queue.
   *
   * @param topic - Tipo de evento (nombre del job en BullMQ)
   * @param payload - Datos del evento (data del job)
   * @param attrs - Atributos opcionales (guardados en opts)
   * @returns ID del job creado en BullMQ
   * @throws Error si falla la publicación
   *
   * @example
   * const jobId = await publishEvent.publish(
   *   'user.created',
   *   { userId: '123', email: 'user@example.com' },
   *   { source: 'user-service', priority: 'high' }
   * );
   */
  async publish(
    topic: string,
    payload: any,
    attrs?: Record<string, string>,
  ): Promise<InvokeOutputDto> {
    try {
      // Paso 1: Crear el job en BullMQ
      // El nombre del job es el topic/eventType
      console.log('payload', payload);
      const input = InvokeInputFactory.create(topic, payload);
      console.log('input', input);
      const job = await this.queue.add(
        topic, // Nombre del job (eventType)
        MessageConverterHelper.convertToMessage(input), // Data del job (payload del evento)
        {
          // Opciones del job
          attempts: 3, // Reintentar 3 veces
          backoff: { type: 'exponential', delay: 2000 }, // Backoff exponencial
          removeOnComplete: true, // Eliminar job al completar
          removeOnFail: 1000, // Mantener jobs fallidos
          // Agregar atributos como metadata del job
          ...(attrs && Object.keys(attrs).length > 0 ? { attrs } : {}),
        },
      );
      console.log('job', job);

      // Paso 3: Loggear éxito y retornar jobId
      this.logger.log(
        `Event published successfully - ID: ${job.id}, EventType: ${topic}`,
      );

      return new InvokeOutputDto(input.jobId);
    } catch (error) {
      // Manejo de errores: loggear y re-lanzar
      const err = error as Error;
      this.logger.error(
        `Error publishing event to BullMQ: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Limpia recursos al destruir el adapter
   *
   * Cierra la conexión con la queue y Redis.
   */
  async onModuleDestroy() {
    await this.queue.close();
    this.logger.log('BullMQ publisher closed');
  }
}
