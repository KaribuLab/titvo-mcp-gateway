import {
  StringField,
  ArrayField,
} from '../../../shared/dto/decorators/field.decorator';
import { PollOutputDto } from './poll-output.dto';
import { JobStatus } from './job-status.enum';

/**
 * GitCommitFilesOutputDto - DTO de salida específico para git commit-files
 *
 * Define la estructura completa de salida que el agente recibirá cuando el job termine.
 * Extiende PollOutputDto que proporciona los campos base (jobId y status).
 *
 * Características:
 * - Extiende PollOutputDto para campos base (jobId, status)
 * - Agrega campos específicos (filesPaths, commitId)
 * - Usado como `outputSchema` en `mcp.tool.git.commit-files.poll`
 *
 * @example
 * const output = new GitCommitFilesOutputDto();
 * output.jobId = 'mcp.tool.git.commit-files-abc-123';
 * output.status = JobStatus.SUCCESS;
 * output.filesPaths = ['abc123/src/index.ts', 'abc123/src/utils.ts'];
 * output.commitId = 'abc123';
 */
export class GitCommitFilesOutputDto extends PollOutputDto {

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

