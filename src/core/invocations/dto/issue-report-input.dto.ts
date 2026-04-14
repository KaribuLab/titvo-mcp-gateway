import { SchemaDto } from '../../../shared/dto/schema.dto';
import { AnnotationDto } from './annotation-input.dto';
import {
  ArrayField,
  EnumField,
} from '../../../shared/dto/decorators/field.decorator';
import { ReportStatus } from './report-status.enum';

/**
 * IssueReportInputDto - DTO de entrada para generar reportes de issues
 *
 * Define los parámetros para generar un reporte consolidado a partir
 * de una lista de anotaciones de código.
 *
 * Casos de uso:
 * - Consolidar resultados de múltiples linters
 * - Generar reporte de code review
 * - Agregar vulnerabilidades de security scan
 * - Crear reporte de calidad de código
 *
 * Características:
 * - Extiende SchemaDto para generación automática de schema Zod
 * - Requiere al menos una anotación (minItems: 1)
 * - Estado del reporte (SUCCESS, FAILED, WARNING)
 * - Usado por el tool 'invoke-get-report'
 *
 * @example
 * const input = new IssueReportInputDto();
 * input.reportStatus = ReportStatus.WARNING;
 * input.annotations = [
 *   { title: 'Unused var', severity: 'warning', ... },
 *   { title: 'SQL injection risk', severity: 'error', ... }
 * ];
 */
export class IssueReportInputDto extends SchemaDto {
  /** Estado general del reporte (SUCCESS, FAILED, WARNING) */
  @EnumField({
    description:
      "Overall scan outcome for the HTML report: COMPLETED, WARNING, or FAILED (ReportStatus enum; align with severity of findings).",
    enum: ReportStatus,
  })
  reportStatus: ReportStatus;

  /** Lista de anotaciones a incluir en el reporte (mínimo 1) */
  @ArrayField({
    description:
      "At least one finding; each item follows AnnotationDto. Used to render the report—neutral Spanish text is recommended.",
    itemType: AnnotationDto,
    minItems: 1,
  })
  annotations: AnnotationDto[];
}
