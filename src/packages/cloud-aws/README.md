# AWS Cloud Provider - Guía de Uso

## Configuración

### Variables de Entorno Requeridas

Todas estas variables son **obligatorias** cuando usas AWS como provider:

```bash
CLOUD_PROVIDER=aws
AWS_REGION=us-east-1
AWS_EVENTBUS_NAME=default
AWS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/my-queue
```

**Nota:** Si no tienes un EventBus custom, usa `default`. La aplicación **no iniciará** si falta alguna de estas variables.

### Credenciales AWS

Las credenciales se pueden configurar de varias formas:

1. **AWS CLI** (recomendado para desarrollo local):

   ```bash
   aws configure
   ```

2. **Variables de entorno**:

   ```bash
   export AWS_ACCESS_KEY_ID=your-access-key
   export AWS_SECRET_ACCESS_KEY=your-secret-key
   ```

3. **IAM Roles** (recomendado para producción en AWS):
   - ECS Task Role
   - EC2 Instance Profile
   - Lambda Execution Role

## Uso

### 1. Publicar Eventos a EventBridge

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
    const eventId = await this.publishEvent.publish(
      'user.created', // DetailType (topic)
      {
        // Payload (se serializa a JSON)
        userId,
        email: 'user@example.com',
        timestamp: new Date().toISOString(),
      },
      {
        // Attributes (opcionales)
        source: 'user-service',
        version: '1.0',
      },
    );

    console.log(`Event published with ID: ${eventId}`);
  }
}
```

**Estructura del evento en EventBridge:**

```json
{
  "Source": "mcp-gateway",
  "DetailType": "user.created",
  "Detail": "{\"userId\":\"123\",\"email\":\"user@example.com\",\"timestamp\":\"2025-10-17T...\"}",
  "EventBusName": "default",
  "Resources": ["source:user-service", "version:1.0"]
}
```

### 2. Consumir Mensajes de SQS

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

        // Procesar el mensaje
        await this.processMessage(payload);

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

  private async processMessage(payload: any) {
    // Tu lógica de negocio aquí
    console.log('Processing:', payload);
  }
}
```

## Características

### EventBridge Adapter

- ✅ Publicación de eventos a EventBridge
- ✅ Soporte para EventBus custom (o default)
- ✅ Manejo de atributos como Resources
- ✅ Logging detallado con Logger de NestJS
- ✅ Manejo de errores robusto

### SQS Consumer Adapter

- ✅ Long polling (20 segundos) para eficiencia
- ✅ Procesamiento en paralelo de múltiples mensajes
- ✅ ACK/NACK manual de mensajes
- ✅ Inicio/Detención controlada del consumer
- ✅ Manejo automático de errores con NACK
- ✅ Logging detallado de operaciones

## Permisos IAM Necesarios

### Para EventBridge

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["events:PutEvents"],
      "Resource": "arn:aws:events:*:*:event-bus/default"
    }
  ]
}
```

### Para SQS

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:ChangeMessageVisibility"
      ],
      "Resource": "arn:aws:sqs:*:*:your-queue-name"
    }
  ]
}
```

## Troubleshooting

### Error: "queueUrl is required for SQS consumer"

Asegúrate de configurar la variable `AWS_QUEUE_URL` cuando uses el consumer de SQS.

### Error: "No message handler registered"

Llama a `queueConsumer.onMessage()` antes de llamar a `queueConsumer.start()`.

### Mensajes no se procesan

- Verifica que el consumer esté iniciado con `start()`
- Revisa los logs para ver si hay errores de autenticación
- Verifica los permisos IAM de la aplicación
- Confirma que la URL de la cola sea correcta

### EventBridge: "Failed to publish event"

- Verifica los permisos IAM para `events:PutEvents`
- Confirma que el EventBus existe
- Revisa que el payload sea serializable a JSON
