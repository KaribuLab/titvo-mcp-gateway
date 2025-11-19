import { GetDataFromFileOutputDto } from 'src/core/invocations/dto/get-data-from-file-output.dto';
import type { JobDto } from '../types/job.dto';
import type { SaveJobDto } from '../types/save-job.dto';
import type { UpdateJobDto } from '../types/update-job.dto';

export type { JobDto, SaveJobDto, UpdateJobDto };

/**
 * Port para obtener datos de un archivo (Hexagonal Architecture)
 *
 * Define el contrato que deben cumplir todos los adaptadores de obtener datos de un archivo, independientemente del provider de cloud.
 *
 * Implementaciones:
 * - LocalGetDataFromFileAdapter: Obtiene datos de un archivo local
 * - AwsGetDataFromFileAdapter: Obtiene datos de un archivo en AWS
 * - GcpGetDataFromFileAdapter: Obtiene datos de un archivo en GCP
 * - AzureGetDataFromFileAdapter: Obtiene datos de un archivo en Azure
 *
 * @example
 * // Inyectar en un controlador:
 * constructor(@Inject(GET_DATA_FROM_FILE) private getDataFromFile: GetDataFromFilePort) {}
 *
 * // Obtener contenido de un archivo:
 * const data = await this.getDataFromFile.getData('path/to/file');
 * console.log(data);
 */
export interface GetDataFromFilePort {
  /**
   * Obtiene el contenido de un archivo
   *
   * @param path - Ruta del archivo
   * @returns DTO con el contenido del archivo y el tipo de contenido
   * @throws Error si la operación falla
   */
  getData(path: string): Promise<GetDataFromFileOutputDto>;

}
