import { SchemaDto } from '../../../shared/dto/schema.dto';
import { StringField } from '../../../shared/dto/decorators/field.decorator';

/**
 * InvokeOutputDto - DTO de salida para invocaciones de tools
 *
 * Retorna el ID del job creado al cliente MCP cuando se invoca un tool.
 * El cliente puede usar este ID para consultar el estado y resultado del job.
 *
 * Características:
 * - Extiende SchemaDto para generación automática de schema Zod
 * - Se usa como respuesta inmediata al invocar un tool
 * - El job se procesa de forma asíncrona en background
 *
 * @example
 * const output = new InvokeOutputDto('my-tool-550e8400-e29b-41d4-a716');
 * return output; // Cliente recibe el jobId para consultar estado
 */
export class InvokeOutputDto extends SchemaDto {
  /** ID del job creado (puede usarse para consultar estado) */
  @StringField({ description: 'The ID of the job that was invoked' })
  jobId: string;

  constructor(jobId: string) {
    super();
    this.jobId = jobId;
  }
}
