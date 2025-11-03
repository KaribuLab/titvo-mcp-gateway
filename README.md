# MCP Gateway

<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="NestJS Logo" />
</p>

    <p align="center">

Un gateway MCP (Model Context Protocol) multi-cloud construido con NestJS y arquitectura hexagonal.

</p>

## 📋 Descripción

**MCP Gateway** es un servidor que expone herramientas (tools), recursos y prompts mediante el protocolo MCP, permitiendo que LLMs y agentes AI interactúen con operaciones que se ejecutan de forma asíncrona en diferentes proveedores de cloud.

### Características Principales

- 🏗️ **Arquitectura Hexagonal**: Desacoplamiento total entre lógica de negocio e infraestructura
- ☁️ **Multi-Cloud**: Soporte para AWS, GCP, Azure y desarrollo local
- 🔄 **Procesamiento Asíncrono**: Jobs en background con reporte de progreso en tiempo real
- 🎯 **MCP Protocol**: Exposición de tools, resources y prompts para LLMs
- 📦 **Preparado para NPM**: Estructura modular lista para extraer paquetes independientes
- 🔌 **Decoradores Personalizados**: `@InvokeTool` para simplificar creación de tools
- ✅ **Schemas Dinámicos**: Generación automática de schemas Zod desde decoradores
- 🧪 **LocalStack Ready**: Prueba con AWS local antes de ir a producción

## 🏛️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        MCP Client                            │
│                    (Claude, ChatGPT, etc)                    │
└────────────────────────┬────────────────────────────────────┘
                         │ MCP Protocol
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      MCP Gateway                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Tools     │  │  Resources   │  │   Prompts    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                          │                                   │
│              ┌───────────▼───────────┐                      │
│              │   Core Services       │                      │
│              │  (Job Processing)     │                      │
│              └───────────┬───────────┘                      │
│                          │                                   │
│         ┌────────────────┼────────────────┐                │
│         ▼                ▼                ▼                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│  │   Ports  │    │   Ports  │    │   Ports  │            │
│  │ Publish  │    │  Queue   │    │   Job    │            │
│  │  Event   │    │ Consumer │    │  Persist │            │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘            │
└───────┼───────────────┼───────────────┼──────────────────┘
        │               │               │
        │               │               │ Adapters (Hexagonal)
        ▼               ▼               ▼
┌────────────────────────────────────────────────────────────┐
│                   Cloud Providers                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │   AWS    │  │   GCP    │  │  Azure   │  │  Local   │ │
│  │EventBrdg │  │ Pub/Sub  │  │ Service  │  │  BullMQ  │ │
│  │   SQS    │  │ Firestore│  │   Bus    │  │  Redis   │ │
│  │ DynamoDB │  │          │  │ CosmosDB │  │          │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└────────────────────────────────────────────────────────────┘
```

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js >= 18.x
- Yarn o npm
- Docker (para Redis/LocalStack)

### Instalación

```bash
# Clonar el repositorio
git clone <repo-url>
cd mcp-gateway

# Instalar dependencias
yarn install
```

### Configuración

Crea un archivo `.env` basándote en el provider que quieras usar:

#### Opción 1: Desarrollo Local (Redis + BullMQ)

```bash
CLOUD_PROVIDER=local
REDIS_HOST=localhost
REDIS_PORT=6379
LOCAL_QUEUE_NAME=events-queue
LOCAL_RESULT_QUEUE_NAME=results-queue
```

#### Opción 2: AWS con LocalStack

```bash
CLOUD_PROVIDER=aws
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_EVENTBUS_NAME=default
AWS_QUEUE_URL=http://localhost:4566/000000000000/mcp-gateway-results
AWS_JOB_TABLE_NAME=mcp-gateway-jobs
AWS_ENDPOINT=http://localhost:4566
```

#### Opción 3: AWS Producción

```bash
CLOUD_PROVIDER=aws
AWS_REGION=us-east-1
AWS_EVENTBUS_NAME=my-eventbus
AWS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/my-queue
AWS_JOB_TABLE_NAME=production-jobs
# No incluir AWS_ENDPOINT para usar AWS real
```

### Ejecutar la Aplicación

```bash
# Modo desarrollo
yarn start:dev

