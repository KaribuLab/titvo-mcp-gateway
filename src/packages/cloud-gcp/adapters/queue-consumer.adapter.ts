import { Injectable, Logger } from '@nestjs/common';
import { PubSub, Subscription, Message } from '@google-cloud/pubsub';
import { QueueConsumerPort } from 'src/packages/cloud-contracts/ports/queue-consumer.port';
import { GcpOptions } from '../types/gcp-options.interface';

/**
 * Type para el handler de mensajes
 * Define la firma de la función que procesa cada mensaje de la subscription
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
 * GcpQueueConsumerAdapter - Implementación de QueueConsumerPort para GCP Pub/Sub
 *
 * Este adapter consume mensajes de GCP Pub/Sub Subscriptions, usando el
 * modo pull (subscriber pattern) para recibir mensajes.
 *
 * Características:
 * - Modo Pull: El subscriber "escucha" activamente los mensajes
 * - Procesamiento event-driven (no polling)
 * - ACK/NACK automático según el resultado del handler
 * - Manejo automático de reintentos (configurado en la subscription)
 * - Flow control configurado para hasta 10 mensajes simultáneos
 *
 * Flujo de procesamiento:
 * 1. onMessage() - Registrar handler
 * 2. start() - Suscribirse y comenzar a escuchar
 * 3. On 'message' event - Procesar mensaje
 * 4. processMessage() - Llamar handler del usuario
 * 5. ack()/nack() - Confirmar o rechazar mensaje
 * 6. stop() - Cerrar subscription
 *
 * Diferencia con SQS:
 * - SQS: Polling activo (long polling)
 * - Pub/Sub: Event-driven (push model desde el servidor)
 *
 * @see https://cloud.google.com/pubsub/docs/subscriber
 */
@Injectable()
export class GcpQueueConsumerAdapter implements QueueConsumerPort {
  private readonly logger = new Logger(GcpQueueConsumerAdapter.name);
  private readonly pubSubClient: PubSub;
  private readonly subscription: Subscription;
  private readonly subscriptionName: string;
  private isRunning = false; // Estado del consumer
  private messageHandler?: MessageHandler; // Handler para procesar mensajes

  /**
   * Constructor del adapter
   *
   * Inicializa el cliente Pub/Sub y obtiene referencia a la Subscription.
   * La subscription debe existir previamente en GCP (no se crea automáticamente).
   *
   * Configura flow control para limitar mensajes concurrentes:
   * - maxMessages: 10 mensajes máximo en proceso simultáneo
   * - allowExcessMessages: false para respetar el límite
   *
   * @param options - Configuración de GCP (projectId, subscriptionName, etc.)
   */
  constructor(private readonly options: GcpOptions) {
    // Inicializar cliente Pub/Sub con el proyecto
    this.pubSubClient = new PubSub({
      projectId: options.projectId,
    });

    // Obtener referencia a la subscription
    this.subscriptionName = options.subscriptionName;
    this.subscription = this.pubSubClient.subscription(this.subscriptionName, {
      // Flow control: limita mensajes concurrentes
      flowControl: {
        maxMessages: 10, // Máximo 10 mensajes en proceso simultáneo
        allowExcessMessages: false, // No exceder el límite
      },
    });

    this.logger.log(
      `Initialized Pub/Sub subscriber - Project: ${options.projectId}, Subscription: ${this.subscriptionName}`,
    );
  }

  /**
   * Registra el handler que procesará los mensajes
   *
   * Debe llamarse antes de start(). Solo se permite un handler por consumer.
   *
   * @param subscription - Nombre de la suscripción (para logging, ya está configurada)
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
   * 3. Registra listeners de eventos
   * 4. Marca el consumer como activo
   *
   * Eventos:
   * - 'message': Se recibe un mensaje (llama a processMessage)
   * - 'error': Error en la conexión o recepción
   *
   * A diferencia de SQS (polling), Pub/Sub usa eventos push.
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

    // Marcar como activo
    this.isRunning = true;

    // Registrar listener para mensajes entrantes
    this.subscription.on('message', (message: Message) => {
      // Procesar mensaje de forma asíncrona
      this.processMessage(message).catch((error) => {
        this.logger.error(
          `Error in message handler: ${(error as Error).message}`,
        );
      });
    });

    // Registrar listener para errores
    this.subscription.on('error', (error: Error) => {
      this.logger.error(
        `Error in Pub/Sub subscription: ${error.message}`,
        error.stack,
      );
    });

    this.logger.log('Pub/Sub consumer started');
  }

  /**
   * Detiene el consumidor de mensajes
   *
   * Proceso:
   * 1. Marca el consumer como inactivo
   * 2. Cierra la subscription (deja de recibir mensajes)
   * 3. Limpia listeners
   *
   * Los mensajes que están siendo procesados terminarán su ejecución.
   */
  async stop(): Promise<void> {
    // Validar que esté corriendo
    if (!this.isRunning) {
      this.logger.warn('Consumer not running');
      return;
    }

    // Detener el consumer
    this.isRunning = false;

    // Cerrar la subscription
    await this.subscription.close();

    // Limpiar listeners
    this.subscription.removeAllListeners();

    this.logger.log('Pub/Sub consumer stopped');
  }

  /**
   * Procesa un mensaje individual de Pub/Sub
   *
   * Este método prepara el mensaje y lo pasa al handler registrado por el usuario.
   * El handler decide si hacer ACK (confirmar) o NACK (rechazar).
   *
   * Proceso:
   * 1. Validar que haya handler
   * 2. Extraer datos y atributos del mensaje
   * 3. Crear funciones ack/nack para el handler
   * 4. Llamar al handler del usuario
   * 5. Si hay error, hacer NACK automático
   *
   * ACK vs NACK:
   * - ACK: message.ack() - Mensaje procesado exitosamente
   * - NACK: message.nack() - Mensaje falló, reenviar
   *
   * Pub/Sub tiene límite de reintentos configurado en la subscription,
   * después del cual el mensaje puede ir a una Dead Letter Topic.
   *
   * @param message - Mensaje de Pub/Sub a procesar
   */
  private async processMessage(message: Message): Promise<void> {
    // Validar que tengamos handler
    if (!this.messageHandler) {
      return;
    }

    const messageId = message.id;

    try {
      // Paso 1: Obtener datos del mensaje (ya viene como Buffer)
      const data = message.data;

      // Paso 2: Extraer atributos del mensaje (metadata)
      const attrs: Record<string, string> = message.attributes || {};

      // Paso 3: Crear funciones ack/nack para el handler
      // ACK: Confirma que el mensaje fue procesado exitosamente
      const ack = async () => {
        message.ack();
        this.logger.debug(`Message acknowledged: ${messageId}`);
      };

      // NACK: Rechaza el mensaje para que se reintente
      const nack = async () => {
        message.nack();
        this.logger.debug(`Message nacked: ${messageId}`);
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

      // NACK automático: rechazar el mensaje para reintento
      message.nack();
    }
  }

  /**
   * Limpia recursos al destruir el adapter
   *
   * Cierra la subscription y limpia listeners.
   */
  async onModuleDestroy() {
    await this.stop();
  }
}
