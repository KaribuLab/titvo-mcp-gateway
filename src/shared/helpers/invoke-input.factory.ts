import { InvokeInputDto } from '../../core/invocations/dto/invoke-input.dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * InvokeInputFactory - Factory para crear objetos InvokeInputDto
 *
 * Genera un DTO de entrada para invocaciones con un ID único generado
 * automáticamente basado en el nombre del tool y un UUID.
 *
 * Características:
 * - Genera IDs únicos para cada invocación
 * - Formato del ID: `{toolID}-{uuid}`
 * - Encapsula la lógica de creación del DTO
 *
 * @example
 * const input = InvokeInputFactory.create('get-commit-data', {
 *   repository: 'org/repo',
 *   commitId: 'abc123'
 * });
 * // input.jobId = 'get-commit-data-550e8400-e29b-41d4-a716-446655440000'
 */
export class InvokeInputFactory {
  /**
   * Crea un InvokeInputDto con un ID único generado automáticamente
   *
   * @param toolID - Identificador del tool que se está invocando
   * @param data - Datos de entrada para el tool
   * @returns InvokeInputDto con jobId único y datos
   *
   * @example
   * const input = InvokeInputFactory.create('my-tool', { key: 'value' });
   */
  static create<T>(toolID: string, data: T) {
    const taskId = `${toolID}-${uuidv4()}`;
    return new InvokeInputDto(taskId, data);
  }
}
