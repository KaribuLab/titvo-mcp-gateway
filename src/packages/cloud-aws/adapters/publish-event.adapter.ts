import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';
import { Injectable, Logger } from '@nestjs/common';
import { PublishEventPort } from '../../cloud-contracts/ports/publish-event.port';
import { InvokeInputFactory } from '../../../shared/helpers/invoke-input.factory';
import { CaseConversionHelper } from '../../../shared/helpers/case-conversion.helper';
import { InvokeOutputDto } from '../../../core/invocations/dto/invoke-output.dto';
import { AwsOptions } from '../types/aws-options.interface';
import { Console } from 'console';

/**
 * AwsPublishEventAdapter - Implementación de PublishEventPort para AWS EventBridge
 *
 * Este adapter publica eventos a AWS EventBridge, un servicio de bus de eventos
 * serverless que facilita la comunicación entre aplicaciones mediante eventos.
 *
 * Características:
 * - Publica eventos a un EventBus específico (o 'default')
 * - Serializa el payload a JSON automáticamente
 * - Soporta atributos/metadata en los eventos
 * - Manejo robusto de errores con logging detallado
 *
 * @see https://docs.aws.amazon.com/eventbridge/
 */
@Injectable()
export class AwsPublishEventAdapter implements PublishEventPort {
  private readonly logger = new Logger(AwsPublishEventAdapter.name);
  private readonly eventBridgeClient: EventBridgeClient;
  private readonly eventBusName: string;

  /**
   * Constructor del adapter
   *
   * Inicializa el cliente de EventBridge con la región configurada
   * y determina el nombre del EventBus a usar.
   *
   * @param options - Configuración de AWS (región, eventBusName, etc.)
   */
  constructor(private readonly options: AwsOptions) {
    // Inicializar cliente de EventBridge con la región
    this.eventBridgeClient = new EventBridgeClient({
      region: options.region,
      endpoint: process.env.AWS_ENDPOINT_URL,
    });

    // Usar EventBus especificado o 'default'
    const busName: string | undefined = options.eventBusName;
    this.eventBusName = busName || 'default';

    this.logger.log(
      `Initialized EventBridge adapter - Region: ${options.region}, EventBus: ${this.eventBusName}`,
    );
  }

  /**
   * Publica un evento a AWS EventBridge
   *
   * Proceso:
   * 1. Construye el evento con Source, DetailType, Detail y EventBus
   * 2. Agrega atributos como Resources si se proporcionan
   * 3. Envía el evento a EventBridge usando PutEvents
   * 4. Valida la respuesta y maneja errores
   * 5. Retorna el ID del evento publicado
   *
   * @param topic - Tipo de evento (se mapea a DetailType en EventBridge)
   * @param payload - Datos del evento (se serializan a JSON en Detail)
   * @param attrs - Atributos opcionales (se mapean a Resources)
   * @returns ID del evento publicado en EventBridge
   * @throws Error si la publicación falla
   */
  async publish(
    topic: string,
    payload: any,
    attrs?: Record<string, string>,
  ): Promise<InvokeOutputDto> {
    try {
      // Paso 1: Construir la entrada del evento
      const input = InvokeInputFactory.create(topic, payload);
      const entry: PutEventsRequestEntry = {
        Source: topic, // Identificador de la aplicación que envía el evento
        DetailType: "input", // Tipo de evento (ej: 'user.created', 'order.placed')
        Detail: JSON.stringify(CaseConversionHelper.convertToSnakeCase(input)), // Payload serializado a JSON
        EventBusName: this.eventBusName, // EventBus de destino
      };
      console.log('entry', entry);

      // Paso 2: Agregar atributos como recursos si se proporcionan
      // Los atributos se mapean a Resources para filtrado en EventBridge
      if (attrs && Object.keys(attrs).length > 0) {
        entry.Resources = Object.entries(attrs).map(
          ([key, value]) => `${key}:${value}`,
        );
      }

      // Paso 3: Crear el comando PutEvents con el evento
      const command = new PutEventsCommand({
        Entries: [entry],
      });

      // Paso 4: Enviar el evento a EventBridge
      const response = await this.eventBridgeClient.send(command);

      // Paso 5: Validar que el evento se publicó exitosamente
      if (response.FailedEntryCount && response.FailedEntryCount > 0) {
        const error = response.Entries?.[0];
        throw new Error(
          `Failed to publish event: ${error?.ErrorCode} - ${error?.ErrorMessage}`,
        );
      }

      // Paso 6: Obtener y retornar el ID del evento
      const eventId = response.Entries?.[0]?.EventId || 'unknown';
      this.logger.log(`Event published successfully - ID: ${eventId}`);

      return new InvokeOutputDto(input.jobId);
    } catch (error) {
      // Manejo de errores: loggear y re-lanzar
      const err = error as Error;
      this.logger.error(
        `Error publishing event to EventBridge: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
