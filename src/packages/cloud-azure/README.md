# Azure Cloud Provider - Guía de Uso

## Configuración

### Variables de Entorno Requeridas

Todas estas variables son **obligatorias** cuando usas Azure como provider:

```bash
CLOUD_PROVIDER=azure
AZURE_SERVICE_BUS_CONNECTION_STRING="Endpoint=sb://my-namespace.servicebus.windows.net/;SharedAccessKeyName=...;SharedAccessKey=..."
AZURE_TOPIC_NAME=events-topic
AZURE_QUEUE_NAME=results-queue
```

**Nota:** La aplicación **no iniciará** si falta alguna de estas variables.

### Obtener Connection String

1. Abre Azure Portal
2. Ve a tu Service Bus Namespace
3. En el menú izquierdo, selecciona "Shared access policies"
4. Selecciona una política (ej: RootManageSharedAccessKey)
5. Copia "Primary Connection String"

## Uso

### 1. Publicar Mensajes a Service Bus

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { PublishEventPort } from 'src/cloud/ports/publish-event.port';
import { PUBLISH_EVENT } from 'src/cloud/cloud.constants';

@Injectable()
export class MyService {
  constructor(
    @Inject(PUBLISH_EVENT) private readonly publishEvent: PublishEventPort,
  ) {}

  async publishUserCreatedEvent(userId: string) {
    const messageId = await this.publishEvent.publish(
      'user.created', // EventType (guardado en applicationProperties)
      {
        // Payload (body del mensaje en JSON)
        userId,
        email: 'user@example.com',
        timestamp: new Date().toISOString(),
      },
      {
        // Atributos (applicationProperties para filtrado)
        source: 'user-service',
        version: '1.0',
      },
    );

    console.log(`Message published with ID: ${messageId}`);
  }
}
```

**Estructura del mensaje en Service Bus:**

```json
{
  "body": "{\"userId\":\"123\",\"email\":\"user@example.com\",\"timestamp\":\"2025-10-17T...\"}",
  "contentType": "application/json",
  "applicationProperties": {
    "eventType": "user.created",
    "source": "mcp-gateway",
    "timestamp": "2025-10-17T18:00:00.000Z",
    "version": "1.0"
  }
}
```

### 2. Consumir Mensajes de Service Bus

```typescript
import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { QueueConsumerPort } from 'src/cloud/ports/queue-consumer.port';
import { QUEUE_CONSUMER } from 'src/cloud/cloud.constants';

@Injectable()
export class ResultProcessor implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(QUEUE_CONSUMER) private readonly queueConsumer: QueueConsumerPort,
  ) {}

  async onModuleInit() {
    // Registrar el handler
    this.queueConsumer.onMessage('results-queue', async (msg) => {
      try {
        console.log(`Processing message: ${msg.id}`);

        // Parsear el mensaje
        const result = JSON.parse(msg.data.toString('utf-8'));

        // Obtener propiedades
        const eventType = msg.attrs.eventType;
        console.log(`Event type: ${eventType}`);

        // Procesar el resultado
        await this.processResult(result);

        // Confirmar procesamiento exitoso
        await msg.ack();
      } catch (error) {
        console.error(`Error processing message: ${error.message}`);

        // Rechazar el mensaje (volverá a la cola)
        await msg.nack();
      }
    });

    // Iniciar el consumer
    await this.queueConsumer.start();
  }

  async onModuleDestroy() {
    // Detener el consumer al apagar la aplicación
    await this.queueConsumer.stop();
  }

  private async processResult(result: any) {
    // Tu lógica de negocio aquí
    console.log('Processing result:', result);
  }
}
```

## Características

### Service Bus Sender

- ✅ Publicación de mensajes a Topics
- ✅ Serialización automática a JSON
- ✅ Soporte para applicationProperties (metadata)
- ✅ Content type configurado
- ✅ Logging detallado con Logger de NestJS
- ✅ Manejo de errores robusto

### Service Bus Receiver

- ✅ Modo PeekLock (mensajes bloqueados hasta ACK/NACK)
- ✅ Polling con receiveMessages (similar a SQS)
- ✅ Procesamiento concurrente (hasta 10 mensajes)
- ✅ ACK/NACK manual
- ✅ Auto-renewal de lock para mensajes largos
- ✅ Dead Letter Queue automático
- ✅ Inicio/Detención controlada

## Crear Recursos en Azure

### Crear Service Bus Namespace

```bash
# Variables
RESOURCE_GROUP="my-resource-group"
NAMESPACE="my-servicebus-namespace"
LOCATION="eastus"

# Crear resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Crear Service Bus namespace
az servicebus namespace create \
  --resource-group $RESOURCE_GROUP \
  --name $NAMESPACE \
  --location $LOCATION \
  --sku Standard
```

### Crear Topic

```bash
# Crear topic para eventos
az servicebus topic create \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE \
  --name events-topic
```

### Crear Queue

```bash
# Crear queue para resultados
az servicebus queue create \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE \
  --name results-queue \
  --max-delivery-count 5 \
  --lock-duration PT1M \
  --enable-dead-lettering-on-message-expiration true
```

### Obtener Connection String

```bash
az servicebus namespace authorization-rule keys list \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE \
  --name RootManageSharedAccessKey \
  --query primaryConnectionString \
  --output tsv
```

## Permisos Necesarios

### Para Publicar (Sender)

Necesita permiso de **Send** en el Topic:

```bash
az servicebus topic authorization-rule create \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE \
  --topic-name events-topic \
  --name SendPolicy \
  --rights Send
```

### Para Consumir (Receiver)

Necesita permiso de **Listen** en la Queue:

```bash
az servicebus queue authorization-rule create \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE \
  --queue-name results-queue \
  --name ListenPolicy \
  --rights Listen
