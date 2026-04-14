import { SchemaDto } from '../../../shared/dto/schema.dto';
import {
  NumberField,
  StringField,
} from '../../../shared/dto/decorators/field.decorator';

/**
 * AnnotationDto - DTO para representar una anotación de código
 *
 * Representa una anotación individual generada por herramientas de análisis
 * de código (linters, security scanners, code review tools, etc.)
 *
 * Una anotación puede ser:
 * - Error de linting
 * - Vulnerabilidad de seguridad
 * - Code smell
 * - Sugerencia de mejora
 * - Warning de compilación
 *
 * Características:
 * - Extiende SchemaDto para generación automática de schema Zod
 * - Incluye ubicación exacta (archivo y línea)
 * - Proporciona contexto completo del issue
 *
 * @example
 * const annotation = new AnnotationDto();
 * annotation.title = 'Unused variable';
 * annotation.severity = 'warning';
 * annotation.path = 'src/index.ts';
 * annotation.line = 42;
 */
export class AnnotationDto extends SchemaDto {
  /** Título breve de la anotación */
  @StringField({
    description:
      "Short finding title in neutral Spanish (one line, suitable for report and issue lists).",
  })
  title: string;

  /** Descripción detallada del problema */
  @StringField({
    description:
      "Detailed explanation of the vulnerability or finding in neutral Spanish (what is wrong and why it matters).",
  })
  description: string;

  /** Nivel de severidad (error, warning, info, etc.) */
  @StringField({
    description:
      "Severity label: use one of CRITICAL, HIGH, MEDIUM, LOW, or NONE (uppercase recommended for consistency with reports).",
  })
  severity: string;

  /** Ruta del archivo donde se encontró el issue */
  @StringField({
    description:
      "Repository-relative file path where the finding applies (e.g. src/app/service.ts).",
  })
  path: string;

  /** Número de línea donde se encuentra el issue */
  @NumberField({
    description:
      "1-based line number in the file for the finding (must match the analyzed source line).",
  })
  line: number;

  /** Resumen ejecutivo del problema */
  @StringField({
    description:
      "One or two sentences in neutral Spanish summarizing the issue for dashboards.",
  })
  summary: string;

  /** Código del issue (ej: 'ESLint: no-unused-vars') */
  @StringField({
    description:
      "Small code snippet or identifier illustrating the issue (literal code from the file when possible).",
  })
  code: string;

  /** Recomendación para resolver el issue */
  @StringField({
    description:
      "Actionable remediation in neutral Spanish (how to fix or mitigate the finding).",
  })
  recommendation: string;
}
