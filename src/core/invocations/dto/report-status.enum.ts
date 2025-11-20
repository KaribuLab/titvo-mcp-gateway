/**
 * ReportStatus - Estados posibles de un reporte de análisis
 *
 * Define los estados que puede tener un reporte generado por herramientas
 * de análisis de código (linters, security scanners, etc.)
 *
 * Valores:
 * - OPEN (SUCCESS): El análisis completó exitosamente sin errores críticos
 * - FAILED: El análisis falló o encontró errores críticos
 * - WARNING: El análisis completó pero encontró advertencias
 */
export enum ReportStatus {
  /** Análisis exitoso */
  COMPLETED = 'COMPLETED',

  /** Análisis falló o errores críticos encontrados */
  FAILED = 'FAILED',

  /** Análisis completó con advertencias */
  WARNING = 'WARNING',
}