```

## Configuración Avanzada

### Dead Letter Queue

La Dead Letter Queue se crea automáticamente con cada Queue/Subscription.

Acceder a mensajes en DLQ:

```typescript
const dlqReceiver = serviceBusClient.createReceiver('results-queue', {
  subQueueType: 'deadLetter',
});

const messages = await dlqReceiver.receiveMessages(10);
```

Ver mensajes en DLQ con Azure CLI:

```bash
az servicebus queue show \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE \
  --name results-queue \
  --query countDetails.deadLetterMessageCount
```

### Filtrado de Mensajes (Subscriptions)

Si usas Topics con Subscriptions (en lugar de Queue directa):

```bash
# Crear subscription con filtro
az servicebus topic subscription create \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE \
  --topic-name events-topic \
  --name high-priority-sub

# Agregar regla de filtro
az servicebus topic subscription rule create \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE \
  --topic-name events-topic \
  --subscription-name high-priority-sub \
  --name PriorityFilter \
  --filter-sql-expression "priority = 'high'"
```

### Sesiones (Sessions)

Para garantizar orden FIFO y procesamiento único:

```typescript
// Al publicar, especifica sessionId
const message: ServiceBusMessage = {
  body: jsonPayload,
  sessionId: 'user-123', // Mensajes con mismo sessionId se procesan en orden
};
```

Configurar queue para sesiones:

```bash
az servicebus queue create \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE \
  --name session-queue \
  --enable-session true
```

## Troubleshooting

### Error: "Unauthorized"

Verifica el connection string y que tenga los permisos necesarios:

```bash
# Verificar namespace
az servicebus namespace show \
  --resource-group $RESOURCE_GROUP \
  --name $NAMESPACE
```

### Mensajes no se procesan

1. Verifica que el consumer esté iniciado:

   ```typescript
   await consumer.start();
   ```

2. Revisa logs del receiver

3. Verifica que haya mensajes en la queue:
   ```bash
   az servicebus queue show \
     --resource-group $RESOURCE_GROUP \
     --namespace-name $NAMESPACE \
     --name results-queue \
     --query countDetails.activeMessageCount
   ```

### Mensajes van a Dead Letter

Revisa los motivos en Azure Portal o con CLI:

```bash
# Ver mensajes en DLQ
az servicebus queue show \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE \
  --name results-queue \
  --query countDetails.deadLetterMessageCount
```

Causas comunes:

- MaxDeliveryCount excedido (reintentos agotados)
- Mensaje expirado (TTL)
- Mensaje rechazado explícitamente

### Lock Duration agotado

Si el procesamiento toma mucho tiempo, aumenta lock duration:

```bash
az servicebus queue update \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE \
  --name results-queue \
  --lock-duration PT5M  # 5 minutos
```

O usa auto-renewal en el código (Service Bus SDK lo hace automáticamente).

## Monitoreo

### Azure Portal

1. Ve a tu Service Bus Namespace
2. En Overview, verás métricas de:
   - Incoming/Outgoing Messages
   - Active Messages
   - Dead-letter Messages
   - Server Errors

### Azure Monitor

Query de ejemplo (Kusto):

```kusto
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.SERVICEBUS"
| where Category == "OperationalLogs"
| where TimeGenerated > ago(1h)
| project TimeGenerated, OperationName, ResultType, Message
```

### CLI

```bash
# Contar mensajes activos
az servicebus queue show \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE \
  --name results-queue \
  --query countDetails

# Ver throughput
az monitor metrics list \
  --resource /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.ServiceBus/namespaces/{namespace} \
  --metric IncomingMessages
```

## Comparación con Otros Providers

| Feature              | AWS                | GCP               | Azure                        |
| -------------------- | ------------------ | ----------------- | ---------------------------- |
| **Publicación**      | EventBridge        | Pub/Sub           | Service Bus Topics           |
| **Consumo**          | SQS Polling        | Push Events       | Polling (receiveMessages)    |
| **Lock Mode**        | Visibility Timeout | ACK/NACK          | PeekLock                     |
| **DLQ**              | SQS DLQ            | Dead Letter Topic | Dead Letter Queue            |
| **Orden**            | FIFO Queues        | Ordering Keys     | Sessions                     |
| **Max Message Size** | 256 KB             | 10 MB             | 256 KB (std), 1 MB (premium) |

## Mejores Prácticas

1. ✅ **Usa Sessions** para garantizar orden y procesamiento único
2. ✅ **Configura DLQ** para manejar mensajes problemáticos
3. ✅ **Monitorea** mensajes en DLQ regularmente
4. ✅ **Usa Standard tier** para desarrollo, Premium para producción
5. ✅ **Implementa idempotencia** para manejar reintentos
6. ✅ **Configura TTL** apropiado para tus mensajes
7. ✅ **Usa filtros** en subscriptions para routing eficiente

## Costos

### Tiers

- **Basic**: Solo queues, no topics ($0.05 por millón de operaciones)
- **Standard**: Queues y topics ($0.05 por millón de operaciones)
- **Premium**: Recursos dedicados, mejor rendimiento ($0.676/hr por messaging unit)

### Optimización

- Usa batch operations cuando sea posible
- Configura retention period apropiado
- Limpia mensajes completados/fallidos
- Monitorea uso para ajustar tier

## Referencias

- [Azure Service Bus Documentation](https://learn.microsoft.com/azure/service-bus-messaging/)
- [Best Practices](https://learn.microsoft.com/azure/service-bus-messaging/service-bus-performance-improvements)
- [Pricing](https://azure.microsoft.com/pricing/details/service-bus/)
- [SDK Reference](https://learn.microsoft.com/javascript/api/@azure/service-bus/)
