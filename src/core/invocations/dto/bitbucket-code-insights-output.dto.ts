import { StringField } from '../../../shared/dto/decorators/field.decorator';
import { PollOutputDto } from './poll-output.dto';
import { JobStatus } from './job-status.enum';

/**
 * BitbucketCodeInsightsOutputDto - DTO de salida específico para bitbucket code insights
 *
 * Define la estructura completa de salida que el agente recibirá cuando el job termine.
 * Extiende PollOutputDto que proporciona los campos base (jobId y status).
 *
 * Características:
 * - Extiende PollOutputDto para campos base (jobId, status)
 * - Agrega campo específico (reportURL)
 * - Usado como `outputSchema` en `mcp.tool.bitbucket.code-insights.poll`
 *
 * @example
 * const output = new BitbucketCodeInsightsOutputDto();
 * output.jobId = 'mcp.tool.bitbucket.code-insights-abc-123';
 * output.status = JobStatus.SUCCESS;
 * output.reportURL = 'https://bitbucket.org/workspace/repo/commits/abc123';
 */
export class BitbucketCodeInsightsOutputDto extends PollOutputDto {
  /** URL del reporte publicado en Bitbucket Code Insights (disponible solo cuando status === "SUCCESS") */
  @StringField({ description: `URL of the report published in Bitbucket Code Insights. Only available when status is ${JobStatus.SUCCESS}.`, required: false })
  codeInsightsURL?: string;
}

