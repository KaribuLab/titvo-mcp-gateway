import type { JobDto } from '../types/job.dto';
import type { SaveJobDto } from '../types/save-job.dto';
import type { UpdateJobDto } from '../types/update-job.dto';

export type { JobDto, SaveJobDto, UpdateJobDto };

/**
 * Port para persistencia de jobs (Hexagonal Architecture)
 *
 * Define el contrato que deben cumplir todos los adaptadores de persistencia
 * de jobs, independientemente del provider de cloud.
 *
 * Implementaciones:
 * - LocalJobPersistenceAdapter: Persiste en Redis
 * - AwsJobPersistenceAdapter: Persiste en DynamoDB
 * - GcpJobPersistenceAdapter: Persiste en Firestore
 * - AzureJobPersistenceAdapter: Persiste en Cosmos DB
 *
 * @example
 * // Inyectar en un controlador:
 * constructor(@Inject(JOB_PERSISTENCE) private jobPersistence: JobPersistencePort) {}
 *
 * // Guardar job:
 * await this.jobPersistence.saveJob({
 *   id: 'msg-123',
 *   content: 'Hello World',
 *   metadata: { source: 'api' }
 * });
 */
export interface JobPersistencePort {
  /**
   * Guarda un job en la base de datos
   *
   * @param job - Datos del job a guardar
   * @returns ID del job guardado
   * @throws Error si la operación falla
   */
  saveJob(job: SaveJobDto): Promise<string>;

  /**
   * Obtiene un job por ID
   *
   * @param id - ID del job
   * @returns Mensaje encontrado o null
   * @throws Error si la operación falla
   */
  getJob(jobId: string): Promise<JobDto | null>;

  /**
   * Actualiza un job existente
   *
   * @param id - ID del job
   * @param updates - Campos a actualizar
   * @returns true si se actualizó, false si no se encontró
   * @throws Error si la operación falla
   */
  updateJob(jobId: string, updates: UpdateJobDto): Promise<boolean>;

  /**
   * Elimina un job
   *
   * @param id - ID del job
   * @returns true si se eliminó, false si no se encontró
   * @throws Error si la operación falla
   */
  deleteJob(jobId: string): Promise<boolean>;
}
