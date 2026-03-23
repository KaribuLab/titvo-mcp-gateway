import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

/**
 * Expone GET /health para probes de disponibilidad (load balancer, ECS, Kubernetes).
 */
@Controller()
export class HealthcheckController {
  @Get('health')
  @HttpCode(HttpStatus.OK)
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
