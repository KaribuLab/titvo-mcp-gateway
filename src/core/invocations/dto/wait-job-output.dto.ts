import { SchemaDto } from '../../../shared/dto/schema.dto';
import {
  StringField,
  NumberField,
  AnyField,
} from '../../../shared/dto/decorators/field.decorator';

/**
 * WaitJobOutputDto - DTO de salida para el tool de espera de job
 *
 * Retorna el estado completo del job cuando termina (SUCCESS o FAILURE).
 * Incluye el resultado completo con los datos procesados.
 *
 * Características:
 * - Extiende SchemaDto para generación automática de schema Zod
 * - Contiene el estado final del job
 * - Incluye el resultado completo cuando el job es exitoso
 * - Incluye mensaje descriptivo del estado
 *
 * Nota: El campo `result` es de tipo `any` para mantener flexibilidad con diferentes
 * tipos de jobs. Para git commit-files, la estructura esperada es:
 * {
 *   filesPaths: string[];
 *   commitId?: string;
 * }
 *
 * @example
 * const output = new WaitJobOutputDto();
 * output.id = 'mcp.tool.git.commit-files-abc-123';
 * output.status = 'SUCCESS';
 * output.result = { filesPaths: ['path1', 'path2'], commitId: 'abc123' };
 * output.message = 'Job completed successfully';
 * output.progress = 100;
 */
export class WaitJobOutputDto extends SchemaDto {
  /** ID del job */
  @StringField({ description: 'The ID of the job' })
  id: string;

  /** Estado final del job (SUCCESS o FAILURE) */
  @StringField({ description: 'Final status of the job: SUCCESS or FAILURE' })
  status: string;

  /** Resultado del job (solo disponible si status === SUCCESS). Para git commit-files contiene { filesPaths: string[], commitId?: string } */
  @AnyField({
    description:
      'Result of the job when completed successfully. Structure varies by job type. For mcp.tool.git.commit-files jobs, the result structure is: { filesPaths: string[] (array of file paths), commitId?: string (optional commit ID) }. Example: { "filesPaths": ["abc123/src/index.ts", "abc123/src/utils.ts"], "commitId": "abc123" }',
    required: false,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;

  /** Mensaje descriptivo del estado o error */
  @StringField({ description: 'Descriptive message about the job status or error' })
  message: string;

  /** Progreso del job (0 a 100) */
  @NumberField({ description: 'Progress of the job from 0 to 100', min: 0, max: 100, int: true })
  progress: number;
}

