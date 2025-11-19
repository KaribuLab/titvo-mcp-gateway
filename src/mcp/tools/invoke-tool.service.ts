import { Inject, Injectable } from "@nestjs/common";
import type { Context } from "@rekog/mcp-nest";
import {
  JOB_PERSISTENCE,
  PUBLISH_EVENT,
} from "../../packages/cloud-contracts/constants/injection-tokens";
import { JobPersistencePort } from "../../packages/cloud-contracts/ports/job-persistence.port";
import { PublishEventPort } from "../../packages/cloud-contracts/ports/publish-event.port";
import { ContextService } from "../../shared/services/context.service";
import { InvokeTool } from "../decorators/invoke-tool.decorator";
import { InvokeAsyncTool } from "../decorators/invoke-async-tool.decorator";
import { PollAsyncTool } from "../decorators/poll-async-tool.decorator";
import { GetCommitInputDto } from "../../core/invocations/dto/get-commit-input.dto";
import { IssueReportInputDto } from "../../core/invocations/dto/issue-report-input.dto";
import { BitbucketCodeInsightsInputDto } from "src/core/invocations/dto/bitbucket-code-insights-input.dto";
import { GithubIssueInputDto } from "src/core/invocations/dto/github-issue-input.dto";
import { WaitJobInputDto } from "../../core/invocations/dto/wait-job-input.dto";
import { GitCommitFilesOutputDto } from "../../core/invocations/dto/git-commit-files-output.dto";

/**
 * InvokeToolService - Servicio que expone tools MCP para invocar operaciones
 *
 * Este servicio define los tools MCP que los clientes pueden invocar.
 * Cada tool utiliza el decorador @InvokeTool que encapsula la lógica común:
 * - Publicación del evento al sistema de mensajería
 * - Creación y almacenamiento del job
 * - Guardado del contexto MCP para reportar progreso
 * - Retorno inmediato del jobId al cliente
 *
 * Características:
 * - Tools definidos de forma declarativa con decoradores
 * - Schemas Zod generados automáticamente desde DTOs
 * - Procesamiento asíncrono en background
 * - El cliente recibe jobId inmediatamente y puede consultar progreso
 *
 * Flujo de invocación:
 * 1. Cliente invoca el tool con parámetros
 * 2. @InvokeTool publica evento y guarda job
 * 3. Cliente recibe jobId
 * 4. Worker procesa job en background
 * 5. Cliente consulta progreso via jobId
 *
 * @example
 * // Agregar un nuevo tool:
 * @InvokeTool({
 *   name: "my-new-tool",
 *   description: "Description of what the tool does",
 *   dtoClass: MyInputDto,
 *   title: "Execute my tool",
 * })
 * async myNewTool(input: MyInputDto, context: Context) {}
 */
@Injectable()
export class InvokeToolService {
  constructor(
    @Inject(PUBLISH_EVENT) private readonly publishEvent: PublishEventPort,
    @Inject(JOB_PERSISTENCE)
    private readonly jobPersistence: JobPersistencePort,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Tool: Obtener datos de un commit de repositorio
   *
   * Invoca una operación para extraer información de un commit específico
   * desde un repositorio Git (archivos modificados, autor, mensaje, etc.)
   */
  @InvokeAsyncTool({
    name: "mcp.tool.git.commit-files",
    description: "Invokes an tool to get the commit data from a repository, save the files in a container and return its exact ids. This tool returns a jobId and pollToolName immediately. You MUST use the pollToolName returned with the jobId to get the filesPaths array before using mcp.tool.files.",
    dtoClass: GetCommitInputDto,
    pollToolName: "mcp.tool.git.commit-files.poll",
    title: "Execute get commit files tool and save files in a container",
    destructiveHint: false,
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  })
  async toolGitCommitFiles(input: GetCommitInputDto, context: Context) {}

  /**
   * Tool: Hacer polling del resultado de git commit-files
   *
   * Hace polling del estado de un job de git commit-files hasta que termine (SUCCESS o FAILURE).
   * Usa internamente el resource MCP estándar `job://{jobId}` a través de JobPersistencePort.
   *
   * @param input - DTO con el jobId a esperar
   * @param context - Contexto MCP
   * @returns Resultado completo con jobId, filesPaths y commitId
   * @throws Error si el job no existe, timeout o falla
   */
  @PollAsyncTool({
    name: 'mcp.tool.git.commit-files.poll',
    description:
      'Check the status of a git commit-files job. Use this tool with the jobId returned by mcp.tool.git.commit-files. The response includes a "status" field that indicates the job state: "REQUESTED" or "IN_PROGRESS" means the job is still processing (call this tool again later), "SUCCESS" means the job completed and filesPaths/commitId are available, "FAILURE" means the job failed. Keep calling this tool until status is "SUCCESS" or "FAILURE".',
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

  /**
   * Tool: Generar reporte desde lista de anotaciones
   *
   * Invoca una operación para generar un reporte consolidado a partir
   * de una lista de anotaciones (issues, warnings, etc.)
   */
  @InvokeTool({
    name: "mcp.tool.issue.report",
    description: "Invokes a tool to get a report from a annotations list",
    dtoClass: IssueReportInputDto,
    title: "Execute get report tool",
    destructiveHint: false,
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  })
  async toolIssueReport(input: IssueReportInputDto, context: Context) {}


  @InvokeTool({
    name: "mcp.tool.bitbucket.code-insights",
    description: "Invokes a tool to get a code insights from a repository",
    dtoClass: BitbucketCodeInsightsInputDto,
    title: "Execute get code insights tool",
    destructiveHint: false,
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  })
  async toolBitbucketCodeInsights(input: BitbucketCodeInsightsInputDto,context: Context) {}

  @InvokeTool({
    name: "mcp.tool.github.issue",
    description: "Invokes a tool to get a issue from a repository",
    dtoClass: GithubIssueInputDto,
    title: "Execute get issue tool",
    destructiveHint: false,
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  })
  async toolGithubIssue(input: GithubIssueInputDto, context: Context) {}
}
