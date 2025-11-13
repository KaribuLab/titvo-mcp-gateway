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
  @StringField({ description: "Repo Owner" })
  repoOwner: string;

  /** Nombre del repositorio */
  @StringField({ description: "Repo Name" })
  repoName: string;

  /** Usuario de GitHub a quien se asignará el issue */
  @StringField({ description: "Asignee" })
  asignee: string;

  /** Hash del commit relacionado con el issue */
  @StringField({ description: "Commit Hash" })
  commitHash: string;

  /** Estado del análisis (SUCCESS, FAILED, WARNING) */
  @EnumField({ description: "Status of the report", enum: ReportStatus })
  status: ReportStatus;

  /** Lista de anotaciones que generarán el contenido del issue */
  @ArrayField({ description: "Annotations", itemType: AnnotationDto })
  annotations: AnnotationDto[];
}
