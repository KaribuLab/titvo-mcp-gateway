import 'reflect-metadata';
import type { Context } from '@rekog/mcp-nest';
import { Tool } from '@rekog/mcp-nest';
import { JobPersistencePort } from '../../packages/cloud-contracts/ports/job-persistence.port';
import { PublishEventPort } from '../../packages/cloud-contracts/ports/publish-event.port';
import { ContextService } from '../../shared/services/context.service';
import { InvokeOutputDto } from '../../core/invocations/dto/invoke-output.dto';
import { SchemaDto } from '../../shared/dto/schema.dto';

/**
 * Opciones para el decorador @InvokeTool
 */
export interface InvokeToolOptions {
  name: string;
  description: string;
  dtoClass: typeof SchemaDto; // Clase que extiende SchemaDto
  title?: string;
  destructiveHint?: boolean;
  readOnlyHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/**
 * Decorador @InvokeTool - Simplifica la creación de tools MCP
 *
 * Este decorador:
 * 1. Aplica el decorador @Tool con las opciones configuradas
 * 2. Genera el schema automáticamente desde el DTO
 * 3. Ejecuta la lógica común (publicar evento, guardar job, reportar progreso)
 *
 * Beneficios:
 * - Reduce código duplicado en cada tool
 * - Schema generado automáticamente desde decoradores
 * - Lógica centralizada y fácil de mantener
 *
 * @example
 * ```typescript
 * @InvokeTool({
 *   name: 'invoke-get-commit-data',
 *   description: 'Gets commit data from a repository',
 *   dtoClass: GetCommitInputDto,
 *   title: 'Execute get commit data tool',
 * })
 * async getCommitDataInvoke(input: GetCommitInputDto, context: Context) {
 *   // El método puede estar vacío
 *   // El decorador maneja todo automáticamente
 * }
 * ```
 */
export function InvokeTool(options: InvokeToolOptions) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    // ====================================================
    // PASO 1: Reemplazar el método con wrapper que ejecuta lógica común
    // ====================================================
    descriptor.value = async function (
      this: {
        publishEvent: PublishEventPort;
        jobPersistence: JobPersistencePort;
        contextService: ContextService;
      },
      input: unknown,
      context: Context,
    ) {
      // IMPORTANTE: Usar 'function' (no arrow) para mantener 'this'
      // 'this' es la instancia de la clase (ej: InvokeTool)

      // Obtener servicios inyectados desde la instancia
      const publishEvent = this.publishEvent;
      const jobPersistence = this.jobPersistence;
      const contextService = this.contextService;

      // Validar que los servicios estén disponibles
      if (!publishEvent || !jobPersistence || !contextService) {
        throw new Error(
          `@InvokeTool: Required services not found. Ensure the class has @Inject(PUBLISH_EVENT), @Inject(JOB_PERSISTENCE), and ContextService injected.`,
        );
      }

      try {
        // ====================================================
        // LÓGICA COMÚN: Publicar evento y guardar job
        // ====================================================

        // 1. Publicar evento al sistema de mensajería
        const output: InvokeOutputDto = await publishEvent.publish(
          context.mcpRequest.params.name as string,
          input,
        );

        // 2. Reportar progreso inicial
        await context.reportProgress({ progress: 0, total: 100 });

        // 3. Guardar job en la base de datos
        await jobPersistence.saveJob({
          id: output.jobId,
          content: input,
          status: 'REQUESTED',
          progress: 0,
        });

        // 4. Guardar contexto MCP para reportar progreso después
        contextService.saveContext(output.jobId, context);

        // 5. Log informativo
        console.log(
          `[${options.name}] Event published with ID: ${output.jobId}`,
        );

        // 6. Retornar el output
        return output;
      } catch (error) {
        // Manejo de errores
        const err = error as Error;
        console.error(
          `[${options.name}] Error processing tool:`,
          err.message,
          err.stack,
        );
        throw error;
      }
    };

    // ====================================================
    // PASO 3: Construir opciones para el decorador @Tool
    // ====================================================
    const toolOptions = {
      name: options.name,
      description: options.description,
      // Schema generado automáticamente desde el DTO
      parameters: options.dtoClass.schema(),
      outputSchema: InvokeOutputDto.schema(),
      annotations: {
        title: options.title || options.name,
        destructiveHint: options.destructiveHint ?? false,
        readOnlyHint: options.readOnlyHint ?? true,
        idempotentHint: options.idempotentHint ?? true,
        openWorldHint: options.openWorldHint ?? false,
      },
    };

    // ====================================================
    // PASO 4: Aplicar el decorador @Tool DESPUÉS de modificar el descriptor
    // ====================================================
    const toolDecorator = Tool(toolOptions);
    toolDecorator(target, propertyKey, descriptor);

    // Retornar el descriptor modificado
    return descriptor;
  };
}
