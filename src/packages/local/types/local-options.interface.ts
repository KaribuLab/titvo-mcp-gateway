/**
 * Opciones de configuración para ambiente LOCAL
 *
 * Define las configuraciones necesarias para conectarse a Redis usando BullMQ.
 * Todas estas propiedades se obtienen de variables de entorno y son validadas
 * en el LocalModule.
 */
export interface LocalOptions {
  /**
   * Host de Redis
   * @example 'localhost', '127.0.0.1', 'redis.local'
   */
  redisHost: string;

  /**
   * Puerto de Redis
   * @example 6379
   */
  redisPort: number;

  /**
   * Nombre de la cola/queue para eventos
   * @example 'events-queue', 'local-events'
   */
  queueName: string;

  /**
   * Nombre de la cola/queue para resultados
   * @example 'results-queue', 'local-results'
   */
  resultQueueName: string;

  /**
   * Password de Redis (opcional)
   * @example 'mypassword'
   */
  redisPassword?: string;

  /**
   * Base de datos de Redis (opcional, default: 0)
   * @example 0, 1, 2
   */
  redisDb?: number;
}
