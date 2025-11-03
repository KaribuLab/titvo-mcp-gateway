import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JOB_PERSISTENCE,
  PUBLISH_EVENT,
  QUEUE_CONSUMER,
} from '../../cloud-contracts/constants/injection-tokens';
import { JobPersistencePort } from '../../cloud-contracts/ports/job-persistence.port';
import { PublishEventPort } from '../../cloud-contracts/ports/publish-event.port';
import { QueueConsumerPort } from '../../cloud-contracts/ports/queue-consumer.port';
import {
  validateRequiredEnvVars,
  validateUrl,
} from '../../../infrastructure/cloud/utils/config-validator.util';
import { AwsOptions } from '../types/aws-options.interface';
import { AwsJobPersistenceAdapter } from '../adapters/job-persistence.adapter';
import { AwsPublishEventAdapter } from '../adapters/publish-event.adapter';
import { AwsQueueConsumerAdapter } from '../adapters/queue-consumer.adapter';

/**
 * AwsModule - Módulo de integración con AWS
 *
 * Este módulo provee implementaciones de los ports usando servicios de AWS:
 * - PUBLISH_EVENT → AWS EventBridge (publicación de eventos)
 * - QUEUE_CONSUMER → AWS SQS (consumo de colas)
 *
 * Variables de entorno requeridas:
 * - AWS_REGION: Región de AWS (ej: us-east-1)
 * - AWS_EVENTBUS_NAME: Nombre del EventBus (o 'default')
 * - AWS_QUEUE_URL: URL completa de la cola SQS
 *
 * Credenciales AWS:
 * Se obtienen automáticamente via AWS SDK (CLI, variables de entorno, o IAM roles)
 */
@Module({})
export class AwsModule {
  /**
   * Registro asíncrono del módulo
   *
   * Usa registerAsync() en lugar de register() porque necesita acceso
   * al ConfigService para leer y validar variables de entorno.
   *
   * Proceso:
   * 1. Lee y valida variables de entorno (AWS_REGION, AWS_EVENTBUS_NAME, AWS_QUEUE_URL)
   * 2. Crea provider de configuración (AWS_OPTIONS)
   * 3. Crea adapters para EventBridge y SQS usando la configuración
   * 4. Exporta los tokens PUBLISH_EVENT y QUEUE_CONSUMER
   */
  static registerAsync(): DynamicModule {
    /**
     * Provider de configuración AWS
     *
     * Lee variables de entorno y las valida antes de crear los adapters.
     * Lanza error si falta alguna variable requerida o si el formato es inválido.
     */
    const configProvider: Provider = {
      provide: 'AWS_OPTIONS',
      useFactory: (configService: ConfigService): AwsOptions => {
        // Paso 1: Validar que todas las variables requeridas estén presentes
        const envVars = validateRequiredEnvVars(
          configService,
          ['AWS_REGION', 'AWS_EVENTBUS_NAME', 'AWS_QUEUE_URL', 'AWS_DYNAMODB_TABLE_NAME'],
          'AWS',
        );

        // Paso 2: Validar formato específico (URL válida para SQS)
        validateUrl(envVars.AWS_QUEUE_URL, 'AWS_QUEUE_URL');

        // Paso 3: Retornar configuración validada
        return {
          region: envVars.AWS_REGION,
          eventBusName: envVars.AWS_EVENTBUS_NAME,
          queueUrl: envVars.AWS_QUEUE_URL,
          jobTableName: envVars.AWS_DYNAMODB_TABLE_NAME,
        };
      },
      inject: [ConfigService],
    };

    /**
     * Provider de publicación de eventos (EventBridge)
     *
     * Crea una instancia del adapter que publica eventos a AWS EventBridge.
     */
    const publishEventProvider: Provider = {
      provide: PUBLISH_EVENT,
      useFactory: (options: AwsOptions): PublishEventPort =>
        new AwsPublishEventAdapter(options),
      inject: ['AWS_OPTIONS'],
    };

    /**
     * Provider de consumo de colas (SQS)
     *
     * Crea una instancia del adapter que consume mensajes de AWS SQS.
     */
    const consumerQueueProvider: Provider = {
      provide: QUEUE_CONSUMER,
      useFactory: (options: AwsOptions): QueueConsumerPort =>
        new AwsQueueConsumerAdapter(options),
      inject: ['AWS_OPTIONS'],
    };

    /**
     * Provider de persistencia de mensajes (DynamoDB)
     *
     * Crea una instancia del adapter que persiste mensajes en DynamoDB.
     */
    const jobPersistenceProvider: Provider = {
      provide: JOB_PERSISTENCE,
      useFactory: (options: AwsOptions): JobPersistencePort =>
        new AwsJobPersistenceAdapter(options),
      inject: ['AWS_OPTIONS'],
    };

    // Retornar módulo dinámico con todos los providers
    return {
      module: AwsModule,
      providers: [
        configProvider,
        publishEventProvider,
        consumerQueueProvider,
        jobPersistenceProvider,
      ],
      exports: [PUBLISH_EVENT, QUEUE_CONSUMER, JOB_PERSISTENCE], // Exportar para inyección en otros módulos
    };
  }
}
