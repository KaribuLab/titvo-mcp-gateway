import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import * as pino from 'pino';
import { McpModule } from '@rekog/mcp-nest';
import { randomUUID } from 'crypto';
import { CloudProvider } from './packages/cloud-contracts/enums/cloud-provider.enum';
import { CloudModule } from './infrastructure/cloud/cloud.module';
import { ContextService } from './shared/services/context.service';
import { JobProcessorService } from './core/jobs/services/job-processor.service';
import { JobResource } from './mcp/resources/job.resource';
import { InvokeToolService } from './mcp/tools/invoke-tool.service';
import { FilesService } from './mcp/tools/files.service';
import { HealthcheckModule } from './packages/healthcheck/healthcheck.module';

/**
 * AppModule - Módulo principal de la aplicación MCP Gateway
 *
 * Este módulo configura e integra todos los componentes principales:
 * - ConfigModule: Gestión de variables de entorno y configuración global
 * - CloudModule: Abstracción multi-cloud (AWS, GCP, Azure, Local)
 * - McpModule: Servidor MCP para exponer tools y resources
 *
 * Características:
 * - Validación de CLOUD_PROVIDER al inicio
 * - Gestión de sesiones MCP con UUID
 * - Integración de servicios core (jobs, context, tools)
 *
 * Variables de entorno requeridas:
 * - CLOUD_PROVIDER: 'aws' | 'gcp' | 'azure' | 'local'
 * - PORT: Puerto del servidor (default: 3000)
 * - Variables específicas del cloud provider seleccionado
 */
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        autoLogging: false,
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
          level(label: string): { level: string } {
            return { level: label };
          },
        },
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const allowedValues: string[] = Object.values(CloudProvider);
        const cloudProvider = config['CLOUD_PROVIDER'];
        if (!allowedValues.includes(cloudProvider as string)) {
          throw new Error(
            `CLOUD_PROVIDER debe ser uno de los siguientes valores permitidos: ${allowedValues.join(
              ', ',
            )}. Valor recibido: ${cloudProvider as string}`,
          );
        }
        return config;
      },
    }),
    CloudModule.register(),
    McpModule.forRoot({
      name: 'my-mcp-server',
      version: '1.0.0',
      streamableHttp: {
        enableJsonResponse: false,
        sessionIdGenerator: () => randomUUID(),
        statelessMode: false, // Enables session management
      },
    }),
    HealthcheckModule
  ],
  providers: [
    ContextService,
    InvokeToolService,
    JobResource,
    JobProcessorService,
    FilesService,
  ],
})
export class AppModule {}
