import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  JobDto,
  JobPersistencePort,
  SaveJobDto,
  UpdateJobDto,
} from 'src/packages/cloud-contracts/ports/job-persistence.port';
import { LocalOptions } from '../types/local-options.interface';

/**
 * LocalJobPersistenceAdapter - Implementación de JobPersistencePort para Redis
 *
 * Este adapter persiste mensajes en Redis usando la misma conexión que BullMQ.
 * Proporciona funcionalidades de almacenamiento, consulta y actualización de mensajes.
 *
 * Características:
 * - Almacenamiento en Hash para metadatos
 * - Búsquedas por contenido, tags y metadata
 * - Filtros por fecha
 * - Paginación
 * - TTL automático para limpieza
 *
 * Estructura de datos en Redis:
 * - job:{id} - Hash con datos del mensaje
 * - jobs:search:content - Set de IDs por contenido
 * - jobs:search:tags - Set de IDs por tag
 * - jobs:timeline - Sorted Set por fecha
 */
@Injectable()
export class LocalJobPersistenceAdapter implements JobPersistencePort {
  private readonly logger = new Logger(LocalJobPersistenceAdapter.name);
  private readonly redis: Redis;

  constructor(private readonly options: LocalOptions) {
    // Usar la misma conexión Redis que BullMQ
    this.redis = new Redis({
      host: options.redisHost,
      port: options.redisPort,
      password: options.redisPassword,
      db: options.redisDb || 0,
    });

    this.logger.log(
      `Initialized Redis job persistence - Host: ${options.redisHost}:${options.redisPort}`,
    );
  }

  /**
   * Guarda un mensaje en Redis
   */
  async saveJob(job: SaveJobDto): Promise<string> {
    const jobId = job.id || this.generateId();
    const jobKey = `job:${jobId}`;
    const now = new Date();

    try {
      const jobData = {
        id: jobId,
        content: job.content as unknown,
        status: job.status,
        progress: job.progress,
        createdAt: now.toISOString(),
      };

      // Guardar mensaje principal
      await this.redis.hset(jobKey, jobData);

      // Agregar a timeline
      await this.redis.zadd('jobs:timeline', now.getTime(), jobId);

      // Configurar TTL (30 días)
      await this.redis.expire(jobKey, 30 * 24 * 60 * 60);

      this.logger.log(`Job ${jobId} saved to Redis`);
      return jobId;
    } catch (error) {
      this.logger.error(
        `Error saving job ${jobId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Obtiene un mensaje por ID
   */
  async getJob(id: string): Promise<JobDto | null> {
    try {
      const jobKey = `job:${id}`;
      const jobData = await this.redis.hgetall(jobKey);

      if (!jobData || Object.keys(jobData).length === 0) {
        return null;
      }

      return {
        id: jobData.id,
        content: jobData.content as unknown,
        message: jobData.message,
        result: jobData.result,
        status: jobData.status,
        progress: parseInt(jobData.progress),
        createdAt: new Date(jobData.createdAt),
        updatedAt: new Date(jobData.updatedAt),
      };
    } catch (error) {
      this.logger.error(
        `Error getting job ${id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Actualiza un mensaje existente
   */
  async updateJob(id: string, updates: UpdateJobDto): Promise<boolean> {
    try {
      const jobKey = `job:${id}`;
      const exists = await this.redis.exists(jobKey);

      if (!exists) {
        return false;
      }

      const updateData: Record<string, string> = {
        updatedAt: new Date().toISOString(),
      };

      if (updates.result !== undefined) {
        updateData.result = updates.result;
      }

      if (updates.status !== undefined) {
        updateData.status = updates.status;
      }

      if (updates.progress !== undefined) {
        updateData.progress = `${updates.progress}`;
      }

      await this.redis.hset(jobKey, updateData);

      this.logger.log(`Job ${id} updated`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error updating job ${id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Elimina un mensaje
   */
  async deleteJob(id: string): Promise<boolean> {
    try {
      const jobKey = `job:${id}`;
      const exists = await this.redis.exists(jobKey);

      if (!exists) {
        return false;
      }

      // Eliminar mensaje principal
      await this.redis.del(jobKey);

      // Eliminar de timeline
      await this.redis.zrem('jobs:timeline', id);

      this.logger.log(`Job ${id} deleted`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error deleting job ${id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Genera un ID único
   */
  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cierra la conexión Redis
   */
  async close(): Promise<void> {
    await this.redis.quit();
    this.logger.log('Redis job persistence adapter closed');
  }
}
