import { SchemaDto } from '../../../shared/dto/schema.dto';
import { StringField } from '../../../shared/dto/decorators/field.decorator';

/**
 * WaitJobInputDto - DTO de entrada para esperar a que un job termine
 *
 * Define los parámetros necesarios para hacer polling del estado de un job
 * hasta que termine (SUCCESS o FAILURE).
 *
 * Características:
 * - Extiende SchemaDto para generación automática de schema Zod
 * - Requiere el ID del job a esperar
 * - Usado por el tool 'mcp.tool.job.wait'
 *
 * @example
 * const input = new WaitJobInputDto();
 * input.jobId = 'mcp.tool.git.commit-files-550e8400-e29b-41d4-a716';
 */
export class WaitJobInputDto extends SchemaDto {
  /** ID del job a esperar (obtenido de mcp.tool.git.commit-files u otro tool asíncrono) */
  @StringField({ description: 'The ID of the job to wait for completion' })
  jobId: string;
}

