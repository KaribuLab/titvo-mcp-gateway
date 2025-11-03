/**
 * Port para consumo de colas de mensajes (Hexagonal Architecture)
 *
 * Define el contrato que deben cumplir todos los adaptadores de consumo
 * de mensajes, independientemente del provider de cloud.
 *
 * Implementaciones:
 * - AwsQueueConsumerAdapter: Consume de AWS SQS
 * - Futuro: GcpQueueConsumerAdapter, AzureQueueConsumerAdapter
 *
 * @example
 * // Inyectar en un servicio:
 * constructor(@Inject(QUEUE_CONSUMER) private consumer: QueueConsumerPort) {}
 *
 * // Registrar handler y consumir:
 * this.consumer.onMessage('my-queue', async (msg) => {
 *   console.log(msg.data.toString());
 *   await msg.ack();
 * });
 * await this.consumer.start();
 */
export interface QueueConsumerPort {
  /**
   * Registra un handler para procesar mensajes
   *
   * Debe llamarse antes de start(). Solo se permite un handler por consumidor.
   *
   * @param subscription - Nombre de la suscripción o cola
   * @param handler - Función que procesa cada mensaje
   *
   * El handler recibe un objeto con:
   * - id: ID único del mensaje
   * - data: Contenido del mensaje como Buffer
   * - attrs: Atributos/metadata del mensaje
   * - ack(): Confirma que el mensaje fue procesado exitosamente
   * - nack(): Rechaza el mensaje (volverá a la cola)
   *
   * @example
   * consumer.onMessage('orders', async (msg) => {
   *   try {
   *     const order = JSON.parse(msg.data.toString());
   *     await processOrder(order);
   *     await msg.ack(); // Confirmar procesamiento
   *   } catch (error) {
   *     await msg.nack(); // Rechazar para reintentar
   *   }
   * });
   */
  onMessage(
    subscription: string,
    handler: (msg: {
      id: string;
      data: Buffer;
      attrs: Record<string, string>;
      ack: () => Promise<void>;
      nack: () => Promise<void>;
    }) => Promise<void> | void,
  ): void;

  /**
   * Inicia el consumidor de mensajes
   *
   * Proceso:
   * 1. Verifica que haya un handler registrado
   * 2. Comienza a hacer polling a la cola
   * 3. Procesa mensajes de forma continua
   *
   * @throws Error si no hay handler registrado
   *
   * @example
   * await consumer.start();
   * console.log('Consumer running...');
   */
  start(): Promise<void>;

  /**
   * Detiene el consumidor de mensajes
   *
   * Proceso:
   * 1. Detiene el polling de la cola
   * 2. Espera a que terminen los mensajes en proceso
   * 3. Libera recursos
   *
   * @example
   * // En onModuleDestroy:
   * await consumer.stop();
   */
  stop(): Promise<void>;
}
