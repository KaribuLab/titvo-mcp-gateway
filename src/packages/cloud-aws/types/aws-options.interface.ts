/**
 * Opciones de configuración para AWS
 *
 * Define las configuraciones necesarias para conectarse a los servicios de AWS.
 * Todas estas propiedades se obtienen de variables de entorno y son validadas
 * en el AwsModule.
 */
export interface AwsOptions {
  /**
   * Región de AWS donde están los recursos
   * @example 'us-east-1', 'us-west-2', 'eu-west-1'
   */
  region: string;

  /**
   * Nombre del EventBus de AWS EventBridge
   * Si no se especifica, se usa 'default'
   * @example 'default', 'my-custom-event-bus'
   */
  eventBusName?: string;

  /**
   * URL completa de la cola SQS
   * @example 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue'
   */
  queueUrl?: string;

  /**
   * Nombre de la tabla de DynamoDB para mensajes
   * Si no se especifica, se usa 'jobs'
   * @example 'jobs', 'my-jobs-table'
   */
  jobTableName?: string;

  /**
   * Nombre del bucket S3 para archivos
   * @example 'tvo-mcp-git-commit-files-input-local'
   */
  s3BucketName?: string;
}
