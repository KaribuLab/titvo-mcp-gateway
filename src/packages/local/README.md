# LOCAL Provider - Guía de Uso

## Descripción

El provider LOCAL usa **BullMQ + Redis** para simular servicios cloud en desarrollo local. Es ideal para desarrollo, testing y ambientes donde no se requiere infraestructura cloud.

## Configuración

### Variables de Entorno Requeridas

Todas estas variables son **obligatorias** cuando usas LOCAL como provider:

```bash
CLOUD_PROVIDER=local
REDIS_HOST=localhost
REDIS_PORT=6379
LOCAL_QUEUE_NAME=events-queue
LOCAL_RESULT_QUEUE_NAME=results-queue
```

### Variables Opcionales

```bash
REDIS_PASSWORD=mypassword    # Si Redis tiene password
REDIS_DB=0                    # Base de datos (default: 0)
```

## Instalación

### 1. Instalar Redis

#### Opción A: Docker (Recomendado)

Usa el `docker-compose.yml` incluido:

```bash
docker-compose up -d redis
```

Verifica que está corriendo:

```bash
docker ps
redis-cli ping  # Debe retornar PONG
```

#### Opción B: Instalación Local

**Ubuntu/Debian:**

```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**macOS:**

```bash
brew install redis
brew services start redis
```

**Windows:**

Usa Docker o WSL2.

### 2. Verificar Conexión

```bash
redis-cli
127.0.0.1:6379> ping
PONG
127.0.0.1:6379> exit
```

## Uso

### 1. Publicar Eventos

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
    // Publicar a la queue de BullMQ
    const jobId = await this.publishEvent.publish(
      'user.created', // Nombre del job/evento
      {
        // Payload (data del job)
        userId,
        email: 'user@example.com',
        timestamp: new Date().toISOString(),
      },
      {
        // Atributos (metadata)
        source: 'user-service',
        priority: 'high',
      },
    );

    console.log(`Job published with ID: ${jobId}`);
  }
}
```

