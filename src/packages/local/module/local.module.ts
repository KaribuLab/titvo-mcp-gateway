import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JOB_PERSISTENCE,
  PUBLISH_EVENT,
  QUEUE_CONSUMER,
} from 'src/packages/cloud-contracts/constants/injection-tokens';
import { JobPersistencePort } from 'src/packages/cloud-contracts/ports/job-persistence.port';
import { PublishEventPort } from 'src/packages/cloud-contracts/ports/publish-event.port';
import { QueueConsumerPort } from 'src/packages/cloud-contracts/ports/queue-consumer.port';
import { validateRequiredEnvVars } from '../../../infrastructure/cloud/utils/config-validator.util';
import { LocalJobPersistenceAdapter } from '../adapters/job-persistence.adapter';
import { LocalOptions } from '../types/local-options.interface';
import { LocalPublishEventAdapter } from '../adapters/publish-event.adapter';
import { LocalQueueConsumerAdapter } from '../adapters/queue-consumer.adapter';

/**
 * LocalModule - Módulo para desarrollo local usando BullMQ + Redis
 *
 * Este módulo provee implementaciones de los ports usando BullMQ (Redis):
 * - PUBLISH_EVENT → BullMQ Queue.add() (publicación de jobs)
 * - QUEUE_CONSUMER → BullMQ Worker (procesamiento de jobs)
 *
 * Variables de entorno requeridas:
 * - REDIS_HOST: Host de Redis (ej: localhost)
 * - REDIS_PORT: Puerto de Redis (ej: 6379)
 * - LOCAL_QUEUE_NAME: Nombre de la cola para eventos
 * - LOCAL_RESULT_QUEUE_NAME: Nombre de la cola para resultados
 *
 * Variables opcionales:
 * - REDIS_PASSWORD: Password de Redis
 * - REDIS_DB: Base de datos de Redis (default: 0)
 *
 * Ideal para:
 * - Desarrollo local sin infraestructura cloud
 * - Testing e integración continua
 * - Ambientes donde no se necesita escalar horizontalmente
 *
 * Requisitos:
 * - Redis instalado y corriendo (puede ser via Docker)
 * - BullMQ y ioredis instalados (yarn add bullmq ioredis)
 *
 * @see https://docs.bullmq.io/
 */
@Module({})
export class LocalModule {
  /**
   * Registro asíncrono del módulo
   *
   * Usa registerAsync() para acceso al ConfigService y validar variables de entorno.
   *
   * Proceso:
   * 1. Lee y valida variables de entorno (REDIS_HOST, REDIS_PORT, etc.)
   * 2. Crea provider de configuración (LOCAL_OPTIONS)
   * 3. Crea adapters para BullMQ Queue y Worker usando la configuración
   * 4. Exporta los tokens PUBLISH_EVENT y QUEUE_CONSUMER
   */
  static registerAsync(): DynamicModule {
    /**
     * Provider de configuración LOCAL
     *
     * Lee variables de entorno y las valida antes de crear los adapters.
     * Lanza error si falta alguna variable requerida.
     */
    const configProvider: Provider = {
      provide: 'LOCAL_OPTIONS',
      useFactory: (configService: ConfigService): LocalOptions => {
        // Paso 1: Validar variables requeridas
        const envVars = validateRequiredEnvVars(
          configService,
          [
            'REDIS_HOST',
            'REDIS_PORT',
            'LOCAL_QUEUE_NAME',
            'LOCAL_RESULT_QUEUE_NAME',
          ],
          'LOCAL',
        );

        // Paso 2: Leer variables opcionales
        const redisPassword = configService.get<string>('REDIS_PASSWORD');
        const redisDb = configService.get<number>('REDIS_DB');

        // Paso 3: Retornar configuración validada
        return {
          redisHost: envVars.REDIS_HOST,
          redisPort: parseInt(envVars.REDIS_PORT, 10),
          queueName: envVars.LOCAL_QUEUE_NAME,
          resultQueueName: envVars.LOCAL_RESULT_QUEUE_NAME,
          redisPassword,
          redisDb,
        };
      },
      inject: [ConfigService],
    };

    /**
     * Provider de persistencia de mensajes (Redis)
     *
     * Crea una instancia del adapter de persistencia para almacenar
     * mensajes en Redis usando la misma conexión que BullMQ.
     */
    const jobPersistenceProvider: Provider = {
      provide: JOB_PERSISTENCE,
      useFactory: (options: LocalOptions): JobPersistencePort =>
        new LocalJobPersistenceAdapter(options),
      inject: ['LOCAL_OPTIONS'],
    };

    /**
     * Provider de publicación de eventos (BullMQ Queue)
     *
     * Crea una instancia del adapter que publica jobs a una Queue de BullMQ.
     */
    const publishEventProvider: Provider = {
      provide: PUBLISH_EVENT,
      useFactory: (options: LocalOptions): PublishEventPort =>
        new LocalPublishEventAdapter(options),
      inject: ['LOCAL_OPTIONS'],
    };

    /**
     * Provider de consumo de colas (BullMQ Worker)
     *
     * Crea una instancia del adapter que procesa jobs de una Queue.
     */
    const consumerQueueProvider: Provider = {
      provide: QUEUE_CONSUMER,
      useFactory: (options: LocalOptions): QueueConsumerPort =>
        new LocalQueueConsumerAdapter(options),
      inject: ['LOCAL_OPTIONS'],
    };

    // Retornar módulo dinámico con todos los providers
    return {
      module: LocalModule,
      providers: [
        configProvider,
        jobPersistenceProvider,
        publishEventProvider,
        consumerQueueProvider,
      ],
      exports: [PUBLISH_EVENT, QUEUE_CONSUMER, JOB_PERSISTENCE],
    };
  }
}
