# Cloud Module - Documentación

## Resumen

Este módulo proporciona una abstracción para servicios de cloud (AWS, GCP, Azure) permitiendo cambiar de provider sin modificar el código de la aplicación.

## Arquitectura

### Patrón Hexagonal (Ports & Adapters)

```
┌─────────────────────────────────────────────────────────┐
│                      Application                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │              CloudModule (Facade)                 │  │
│  │    - Selecciona provider según configuración     │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                              │
│                          ▼                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Ports (Interfaces/Contratos)             │  │
│  │  - PublishEventPort                              │  │
│  │  - QueueConsumerPort                             │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                              │
│         ┌────────────────┼────────────────┐            │
│         ▼                ▼                ▼             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │   AWS    │    │   GCP    │    │  Azure   │         │
│  │ Adapters │    │ Adapters │    │ Adapters │         │
│  └──────────┘    └──────────┘    └──────────┘         │
│       │               │                │               │
└───────┼───────────────┼────────────────┼───────────────┘
        ▼               ▼                ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │   AWS    │    │   GCP    │    │  Azure   │
  │ Services │    │ Services │    │ Services │
  └──────────┘    └──────────┘    └──────────┘
  EventBridge     Pub/Sub       Service Bus
      SQS
```

## Estructura de Archivos

```
src/cloud/
├── cloud.module.ts              # Módulo principal (Facade)
├── cloud.constants.ts           # Tokens DI compartidos
├── cloud-provider.enum.ts       # Enum de providers soportados
│
├── ports/                       # Interfaces (contratos)
│   ├── publish-event.port.ts    # Publicación de eventos
│   └── queue-consumer.port.ts   # Consumo de colas
│
├── providers/                   # Implementaciones por provider
│   └── aws/
│       ├── aws.module.ts                  # Módulo AWS
│       ├── aws-options.interface.ts       # Configuración AWS
│       ├── publish-event.adapter.ts       # EventBridge adapter
│       ├── queue-consumer.adapter.ts      # SQS adapter
│       └── AWS_README.md                  # Documentación AWS
│
└── utils/                       # Utilidades compartidas
    ├── config-validator.util.ts  # Validación de variables de entorno
    └── USAGE_EXAMPLE.md          # Ejemplos de uso del validator
```

## Flujo de Ejecución

### 1. Inicialización de la Aplicación

```typescript
// app.module.ts
ConfigModule.forRoot({
  validate: (config) => {
    // Validar CLOUD_PROVIDER
    if (!isValidProvider(config.CLOUD_PROVIDER)) {
      throw new Error('Invalid provider');
    }
    return config;
  },
});
```

### 2. Registro del CloudModule

```typescript
// CloudModule.register() se ejecuta
CloudModule.register()
  └─> Lee CLOUD_PROVIDER
  └─> Switch según provider:
      ├─> AWS: AwsModule.registerAsync()
      ├─> GCP: (no implementado)
      └─> Azure: (no implementado)
```

### 3. Registro del Provider (AWS ejemplo)

```typescript
// AwsModule.registerAsync() se ejecuta
AwsModule.registerAsync()
  └─> Crea provider de configuración
      └─> validateRequiredEnvVars(['AWS_REGION', 'AWS_EVENTBUS_NAME', 'AWS_QUEUE_URL'])
      └─> validateUrl('AWS_QUEUE_URL')
      └─> Retorna AwsOptions validadas

  └─> Crea PublishEventProvider
      └─> new AwsPublishEventAdapter(awsOptions)
      └─> Inicializa EventBridgeClient

  └─> Crea QueueConsumerProvider
      └─> new AwsQueueConsumerAdapter(awsOptions)
      └─> Inicializa SQSClient

  └─> Exporta tokens: PUBLISH_EVENT, QUEUE_CONSUMER
```

### 4. Uso en la Aplicación

```typescript
// En cualquier servicio
@Injectable()
export class MyService {
  constructor(
    @Inject(PUBLISH_EVENT) private publishEvent: PublishEventPort,
    @Inject(QUEUE_CONSUMER) private consumer: QueueConsumerPort,
  ) {}

  async publishUserCreated(userId: string) {
    // Publicar evento
    const eventId = await this.publishEvent.publish('user.created', {
      userId,
      timestamp: new Date(),
    });
  }

  async onModuleInit() {
    // Registrar handler de mensajes
    this.consumer.onMessage('users-queue', async (msg) => {
      const data = JSON.parse(msg.data.toString());
      await this.processUser(data);
      await msg.ack();
    });

    // Iniciar consumer
    await this.consumer.start();
  }

  async onModuleDestroy() {
    // Detener consumer
    await this.consumer.stop();
  }
}
```

## Flujos Específicos

### Publicación de Evento (EventBridge)

