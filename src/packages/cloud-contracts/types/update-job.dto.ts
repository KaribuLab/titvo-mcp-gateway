/**
 * UpdateJobDto - DTO para actualizar un job existente
 *
 * Define los campos que pueden ser actualizados en un job.
 * Todos los campos son opcionales para permitir actualizaciones parciales.
 *
 * Casos de uso:
 * - Reportar progreso: Actualizar progress y message
 * - Job completado: Actualizar status, progress (100), result
 * - Job fallido: Actualizar status (FAILURE), message con error
 *
 * Este DTO es usado por:
 * - JobProcessorService - Para actualizar jobs al procesar mensajes
 * - JobPersistencePort.updateJob() - Para persistir cambios
 *
 * Nota: updatedAt se actualiza automáticamente en la base de datos
 *
 * @example
 * // Reportar progreso:
 * await jobPersistence.updateJob(jobId, {
 *   progress: 50,
 *   message: 'Processing files...',
 *   status: 'IN_PROGRESS'
 * });
 *
 * // Job completado:
 * await jobPersistence.updateJob(jobId, {
 *   progress: 100,
 *   status: 'SUCCESS',
 *   result: { files: [...], author: '...' }
 * });
 *
 * // Job fallido:
 * await jobPersistence.updateJob(jobId, {
 *   status: 'FAILURE',
 *   message: 'Error: Repository not found'
 * });
 */
export interface UpdateJobDto {
  /** Mensaje descriptivo del estado actual o error (opcional) */
  message?: string;

  /** Resultado del job al completarse exitosamente (opcional) */
  result?: any;

  /** Nuevo estado del job (opcional) */
  status?: string;

  /** Nuevo progreso de 0 a 100 (opcional) */
  progress?: number;
}
