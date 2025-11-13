import { Injectable, Logger } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
  Message,
} from '@aws-sdk/client-sqs';
import { QueueConsumerPort } from 'src/packages/cloud-contracts/ports/queue-consumer.port';
import { AwsOptions } from '../types/aws-options.interface';

/**
 * Type para el handler de mensajes
 * Define la firma de la función que procesa cada mensaje de la cola
 */
interface MessageHandler {
  (msg: {
    id: string;
    data: Buffer;
    attrs: Record<string, string>;
    ack: () => Promise<void>;
    nack: () => Promise<void>;
  }): Promise<void> | void;
}

/**
 * AwsQueueConsumerAdapter - Implementación de QueueConsumerPort para AWS SQS
 *
 * Este adapter consume mensajes de AWS SQS (Simple Queue Service), un servicio
 * de colas de mensajes totalmente administrado.
 *
 * Características:
 * - Long polling (20 segundos) para reducir costos y mejorar latencia
 * - Procesamiento en paralelo de hasta 10 mensajes simultáneos
 * - ACK/NACK manual para control preciso del procesamiento
 * - Manejo automático de errores (NACK en caso de fallo)
 * - Reintentos automáticos de SQS para mensajes fallidos
 *
 * Flujo de procesamiento:
 * 1. onMessage() - Registrar handler
 * 2. start() - Iniciar polling de la cola
 * 3. poll() - Recibir mensajes (long polling 20s)
 * 4. processMessage() - Procesar cada mensaje
 * 5. ack()/nack() - Confirmar o rechazar mensaje
 * 6. stop() - Detener polling
 *
 * @see https://docs.aws.amazon.com/sqs/
 */
@Injectable()
export class AwsQueueConsumerAdapter implements QueueConsumerPort {
  private readonly logger = new Logger(AwsQueueConsumerAdapter.name);
  private readonly sqsClient: SQSClient; // Cliente AWS SQS
  private readonly queueUrl: string; // URL de la cola SQS
  private isRunning = false; // Estado del consumer
  private messageHandler?: MessageHandler; // Handler para procesar mensajes
  private pollingInterval?: NodeJS.Timeout; // Timer del polling

  /**
   * Constructor del adapter
   *
   * Inicializa el cliente SQS y valida que la URL de la cola esté presente.
   * La URL de la cola es requerida porque es la única forma de identificar
   * una cola en SQS.
   *
   * @param options - Configuración de AWS (región, queueUrl, etc.)
   * @throws Error si queueUrl no está definido
   */
  constructor(private readonly options: AwsOptions) {
    // Inicializar cliente SQS con la región
    this.sqsClient = new SQSClient({
      region: options.region,
      endpoint: process.env.AWS_ENDPOINT_URL,
    });

    // Validar que la URL de la cola esté presente
    if (!options.queueUrl) {
      throw new Error('queueUrl is required for SQS consumer');
    }

    this.queueUrl = options.queueUrl;
    this.logger.log(
      `Initialized SQS consumer - Region: ${options.region}, Queue: ${this.queueUrl}`,
    );
  }

  /**
   * Registra el handler que procesará los mensajes
   *
   * Debe llamarse antes de start(). Solo se permite un handler por consumer.
   *
   * @param subscription - Nombre de la suscripción (para logging)
   * @param handler - Función que procesa cada mensaje recibido
   */
  onMessage(subscription: string, handler: MessageHandler): void {
    this.messageHandler = handler;
    this.logger.log(`Message handler registered for: ${subscription}`);
  }

  /**
   * Inicia el consumidor de mensajes
   *
   * Proceso:
   * 1. Verifica que no esté ya corriendo
   * 2. Valida que haya un handler registrado
   * 3. Marca el consumer como activo
   * 4. Inicia el ciclo de polling
   *
   * El polling continuará hasta que se llame a stop()
   *
   * @throws Error si no hay handler registrado
   */
  async start(): Promise<void> {
    // Validar que no esté ya corriendo
    if (this.isRunning) {
      this.logger.warn('Consumer already running');
      return;
    }

    // Validar que haya un handler registrado
    if (!this.messageHandler) {
      throw new Error('No message handler registered. Call onMessage() first.');
    }

    // Marcar como activo e iniciar polling
    this.isRunning = true;
    this.logger.log('Starting SQS consumer...');

    // Iniciar el ciclo de polling
    this.poll();
  }

  /**
   * Detiene el consumidor de mensajes
   *
   * Proceso:
   * 1. Marca el consumer como inactivo
   * 2. Cancela el timer de polling
   * 3. Permite que terminen los mensajes en proceso
   *
   * Los mensajes que están siendo procesados terminarán su ejecución.
   */
  async stop(): Promise<void> {
    // Validar que esté corriendo
    if (!this.isRunning) {
      this.logger.warn('Consumer not running');
      return;
    }

    // Detener el polling
    this.isRunning = false;
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = undefined;
    }

