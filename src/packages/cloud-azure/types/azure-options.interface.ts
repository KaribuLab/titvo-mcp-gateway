/**
 * Opciones de configuración para Azure
 *
 * Define las configuraciones necesarias para conectarse a Azure Service Bus.
 * Todas estas propiedades se obtienen de variables de entorno y son validadas
 * en el AzureModule.
 */
export interface AzureOptions {
  /**
   * Connection String de Azure Service Bus
   * Contiene endpoint, SharedAccessKeyName y SharedAccessKey
   * @example 'Endpoint=sb://my-namespace.servicebus.windows.net/;SharedAccessKeyName=...'
   */
  connectionString: string;

  /**
   * Nombre del Topic de Service Bus para publicar mensajes
   * @example 'events-topic', 'user-events'
   */
  topicName: string;

  /**
   * Nombre de la Queue de Service Bus para consumir mensajes
   * @example 'results-queue', 'processing-queue'
   */
  queueName: string;
}
