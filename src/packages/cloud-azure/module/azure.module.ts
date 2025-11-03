import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PUBLISH_EVENT,
  QUEUE_CONSUMER,
} from 'src/packages/cloud-contracts/constants/injection-tokens';
import { PublishEventPort } from 'src/packages/cloud-contracts/ports/publish-event.port';
import { QueueConsumerPort } from 'src/packages/cloud-contracts/ports/queue-consumer.port';
import { validateRequiredEnvVars } from '../../../infrastructure/cloud/utils/config-validator.util';
import { AzureOptions } from '../types/azure-options.interface';
import { AzurePublishEventAdapter } from '../adapters/publish-event.adapter';
import { AzureQueueConsumerAdapter } from '../adapters/queue-consumer.adapter';

/**
 * AzureModule - Módulo de integración con Azure
 *
 * Este módulo provee implementaciones de los ports usando Azure Service Bus:
 * - PUBLISH_EVENT → Service Bus Topic Sender (publicación de mensajes)
 * - QUEUE_CONSUMER → Service Bus Queue Receiver (consumo de mensajes)
 *
 * Variables de entorno requeridas:
 * - AZURE_SERVICE_BUS_CONNECTION_STRING: Connection string de Service Bus
 * - AZURE_TOPIC_NAME: Nombre del Topic de Service Bus
 * - AZURE_QUEUE_NAME: Nombre de la Queue de Service Bus
 *
 * Credenciales Azure:
 * El connection string incluye:
 * - Endpoint: URL del namespace de Service Bus
 * - SharedAccessKeyName: Nombre de la política de acceso
 * - SharedAccessKey: Clave de acceso
 *
 * Se obtiene desde Azure Portal:
 * Service Bus Namespace → Shared access policies → Policy → Connection string
 *
 * @see https://learn.microsoft.com/azure/service-bus-messaging/
 */
@Module({})
export class AzureModule {
  /**
   * Registro asíncrono del módulo
   *
   * Usa registerAsync() para acceso al ConfigService y validar variables de entorno.
   *
   * Proceso:
   * 1. Lee y valida variables de entorno (connection string, topic, queue)
   * 2. Crea provider de configuración (AZURE_OPTIONS)
   * 3. Crea adapters para Service Bus Sender y Receiver usando la configuración
   * 4. Exporta los tokens PUBLISH_EVENT y QUEUE_CONSUMER
   */
  static registerAsync(): DynamicModule {
    /**
     * Provider de configuración Azure
     *
     * Lee variables de entorno y las valida antes de crear los adapters.
     * Lanza error si falta alguna variable requerida.
     */
    const configProvider: Provider = {
      provide: 'AZURE_OPTIONS',
      useFactory: (configService: ConfigService): AzureOptions => {
        // Paso 1: Validar que todas las variables requeridas estén presentes
        const envVars = validateRequiredEnvVars(
          configService,
          [
            'AZURE_SERVICE_BUS_CONNECTION_STRING',
            'AZURE_TOPIC_NAME',
            'AZURE_QUEUE_NAME',
          ],
          'Azure',
        );

        // Paso 2: Retornar configuración validada
        return {
          connectionString: envVars.AZURE_SERVICE_BUS_CONNECTION_STRING,
          topicName: envVars.AZURE_TOPIC_NAME,
          queueName: envVars.AZURE_QUEUE_NAME,
        };
      },
      inject: [ConfigService],
    };

    /**
     * Provider de publicación de mensajes (Service Bus Sender)
     *
     * Crea una instancia del adapter que publica mensajes a un Topic.
     */
    const publishEventProvider: Provider = {
      provide: PUBLISH_EVENT,
      useFactory: (options: AzureOptions): PublishEventPort =>
        new AzurePublishEventAdapter(options),
      inject: ['AZURE_OPTIONS'],
    };

    /**
     * Provider de consumo de mensajes (Service Bus Receiver)
     *
     * Crea una instancia del adapter que consume mensajes de una Queue.
     */
    const consumerQueueProvider: Provider = {
      provide: QUEUE_CONSUMER,
      useFactory: (options: AzureOptions): QueueConsumerPort =>
        new AzureQueueConsumerAdapter(options),
      inject: ['AZURE_OPTIONS'],
    };

    // Retornar módulo dinámico con todos los providers
    return {
      module: AzureModule,
      providers: [configProvider, publishEventProvider, consumerQueueProvider],
      exports: [PUBLISH_EVENT, QUEUE_CONSUMER], // Exportar para inyección en otros módulos
    };
  }
}
