import { SchemaDto } from '../../../shared/dto/schema.dto';
import {
  StringField,
  ArrayField,
} from '../../../shared/dto/decorators/field.decorator';

/**
 * GitCommitFilesOutputDto - DTO de salida específico para git commit-files
 *
 * Define la estructura completa de salida que el agente recibirá cuando el job termine.
 * Aunque inicialmente solo se retorna `jobId`, este schema muestra la estructura completa
 * esperada para que el agente sepa qué esperar cuando haga polling.
 *
 * Características:
 * - Extiende SchemaDto para generación automática de schema Zod
 * - Muestra la estructura completa esperada del resultado
 * - Usado como `outputSchema` en `mcp.tool.git.commit-files`
 *
 * @example
 * const output = new GitCommitFilesOutputDto();
 * output.jobId = 'mcp.tool.git.commit-files-abc-123';
 * output.filesPaths = ['abc123/src/index.ts', 'abc123/src/utils.ts'];
 * output.commitId = 'abc123';
 */
export class GitCommitFilesOutputDto extends SchemaDto {
  /** ID del job creado (retornado inmediatamente) */
  @StringField({ description: 'The ID of the job that was invoked' })
  jobId: string;

  /** Estado del job: "REQUESTED" | "IN_PROGRESS" | "SUCCESS" | "FAILURE". Si es "REQUESTED" o "IN_PROGRESS", el job aún está procesándose y debes llamar esta tool nuevamente más tarde. Si es "SUCCESS", el job terminó y los campos filesPaths y commitId estarán disponibles. Si es "FAILURE", el job falló. */
  @StringField({ description: 'Status of the job: "REQUESTED" | "IN_PROGRESS" | "SUCCESS" | "FAILURE". If status is "REQUESTED" or "IN_PROGRESS", the job is still processing and you must call this tool again later. If status is "SUCCESS", the job completed and filesPaths and commitId will be available. If status is "FAILURE", the job failed.' })
  status: string;

  /** Array de paths de archivos procesados (disponible solo cuando status === "SUCCESS") */
  @ArrayField({
    description: 'Array of file paths returned by the job when completed. Only available when status is "SUCCESS".',
    itemType: String,
    required: false,
  })
  filesPaths?: string[];

  /** ID del commit procesado (disponible solo cuando status === "SUCCESS") */
  @StringField({ description: 'Commit ID that was processed. Only available when status is "SUCCESS".', required: false })
  commitId?: string;
}

