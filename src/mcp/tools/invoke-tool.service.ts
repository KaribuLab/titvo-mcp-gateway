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
import { GetCommitInputDto } from "../../core/invocations/dto/get-commit-input.dto";
import { IssueReportInputDto } from "../../core/invocations/dto/issue-report-input.dto";
import { BitbucketCodeInsightsInputDto } from "src/core/invocations/dto/bitbucket-code-insights-input.dto";
import { GithubIssueInputDto } from "src/core/invocations/dto/github-issue-input.dto";

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
  @InvokeTool({
    name: "mcp.tool.git.commit-files",
    description: "Invokes an tool to get the commit data from a repository",
    dtoClass: GetCommitInputDto,
    title: "Execute get commit data tool",
    destructiveHint: false,
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  })
  async toolGitCommitFiles(input: GetCommitInputDto, context: Context) {}

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
