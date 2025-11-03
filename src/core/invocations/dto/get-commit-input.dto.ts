import { SchemaDto } from '../../../shared/dto/schema.dto';
import { StringField } from '../../../shared/dto/decorators/field.decorator';

/**
 * GetCommitInputDto - DTO de entrada para obtener datos de un commit
 *
 * Define los parámetros necesarios para extraer información de un commit
 * específico desde un repositorio Git.
 *
 * Información típicamente extraída:
 * - Archivos modificados/creados/eliminados
 * - Diferencias (diff) del código
 * - Autor y fecha del commit
 * - Mensaje del commit
 * - Estadísticas (líneas agregadas/eliminadas)
 *
 * Características:
 * - Extiende SchemaDto para generación automática de schema Zod
 * - Validación automática de parámetros
 * - Usado por el tool 'invoke-get-commit-data'
 *
 * @example
 * const input = new GetCommitInputDto();
 * input.repository = 'https://github.com/org/repo';
 * input.commitId = 'abc123def456';
 */
export class GetCommitInputDto extends SchemaDto {
  /** URL del repositorio Git (HTTP/HTTPS o SSH) */
  @StringField({ description: 'URL of the repository' })
  repository: string;

  /** SHA del commit a consultar */
  @StringField({ description: 'Commit ID to get the data from' })
  commitId: string;
}