# Modo producción
yarn build
yarn start:prod

# Con Docker Compose (incluye Redis)
docker-compose up -d
```

## 📦 Estructura del Proyecto

```
src/
├── app.module.ts                    # Módulo principal
├── main.ts                          # Bootstrap de la aplicación
│
├── core/                            # Lógica de negocio (agnóstica de infraestructura)
│   ├── invocations/                 # DTOs de invocaciones
│   │   └── dto/
│   └── jobs/                        # Servicios de procesamiento de jobs
│       └── services/
│
├── mcp/                             # Componentes MCP (Tools, Resources, Prompts)
│   ├── tools/                       # Tools expuestos a clientes MCP
│   ├── resources/                   # Resources para consultar estado
│   ├── prompts/                     # Prompts para LLMs
│   └── decorators/                  # Decoradores personalizados (@InvokeTool)
│
├── shared/                          # Código compartido
│   ├── services/                    # Servicios compartidos (ContextService)
│   ├── helpers/                     # Helpers y factories
│   └── dto/                         # DTOs base y decoradores de campo
│
├── infrastructure/                  # Capa de infraestructura
│   └── cloud/                       # Módulo de abstracción cloud
│       ├── cloud.module.ts          # Facade para providers
│       └── utils/                   # Utilidades de configuración
│
└── packages/                        # Paquetes modulares (futuros NPM)
    ├── cloud-contracts/             # Contratos compartidos (ports, types)
    │   ├── ports/                   # Interfaces hexagonales
    │   ├── types/                   # DTOs compartidos
    │   ├── enums/                   # Enumeraciones
    │   └── constants/               # Tokens de inyección
    │
    ├── local/                       # Provider local (BullMQ + Redis)
    │   ├── adapters/                # Implementaciones de ports
    │   ├── module/                  # Módulo NestJS
    │   └── types/                   # Types específicos
    │
    ├── cloud-aws/                   # Provider AWS (EventBridge + SQS + DynamoDB)
    │   ├── adapters/
    │   ├── module/
    │   └── types/
    │
    ├── cloud-gcp/                   # Provider GCP (Pub/Sub + Firestore)
    │   ├── adapters/
    │   ├── module/
    │   └── types/
    │
    └── cloud-azure/                 # Provider Azure (Service Bus + Cosmos DB)
        ├── adapters/
        ├── module/
        └── types/
```

## 🎯 Uso

### Crear un Nuevo Tool

```typescript
import { InvokeTool } from './mcp/decorators/invoke-tool.decorator';
import { MyInputDto } from './dto/my-input.dto';

@Injectable()
export class MyToolService {
  constructor(
    @Inject(PUBLISH_EVENT) private readonly publishEvent: PublishEventPort,
    @Inject(JOB_PERSISTENCE)
    private readonly jobPersistence: JobPersistencePort,
    private readonly contextService: ContextService,
  ) {}

  @InvokeTool({
    name: 'my-custom-tool',
    description: 'Does something awesome',
    dtoClass: MyInputDto,
    title: 'Execute My Tool',
  })
  async myCustomTool(input: MyInputDto, context: Context) {
    // El decorador maneja todo automáticamente:
    // - Publica evento
    // - Crea job
    // - Guarda contexto
    // - Retorna jobId
  }
}
```

### Crear DTOs con Schemas Automáticos

```typescript
import { SchemaDto } from './shared/dto/schema.dto';
import {
  StringField,
  NumberField,
} from './shared/dto/decorators/field.decorator';

export class MyInputDto extends SchemaDto {
  @StringField({
    description: 'User name',
    minLength: 3,
    maxLength: 50,
  })
  name: string;

