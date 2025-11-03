import { Injectable } from '@nestjs/common';
import { Context } from '@rekog/mcp-nest';

/**
 * ContextService - Servicio para gestionar contextos MCP de jobs activos
 *
 * Almacena los contextos MCP asociados a cada job para permitir reportar
 * progreso de forma asíncrona cuando el job se está procesando en background.
 *
 * Características:
 * - Almacenamiento en memoria (Map) de contextos por jobId
 * - Permite reportar progreso desde cualquier parte de la aplicación
 * - Gestión del ciclo de vida de los contextos
 *
 * Flujo típico:
 * 1. Tool invocado → guarda contexto
 * 2. Job se procesa en background → recupera contexto
 * 3. Reporta progreso al cliente MCP
 * 4. Job completa → elimina contexto
 *
 * @example
 * // Guardar contexto al invocar tool
 * contextService.saveContext(jobId, context);
 *
 * // Recuperar contexto para reportar progreso
 * const ctx = contextService.getContext(jobId);
 * await ctx.reportProgress({ progress: 50, total: 100 });
 *
 * // Limpiar contexto al finalizar
 * contextService.deleteContext(jobId);
 */
@Injectable()
export class ContextService {
  private contexts = new Map<string, Context>();

  /**
   * Guarda un contexto MCP asociado a un job
   *
   * @param taskId - ID del job/tarea
   * @param context - Contexto MCP de la invocación
   */
  saveContext(taskId: string, context: Context) {
    this.contexts.set(taskId, context);
  }

  /**
   * Recupera el contexto MCP de un job
   *
   * @param taskId - ID del job/tarea
   * @returns Contexto MCP o undefined si no existe
   */
  getContext(taskId: string) {
    return this.contexts.get(taskId);
  }

  /**
   * Elimina el contexto MCP de un job
   *
   * @param taskId - ID del job/tarea
   */
  deleteContext(taskId: string) {
    this.contexts.delete(taskId);
  }
}
