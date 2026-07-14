import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { config } from '../config';

@Controller()
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get('/')
  root() {
    return this.health();
  }

  @Get('/health')
  health() {
    const dbState = this.connection.readyState;
    return {
      status: dbState === 1 ? 'ok' : 'degraded',
      service: 'bsp-service',
      env: config.env,
      db: dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('/readiness')
  readiness() {
    if (this.connection.readyState !== 1) {
      throw new ServiceUnavailableException({ status: 'not_ready', service: 'bsp-service', mongo: false });
    }
    return { status: 'ready', service: 'bsp-service', mongo: true };
  }
}
