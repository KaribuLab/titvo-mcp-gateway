/**
 * Enum de Providers de Cloud soportados
 *
 * Define los valores válidos para la variable de entorno CLOUD_PROVIDER.
 * Cada provider debe tener su propio módulo en /providers/
 *
 * @example
 * // En .env:
 * CLOUD_PROVIDER=aws
 */
export enum CloudProvider {
  /** Implementación local (BullMQ + Redis) - Implementado ✓ */
  LOCAL = 'local',

  /** Amazon Web Services (EventBridge + SQS) - Implementado ✓ */
  AWS = 'aws',

  /** Google Cloud Platform (Pub/Sub) - Implementado ✓ */
  GCP = 'gcp',

  /** Microsoft Azure (Service Bus) - Implementado ✓ */
  AZURE = 'azure',
}
