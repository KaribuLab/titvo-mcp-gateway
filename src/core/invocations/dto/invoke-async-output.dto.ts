import { SchemaDto } from '../../../shared/dto/schema.dto';
import { StringField } from '../../../shared/dto/decorators/field.decorator';

/**
 * InvokeAsyncOutputDto - DTO de salida para invocaciones de tools asíncronos
 *
 * Retorna el ID del job creado y el nombre de la tool de polling asociada
 * al cliente MCP cuando se invoca un tool asíncrono.
 *
 * Características:
 * - Extiende SchemaDto para generación automática de schema Zod
 * - Se usa como respuesta inmediata al invocar un tool asíncrono
 * - Incluye el nombre de la tool de polling para que el agente sepa qué usar
 * - El job se procesa de forma asíncrona en background
 *
 * @example
 * const output = new InvokeAsyncOutputDto('my-tool-550e8400-e29b-41d4-a716', 'mcp.tool.my-tool.poll');
 * return output; // Cliente recibe jobId y pollToolName
 */
export class InvokeAsyncOutputDto extends SchemaDto {
  /** ID del job creado (puede usarse para consultar estado) */
  @StringField({ description: 'The ID of the job that was invoked' })
  jobId: string;

  /** Nombre de la tool de polling a usar para obtener el resultado */
  @StringField({ description: 'The name of the polling tool to use to get the result' })
  pollToolName: string;

  constructor(jobId: string, pollToolName: string) {
    super();
    this.jobId = jobId;
    this.pollToolName = pollToolName;
  }
}

