import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  JOB_PERSISTENCE,
  QUEUE_CONSUMER,
} from '../../../packages/cloud-contracts/constants/injection-tokens';
import { JobPersistencePort } from '../../../packages/cloud-contracts/ports/job-persistence.port';
import { QueueConsumerPort } from '../../../packages/cloud-contracts/ports/queue-consumer.port';
import { ContextService } from '../../../shared/services/context.service';

/**
 * JobProcessorService - Servicio para procesar jobs de forma asíncrona
 *
 * Este servicio consume mensajes de la cola (SQS, Service Bus, Pub/Sub, Redis)
 * y procesa los resultados de jobs que se ejecutan en background.
 *
 * Características:
 * - Se inicia automáticamente al arrancar la aplicación (OnModuleInit)
 * - Consume mensajes de la cola configurada
 * - Actualiza el estado y progreso de jobs en base de datos
 * - Reporta progreso al cliente MCP en tiempo real
 * - Se detiene limpiamente al cerrar la aplicación (OnModuleDestroy)
 *
 * Flujo de procesamiento:
 * 1. Recibe mensaje de la cola con resultado/progreso del job
 * 2. Parsea el mensaje y extrae datos (job_id, progress, success, data)
 * 3. Obtiene el job de la base de datos
 * 4. Actualiza estado según el tipo de mensaje:
 *    - Progreso: Actualiza progress y status a IN_PROGRESS
 *    - Éxito: Guarda resultado y marca como SUCCESS
 *    - Error: Marca como FAILURE con mensaje de error
 * 5. Reporta progreso al contexto MCP si está disponible
 * 6. Hace ACK del mensaje para removerlo de la cola
 *
 * @example
 * // El servicio se registra en AppModule y se inicia automáticamente
 * providers: [JobProcessorService]
 */
@Injectable()
export class JobProcessorService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(QUEUE_CONSUMER) private readonly consumer: QueueConsumerPort,
    @Inject(JOB_PERSISTENCE)
    private readonly jobPersistence: JobPersistencePort,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Hook de ciclo de vida - Se ejecuta al iniciar el módulo
   *
   * Registra el handler de mensajes e inicia el consumer de la cola.
   */
  async onModuleInit() {
    // 1. Registrar handler para procesar mensajes
    this.consumer.onMessage('nombre-de-la-queue', async (msg) => {
      await this.processMessage(msg);
    });

    // 2. Iniciar el consumer
    await this.consumer.start();
  }

  /**
   * Hook de ciclo de vida - Se ejecuta al destruir el módulo
   *
   * Detiene el consumer de forma limpia antes de cerrar la aplicación.
   */
  async onModuleDestroy() {
    // 3. Detener el consumer al cerrar la app
    await this.consumer.stop();
  }

  /**
   * Procesa un mensaje de la cola con resultado/progreso de un job
   *
   * @param msg - Mensaje de la cola con datos del job
   * @param msg.id - ID del mensaje en la cola
   * @param msg.data - Payload del mensaje (Buffer)
   * @param msg.attrs - Atributos adicionales del mensaje
   * @param msg.ack - Función para confirmar procesamiento exitoso
   * @param msg.nack - Función para rechazar el mensaje (reintento)
   */
  private async processMessage(msg: {
    id: string;
    data: Buffer;
    attrs: Record<string, string>;
    ack: () => Promise<void>;
    nack: () => Promise<void>;
  }) {
    // 4. Parsear el mensaje
    const output = JSON.parse(msg.data.toString('utf-8')) as {
      job_id: string;
      data: unknown;
      success: boolean;
      progress: number;
      message: string;
    };

    // 5. Obtener el job de la BD
    const job = await this.jobPersistence.getJob(output.job_id);
    if (!job) {
      return;
    }

    // 6. Procesar el job según el tipo de mensaje
    // 7. Actualizar el job con resultados
    // 8. Reportar progreso al contexto MCP
    if (output.success === undefined) {
      // ES AVANCE DE LA OPERACION
      if (output.progress > job.progress) {
        await this.jobPersistence.updateJob(output.job_id, {
          message: output.message,
          progress: output.progress,
          status: 'IN_PROGRESS',
        });
        const context = this.contextService.getContext(output.job_id);
        if (context) {
          await context.reportProgress({
            message: output.message,
            progress: output.progress,
            total: 100,
          });
        }
        return;
      }
    } else if (output.success) {
      // Job completado exitosamente
      await this.jobPersistence.updateJob(output.job_id, {
        result: output.data,
        progress: 100,
        status: 'SUCCESS',
      });
      const context = this.contextService.getContext(output.job_id);
      if (context) {
        await context.reportProgress({
          message: output.message,
          progress: 100,
          total: 100,
        });
      }
      return;
    } else {
      // Job falló
      await this.jobPersistence.updateJob(output.job_id, {
        status: 'FAILURE',
        progress: 100,
        message: output.message,
      });
      const context = this.contextService.getContext(output.job_id);
      if (context) {
        await context.reportProgress({
          message: output.message,
          progress: 100,
          total: 100,
        });
      }
      return;
    }

    // 9. ACK o NACK según resultado
    await msg.ack();
  }
}
