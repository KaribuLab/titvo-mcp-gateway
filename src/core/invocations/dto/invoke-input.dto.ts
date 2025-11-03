/**
 * InvokeInputDto - DTO de entrada para invocaciones de tools
 *
 * Encapsula los datos necesarios para procesar una invocación de tool:
 * - jobId: Identificador único del job generado
 * - data: Payload con los parámetros del tool
 *
 * Este DTO se crea mediante InvokeInputFactory y se serializa para
 * enviar a través del sistema de mensajería (EventBridge, SQS, Pub/Sub, etc.)
 *
 * @template T - Tipo del payload de datos del tool
 *
 * @example
 * const input = new InvokeInputDto('my-tool-abc-123', {
 *   repository: 'org/repo',
 *   commitId: 'abc123'
 * });
 */
export class InvokeInputDto<T> {
  /** Identificador único del job (formato: {toolId}-{uuid}) */
  jobId: string;

  /** Datos de entrada del tool (parámetros específicos) */
  data: T;

  constructor(jobId: string, data: T) {
    this.jobId = jobId;
    this.data = data;
  }
}
