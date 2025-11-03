/**
 * Opciones de configuración para GCP (Google Cloud Platform)
 *
 * Define las configuraciones necesarias para conectarse a los servicios de GCP.
 * Todas estas propiedades se obtienen de variables de entorno y son validadas
 * en el GcpModule.
 */
export interface GcpOptions {
  /**
   * ID del proyecto de GCP
   * @example 'my-project-id', 'production-project-123'
   */
  projectId: string;

  /**
   * Nombre del Topic de Pub/Sub para publicar mensajes
   * @example 'events-topic', 'user-events'
   */
  topicName: string;

  /**
   * Nombre de la Subscription de Pub/Sub para consumir mensajes
   * @example 'events-subscription', 'user-events-sub'
   */
  subscriptionName: string;
}
