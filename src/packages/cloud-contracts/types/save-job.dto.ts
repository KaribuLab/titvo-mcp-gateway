/**
 * SaveJobDto - DTO para crear un nuevo job
 *
 * Define los datos necesarios para crear un nuevo job en la base de datos.
 * Se usa cuando un tool es invocado y se crea el job inicial.
 *
 * Campos requeridos:
 * - id: Generado por InvokeInputFactory
 * - content: Parámetros originales del tool
 * - status: Siempre 'REQUESTED' al crear
 * - progress: Siempre 0 al crear
 *
 * Este DTO es usado por:
 * - @InvokeTool decorator - Para crear el job inicial
 * - JobPersistencePort.saveJob() - Para persistir el job
 *
 * Campos NO incluidos (se generan automáticamente en DB):
 * - result: null al crear
 * - message: vacío al crear
 * - createdAt: timestamp actual
 * - updatedAt: timestamp actual
 *
 * @example
 * const saveJob: SaveJobDto = {
 *   id: 'get-commit-550e8400-e29b-41d4',
 *   content: { repository: 'org/repo', commitId: 'abc123' },
 *   status: 'REQUESTED',
 *   progress: 0
 * };
 * await jobPersistence.saveJob(saveJob);
 */
export interface SaveJobDto {
  /** ID único del job (generado por InvokeInputFactory) */
  id: string;

  /** Datos de entrada del tool (parámetros originales) */
  content: any;

  /** Estado inicial del job (siempre 'REQUESTED' al crear) */
  status: string;

  /** Progreso inicial (siempre 0 al crear) */
  progress: number;
}
