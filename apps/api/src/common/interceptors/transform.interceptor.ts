import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '@alkabeer/shared';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map((res) => {
        // If the service returned a paginated result or metadata
        if (res && typeof res === 'object' && 'items' in res && 'meta' in res) {
          return {
            success: true,
            data: res,
            meta: {
              timestamp: new Date().toISOString(),
              path: request.url,
              pagination: res.meta,
            },
          };
        }

        return {
          success: true,
          data: res,
          meta: {
            timestamp: new Date().toISOString(),
            path: request.url,
          },
        };
      }),
    );
  }
}
