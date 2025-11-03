# GCP Cloud Provider - Guía de Uso

## Configuración

### Variables de Entorno Requeridas

Todas estas variables son **obligatorias** cuando usas GCP como provider:

```bash
CLOUD_PROVIDER=gcp
GCP_PROJECT_ID=my-project-id
GCP_TOPIC_NAME=events-topic
GCP_SUBSCRIPTION_NAME=events-subscription
```

**Nota:** La aplicación **no iniciará** si falta alguna de estas variables.

### Credenciales GCP

Las credenciales se pueden configurar de varias formas:

1. **Application Default Credentials** (recomendado para desarrollo local):

   ```bash
   gcloud auth application-default login
   ```

2. **Service Account Key** (recomendado para producción):

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
   ```

3. **Automatic** (cuando se ejecuta en GCP):
   - Compute Engine
   - Cloud Run
   - Cloud Functions
   - GKE (Workload Identity)

## Uso

### 1. Publicar Mensajes a Pub/Sub

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
      'user.created', // EventType (se guarda como atributo)
      {
        // Payload (se serializa a JSON)
        userId,
        email: 'user@example.com',
        timestamp: new Date().toISOString(),
      },
      {
        // Atributos (metadata para filtrado)
        source: 'user-service',
        version: '1.0',
      },
    );

    console.log(`Message published with ID: ${messageId}`);
  }
}
```

**Estructura del mensaje en Pub/Sub:**

```json
{
  "data": "{\"userId\":\"123\",\"email\":\"user@example.com\",\"timestamp\":\"2025-10-17T...\"}",
  "attributes": {
    "eventType": "user.created",
    "source": "mcp-gateway",
    "timestamp": "2025-10-17T18:00:00.000Z",
    "version": "1.0"
  }
}
```

