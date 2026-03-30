import { Inject, Injectable, Logger } from "@nestjs/common";
import { Tool, type Context } from "@rekog/mcp-nest";
import { GetDataFromFileInputDto } from "src/core/invocations/dto/get-data-from-file-input.dto";
import { GetDataFromFileOutputDto } from "src/core/invocations/dto/get-data-from-file-output.dto";
import {
  GET_DATA_FROM_FILE,
  JOB_PERSISTENCE,
  PUBLISH_EVENT,
} from "../../packages/cloud-contracts/constants/injection-tokens";
import { JobPersistencePort } from "../../packages/cloud-contracts/ports/job-persistence.port";
import { PublishEventPort } from "../../packages/cloud-contracts/ports/publish-event.port";
import { ContextService } from "../../shared/services/context.service";
import { GetDataFromFilePort } from "src/packages/cloud-contracts/ports/get-data-from-file.port";

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
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  constructor(
    @Inject(GET_DATA_FROM_FILE) private readonly getDataFromFilePort: GetDataFromFilePort,
  ) {}

  /**
   * Tool: Obtener contenido de un archivo
   *
   * Invoca una operación para obtener el contenido de un archivo
   */
  @Tool({
    name: "mcp.tool.files",
    description: "Get data from files path returned by the array filesPaths from mcp.tool.git.commit-files.poll result. First invoke mcp.tool.git.commit-files, then use the pollToolName returned to get the filesPaths array, then use this tool with each path from that array.",
    parameters: GetDataFromFileInputDto.schema(),
    outputSchema: GetDataFromFileOutputDto.schema(),
    annotations: {
      title: "Execute get data from files path returned by the array filesPaths from mcp.tool.git.commit-files.poll result",
      destructiveHint: false,
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  })
  async getData(input: GetDataFromFileInputDto, context: Context) {
    const data = await this.getDataFromFilePort.getData(input.path);
    this.logger.log(`Data: ${data}`);
    return data;
  }
}
