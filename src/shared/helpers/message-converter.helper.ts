/**
 * MessageConverterHelper - Helper para convertir objetos entre formatos
 *
 * Convierte recursivamente nombres de propiedades de camelCase a snake_case.
 * Útil para adaptar objetos JavaScript a formatos de mensajería o APIs
 * que usan snake_case.
 *
 * Características:
 * - Conversión recursiva (objetos anidados y arrays)
 * - Maneja null y valores primitivos
 * - Preserva la estructura original del objeto
 *
 * @example
 * const input = {
 *   userId: '123',
 *   firstName: 'John',
 *   metadata: { createdAt: '2024-01-01' }
 * };
 *
 * const output = MessageConverterHelper.convertToMessage(input);
 * // { user_id: '123', first_name: 'John', metadata: { created_at: '2024-01-01' } }
 */
export class MessageConverterHelper {
  /**
   * Convierte un objeto de camelCase a snake_case recursivamente
   *
   * Transforma todos los nombres de propiedades del objeto y sus descendientes
   * de camelCase a snake_case.
   *
   * @param data - Objeto, array o primitivo a convertir
   * @returns Objeto convertido con propiedades en snake_case
   *
   * @example
   * const message = MessageConverterHelper.convertToMessage({
   *   jobId: '123',
   *   taskData: { userName: 'John' }
   * });
   * // { job_id: '123', task_data: { user_name: 'John' } }
   */
  static convertToMessage(data: any): any {
    // Manejar null y primitivos
    if (data === null || typeof data !== 'object') {
      return data;
    }

    // Manejar arrays ANTES de objetos
    if (Array.isArray(data)) {
      return data.map((item) => this.convertToMessage(item));
    }

    // Manejar objetos
    const message = {};
    Object.keys(data).forEach((key) => {
      message[this.camelToSnakeCase(key)] = this.convertToMessage(data[key]);
    });
    return message;
  }

  /**
   * Convierte una cadena de camelCase a snake_case
   *
   * @param str - Cadena en camelCase
   * @returns Cadena en snake_case
   *
   * @example
   * camelToSnakeCase('userId') // 'user_id'
   * camelToSnakeCase('firstName') // 'first_name'
   */
  private static camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}
