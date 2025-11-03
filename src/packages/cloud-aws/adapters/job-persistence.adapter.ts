import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Injectable, Logger } from '@nestjs/common';
import {
  JobDto,
  JobPersistencePort,
  SaveJobDto,
  UpdateJobDto,
} from '../../cloud-contracts/ports/job-persistence.port';
import { AwsOptions } from '../types/aws-options.interface';

/**
 * AwsJobPersistenceAdapter - Implementación de JobPersistencePort para DynamoDB
 *
 * Este adapter persiste jobs en DynamoDB usando AWS SDK v3.
 * Proporciona funcionalidades de almacenamiento, consulta y actualización de jobs.
 *
 * Características:
 * - Almacenamiento en DynamoDB con GSI para búsquedas
 * - Búsquedas por contenido, tags y metadata
 * - Filtros por fecha
 * - Paginación con DynamoDB
 * - TTL automático para limpieza
 *
 * Estructura de tabla DynamoDB:
 * - PK: jobId (String)
 * - SK: jobId (String) - Para GSI
 * - GSI1PK: tag#tagName (String) - Para búsquedas por tag
 * - GSI1SK: createdAt (String) - Para ordenamiento
 * - GSI2PK: content#searchTerm (String) - Para búsquedas por contenido
 * - GSI2SK: createdAt (String) - Para ordenamiento
 * - TTL: ttl (Number) - Para limpieza automática
 */
@Injectable()
export class AwsJobPersistenceAdapter implements JobPersistencePort {
  private readonly logger = new Logger(AwsJobPersistenceAdapter.name);
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(private readonly options: AwsOptions) {
    // Configurar cliente DynamoDB
    const dynamoClient = new DynamoDBClient({
      region: options.region,
      endpoint: process.env.AWS_ENDPOINT_URL,
      // credentials: {
      //   accessKeyId: options.accessKeyId,
      //   secretAccessKey: options.secretAccessKey,
      // },
    });

    this.dynamoClient = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = options.jobTableName || 'jobs';

    this.logger.log(
      `Initialized DynamoDB job persistence - Table: ${this.tableName}, Region: ${options.region}`,
    );
  }

  /**
   * Guarda un job en DynamoDB
   */
  async saveJob(job: SaveJobDto): Promise<string> {
    const now = new Date();
    const ttl = Math.floor(now.getTime() / 1000) + 30 * 24 * 60 * 60; // 30 días

    try {
      const item = {
        id: job.id,
        content: job.content as unknown,
        status: job.status,
        progress: job.progress,
        createdAt: now.toISOString(),
      };

      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
        }),
      );

      this.logger.log(`Job ${job.id} saved to DynamoDB`);
      return job.id;
    } catch (error) {
      this.logger.error(
        `Error saving job ${job.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Obtiene un job por ID
   */
  async getJob(jobId: string): Promise<JobDto | null> {
    try {
      const result = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            id: jobId,
          },
        }),
      );

      if (!result.Item) {
        return null;
      }
      const dto: JobDto = {
        id: result.Item.id as string,
        content: result.Item.content as unknown,
        message: result.Item.message as string,
        result: result.Item.result as unknown,
        status: result.Item.status as string,
        progress: parseInt(result.Item.progress as string),
        createdAt: new Date(result.Item.createdAt as string),
        updatedAt: new Date(result.Item.updatedAt as string),
      };
      return dto;
    } catch (error) {
      this.logger.error(
        `Error getting job ${jobId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Actualiza un job existente
   */
  async updateJob(jobId: string, updates: UpdateJobDto): Promise<boolean> {
    try {
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      // Construir expresiones de actualización
      if (updates.result !== undefined) {
        updateExpressions.push('#result = :result');
        expressionAttributeNames['#result'] = 'result';
        expressionAttributeValues[':result'] = updates.result;
      }

      if (updates.status !== undefined) {
        updateExpressions.push('#status = :status');
        expressionAttributeNames['#status'] = 'status';
        expressionAttributeValues[':status'] = updates.status;
      }

      if (updates.progress !== undefined) {
        updateExpressions.push('#progress = :progress');
        expressionAttributeNames['#progress'] = 'progress';
        expressionAttributeValues[':progress'] = updates.progress;
      }

      // Siempre actualizar updatedAt
      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      const result = await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            id: jobId,
          },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'UPDATED_NEW',
        }),
      );

      this.logger.log(`Job ${jobId} updated in DynamoDB`);
      return !!result.Attributes;
    } catch (error) {
      this.logger.error(
        `Error updating job ${jobId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Elimina un job
   */
  async deleteJob(jobId: string): Promise<boolean> {
    try {
      await this.dynamoClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            id: jobId,
          },
        }),
      );

      this.logger.log(`Job ${jobId} deleted from DynamoDB`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error deleting job ${jobId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
