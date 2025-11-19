import {
  StringField
} from '../../../shared/dto/decorators/field.decorator';
import { SchemaDto } from '../../../shared/dto/schema.dto';

/**
 * GetDataFromFileInputDto - DTO para obtener datos de un archivo
 *
 * Define los parámetros necesarios para obtener datos de un archivo
 *
 * Características:
 * - Extiende SchemaDto para generación automática de schema Zod
 * - Requiere la ruta del archivo
 *
 * @example
 * const input = new GetDataFromFileInputDto();
 * input.path = 'directory/src/index.ts';
 */

export class GetDataFromFileInputDto extends SchemaDto {
  /** Ruta del archivo */
  @StringField({ description: 'Path of the file returned by the array files_paths from mcp.tool.git.commit-files tool' })
  path: string;
}
