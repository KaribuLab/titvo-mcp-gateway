import {
  ServiceBusClient,
  ServiceBusMessage,
  ServiceBusSender,
} from '@azure/service-bus';
import { Injectable, Logger } from '@nestjs/common';
import { PublishEventPort } from 'src/packages/cloud-contracts/ports/publish-event.port';
import { InvokeInputFactory } from '../../../shared/helpers/invoke-input.factory';
import { CaseConversionHelper } from '../../../shared/helpers/case-conversion.helper';
import { InvokeOutputDto } from '../../../core/invocations/dto/invoke-output.dto';
import { AzureOptions } from '../types/azure-options.interface';

/**
 * AzurePublishEventAdapter - Implementación de PublishEventPort para Azure Service Bus
 *
 * Este adapter publica mensajes a Azure Service Bus Topics, un servicio de mensajería
 * empresarial totalmente administrado con soporte para colas y tópicos pub/sub.
 *
 * Características:
 * - Publica mensajes a un Topic específico de Service Bus
 * - Serializa el payload a JSON automáticamente
 * - Soporta propiedades/metadata en los mensajes
 * - Manejo robusto de errores con logging detallado
 * - Soporte para sesiones, transacciones y mensajes programados
 *
 * @see https://learn.microsoft.com/azure/service-bus-messaging/
 */
@Injectable()
export class AzurePublishEventAdapter implements PublishEventPort {
  private readonly logger = new Logger(AzurePublishEventAdapter.name);
  private readonly serviceBusClient: ServiceBusClient;
  private readonly sender: ServiceBusSender;
  private readonly topicName: string;

  /**
   * Constructor del adapter
   *
   * Inicializa el cliente de Service Bus y crea un sender para el Topic.
   * Las credenciales vienen en el connection string.
   *
   * Connection String incluye:
   * - Endpoint: URL del namespace de Service Bus
   * - SharedAccessKeyName: Nombre de la política de acceso
   * - SharedAccessKey: Clave de acceso
   *
   * @param options - Configuración de Azure (connectionString, topicName, etc.)
   */
  constructor(private readonly options: AzureOptions) {
    // Inicializar cliente de Service Bus
    this.serviceBusClient = new ServiceBusClient(options.connectionString);

    // Crear sender para el topic
    this.topicName = options.topicName;
    this.sender = this.serviceBusClient.createSender(this.topicName);

    this.logger.log(
      `Initialized Service Bus publisher - Topic: ${this.topicName}`,
    );
  }

  /**
   * Publica un mensaje a Azure Service Bus
   *
   * Proceso:
   * 1. Serializa el payload a JSON
   * 2. Crea un mensaje de Service Bus con body y properties
   * 3. Agrega propiedades personalizadas (applicationProperties)
   * 4. Envía el mensaje al topic
   * 5. Retorna el messageId
   *
   * Las propiedades (applicationProperties) se usan para filtrado en subscriptions.
   *
   * @param topic - Tipo de evento (se guarda como propiedad 'eventType')
   * @param payload - Datos del evento (se serializan a JSON en body)
   * @param attrs - Atributos opcionales (se guardan en applicationProperties)
   * @returns ID del mensaje publicado
   * @throws Error si la publicación falla
   *
   * @example
   * const messageId = await publishEvent.publish(
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
      // Paso 1: Serializar el payload a JSON
      const input = InvokeInputFactory.create(topic, payload);
      const jsonPayload = JSON.stringify(
        CaseConversionHelper.convertToSnakeCase(input),
      );

      // Paso 2: Crear mensaje de Service Bus
      const message: ServiceBusMessage = {
        body: jsonPayload, // Body como string JSON
        contentType: 'application/json', // Tipo de contenido
        applicationProperties: {
          // Propiedades personalizadas para filtrado
          eventType: topic,
          source: 'mcp-gateway',
          timestamp: new Date().toISOString(),
          ...attrs, // Atributos adicionales del usuario
        },
      };

      // Paso 3: Enviar el mensaje al topic
      await this.sender.sendMessages(message);

      // Service Bus no retorna messageId directamente en sendMessages
      // Generamos uno basado en timestamp para tracking
      const messageId = `${topic}-${Date.now()}`;

      // Paso 4: Loggear éxito y retornar messageId
      this.logger.log(
        `Message published successfully - Topic: ${this.topicName}, EventType: ${topic}`,
      );

      return new InvokeOutputDto(input.jobId);
    } catch (error) {
      // Manejo de errores: loggear y re-lanzar
      const err = error as Error;
      this.logger.error(
        `Error publishing message to Service Bus: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Limpia recursos al destruir el adapter
   *
   * Cierra el sender y el cliente de Service Bus.
   */
  async onModuleDestroy() {
    await this.sender.close();
    await this.serviceBusClient.close();
    this.logger.log('Service Bus publisher closed');
  }
}
