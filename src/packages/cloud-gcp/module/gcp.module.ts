import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PUBLISH_EVENT,
  QUEUE_CONSUMER,
} from 'src/packages/cloud-contracts/constants/injection-tokens';
import { PublishEventPort } from 'src/packages/cloud-contracts/ports/publish-event.port';
import { QueueConsumerPort } from 'src/packages/cloud-contracts/ports/queue-consumer.port';
import { validateRequiredEnvVars } from '../../../infrastructure/cloud/utils/config-validator.util';
import { GcpOptions } from '../types/gcp-options.interface';
import { GcpPublishEventAdapter } from '../adapters/publish-event.adapter';
import { GcpQueueConsumerAdapter } from '../adapters/queue-consumer.adapter';

/**
 * GcpModule - Módulo de integración con GCP (Google Cloud Platform)
 *
 * Este módulo provee implementaciones de los ports usando servicios de GCP:
 * - PUBLISH_EVENT → GCP Pub/Sub Topics (publicación de mensajes)
 * - QUEUE_CONSUMER → GCP Pub/Sub Subscriptions (consumo de mensajes)
 *
 * Variables de entorno requeridas:
 * - GCP_PROJECT_ID: ID del proyecto de GCP
 * - GCP_TOPIC_NAME: Nombre del Topic de Pub/Sub
 * - GCP_SUBSCRIPTION_NAME: Nombre de la Subscription de Pub/Sub
 *
 * Credenciales GCP:
 * Se obtienen automáticamente via:
 * - Variable GOOGLE_APPLICATION_CREDENTIALS (path a service account key)
 * - Application Default Credentials (cuando se ejecuta en GCP)
 * - gcloud auth application-default login (desarrollo local)
 *
 * @see https://cloud.google.com/docs/authentication/application-default-credentials
 */
@Module({})
export class GcpModule {
  /**
   * Registro asíncrono del módulo
   *
   * Usa registerAsync() en lugar de register() porque necesita acceso
   * al ConfigService para leer y validar variables de entorno.
   *
   * Proceso:
   * 1. Lee y valida variables de entorno (GCP_PROJECT_ID, GCP_TOPIC_NAME, GCP_SUBSCRIPTION_NAME)
   * 2. Crea provider de configuración (GCP_OPTIONS)
   * 3. Crea adapters para Pub/Sub Publisher y Subscriber usando la configuración
   * 4. Exporta los tokens PUBLISH_EVENT y QUEUE_CONSUMER
   */
  static registerAsync(): DynamicModule {
    /**
     * Provider de configuración GCP
     *
     * Lee variables de entorno y las valida antes de crear los adapters.
     * Lanza error si falta alguna variable requerida.
     */
    const configProvider: Provider = {
      provide: 'GCP_OPTIONS',
      useFactory: (configService: ConfigService): GcpOptions => {
        // Paso 1: Validar que todas las variables requeridas estén presentes
        const envVars = validateRequiredEnvVars(
          configService,
          ['GCP_PROJECT_ID', 'GCP_TOPIC_NAME', 'GCP_SUBSCRIPTION_NAME'],
          'GCP',
        );

        // Paso 2: Retornar configuración validada
        return {
          projectId: envVars.GCP_PROJECT_ID,
          topicName: envVars.GCP_TOPIC_NAME,
          subscriptionName: envVars.GCP_SUBSCRIPTION_NAME,
        };
      },
      inject: [ConfigService],
    };

    /**
     * Provider de publicación de mensajes (Pub/Sub Publisher)
     *
     * Crea una instancia del adapter que publica mensajes a un Topic de Pub/Sub.
     */
    const publishEventProvider: Provider = {
      provide: PUBLISH_EVENT,
      useFactory: (options: GcpOptions): PublishEventPort =>
        new GcpPublishEventAdapter(options),
      inject: ['GCP_OPTIONS'],
    };

    /**
     * Provider de consumo de mensajes (Pub/Sub Subscriber)
     *
     * Crea una instancia del adapter que consume mensajes de una Subscription.
     */
    const consumerQueueProvider: Provider = {
      provide: QUEUE_CONSUMER,
      useFactory: (options: GcpOptions): QueueConsumerPort =>
        new GcpQueueConsumerAdapter(options),
      inject: ['GCP_OPTIONS'],
    };

    // Retornar módulo dinámico con todos los providers
    return {
      module: GcpModule,
      providers: [configProvider, publishEventProvider, consumerQueueProvider],
      exports: [PUBLISH_EVENT, QUEUE_CONSUMER], // Exportar para inyección en otros módulos
    };
  }
}
