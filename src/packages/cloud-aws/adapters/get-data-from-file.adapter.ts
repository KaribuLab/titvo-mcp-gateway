import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { GetDataFromFileOutputDto } from 'src/core/invocations/dto/get-data-from-file-output.dto';
import { GetDataFromFilePort } from 'src/packages/cloud-contracts/ports/get-data-from-file.port';
import { AwsOptions } from '../types/aws-options.interface';

/**
 * AwsGetDataFromFileAdapter - Implementación de GetDataFromFilePort para S3
 *
 * Este adapter obtiene archivos desde un bucket de S3 configurado.
 *
 * Características:
 * - Lee archivos desde S3 usando el bucket configurado
 * - Maneja diferentes tipos de contenido
 * - Manejo robusto de errores con logging detallado
 *
 * Configuración:
 * - Bucket: Configurado via AWS_S3_BUCKET_NAME
 * - Path format: {commitId}/{filePath}
 *
 * @example
 * const adapter = new AwsGetDataFromFileAdapter(options);
 * const data = await adapter.getData('abc123/src/index.ts');
 */
@Injectable()
export class AwsGetDataFromFileAdapter implements GetDataFromFilePort {
  private readonly logger = new Logger(AwsGetDataFromFileAdapter.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly options: AwsOptions) {
    // Configurar cliente S3
    this.s3Client = new S3Client({
      region: options.region,
      endpoint: process.env.AWS_ENDPOINT_URL,
    });

    // Validar y guardar el nombre del bucket
    if (!options.s3BucketName) {
      throw new Error('s3BucketName is required in AwsOptions');
    }
    this.bucketName = options.s3BucketName;

    this.logger.log(
      `Initialized S3 adapter - Region: ${options.region}, Bucket: ${this.bucketName}`,
    );
  }

  /**
   * Obtiene datos de un archivo desde S3
   *
   * @param path - Ruta relativa dentro del bucket (ej: "abc123/src/file.ts")
   * @returns Contenido del archivo y tipo de contenido
   */
  async getData(path: string): Promise<GetDataFromFileOutputDto> {
    try {
      this.logger.log(`Getting file from S3: bucket=${this.bucketName}, key=${path}`);

      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: path,
        }),
      );

      const content = (await response.Body?.transformToString()) || '';
      const contentType = response.ContentType ?? 'text/plain';

      this.logger.log(
        `File retrieved successfully: ${path} (${content.length} bytes, type: ${contentType})`,
      );

      const output = new GetDataFromFileOutputDto();
      output.content = content;
      output.contentType = contentType;
      return output;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error getting file from S3 - Bucket: ${this.bucketName}, Key: ${path}, Error: ${err.message}`,
        err.stack,
      );
      throw new Error(
        `Failed to get file from S3 (bucket: ${this.bucketName}, key: ${path}): ${err.message}`,
      );
    }
  }
}