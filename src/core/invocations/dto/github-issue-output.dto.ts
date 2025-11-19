import { StringField, NumberField } from '../../../shared/dto/decorators/field.decorator';
import { PollOutputDto } from './poll-output.dto';
import { JobStatus } from './job-status.enum';

/**
 * GithubIssueOutputDto - DTO de salida específico para github issue
 *
 * Define la estructura completa de salida que el agente recibirá cuando el job termine.
 * Extiende PollOutputDto que proporciona los campos base (jobId y status).
 *
 * Características:
 * - Extiende PollOutputDto para campos base (jobId, status)
 * - Agrega campos específicos (issueId, htmlURL)
 * - Usado como `outputSchema` en `mcp.tool.github.issue.poll`
 *
 * @example
 * const output = new GithubIssueOutputDto();
 * output.jobId = 'mcp.tool.github.issue-abc-123';
 * output.status = JobStatus.SUCCESS;
 * output.issueId = 12345;
 * output.htmlURL = 'https://github.com/owner/repo/issues/12345';
 */
export class GithubIssueOutputDto extends PollOutputDto {
  /** ID del issue creado en GitHub (disponible solo cuando status === "SUCCESS") */
  @NumberField({ description: `ID of the issue created in GitHub. Only available when status is ${JobStatus.SUCCESS}.`, required: false, int: true })
  issueId?: number;

  /** URL HTML del issue creado en GitHub (disponible solo cuando status === "SUCCESS") */
  @StringField({ description: `HTML URL of the issue created in GitHub. Only available when status is ${JobStatus.SUCCESS}.`, required: false })
  htmlURL?: string;
}