### 2. Consumir Jobs

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
        console.log(`Processing job: ${msg.id}`);

        // Parsear el mensaje
        const result = JSON.parse(msg.data.toString('utf-8'));

        // Procesar el resultado
        await this.processResult(result);

        // Confirmar procesamiento exitoso (job completado)
        await msg.ack();
      } catch (error) {
        console.error(`Error processing job: ${error.message}`);

        // Rechazar el job (BullMQ lo reintentará)
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

### BullMQ Publisher

- ✅ Publicación de jobs a Redis
- ✅ Persistencia automática
- ✅ Reintentos configurables (3 intentos por defecto)
- ✅ Backoff exponencial
- ✅ Jobs scheduled (delayed jobs)
- ✅ Priorización de jobs
- ✅ Rate limiting

### BullMQ Worker

- ✅ Procesamiento concurrente (hasta 10 jobs simultáneos)
- ✅ ACK/NACK manual
- ✅ Reintentos automáticos
- ✅ Stalled jobs detection
- ✅ Rate limiting y throttling
- ✅ Inicio/Detención controlada

## Flujo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                     GATEWAY (mcp-gateway)                    │
│                                                              │
│  1. Usuario hace request                                    │
│  2. Gateway publica evento → events-queue                   │
│     publishEvent.publish('task.process', data)              │
│                                                              │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
        ┌──────────┐
        │  Redis   │  ← events-queue (job persistido)
        │  BullMQ  │
        └──────────┘
              │
              ▼
┌─────────────┴─────────────────────────────────────────┐
│                  WORKER (otro proceso)                 │
│                                                        │
│  3. Worker consume de events-queue                    │
│  4. Procesa la tarea                                  │
│  5. Publica resultado → results-queue                 │
│     publishResult.publish('task.result', result)      │
│                                                        │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
        ┌──────────┐
        │  Redis   │  ← results-queue (resultado)
        │  BullMQ  │
        └──────────┘
              │
              ▼
┌─────────────┴─────────────────────────────────────────┐
│              GATEWAY (mcp-gateway)                     │
│                                                        │
│  6. Gateway consume de results-queue                  │
│  7. Procesa resultado                                 │
│  8. Retorna respuesta al usuario                      │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## Monitoreo

### CLI de BullMQ

Instala el CLI global:

```bash
npm install -g bullmq-cli
```

Ver colas:

```bash
bullmq-cli list-queues --host localhost --port 6379
```

Ver jobs:

```bash
bullmq-cli list-jobs events-queue --host localhost --port 6379
```

### Bull Board (UI Web)

Instala Bull Board en tu proyecto:

```bash
yarn add @bull-board/express @bull-board/api
```

Configura en tu aplicación:

```typescript
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(eventsQueue), new BullMQAdapter(resultsQueue)],
  serverAdapter: serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

Accede a: http://localhost:3000/admin/queues

### Redis CLI

Ver keys:

```bash
redis-cli keys "bull:*"
```

Ver info de una cola:

```bash
redis-cli lrange "bull:events-queue:wait" 0 -1
```

## Configuración Avanzada

### Reintentos Personalizados

En `publish-event.adapter.ts`, modifica `defaultJobOptions`:

```typescript
defaultJobOptions: {
  attempts: 5,              // 5 reintentos
  backoff: {
    type: 'exponential',
    delay: 1000,            // Empezar con 1s
  },
  removeOnComplete: 50,     // Mantener últimos 50
  removeOnFail: 200,        // Mantener últimos 200
}
```

### Prioridad de Jobs

Al publicar:

```typescript
await this.publishEvent.publish(
  'high-priority-task',
  data,
  { priority: 'critical' }, // Aunque BullMQ usa números
);
```

Para usar prioridad numérica, modifica el adapter:

```typescript
await this.queue.add(topic, payload, {
  priority: 1, // 1 = más alta prioridad
});
```

### Jobs Scheduled (Delayed)

Modifica el adapter para soportar delay:

```typescript
await this.queue.add(topic, payload, {
  delay: 5000, // Ejecutar en 5 segundos
});
```

### Rate Limiting

En `queue-consumer.adapter.ts`:

```typescript
limiter: {
  max: 50,        // Máximo 50 jobs
  duration: 1000, // Por segundo
}
```

## Troubleshooting

### Error: "ECONNREFUSED"

Redis no está corriendo. Verifica:

```bash
docker ps  # Si usas Docker
redis-cli ping  # Debe retornar PONG
```

Inicia Redis:

```bash
docker-compose up -d redis
```

### Jobs no se procesan

1. Verifica que el consumer esté iniciado:

   ```typescript
   await consumer.start();
   ```

2. Revisa logs del Worker

3. Verifica que la queue existe en Redis:
   ```bash
   redis-cli keys "bull:results-queue:*"
   ```

### Jobs se quedan en "active"

Stalled jobs. BullMQ los detecta automáticamente después de un timeout.

Configura stalled check:

```typescript
stalledInterval: 30000,  // Check cada 30s
maxStalledCount: 3,      // Máximo 3 veces stalled
```

### Memoria de Redis crece

Limpia jobs completados/fallidos:

```typescript
await queue.clean(1000, 100, 'completed'); // Limpiar jobs > 1s completados
await queue.clean(7000, 100, 'failed'); // Limpiar jobs > 7s fallidos
```

O configura mejor `removeOnComplete` y `removeOnFail`.

## Testing

### Unit Tests

Mock el adapter:

```typescript
const mockPublishEvent = {
  publish: jest.fn().mockResolvedValue('job-123'),
};

// En tu test
expect(mockPublishEvent.publish).toHaveBeenCalledWith(
  'user.created',
  expect.objectContaining({ userId: '123' }),
);
```

### Integration Tests

Usa Redis en memoria (ioredis-mock):

```bash
yarn add -D ioredis-mock
```

```typescript
import RedisMock from 'ioredis-mock';

const mockRedis = new RedisMock();
// Usa mockRedis en lugar de la conexión real
```

## Mejores Prácticas

1. ✅ **Usa nombres descriptivos** para las colas
2. ✅ **Configura limpieza automática** de jobs viejos
3. ✅ **Implementa idempotencia** en los handlers
4. ✅ **Monitorea** con Bull Board en desarrollo
5. ✅ **Usa reintentos** con backoff exponencial
6. ✅ **Limita concurrencia** según recursos
7. ✅ **Loggea** IDs de jobs para debugging
8. ✅ **No guardes** datos sensibles en Redis sin encriptar

## Migración a Producción

Cuando migres a cloud:

1. Cambia `CLOUD_PROVIDER=aws` o `gcp`
2. Configura variables de entorno del provider
3. **No cambies código** - los ports son los mismos
4. El comportamiento es idéntico

## Referencias

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Bull Board (UI)](https://github.com/felixmosh/bull-board)
- [Redis Documentation](https://redis.io/docs/)
- [ioredis](https://github.com/redis/ioredis)
