import { PubSub, Topic } from '@google-cloud/pubsub';
import { Injectable, Logger } from '@nestjs/common';
import { PublishEventPort } from 'src/packages/cloud-contracts/ports/publish-event.port';
import { InvokeInputFactory } from '../../../shared/helpers/invoke-input.factory';
import { MessageConverterHelper } from '../../../shared/helpers/message-converter.helper';
import { InvokeOutputDto } from '../../../core/invocations/dto/invoke-output.dto';
import { GcpOptions } from '../types/gcp-options.interface';

/**
 * GcpPublishEventAdapter - Implementación de PublishEventPort para GCP Pub/Sub
 *
 * Este adapter publica eventos a GCP Pub/Sub, un servicio de mensajería
 * asíncrono que permite la comunicación entre aplicaciones independientes.
 *
 * Características:
 * - Publica mensajes a un Topic específico de Pub/Sub
 * - Serializa el payload a JSON automáticamente
 * - Soporta atributos/metadata en los mensajes
 * - Manejo robusto de errores con logging detallado
 * - Los suscriptores pueden recibir los mensajes de forma push o pull
 *
 * @see https://cloud.google.com/pubsub/docs
 */
@Injectable()
export class GcpPublishEventAdapter implements PublishEventPort {
  private readonly logger = new Logger(GcpPublishEventAdapter.name);
  private readonly pubSubClient: PubSub;
  private readonly topic: Topic;
  private readonly topicName: string;

  /**
   * Constructor del adapter
   *
   * Inicializa el cliente de Pub/Sub y obtiene referencia al Topic.
   * Las credenciales se obtienen automáticamente de:
   * - Variable GOOGLE_APPLICATION_CREDENTIALS
   * - Application Default Credentials (en GCP)
   * - Service Account Keys
   *
   * @param options - Configuración de GCP (projectId, topicName, etc.)
   */
  constructor(private readonly options: GcpOptions) {
    // Inicializar cliente de Pub/Sub con el proyecto
    this.pubSubClient = new PubSub({
      projectId: options.projectId,
    });

    // Obtener referencia al topic
    this.topicName = options.topicName;
    this.topic = this.pubSubClient.topic(this.topicName);

    this.logger.log(
      `Initialized Pub/Sub publisher - Project: ${options.projectId}, Topic: ${this.topicName}`,
    );
  }

  /**
   * Publica un evento a GCP Pub/Sub
   *
   * Proceso:
   * 1. Serializa el payload a JSON
   * 2. Convierte el JSON a Buffer
   * 3. Agrega atributos al mensaje si se proporcionan
   * 4. Publica el mensaje al topic
   * 5. Retorna el ID del mensaje publicado
   *
   * Los atributos se usan para routing, filtrado y metadata.
   * Se agrega automáticamente el atributo 'eventType' con el topic.
   *
   * @param topic - Tipo de evento (se guarda como atributo 'eventType')
   * @param payload - Datos del evento (se serializan a JSON)
   * @param attrs - Atributos opcionales (metadata, para filtrado)
   * @returns ID del mensaje publicado en Pub/Sub
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
        MessageConverterHelper.convertToMessage(input),
      );

      // Paso 2: Convertir a Buffer (requerido por Pub/Sub)
      const dataBuffer = Buffer.from(jsonPayload, 'utf-8');

      // Paso 3: Preparar atributos del mensaje
      const attributes: Record<string, string> = {
        eventType: topic, // Tipo de evento como atributo principal
        source: 'mcp-gateway', // Fuente del mensaje
        timestamp: new Date().toISOString(), // Timestamp de publicación
        ...attrs, // Atributos adicionales del usuario
      };

      // Paso 4: Publicar el mensaje al topic
      // publish() retorna una Promise con el messageId
      const messageId = await this.topic.publishMessage({
        data: dataBuffer,
        attributes,
      });

      // Paso 5: Loggear éxito y retornar messageId
      this.logger.log(
        `Message published successfully - ID: ${messageId}, EventType: ${topic}`,
      );

      return new InvokeOutputDto(input.jobId);
    } catch (error) {
      // Manejo de errores: loggear y re-lanzar
      const err = error as Error;
      this.logger.error(
        `Error publishing message to Pub/Sub: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Limpia recursos al destruir el adapter
   *
   * Cierra la conexión con el topic para liberar recursos.
   * Debería llamarse al destruir la aplicación.
   */
  async onModuleDestroy() {
    await this.topic.flush();
    this.logger.log('Pub/Sub publisher closed');
  }
}
