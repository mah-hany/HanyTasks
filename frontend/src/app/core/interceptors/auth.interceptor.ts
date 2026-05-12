import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, from } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Convert a Blob error body → parsed JSON (needed when responseType='blob' requests fail) */
function blobToJson(blob: Blob): Promise<any> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result as string)); }
      catch { resolve({ message: reader.result }); }
    };
    reader.onerror = () => resolve({ message: 'Unknown error' });
    reader.readAsText(blob);
  });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Build the authenticated request, preserving ALL original options (incl. responseType:'blob')
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // If the error body is a Blob (happens when responseType='blob'), parse it first
      if (err.error instanceof Blob && err.error.type === 'application/json') {
        return from(blobToJson(err.error)).pipe(
          switchMap(parsed => throwError(() => ({ ...err, error: parsed })))
        );
      }

      if (err.status === 401 && !req.url.includes('/auth/')) {
        return authService.refresh().pipe(
          switchMap(() => {
            const newToken = authService.getToken();
            // Clone authReq (which already has responseType:'blob' if needed) with the new token
            const retryReq = authReq.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
            return next(retryReq);
          }),
          catchError(refreshErr => {
            authService.clearSession();
            return throwError(() => refreshErr);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
