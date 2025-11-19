import {
  StringField
} from '../../../shared/dto/decorators/field.decorator';
import { SchemaDto } from '../../../shared/dto/schema.dto';

/**
 * GetDataFromFileOutputDto - DTO para obtener datos de un archivo
 *
 * Define los datos que se obtendrán de un archivo
 *
 * Características:
 * - Extiende SchemaDto para generación automática de schema Zod
 * - Contiene el contenido del archivo
 * - Contiene el tipo de contenido del archivo
 *
 * @example
 * const output = new GetDataFromFileOutputDto();
 * output.content = 'console.log("Hello, world!");';
 * output.contentType = 'text/plain';
 */
export class GetDataFromFileOutputDto extends SchemaDto {
  /** Contenido del archivo */
  @StringField({ description: 'Content of the file' })
  content: string;

  /** Tipo de contenido del archivo */
  @StringField({ description: 'Type of the content' })
  contentType: string;

}
