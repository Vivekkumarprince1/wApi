import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { config } from '../config';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-internal-secret'] || request.headers['x-internal-service-secret'];
    const service = request.headers['x-internal-service'];

    if (!service || secret !== config.internalServiceSecret) {
      throw new UnauthorizedException('Invalid internal service credentials');
    }

    return true;
  }
}
