import { Inject, Injectable, Scope } from '@nestjs/common';
import { ResourceTemplate } from '@rekog/mcp-nest';
import { JOB_PERSISTENCE } from '../../packages/cloud-contracts/constants/injection-tokens';
import {
  JobDto,
  JobPersistencePort,
} from '../../packages/cloud-contracts/ports/job-persistence.port';

/**
 * JobResource - Resource MCP para consultar el estado de jobs
 *
 * Expone un resource MCP que permite a los clientes consultar el estado
 * y resultado de jobs que se están procesando de forma asíncrona.
 *
 * Características:
 * - URI template: `job://{jobId}`
 * - Scope REQUEST para aislamiento por petición
 * - Retorna JSON con estado completo del job
 * - Maneja jobs no encontrados con mensaje de error
 *
 * Datos retornados:
 * - id: ID del job
 * - content: Datos de entrada originales
 * - result: Resultado del job (si está completo)
 * - status: Estado actual (REQUESTED, IN_PROGRESS, SUCCESS, FAILURE)
 * - progress: Progreso de 0 a 100
 * - createdAt: Fecha de creación
 * - updatedAt: Fecha de última actualización
 *
 * @example
 * // Cliente MCP consulta el estado de un job:
 * // GET mcp://job://my-tool-550e8400-e29b-41d4-a716
 * // Retorna: { id, status, progress, result, ... }
 */
@Injectable({ scope: Scope.REQUEST })
export class JobResource {
  constructor(
    @Inject(JOB_PERSISTENCE)
    private readonly jobPersistence: JobPersistencePort,
  ) {}

  /**
   * Obtiene el estado de un job específico
   *
   * @param uri - URI del resource solicitado
   * @param jobId - ID del job a consultar (extraído de la URI)
   * @returns Resource con el estado del job en formato JSON
   *
   * @example
   * // Ejemplo de respuesta para job exitoso:
   * {
   *   uri: 'job://my-tool-abc-123',
   *   mimeType: 'application/json',
   *   text: '{ "id": "my-tool-abc-123", "status": "SUCCESS", "progress": 100, ... }'
   * }
   */
  @ResourceTemplate({
    name: 'job-status',
    description: "Get a specific job's status",
    mimeType: 'application/json',
    uriTemplate: 'job://{jobId}',
  })
  async getJobStatus({ uri, jobId }) {
    const job: JobDto | null = await this.jobPersistence.getJob(jobId);

    // Job no encontrado
    if (!job) {
      return {
        contents: [
          {
            uri: uri,
            mimeType: 'application/json',
            text: JSON.stringify({ error: 'Job not found' }, null, 2),
          },
        ],
      };
    }

    // Job encontrado - retornar estado completo
    const result = {
      contents: [
        {
          uri: uri,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              id: job.id,
              content: job.content,
              result: job.result,
              status: job.status,
              progress: job.progress,
              createdAt: job.createdAt,
              updatedAt: job.updatedAt,
            },
            null,
            2,
          ),
        },
      ],
    };
    return result;
  }
}
