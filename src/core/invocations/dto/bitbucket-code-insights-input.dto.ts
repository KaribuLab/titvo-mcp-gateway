import {
  ArrayField,
  EnumField,
  StringField,
} from "../../../shared/dto/decorators/field.decorator";
import { SchemaDto } from "../../../shared/dto/schema.dto";
import { AnnotationDto } from "./annotation-input.dto";
import { ReportStatus } from "./report-status.enum";

/**
 * BitbucketCodeInsightsInputDto - DTO de entrada para publicar Code Insights en Bitbucket
 *
 * Define los parámetros necesarios para publicar reportes de análisis de código
 * en Bitbucket Code Insights, una funcionalidad que permite visualizar resultados
 * de linters, security scanners y otras herramientas directamente en los commits.
 *
 * Casos de uso:
 * - Publicar resultados de análisis estático en pull requests
 * - Mostrar vulnerabilidades de seguridad en commits
 * - Integrar resultados de tests de calidad de código
 * - Reportar issues de linting en revisiones de código
 *
 * Características:
 * - Extiende SchemaDto para generación automática de schema Zod
 * - Requiere identificadores de Bitbucket (workspace, repo, commit)
 * - Soporta múltiples anotaciones por reporte
 * - Usado por el tool 'mcp.tool.bitbucket.code-insights'
 *
 * @example
 * const input = new BitbucketCodeInsightsInputDto();
 * input.workspaceId = 'my-workspace';
 * input.repoSlug = 'my-repo';
 * input.commitHash = 'abc123def456';
 * input.reportURL = 'https://example.com/report/123';
 * input.status = ReportStatus.WARNING;
 * input.annotations = [...];
 */
export class BitbucketCodeInsightsInputDto extends SchemaDto {
  /** URL del reporte completo (externa) */
  @StringField({
    description:
      "reportURL returned by mcp.tool.issue.report after polling to SUCCESS (Bitbucket insights link back to this HTML report).",
  })
  reportURL: string;

  /** ID del workspace de Bitbucket */
  @StringField({
    description:
      "Bitbucket workspace ID from the repo URL bitbucket.org/WORKSPACE/repo (often the team or user slug).",
  })
  workspaceId: string;

  /** Hash del commit donde se publicará el reporte */
  @StringField({
    description:
      "Commit SHA where annotations are published (same commit being scanned).",
  })
  commitHash: string;

  /** Slug del repositorio (nombre corto) */
  @StringField({
    description:
      "Repository slug from bitbucket.org/workspace/REPO_SLUG (short repo name, not display name).",
  })
  repoSlug: string;

  /** Estado general del reporte (SUCCESS, FAILED, WARNING) */
  @EnumField({
    description:
      "Scan outcome label for the report: COMPLETED, WARNING, or FAILED (ReportStatus enum).",
    enum: ReportStatus,
  })
  status: ReportStatus;

  /** Lista de anotaciones de código a publicar */
  @ArrayField({
    description:
      "Inline findings for Code Insights; each item follows AnnotationDto (path and line must match files in the commit).",
    itemType: AnnotationDto,
  })
  annotations: AnnotationDto[];
}
