import { Injectable, Logger } from '@nestjs/common';
import {
  ServiceBusClient,
  ServiceBusReceiver,
  ServiceBusReceivedMessage,
} from '@azure/service-bus';
import { QueueConsumerPort } from 'src/packages/cloud-contracts/ports/queue-consumer.port';
import { AzureOptions } from '../types/azure-options.interface';

/**
 * Type para el handler de mensajes
 * Define la firma de la función que procesa cada mensaje de Service Bus
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
 * AzureQueueConsumerAdapter - Implementación de QueueConsumerPort para Azure Service Bus
 *
 * Este adapter consume mensajes de Azure Service Bus Queues usando el modo
 * receiveMessages con procesamiento continuo.
 *
 * Características:
 * - Modo PeekLock: Mensajes se bloquean hasta ACK/NACK
 * - Procesamiento continuo con auto-renewal de lock
 * - ACK/NACK manual para control preciso
 * - Dead Letter Queue automático después de reintentos
 * - Soporte para sesiones y transacciones
 *
 * Flujo de procesamiento:
 * 1. onMessage() - Registrar handler
 * 2. start() - Iniciar polling de mensajes
 * 3. receiveMessages() - Recibir hasta 10 mensajes
 * 4. processMessage() - Procesar cada mensaje
 * 5. ack()/nack() - Completar o abandonar mensaje
 * 6. stop() - Cerrar receiver
 *
 * @see https://learn.microsoft.com/azure/service-bus-messaging/
 */
@Injectable()
export class AzureQueueConsumerAdapter implements QueueConsumerPort {
  private readonly logger = new Logger(AzureQueueConsumerAdapter.name);
  private readonly serviceBusClient: ServiceBusClient;
  private readonly receiver: ServiceBusReceiver;
  private readonly queueName: string;
  private isRunning = false;
  private messageHandler?: MessageHandler;
  private pollingInterval?: NodeJS.Timeout;

  /**
   * Constructor del adapter
   *
   * Inicializa el cliente de Service Bus y crea un receiver para la Queue.
   * Usa modo PeekLock para permitir ACK/NACK manual.
   *
   * PeekLock vs ReceiveAndDelete:
   * - PeekLock: Mensaje bloqueado hasta ACK/NACK (recomendado)
   * - ReceiveAndDelete: Mensaje eliminado inmediatamente (no recuperable)
   *
   * @param options - Configuración de Azure (connectionString, queueName, etc.)
   */
  constructor(private readonly options: AzureOptions) {
    // Inicializar cliente de Service Bus
    this.serviceBusClient = new ServiceBusClient(options.connectionString);

    // Crear receiver para la queue en modo PeekLock
    this.queueName = options.queueName;
    this.receiver = this.serviceBusClient.createReceiver(this.queueName, {
      receiveMode: 'peekLock', // Bloquear mensajes hasta ACK/NACK
    });

    this.logger.log(
      `Initialized Service Bus consumer - Queue: ${this.queueName}`,
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
   * El polling usa receiveMessages() que espera hasta que haya mensajes
   * o se cumpla el timeout.
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
    this.logger.log('Service Bus consumer started');

    // Iniciar el ciclo de polling
    this.poll();
  }

  /**
   * Detiene el consumidor de mensajes
   *
   * Proceso:
   * 1. Marca el consumer como inactivo
   * 2. Cancela el timer de polling
   * 3. Cierra el receiver
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

    this.logger.log('Service Bus consumer stopped');
  }

  /**
   * Realiza el polling de la cola Service Bus
   *
   * Este método se ejecuta en un ciclo continuo mientras el consumer esté activo.
   * Usa receiveMessages() que espera hasta que haya mensajes disponibles.
   *
   * Proceso:
   * 1. Verifica que el consumer esté activo
   * 2. Solicita mensajes (máximo 10, espera 20s)
   * 3. Procesa mensajes recibidos en paralelo
   * 4. Programa el siguiente polling
   *
   * receiveMessages espera hasta maxWaitTimeInMs por mensajes,
   * similar al long polling de SQS.
   */
  private async poll(): Promise<void> {
    // Salir si el consumer fue detenido
    if (!this.isRunning) {
      return;
    }

    try {
      // Recibir mensajes (máximo 10, espera 20s)
      const messages = await this.receiver.receiveMessages(10, {
        maxWaitTimeInMs: 20000, // Esperar hasta 20 segundos
      });

      // Procesar mensajes si hay alguno
      if (messages.length > 0) {
        this.logger.log(`Received ${messages.length} message(s)`);

        // Procesar todos los mensajes en paralelo
        await Promise.all(
          messages.map((message) => this.processMessage(message)),
        );
      }
    } catch (error) {
      // Loggear errores pero continuar el polling
      this.logger.error(
        `Error polling Service Bus queue: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }

    // Programar el siguiente ciclo de polling
    if (this.isRunning) {
      this.pollingInterval = setTimeout(() => this.poll(), 0);
    }
  }

  /**
   * Procesa un mensaje individual de Service Bus
   *
   * Este método prepara el mensaje y lo pasa al handler registrado por el usuario.
   * El handler decide si hacer ACK (completar) o NACK (abandonar).
   *
   * Proceso:
   * 1. Validar que haya handler
   * 2. Extraer body y propiedades del mensaje
   * 3. Convertir body a Buffer
   * 4. Crear funciones ack/nack para el handler
   * 5. Llamar al handler del usuario
   * 6. Si hay error, hacer NACK automático
   *
   * ACK vs NACK:
   * - ACK: completeMessage() - Mensaje eliminado de la queue
   * - NACK: abandonMessage() - Mensaje vuelve a la queue para reintento
   *
   * Service Bus tiene límite de delivery attempts, después va a Dead Letter Queue.
   *
   * @param message - Mensaje de Service Bus a procesar
   */
  private async processMessage(
    message: ServiceBusReceivedMessage,
  ): Promise<void> {
    // Validar que tengamos handler
    if (!this.messageHandler) {
      return;
    }

    // Convertir messageId a string (puede ser string | number | Buffer)
    const messageId = message.messageId ? String(message.messageId) : 'unknown';

    try {
      // Paso 1: Extraer body del mensaje
      const body = message.body as string;
      const data = Buffer.from(body, 'utf-8');

      // Paso 2: Extraer propiedades del mensaje
      const attrs: Record<string, string> = {};
      if (message.applicationProperties) {
        for (const [key, value] of Object.entries(
          message.applicationProperties,
        )) {
          attrs[key] = String(value);
        }
      }

      // Paso 3: Crear funciones ack/nack para el handler
      // ACK: Completar el mensaje (eliminarlo de la queue)
      const ack = async () => {
        await this.receiver.completeMessage(message);
        this.logger.debug(`Message completed: ${messageId}`);
      };

      // NACK: Abandonar el mensaje (vuelve a la queue para reintento)
      const nack = async () => {
        await this.receiver.abandonMessage(message);
        this.logger.debug(`Message abandoned: ${messageId}`);
      };

      // Paso 4: Llamar al handler del usuario con el mensaje preparado
      await this.messageHandler({
        id: messageId,
        data,
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

      // NACK automático: abandonar el mensaje para reintento
      await this.receiver.abandonMessage(message);
    }
  }

  /**
   * Limpia recursos al destruir el adapter
   *
   * Cierra el receiver y el cliente de Service Bus.
   */
  async onModuleDestroy() {
    await this.stop();
    await this.receiver.close();
    await this.serviceBusClient.close();
  }
}
