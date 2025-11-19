import { StringField } from '../../../shared/dto/decorators/field.decorator';
import { PollOutputDto } from './poll-output.dto';
import { JobStatus } from './job-status.enum';

/**
 * IssueReportOutputDto - DTO de salida específico para issue report
 *
 * Define la estructura completa de salida que el agente recibirá cuando el job termine.
 * Extiende PollOutputDto que proporciona los campos base (jobId y status).
 *
 * Características:
 * - Extiende PollOutputDto para campos base (jobId, status)
 * - Agrega campo específico (reportURL)
 * - Usado como `outputSchema` en `mcp.tool.issue.report.poll`
 *
 * @example
 * const output = new IssueReportOutputDto();
 * output.jobId = 'mcp.tool.issue.report-abc-123';
 * output.status = JobStatus.SUCCESS;
 * output.reportURL = 'https://example.com/report/123';
 */
export class IssueReportOutputDto extends PollOutputDto {
  /** URL del reporte generado (disponible solo cuando status === "SUCCESS") */
  @StringField({ description: `URL of the generated report. Only available when status is ${JobStatus.SUCCESS}.`, required: false })
  reportURL?: string;
}

