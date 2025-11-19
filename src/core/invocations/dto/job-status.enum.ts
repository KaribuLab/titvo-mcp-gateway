/**
 * JobStatus - Estados posibles de un job
 *
 * Define los estados que puede tener un job durante su ciclo de vida.
 *
 * Valores:
 * - REQUESTED: Job creado, esperando procesamiento
 * - IN_PROGRESS: Job siendo procesado
 * - SUCCESS: Job completado exitosamente
 * - FAILURE: Job falló durante el procesamiento
 *
 * @example
 * const status = JobStatus.SUCCESS;
 * if (job.status === JobStatus.IN_PROGRESS) {
 *   // Job aún procesándose
 * }
 */
export enum JobStatus {
  /** Job creado, esperando procesamiento */
  REQUESTED = 'REQUESTED',

  /** Job siendo procesado */
  IN_PROGRESS = 'IN_PROGRESS',

  /** Job completado exitosamente */
  SUCCESS = 'SUCCESS',

  /** Job falló durante el procesamiento */
  FAILURE = 'FAILURE',
}

