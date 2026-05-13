import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { QRCodeComponent } from 'angularx-qrcode';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-qr-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, QRCodeComponent, TranslateModule],
  template: `
    <h2 mat-dialog-title style="text-align: center; margin-bottom: 0;">{{ data.title }}</h2>
    <mat-dialog-content style="display: flex; flex-direction: column; align-items: center; padding: 24px;">
      <p style="color: var(--text-muted); font-size: 13px; text-align: center; margin-top: 0; margin-bottom: 24px;">
        {{ data.subtitle }}
      </p>
      
      <div style="background: white; padding: 16px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <qrcode 
          [qrdata]="data.url" 
          [width]="200" 
          [errorCorrectionLevel]="'M'">
        </qrcode>
      </div>
      
      <p style="margin-top: 24px; font-size: 12px; color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.1); padding: 8px 12px; border-radius: 8px; word-break: break-all; text-align: center;">
        {{ data.url }}
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="center">
      <button mat-stroked-button mat-dialog-close>{{ 'COMMON.CANCEL' | translate }}</button>
      <button mat-flat-button color="primary" class="tf-btn-primary" (click)="downloadQR()">تنزيل الصورة</button>
    </mat-dialog-actions>
  `
})
export class QrDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<QrDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string, subtitle: string, url: string }
  ) {}

  downloadQR() {
    const canvas = document.querySelector('qrcode canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR-${this.data.title.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }
}
