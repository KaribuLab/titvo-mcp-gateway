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
import { IssueReportInputDto } from "../../core/invocations/dto/issue-report-input.dto";
import { BitbucketCodeInsightsInputDto } from "src/core/invocations/dto/bitbucket-code-insights-input.dto";
import { GithubIssueInputDto } from "src/core/invocations/dto/github-issue-input.dto";
import { WaitJobInputDto } from "../../core/invocations/dto/wait-job-input.dto";
import { GitCommitFilesOutputDto } from "../../core/invocations/dto/git-commit-files-output.dto";
import { IssueReportOutputDto } from "../../core/invocations/dto/issue-report-output.dto";
import { BitbucketCodeInsightsOutputDto } from "../../core/invocations/dto/bitbucket-code-insights-output.dto";
import { GithubIssueOutputDto } from "../../core/invocations/dto/github-issue-output.dto";

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
   * de una lista de anotaciones (issues, warnings, etc.).
   * Retorna jobId y pollToolName inmediatamente. Usa la tool de polling para obtener el reportURL.
   */
  @InvokeAsyncTool({
    name: "mcp.tool.issue.report",
    description: "Invokes a tool to get a report from a annotations list. This tool returns a jobId and pollToolName immediately. You MUST use the pollToolName returned with the jobId to get the reportURL.",
    dtoClass: IssueReportInputDto,
    pollToolName: "mcp.tool.issue.report.poll",
    title: "Execute get report tool",
    destructiveHint: false,
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  })
  async toolIssueReport(input: IssueReportInputDto, context: Context) {}

  /**
   * Tool: Hacer polling del resultado de issue report
   *
   * Consulta el estado de un job de issue report.
   * Retorna el estado actual con jobId, status y reportURL cuando está disponible.
   */
  @PollAsyncTool({
    name: 'mcp.tool.issue.report.poll',
    description:
      'Check the status of an issue report job. Use this tool with the jobId returned by mcp.tool.issue.report. The response includes a "status" field that indicates the job state: "REQUESTED" or "IN_PROGRESS" means the job is still processing (call this tool again later), "SUCCESS" means the job completed and reportURL is available, "FAILURE" means the job failed. Keep calling this tool until status is "SUCCESS" or "FAILURE".',
    dtoClass: WaitJobInputDto,
    outputSchemaClass: IssueReportOutputDto,
    title: 'Get issue report result',
    destructiveHint: false,
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
    resultMapper: (result: any) => {
      const mapped: any = { ...result };
      if ('report_url' in mapped && !('reportURL' in mapped)) {
        mapped.reportURL = mapped.report_url;
        delete mapped.report_url;
      }
      return mapped;
    },
  })
  async pollIssueReport(
    input: WaitJobInputDto,
    context: Context,
  ): Promise<IssueReportOutputDto> {
    return {} as IssueReportOutputDto;
  }


  /**
   * Tool: Publicar Code Insights en Bitbucket
   *
   * Invoca una operación para publicar reportes de análisis de código en Bitbucket Code Insights.
   * Retorna jobId y pollToolName inmediatamente. Usa la tool de polling para obtener el reportURL.
   */
  @InvokeAsyncTool({
    name: "mcp.tool.bitbucket.code-insights",
    description: "Invokes a tool to get a code insights from a repository. This tool returns a jobId and pollToolName immediately. You MUST use the pollToolName returned with the jobId to get the reportURL.",
    dtoClass: BitbucketCodeInsightsInputDto,
    pollToolName: "mcp.tool.bitbucket.code-insights.poll",
    title: "Execute get code insights tool",
    destructiveHint: false,
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  })
  async toolBitbucketCodeInsights(input: BitbucketCodeInsightsInputDto, context: Context) {}

  /**
   * Tool: Hacer polling del resultado de bitbucket code insights
   *
   * Consulta el estado de un job de bitbucket code insights.
   * Retorna el estado actual con jobId, status y reportURL cuando está disponible.
   */
  @PollAsyncTool({
    name: 'mcp.tool.bitbucket.code-insights.poll',
    description:
      'Check the status of a bitbucket code insights job. Use this tool with the jobId returned by mcp.tool.bitbucket.code-insights. The response includes a "status" field that indicates the job state: "REQUESTED" or "IN_PROGRESS" means the job is still processing (call this tool again later), "SUCCESS" means the job completed and reportURL is available, "FAILURE" means the job failed. Keep calling this tool until status is "SUCCESS" or "FAILURE".',
    dtoClass: WaitJobInputDto,
    outputSchemaClass: BitbucketCodeInsightsOutputDto,
    title: 'Get bitbucket code insights result',
    destructiveHint: false,
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
    resultMapper: (result: any) => {
      const mapped: any = { ...result };
      if ('report_url' in mapped && !('reportURL' in mapped)) {
        mapped.reportURL = mapped.report_url;
        delete mapped.report_url;
      } 
      return mapped;
    },
  })
  async pollBitbucketCodeInsights(
    input: WaitJobInputDto,
    context: Context,
  ): Promise<BitbucketCodeInsightsOutputDto> {
    return {} as BitbucketCodeInsightsOutputDto;
  }

  /**
   * Tool: Crear issue en GitHub
   *
   * Invoca una operación para crear issues automáticamente en repositorios de GitHub
   * basados en resultados de análisis de código.
   * Retorna jobId y pollToolName inmediatamente. Usa la tool de polling para obtener el issueId y htmlURL.
   */
  @InvokeAsyncTool({
    name: "mcp.tool.github.issue",
    description: "Invokes a tool to get a issue from a repository. This tool returns a jobId and pollToolName immediately. You MUST use the pollToolName returned with the jobId to get the issueId and htmlURL.",
    dtoClass: GithubIssueInputDto,
    pollToolName: "mcp.tool.github.issue.poll",
    title: "Execute get issue tool",
    destructiveHint: false,
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  })
  async toolGithubIssue(input: GithubIssueInputDto, context: Context) {}

  /**
   * Tool: Hacer polling del resultado de github issue
   *
   * Consulta el estado de un job de github issue.
   * Retorna el estado actual con jobId, status, issueId y htmlURL cuando está disponible.
   */
  @PollAsyncTool({
    name: 'mcp.tool.github.issue.poll',
    description:
      'Check the status of a github issue job. Use this tool with the jobId returned by mcp.tool.github.issue. The response includes a "status" field that indicates the job state: "REQUESTED" or "IN_PROGRESS" means the job is still processing (call this tool again later), "SUCCESS" means the job completed and issueId/htmlURL are available, "FAILURE" means the job failed. Keep calling this tool until status is "SUCCESS" or "FAILURE".',
    dtoClass: WaitJobInputDto,
    outputSchemaClass: GithubIssueOutputDto,
    resultMapper: (result: any) => {
      // Mapear campos snake_case a camelCase si es necesario
      const mapped: any = { ...result };
      
      // Mapear html_url -> htmlURL
      if ('html_url' in mapped && !('htmlURL' in mapped)) {
        mapped.htmlURL = mapped.html_url;
        delete mapped.html_url;
      }
      
      // Mapear issue_id -> issueId
      if ('issue_id' in mapped && !('issueId' in mapped)) {
        mapped.issueId = mapped.issue_id;
        delete mapped.issue_id;
      }
      
      return mapped;
    },
    title: 'Get github issue result',
    destructiveHint: false,
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  })
  async pollGithubIssue(
    input: WaitJobInputDto,
    context: Context,
  ): Promise<GithubIssueOutputDto> {
    return {} as GithubIssueOutputDto;
  }
}
