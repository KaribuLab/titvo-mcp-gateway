import 'reflect-metadata';
import type { Context } from '@rekog/mcp-nest';
import { Tool } from '@rekog/mcp-nest';
import { JobPersistencePort } from '../../packages/cloud-contracts/ports/job-persistence.port';
import { SchemaDto } from '../../shared/dto/schema.dto';

/**
 * Opciones para el decorador @PollAsyncTool
 */
export interface PollAsyncToolOptions {
  name: string;
  description: string;
  dtoClass: typeof SchemaDto; // Clase que extiende SchemaDto para el input (debe tener jobId)
  outputSchemaClass: typeof SchemaDto; // Schema específico del resultado
  resultMapper?: (result: any) => any; // Función opcional para transformar job.result antes de asignarlo
  title?: string;
  destructiveHint?: boolean;
  readOnlyHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/**
 * Decorador @PollAsyncTool - Simplifica la creación de tools MCP para consultar estado de jobs
 *
 * Este decorador:
 * 1. Aplica el decorador @Tool con las opciones configuradas
 * 2. Genera el schema automáticamente desde los DTOs
 * 3. Consulta el estado del job una vez
 * 4. Retorna el resultado completo con el schema específico si el job terminó
 * 5. Lanza error si el job aún está en progreso (el agente debe hacer polling)
 *
 * Características:
 * - Consulta el estado usando JobPersistencePort (misma fuente que JobResource)
 * - NO hace polling automático - el agente debe llamar repetidamente hasta que el job termine
 * - Retorna resultado con schema específico bien tipado cuando está listo
 * - Lanza error si el job está en progreso para que el agente sepa que debe esperar
 *
 * @example
 * ```typescript
 * @PollAsyncTool({
 *   name: 'mcp.tool.git.commit-files.poll',
 *   description: 'Check git commit files job result. Call this tool repeatedly until the job completes.',
 *   dtoClass: WaitJobInputDto,
 *   outputSchemaClass: GitCommitFilesOutputDto,
 *   title: 'Get git commit files result',
 * })
 * async pollGitCommitFiles(input: WaitJobInputDto, context: Context): Promise<GitCommitFilesOutputDto> {
 *   // El decorador consulta el estado una vez
 * }
 * ```
 */
export function PollAsyncTool(options: PollAsyncToolOptions) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    // ====================================================
    // PASO 1: Reemplazar el método con wrapper que consulta estado una vez
    // ====================================================
    descriptor.value = async function (
      this: {
        jobPersistence: JobPersistencePort;
      },
      input: unknown,
      context: Context,
    ) {
      // IMPORTANTE: Usar 'function' (no arrow) para mantener 'this'
      // 'this' es la instancia de la clase (ej: InvokeToolService)

      // Obtener servicio inyectado desde la instancia
      const jobPersistence = this.jobPersistence;

      // Validar que el servicio esté disponible
      if (!jobPersistence) {
        throw new Error(
          `@PollAsyncTool: Required service not found. Ensure the class has @Inject(JOB_PERSISTENCE) injected.`,
        );
      }

      // Extraer jobId del input (asumiendo que tiene una propiedad jobId)
      const inputDto = input as { jobId: string };
      const { jobId } = inputDto;

      if (!jobId) {
        throw new Error('@PollAsyncTool: Input must have a jobId property');
      }

      console.log(`[${options.name}] Checking status for job: ${jobId}`);

      // Consultar estado del job usando JobPersistencePort (una sola vez)
      const job = await jobPersistence.getJob(jobId);

      if (!job) {
        const error = new Error(`Job ${jobId} not found`);
        console.error(`[${options.name}] ${error.message}`);
        throw error;
      }

      // Crear instancia del outputSchemaClass y asignar valores
      const OutputClass = options.outputSchemaClass;
      // Crear instancia usando new (las clases concretas que extienden SchemaDto no son abstractas)
      // Usamos 'as any' para evitar el error de TypeScript sobre clases abstractas
      const output = new (OutputClass as any)();

      // Asignar jobId siempre
      if ('jobId' in output && job.id) {
        (output as { jobId: string }).jobId = job.id;
      }

      // Asignar status siempre
      if ('status' in output) {
        (output as { status: string }).status = job.status;
      }

      // Si el job terminó exitosamente, asignar resultado
      if (job.status === 'SUCCESS') {
        console.log(
          `[${options.name}] Job ${jobId} completed successfully`,
        );

        // Asignar valores desde job.result
        // Aplicar resultMapper si existe para transformar el resultado
        let resultToAssign = job.result;
        if (job.result && options.resultMapper) {
          resultToAssign = options.resultMapper(job.result);
        }
        
        if (resultToAssign) {
          Object.assign(output, resultToAssign);
        }
      } else if (job.status === 'REQUESTED' || job.status === 'IN_PROGRESS') {
        // Job en progreso - retornar objeto con status para que el agente sepa que debe esperar
        console.log(
          `[${options.name}] Job ${jobId} is still ${job.status.toLowerCase()}. Progress: ${job.progress}%.`,
        );
        // No asignar resultado, solo status y jobId
      } else if (job.status === 'FAILURE') {
        // Job falló - retornar objeto con status FAILURE
        console.error(
          `[${options.name}] Job ${jobId} failed: ${job.message || 'Unknown error'}`,
        );
        // No asignar resultado, solo status y jobId
      } else {
        // Estado desconocido
        console.error(
          `[${options.name}] Job ${jobId} has unknown status: ${job.status}`,
        );
      }

      return output;
    };

    // ====================================================
    // PASO 2: Construir opciones para el decorador @Tool
    // ====================================================
    const toolOptions = {
      name: options.name,
      description: options.description,
      // Schema generado automáticamente desde el DTO de entrada
      parameters: options.dtoClass.schema(),
      // Schema específico del resultado
      outputSchema: options.outputSchemaClass.schema(),
      annotations: {
        title: options.title || options.name,
        destructiveHint: options.destructiveHint ?? false,
        readOnlyHint: options.readOnlyHint ?? true,
        idempotentHint: options.idempotentHint ?? true,
        openWorldHint: options.openWorldHint ?? false,
      },
    };

    // ====================================================
    // PASO 3: Aplicar el decorador @Tool DESPUÉS de modificar el descriptor
    // ====================================================
    const toolDecorator = Tool(toolOptions);
    toolDecorator(target, propertyKey, descriptor);

    // Retornar el descriptor modificado
    return descriptor;
  };
}


