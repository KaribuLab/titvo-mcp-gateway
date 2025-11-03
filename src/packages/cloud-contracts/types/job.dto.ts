/**
 * JobDto - DTO para representar un job completo
 *
 * Representa el estado completo de un job almacenado en la base de datos.
 * Incluye datos de entrada, resultado, progreso, timestamps y estado.
 *
 * Estados posibles:
 * - REQUESTED: Job creado, esperando procesamiento
 * - IN_PROGRESS: Job siendo procesado
 * - SUCCESS: Job completado exitosamente
 * - FAILURE: Job falló durante el procesamiento
 *
 * Este DTO es usado por:
 * - JobPersistencePort.getJob() - Para retornar el job completo
 * - JobResource - Para exponer el estado vía MCP
 * - JobProcessorService - Para consultar y actualizar jobs
 *
 * @example
 * const job: JobDto = {
 *   id: 'get-commit-abc-123',
 *   content: { repository: 'org/repo', commitId: 'abc123' },
 *   result: { files: [...], author: '...' },
 *   message: 'Processing completed',
 *   status: 'SUCCESS',
 *   progress: 100,
 *   createdAt: new Date('2024-01-01T10:00:00Z'),
 *   updatedAt: new Date('2024-01-01T10:05:00Z')
 * };
 */
export interface JobDto {
  /** ID único del job (formato: {toolId}-{uuid}) */
  id: string;

  /** Datos de entrada originales del tool */
  content: any;

  /** Resultado del job (solo disponible si status === SUCCESS) */
  result: any;

  /** Mensaje descriptivo del estado actual o error */
  message: string;

  /** Estado del job (REQUESTED, IN_PROGRESS, SUCCESS, FAILURE) */
  status: string;

  /** Progreso de 0 a 100 */
  progress: number;

  /** Fecha de creación del job */
  createdAt: Date;

  /** Fecha de última actualización */
  updatedAt: Date;
}