    this.logger.log('SQS consumer stopped');
  }

  /**
   * Realiza el polling de la cola SQS
   *
   * Este método se ejecuta en un ciclo continuo mientras el consumer esté activo.
   * Usa long polling (20 segundos) para reducir costos y mejorar la latencia.
   *
   * Proceso:
   * 1. Verifica que el consumer esté activo
   * 2. Solicita mensajes a SQS (máximo 10, espera 20s)
   * 3. Procesa mensajes recibidos en paralelo
   * 4. Programa el siguiente polling
   *
   * Long polling: SQS esperará hasta 20 segundos por mensajes antes de retornar,
   * reduciendo peticiones vacías y costos.
   */
  private async poll(): Promise<void> {
    // Salir si el consumer fue detenido
    if (!this.isRunning) {
      return;
    }

    try {
      // Configurar el comando de recepción de mensajes
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 10, // Máximo de mensajes por request
        WaitTimeSeconds: 20, // Long polling: esperar hasta 20s por mensajes
        MessageAttributeNames: ['All'], // Recibir todos los atributos
        AttributeNames: ['All'], // Recibir todos los atributos del sistema
      });

      // Solicitar mensajes a SQS
      const response = await this.sqsClient.send(command);
      console.log('response', response);
      // Procesar mensajes si hay alguno
      if (response.Messages && response.Messages.length > 0) {
        this.logger.log(`Received ${response.Messages.length} message(s)`);
        
        // Procesar todos los mensajes en paralelo para mejor throughput
        await Promise.all(
          response.Messages.map((message) => this.handleSQSMessage(message)),
        );
      }
    } catch (error) {
      // Loggear errores pero continuar el polling
      this.logger.error(
        `Error polling SQS queue: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }

    // Programar el siguiente ciclo de polling
    // setTimeout(..., 0) permite que otros eventos se procesen antes
    if (this.isRunning) {
      this.pollingInterval = setTimeout(() => this.poll(), 0);
    }
  }

  /**
   * Maneja un mensaje individual de SQS
   *
   * Este método prepara el mensaje y lo pasa al handler registrado por el usuario.
   * El handler decide si hacer ACK (eliminar) o NACK (devolver a la cola).
   *
   * Proceso:
   * 1. Validar que haya handler y que el mensaje tenga ID y ReceiptHandle
   * 2. Convertir el body del mensaje a Buffer
   * 3. Extraer atributos del mensaje
   * 4. Crear funciones ack/nack para el handler
   * 5. Llamar al handler del usuario
   * 6. Si hay error, hacer NACK automático
   *
   * NACK automático: Si el handler lanza error, el mensaje se hace visible
   * inmediatamente para que SQS lo reintente según su configuración.
   *
   * @param message - Mensaje de SQS a procesar
   */
  private async handleSQSMessage(message: Message): Promise<void> {
    // Validar que tengamos lo necesario para procesar
    if (!this.messageHandler || !message.MessageId || !message.ReceiptHandle) {
      return;
    }

    const messageId = message.MessageId;
    const receiptHandle = message.ReceiptHandle;

    try {
      // Paso 1: Convertir el body del mensaje a Buffer
      const data = Buffer.from(message.Body || '', 'utf-8');

      // Paso 2: Extraer atributos del mensaje (metadata)
      const attrs: Record<string, string> = {};
      if (message.MessageAttributes) {
        for (const [key, value] of Object.entries(message.MessageAttributes)) {
          if (value.StringValue) {
            attrs[key] = value.StringValue;
          }
        }
      }

      // Paso 3: Crear funciones ack/nack para el handler
      // ACK: Elimina el mensaje de la cola (procesamiento exitoso)
      const ack = async () => {
        await this.deleteMessage(receiptHandle);
      };

      // NACK: Hace el mensaje visible inmediatamente (procesamiento fallido)
      const nack = async () => {
        await this.changeVisibility(receiptHandle, 0);
      };

      // Paso 4: Llamar al handler del usuario con el mensaje preparado
      const detail = JSON.parse(data.toString('utf-8')).detail;
      await this.messageHandler({
        id: messageId,
        data: detail,
        attrs,
        ack,
        nack,
      });
    } catch (error) {
      // Loggear el error
      this.logger.error(
        `Error processing message ${messageId}: ${(error as Error).message}`,
        (error as Error).stack,
      );

      // NACK automático: devolver el mensaje a la cola para reintento
      await this.changeVisibility(receiptHandle, 0);
    }
  }

  /**
   * Elimina un mensaje de la cola SQS (ACK)
   *
   * Cuando un mensaje se elimina, se considera procesado exitosamente
   * y no volverá a ser entregado.
   *
   * Este método es llamado por la función ack() que se pasa al handler.
   *
   * @param receiptHandle - Handle único del mensaje para eliminarlo
   */
  private async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      });
      await this.sqsClient.send(command);
      this.logger.debug('Message deleted successfully');
    } catch (error) {
      this.logger.error(
        `Error deleting message: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Cambia la visibilidad de un mensaje en la cola (usado para NACK)
   *
   * Cuando se cambia el visibility timeout a 0, el mensaje se hace
   * visible inmediatamente en la cola para que pueda ser procesado
   * de nuevo (reintento).
   *
   * SQS tiene un límite de reintentos configurado en la cola, después
   * del cual el mensaje puede ir a una Dead Letter Queue (DLQ).
   *
   * Este método es llamado por la función nack() que se pasa al handler,
   * y también automáticamente si el handler lanza un error.
   *
   * @param receiptHandle - Handle único del mensaje
   * @param visibilityTimeout - Segundos hasta que el mensaje sea visible (0 = inmediato)
   */
  private async changeVisibility(
    receiptHandle: string,
    visibilityTimeout: number,
  ): Promise<void> {
    try {
      const command = new ChangeMessageVisibilityCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: visibilityTimeout,
      });
      await this.sqsClient.send(command);
      this.logger.debug(`Message visibility changed to ${visibilityTimeout}s`);
    } catch (error) {
      this.logger.error(
        `Error changing message visibility: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