```
1. Servicio llama: publishEvent.publish('user.created', payload)
   └─> AwsPublishEventAdapter.publish()

2. Construir evento EventBridge:
   - Source: 'mcp-gateway'
   - DetailType: 'user.created' (topic)
   - Detail: JSON.stringify(payload)
   - EventBusName: 'default'
   - Resources: atributos como ARNs

3. Enviar a EventBridge:
   └─> PutEventsCommand
   └─> eventBridgeClient.send(command)

4. Validar respuesta:
   - Si FailedEntryCount > 0: lanzar error
   - Si exitoso: retornar eventId

5. Loggear resultado
```

### Consumo de Cola (SQS)

```
1. onModuleInit():
   └─> consumer.onMessage('queue', handler)
       └─> Registrar handler
   └─> consumer.start()
       └─> Iniciar polling

2. Ciclo de Polling (continuo):
   └─> poll()
       ├─> ReceiveMessageCommand (max 10 msgs, wait 20s)
       ├─> Recibir mensajes de SQS
       └─> Promise.all(messages.map(processMessage))

3. Procesar Mensaje:
   └─> processMessage(message)
       ├─> Convertir body a Buffer
       ├─> Extraer atributos
       ├─> Crear funciones ack/nack
       └─> Llamar handler del usuario
           ├─> Si exitoso: handler llama ack()
           │   └─> deleteMessage(receiptHandle)
           │       └─> DeleteMessageCommand
           └─> Si falla: handler llama nack() o lanza error
               └─> changeVisibility(receiptHandle, 0)
                   └─> ChangeMessageVisibilityCommand

4. Continuar Polling:
   └─> setTimeout(() => poll(), 0)

5. onModuleDestroy():
   └─> consumer.stop()
       └─> isRunning = false
       └─> clearTimeout(pollingInterval)
```

## Variables de Entorno

### Globales

- `CLOUD_PROVIDER`: Provider a usar (aws, gcp, azure, local)

### AWS

- `AWS_REGION`: Región de AWS (ej: us-east-1)
- `AWS_EVENTBUS_NAME`: Nombre del EventBus de EventBridge
- `AWS_QUEUE_URL`: URL completa de la cola SQS

Credenciales AWS se obtienen automáticamente via:

- AWS CLI (`aws configure`)
- Variables de entorno (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- IAM Roles (en EC2, ECS, Lambda)

## Conceptos Clave

### Long Polling (SQS)

- El consumer espera hasta 20 segundos por mensajes
- Reduce costos (menos peticiones vacías)
- Mejora latencia (no hay delay entre peticiones)

### ACK/NACK

- **ACK**: Confirma que el mensaje fue procesado exitosamente (lo elimina de la cola)
- **NACK**: Rechaza el mensaje (lo devuelve a la cola para reintentar)

### Visibility Timeout

- Cuando un mensaje se recibe, se hace "invisible" por un tiempo
- Si no se hace ACK/NACK en ese tiempo, SQS lo vuelve visible automáticamente
- NACK cambia el visibility timeout a 0 (visible inmediatamente)

### Dead Letter Queue (DLQ)

- Si un mensaje falla muchas veces (según configuración de la cola)
- SQS lo mueve a una DLQ para análisis posterior
- Configurado en la cola SQS, no en el código

## Agregar Nuevo Provider

Para agregar soporte para GCP:

1. Crear `/providers/gcp/` con estructura similar a AWS:

   ```
   gcp/
   ├── gcp.module.ts
   ├── gcp-options.interface.ts
   ├── publish-event.adapter.ts (implementa PublishEventPort)
   └── queue-consumer.adapter.ts (implementa QueueConsumerPort)
   ```

2. Implementar los adapters siguiendo los ports

3. Agregar case en `cloud.module.ts`:

   ```typescript
   case CloudProvider.GCP:
     importedModule = GcpModule.registerAsync();
     break;
   ```

4. Agregar validación en `app.module.ts` si es necesario

5. Documentar en GCP_README.md

## Testing

Los adapters son fáciles de testear:

```typescript
describe('AwsPublishEventAdapter', () => {
  it('should publish event to EventBridge', async () => {
    const mockClient = {
      send: jest.fn().mockResolvedValue({
        Entries: [{ EventId: 'test-id' }],
      }),
    };

    const adapter = new AwsPublishEventAdapter({
      region: 'us-east-1',
      eventBusName: 'test-bus',
    });

    // Replace client
    adapter['eventBridgeClient'] = mockClient as any;

    const eventId = await adapter.publish('test.event', { data: 'test' });

    expect(eventId).toBe('test-id');
    expect(mockClient.send).toHaveBeenCalled();
  });
});
```

## Referencias

- [AWS EventBridge Docs](https://docs.aws.amazon.com/eventbridge/)
- [AWS SQS Docs](https://docs.aws.amazon.com/sqs/)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [NestJS Dynamic Modules](https://docs.nestjs.com/fundamentals/dynamic-modules)
