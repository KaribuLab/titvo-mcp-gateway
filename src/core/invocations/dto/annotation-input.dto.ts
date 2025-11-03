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
  @StringField({ description: 'Title of the annotation' })
  title: string;

  /** Descripción detallada del problema */
  @StringField({ description: 'Description of the annotation' })
  description: string;

  /** Nivel de severidad (error, warning, info, etc.) */
  @StringField({ description: 'Severity of the annotation' })
  severity: string;

  /** Ruta del archivo donde se encontró el issue */
  @StringField({ description: 'Path of the annotation' })
  path: string;

  /** Número de línea donde se encuentra el issue */
  @NumberField({ description: 'Line of the annotation' })
  line: number;

  /** Resumen ejecutivo del problema */
  @StringField({ description: 'Summary of the annotation' })
  summary: string;

  /** Código del issue (ej: 'ESLint: no-unused-vars') */
  @StringField({ description: 'Code of the annotation' })
  code: string;

  /** Recomendación para resolver el issue */
  @StringField({ description: 'Recommendation of the annotation' })
  recommendation: string;
}
