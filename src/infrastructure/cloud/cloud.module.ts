import { DynamicModule, Module } from '@nestjs/common';
import { AwsModule } from '../../packages/cloud-aws/module/aws.module';
import { GcpModule } from '../../packages/cloud-gcp/module/gcp.module';
import { LocalModule } from '../../packages/local/module/local.module';
import { AzureModule } from '../../packages/cloud-azure/module/azure.module';
import { CloudProvider } from '../../packages/cloud-contracts/enums/cloud-provider.enum';

/**
 * CloudModule - Módulo principal para abstracción de servicios cloud
 *
 * Este módulo actúa como fachada (Facade Pattern) para diferentes providers de cloud.
 * Permite cambiar entre AWS, GCP, Azure o implementación local sin modificar el código
 * de los consumidores.
 *
 * @example
 * // En AppModule:
 * imports: [CloudModule.register()]
 *
 * // En un servicio:
 * @Inject(PUBLISH_EVENT) private publishEvent: PublishEventPort
 */
@Module({})
export class CloudModule {
  /**
   * Método de registro del módulo dinámico
   *
   * Proceso:
   * 1. Lee la variable CLOUD_PROVIDER del entorno
   * 2. Selecciona el módulo del provider correspondiente
   * 3. Importa y exporta el módulo seleccionado
   *
   * Los providers exportan los tokens PUBLISH_EVENT y QUEUE_CONSUMER
   * que pueden ser inyectados en cualquier parte de la aplicación.
   */
  static register(): DynamicModule {
    // Leer el provider seleccionado desde variables de entorno
    const provider = process.env.CLOUD_PROVIDER as CloudProvider;
    let importedModule: DynamicModule;

    // Seleccionar e importar el módulo del provider correspondiente
    switch (provider) {
      case CloudProvider.LOCAL:
        // LOCAL: BullMQ + Redis (desarrollo local)
        importedModule = LocalModule.registerAsync();
        break;
      case CloudProvider.AWS:
        // AWS: EventBridge + SQS
        importedModule = AwsModule.registerAsync();
        break;
      case CloudProvider.GCP:
        // GCP: Pub/Sub (Topics + Subscriptions)
        importedModule = GcpModule.registerAsync();
        break;
      case CloudProvider.AZURE:
        // Azure: Service Bus (Topics + Queues)
        importedModule = AzureModule.registerAsync();
        break;
      default:
        throw new Error(`Provider ${provider as string} is not supported`);
    }

    // Retornar el módulo dinámico con el provider seleccionado
    return {
      module: CloudModule,
      imports: [importedModule],
      exports: [importedModule], // Re-exportar para que esté disponible globalmente
    };
  }
}