### 2. Consumir Mensajes de Pub/Sub

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
export class MessageProcessor implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(QUEUE_CONSUMER) private readonly queueConsumer: QueueConsumerPort,
  ) {}

  async onModuleInit() {
    // Registrar el handler
    this.queueConsumer.onMessage('my-subscription', async (msg) => {
      try {
        console.log(`Processing message: ${msg.id}`);

        // Parsear el mensaje
        const payload = JSON.parse(msg.data.toString('utf-8'));

        // Obtener atributos
        const eventType = msg.attrs.eventType;
        console.log(`Event type: ${eventType}`);

        // Procesar el mensaje
        await this.processMessage(payload);

        // Confirmar procesamiento exitoso
        await msg.ack();
      } catch (error) {
        console.error(`Error processing message: ${error.message}`);

        // Rechazar el mensaje (volverá a intentarse)
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

  private async processMessage(payload: any) {
    // Tu lógica de negocio aquí
    console.log('Processing:', payload);
  }
}
```

## Características

### Pub/Sub Publisher Adapter

- ✅ Publicación de mensajes a Topics de Pub/Sub
- ✅ Serialización automática a JSON
- ✅ Soporte para atributos (metadata)
- ✅ Atributos automáticos (eventType, source, timestamp)
- ✅ Logging detallado con Logger de NestJS
- ✅ Manejo de errores robusto

### Pub/Sub Subscriber Adapter

- ✅ Event-driven (no polling, push model)
- ✅ Flow control configurado (máx 10 mensajes simultáneos)
- ✅ ACK/NACK manual de mensajes
- ✅ Inicio/Detención controlada del consumer
- ✅ Manejo automático de errores con NACK
- ✅ Logging detallado de operaciones

## Diferencias con AWS SQS

### Modelo de Consumo

**SQS (Polling):**

- El consumer hace polling activo
- Long polling de 20 segundos
- El consumer "pregunta" si hay mensajes

**Pub/Sub (Event-driven):**

- El subscriber escucha eventos
- Push model desde el servidor
- Mensajes llegan automáticamente

### Flow Control

**SQS:**

- Controlas con MaxNumberOfMessages (hasta 10)
- Polling manual

**Pub/Sub:**

- Flow control configurado en el subscriber
- maxMessages limita concurrencia automáticamente

## Crear Recursos en GCP

### Crear Topic

```bash
gcloud pubsub topics create events-topic
```

### Crear Subscription

```bash
gcloud pubsub subscriptions create events-subscription \
  --topic=events-topic \
  --ack-deadline=60 \
  --message-retention-duration=7d
```

### Configurar Dead Letter Topic (opcional)

```bash
# Crear Dead Letter Topic
gcloud pubsub topics create events-dlq

# Crear DLQ Subscription
gcloud pubsub subscriptions create events-dlq-sub \
  --topic=events-dlq

# Actualizar subscription principal con DLQ
gcloud pubsub subscriptions update events-subscription \
  --dead-letter-topic=events-dlq \
  --max-delivery-attempts=5
```

## Permisos IAM Necesarios

### Para Publicar (Publisher)

```json
{
  "roles": ["roles/pubsub.publisher"]
}
```

O permisos específicos:

```json
{
  "permissions": ["pubsub.topics.publish"]
}
```

### Para Consumir (Subscriber)

```json
{
  "roles": ["roles/pubsub.subscriber"]
}
```

O permisos específicos:

```json
{
  "permissions": ["pubsub.subscriptions.consume", "pubsub.subscriptions.get"]
}
```

## Configuración Avanzada

### Filtrado de Mensajes

Pub/Sub soporta filtrado en subscriptions:

```bash
gcloud pubsub subscriptions create events-subscription \
  --topic=events-topic \
  --filter='attributes.eventType="user.created"'
```

### Ordering Keys

Para garantizar orden de mensajes:

```typescript
// En el adapter, modificar publishMessage:
await this.topic.publishMessage({
  data: dataBuffer,
  attributes,
  orderingKey: 'user-123', // Mensajes con misma key se entregan en orden
});
```

### Retry Policy

Configurar política de reintentos en la subscription:

```bash
gcloud pubsub subscriptions update events-subscription \
  --min-retry-delay=10s \
  --max-retry-delay=600s
```

## Troubleshooting

### Error: "Subscription not found"

Asegúrate de que la subscription existe:

```bash
gcloud pubsub subscriptions describe events-subscription
```

### Error: "Permission denied"

Verifica permisos IAM:

```bash
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:YOUR_SA@PROJECT.iam.gserviceaccount.com"
```

### Mensajes no se procesan

- Verifica que el consumer esté iniciado con `start()`
- Revisa los logs para ver si hay errores de autenticación
- Confirma que la subscription tenga mensajes:
  ```bash
  gcloud pubsub subscriptions pull events-subscription --limit=5
  ```

### Mensajes duplicados

Pub/Sub garantiza "at-least-once delivery". Para idempotencia:

```typescript
// Usar el messageId para detectar duplicados
const processedIds = new Set<string>();

this.consumer.onMessage('sub', async (msg) => {
  if (processedIds.has(msg.id)) {
    await msg.ack(); // Ya procesado, solo hacer ACK
    return;
  }

  // Procesar mensaje...
  processedIds.add(msg.id);
  await msg.ack();
});
```

## Monitoreo

### Métricas en Cloud Monitoring

- `pubsub.googleapis.com/topic/send_message_operation_count`
- `pubsub.googleapis.com/subscription/num_undelivered_messages`
- `pubsub.googleapis.com/subscription/oldest_unacked_message_age`

### Ver métricas con gcloud

```bash
# Mensajes no entregados
gcloud pubsub subscriptions describe events-subscription \
  --format="value(messageRetentionDuration)"

# Edad del mensaje más antiguo
gcloud alpha monitoring time-series list \
  --filter='metric.type="pubsub.googleapis.com/subscription/oldest_unacked_message_age"'
```

## Mejores Prácticas

1. **Usa Dead Letter Topics** para mensajes que fallan repetidamente
2. **Configura ack deadline** apropiado para tu tiempo de procesamiento
3. **Implementa idempotencia** para manejar mensajes duplicados
4. **Usa atributos** para filtrado eficiente
5. **Monitorea** mensajes no entregados y edad de mensajes
6. **Usa ordering keys** si necesitas garantías de orden

## Referencias

- [GCP Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [Best Practices](https://cloud.google.com/pubsub/docs/publisher)
- [Authentication Guide](https://cloud.google.com/docs/authentication)
- [IAM Roles](https://cloud.google.com/pubsub/docs/access-control)
