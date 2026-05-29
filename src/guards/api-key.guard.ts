import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-api-key'];

    if (provided !== apiKey) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