  @NumberField({
    description: 'User age',
    min: 0,
    max: 150,
  })
  age: number;
}

// Schema Zod generado automáticamente:
const schema = MyInputDto.schema();
```

### Consultar Estado de un Job

Los clientes MCP pueden consultar el estado usando el resource:

```
mcp://job://{jobId}
```

Retorna:

```json
{
  "id": "my-tool-550e8400-e29b-41d4",
  "status": "IN_PROGRESS",
  "progress": 75,
  "message": "Processing data...",
  "content": {
    /* input original */
  },
  "result": null,
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T10:05:00Z"
}
```

## 🧪 Probar con LocalStack

### 1. Levantar LocalStack

```bash
# Crear docker-compose.localstack.yml
docker-compose -f docker-compose.localstack.yml up -d
```

### 2. Configurar Recursos AWS

```bash
# Ejecutar script de setup
./setup-localstack.sh
```

Ver guía completa en: [`docs/LOCALSTACK_SETUP.md`](./docs/LOCALSTACK_SETUP.md)

## 📚 Documentación por Provider

Cada provider tiene su propia documentación detallada:

- **[Local Provider](./src/packages/local/README.md)** - BullMQ + Redis
- **[AWS Provider](./src/packages/cloud-aws/README.md)** - EventBridge + SQS + DynamoDB
- **[GCP Provider](./src/packages/cloud-gcp/README.md)** - Pub/Sub + Firestore
- **[Azure Provider](./src/packages/cloud-azure/README.md)** - Service Bus + Cosmos DB

## 🔧 Variables de Entorno

### Comunes

| Variable         | Descripción         | Valores                        | Requerida |
| ---------------- | ------------------- | ------------------------------ | --------- |
| `CLOUD_PROVIDER` | Provider a usar     | `local`, `aws`, `gcp`, `azure` | ✅        |
| `PORT`           | Puerto del servidor | Número (default: 3000)         | ❌        |

### Por Provider

Consulta el README específico de cada provider para ver sus variables requeridas.

## 🧩 Extensibilidad

### Agregar un Nuevo Provider

1. Crear carpeta en `packages/cloud-{provider}/`
2. Implementar los adapters para los ports:
   - `PublishEventPort`
   - `QueueConsumerPort`
   - `JobPersistencePort`
3. Crear módulo NestJS que provea los tokens de inyección
4. Registrar en `infrastructure/cloud/cloud.module.ts`
5. Agregar valor al enum `CloudProvider`

### Migrar a NPM Packages

La estructura está preparada para extraer cada provider como paquete NPM:

```bash
packages/
├── @mcp-gateway/contracts      # cloud-contracts
├── @mcp-gateway/local          # local
├── @mcp-gateway/aws            # cloud-aws
├── @mcp-gateway/gcp            # cloud-gcp
└── @mcp-gateway/azure          # cloud-azure
```

## 🧪 Tests

```bash
# Tests unitarios
yarn test

# Tests e2e
yarn test:e2e

# Cobertura
yarn test:cov
```

## 🚀 Deployment

### Local/Development

```bash
docker-compose up -d
```

### AWS (con LocalStack primero)

1. Probar con LocalStack
2. Crear recursos en AWS real (EventBridge, SQS, DynamoDB)
3. Actualizar variables de entorno
4. Desplegar aplicación (ECS, Lambda, EC2, etc.)

### GCP/Azure

Consultar READMEs específicos de cada provider.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/amazing-feature`)
3. Commit tus cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 🙏 Agradecimientos

- [NestJS](https://nestjs.com/) - Framework backend
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) - Protocolo de comunicación
- [BullMQ](https://bullmq.io/) - Cola de jobs para desarrollo local
- [LocalStack](https://localstack.cloud/) - Emulador AWS local

## 📞 Contacto

Para preguntas, sugerencias o reportar issues, por favor abre un issue en GitHub.

---

**Nota**: Este proyecto está en desarrollo activo. Las APIs pueden cambiar.
