import {
  ArrayField,
  EnumField,
  StringField,
} from "../../../shared/dto/decorators/field.decorator";
import { SchemaDto } from "../../../shared/dto/schema.dto";
import { AnnotationDto } from "./annotation-input.dto";
import { ReportStatus } from "./report-status.enum";

/**
 * GithubIssueInputDto - DTO de entrada para crear issues en GitHub
 *
 * Define los parámetros necesarios para crear issues automáticamente en
 * repositorios de GitHub basados en resultados de análisis de código.
 *
 * Casos de uso:
 * - Crear issues automáticos desde resultados de linters
 * - Reportar vulnerabilidades de seguridad como issues
 * - Generar issues de deuda técnica
 * - Crear tasks de mejora de calidad de código
 * - Asignar automáticamente issues a desarrolladores
 *
 * Características:
 * - Extiende SchemaDto para generación automática de schema Zod
 * - Requiere identificadores de GitHub (owner, repo)
 * - Permite asignar el issue a un usuario específico
 * - Soporta múltiples anotaciones para generar el contenido del issue
 * - Usado por el tool 'mcp.tool.github.issue'
 *
 * @example
 * const input = new GithubIssueInputDto();
 * input.repoOwner = 'my-org';
 * input.repoName = 'my-repo';
 * input.asignee = 'developer-username';
 * input.commitHash = 'abc123def456';
 * input.status = ReportStatus.FAILED;
 * input.annotations = [...];
 */
export class GithubIssueInputDto extends SchemaDto {
  /** Propietario del repositorio (organización o usuario) */
  @StringField({
    description:
      "GitHub repository owner: the organization or user from the URL github.com/OWNER/REPO (same value as in the scan context).",
  })
  repoOwner: string;

  /** Nombre del repositorio */
  @StringField({
    description:
      "GitHub repository name: the repo segment from github.com/owner/REPO (without .git).",
  })
  repoName: string;

  /** Usuario de GitHub a quien se asignará el issue */
  @StringField({
    description:
      "GitHub username to assign the issue to (must exist on GitHub; often provided in scan parameters).",
  })
  asignee: string;

  /** Hash del commit relacionado con el issue */
  @StringField({
    description:
      "Full commit SHA for the issue title and body (same commit being scanned).",
  })
  commitHash: string;

  /** Estado del análisis (SUCCESS, FAILED, WARNING) */
  @EnumField({
    description:
      "Overall scan outcome for the issue template: COMPLETED, WARNING, or FAILED (ReportStatus enum—same values as issue report).",
    enum: ReportStatus,
  })
  status: ReportStatus;

  /** Lista de anotaciones que generarán el contenido del issue */
  @ArrayField({
    description:
      "Vulnerabilities to include in the issue body; each item follows AnnotationDto (title, description, severity, path, line, summary, code, recommendation).",
    itemType: AnnotationDto,
  })
  annotations: AnnotationDto[];
}
