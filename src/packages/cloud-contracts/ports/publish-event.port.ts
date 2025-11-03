import { InvokeOutputDto } from '../../../core/invocations/dto/invoke-output.dto';

/**
 * Port para publicación de eventos (Hexagonal Architecture)
 *
 * Define el contrato que deben cumplir todos los adaptadores de publicación
 * de eventos, independientemente del provider de cloud.
 *
 * Implementaciones:
 * - AwsPublishEventAdapter: Publica a AWS EventBridge
 * - Futuro: GcpPublishEventAdapter, AzurePublishEventAdapter
 *
 * @example
 * // Inyectar en un servicio:
 * constructor(@Inject(PUBLISH_EVENT) private publishEvent: PublishEventPort) {}
 *
 * // Publicar evento:
 * await this.publishEvent.publish('user.created', { userId: '123' });
 */
export interface PublishEventPort {
  /**
   * Publica un evento al sistema de mensajería
   *
   * @param topic - Tipo de evento o tópico (ej: 'user.created', 'order.placed')
   * @param payload - Datos del evento (se serializará a JSON)
   * @param attrs - Atributos opcionales del evento (metadata)
   * @returns ID del evento publicado
   *
   * @example
   * const eventId = await publishEvent.publish(
   *   'user.created',
   *   { userId: '123', email: 'user@example.com' },
   *   { source: 'user-service', version: '1.0' }
   * );
   */
  publish(
    topic: string,
    payload: any,
    attrs?: Record<string, string>,
  ): Promise<InvokeOutputDto>;
}
