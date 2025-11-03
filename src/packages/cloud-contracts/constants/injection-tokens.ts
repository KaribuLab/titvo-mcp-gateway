/**
 * Tokens de Inyección de Dependencias (DI)
 *
 * Estos Symbols se usan como tokens de inyección para los servicios de cloud.
 * Al usar Symbols en lugar de strings, garantizamos que no haya colisiones
 * de nombres y mantenemos type-safety.
 *
 * Todos los providers (AWS, GCP, Azure) deben proveer implementaciones
 * para estos tokens.
 */

/**
 * Token para el servicio de publicación de eventos
 * Implementado por: AwsPublishEventAdapter (AWS EventBridge)
 * Futuro: GcpPublishEventAdapter (GCP Pub/Sub), etc.
 */
export const PUBLISH_EVENT = Symbol('PUBLISH_EVENT');

/**
 * Token para el servicio de consumo de colas
 * Implementado por: AwsQueueConsumerAdapter (AWS SQS)
 * Futuro: GcpQueueConsumerAdapter (GCP Pub/Sub), etc.
 */
export const QUEUE_CONSUMER = Symbol('QUEUE_CONSUMER');

/**
 * Token para el servicio de persistencia de mensajes
 * Implementado por: LocalJobPersistenceAdapter (Redis)
 * Futuro: AwsJobPersistenceAdapter (DynamoDB), GcpJobPersistenceAdapter (Firestore), etc.
 */
export const JOB_PERSISTENCE = Symbol('JOB_PERSISTENCE');
