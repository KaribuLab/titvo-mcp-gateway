import { Inject, Injectable } from "@nestjs/common";
import type { Context } from "@rekog/mcp-nest";
import {
  JOB_PERSISTENCE,
  PUBLISH_EVENT,
} from "../../packages/cloud-contracts/constants/injection-tokens";
import { JobPersistencePort } from "../../packages/cloud-contracts/ports/job-persistence.port";
import { PublishEventPort } from "../../packages/cloud-contracts/ports/publish-event.port";
import { ContextService } from "../../shared/services/context.service";
import { InvokeAsyncTool } from "../decorators/invoke-async-tool.decorator";
import { PollAsyncTool } from "../decorators/poll-async-tool.decorator";
import { GetCommitInputDto } from "../../core/invocations/dto/get-commit-input.dto";
import { WaitJobInputDto } from "../../core/invocations/dto/wait-job-input.dto";
import { GitCommitFilesOutputDto } from "../../core/invocations/dto/git-commit-files-output.dto";

/**
 * InvokeToolService - Servicio que expone tools MCP para invocar operaciones asíncronas
 *
 * Este servicio define los tools MCP que los clientes pueden invocar.
 * Cada tool asíncrono utiliza dos decoradores:
 * - @InvokeAsyncTool: Inicia el job y retorna jobId + pollToolName
 * - @PollAsyncTool: Consulta el estado del job y retorna resultado con status
 *
 * Características:
 * - Tools definidos de forma declarativa con decoradores
 * - Schemas Zod generados automáticamente desde DTOs
 * - Procesamiento asíncrono en background
 * - El cliente recibe jobId y pollToolName inmediatamente
 * - El cliente debe hacer polling usando la tool de polling hasta que status sea SUCCESS o FAILURE
 *
 * Flujo de invocación:
 * 1. Cliente invoca el tool con parámetros (ej: mcp.tool.git.commit-files)
 * 2. @InvokeAsyncTool publica evento y guarda job
 * 3. Cliente recibe { jobId, pollToolName }
 * 4. Worker procesa job en background
 * 5. Cliente invoca la tool de polling (ej: mcp.tool.git.commit-files.poll) con jobId
 * 6. @PollAsyncTool consulta estado y retorna { jobId, status, ...campos específicos }
 * 7. Si status es REQUESTED o IN_PROGRESS, cliente espera y vuelve a llamar la tool de polling
 * 8. Si status es SUCCESS, cliente tiene todos los datos disponibles
 *
 * @example
 * // Agregar un nuevo tool asíncrono:
 * @InvokeAsyncTool({
 *   name: "mcp.tool.my-tool",
 *   description: "Description of what the tool does",
 *   dtoClass: MyInputDto,
 *   pollToolName: "mcp.tool.my-tool.poll",
 *   title: "Execute my tool",
 * })
 * async myTool(input: MyInputDto, context: Context) {}
 *
 * @PollAsyncTool({
 *   name: "mcp.tool.my-tool.poll",
 *   description: "Check status of my tool job",
 *   dtoClass: WaitJobInputDto,
 *   outputSchemaClass: MyOutputDto,
 *   title: "Get my tool result",
 * })
 * async pollMyTool(input: WaitJobInputDto, context: Context): Promise<MyOutputDto> {
 *   return {} as MyOutputDto;
 * }
 */
@Injectable()
export class InvokeToolService {
  constructor(
    @Inject(PUBLISH_EVENT) private readonly publishEvent: PublishEventPort,
    @Inject(JOB_PERSISTENCE)
    private readonly jobPersistence: JobPersistencePort,
    private readonly contextService: ContextService,
  ) { }

  /**
   * Tool: Obtener datos de un commit de repositorio
   *
   * Invoca una operación para extraer información de un commit específico
   * desde un repositorio Git (archivos modificados, autor, mensaje, etc.)
   */
  @InvokeAsyncTool({
    name: "mcp.tool.git.commit-files",
    description:
      "Fetches commit files for analysis (GitHub, Bitbucket, or any Git URL). Use first to obtain file paths. Returns jobId and pollToolName; you MUST poll until SUCCESS to read filesPaths.",
    dtoClass: GetCommitInputDto,
    pollToolName: "mcp.tool.git.commit-files.poll",
    title: "Get commit files for security analysis",
    destructiveHint: false,
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  })
  async toolGitCommitFiles(input: GetCommitInputDto, context: Context) { }

  /**
   * Tool: Hacer polling del resultado de git commit-files
   *
   * Consulta el estado de un job de git commit-files.
   * Retorna el estado actual con jobId, status y campos específicos (filesPaths, commitId) cuando está disponible.
   *
   * @param input - DTO con el jobId a consultar
   * @param context - Contexto MCP
   * @returns Resultado con jobId, status y campos específicos según el estado del job
   */
  @PollAsyncTool({
    name: 'mcp.tool.git.commit-files.poll',
    description:
      'Poll git commit-files job status. Pass jobId from mcp.tool.git.commit-files. Repeat until status is SUCCESS or FAILURE. On SUCCESS, use filesPaths and commitId from the response (see schema).',
    dtoClass: WaitJobInputDto,
    outputSchemaClass: GitCommitFilesOutputDto,
    resultMapper: (result: any) => {
      // Mapear campos snake_case a camelCase
      const mapped: any = { ...result };

      // Mapear commit_id -> commitId
      if ('commit_id' in mapped && !('commitId' in mapped)) {
        mapped.commitId = mapped.commit_id;
        delete mapped.commit_id;
      }

      // Mapear files_paths -> filesPaths
      if ('files_paths' in mapped && !('filesPaths' in mapped)) {
        mapped.filesPaths = mapped.files_paths;
        delete mapped.files_paths;
      }

      return mapped;
    },
    title: 'Get git commit files result',
    destructiveHint: false,
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  })
  async pollGitCommitFiles(
    input: WaitJobInputDto,
    context: Context,
  ): Promise<GitCommitFilesOutputDto> {
    // El decorador @PollAsyncTool maneja toda la lógica de polling automáticamente
    // Este método nunca se ejecuta directamente, el decorador lo reemplaza completamente
    return {} as GitCommitFilesOutputDto;
  }

}
