import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private url = `${environment.apiUrl}/tasks`;
  private templateUrl = `${environment.apiUrl}/templates`;
  private exportUrl  = `${environment.apiUrl}/export`;

  constructor(private http: HttpClient) {}

  // ── Tasks ───────────────────────────────────────────────────
  getAll(filters: any = {}) {
    let params = new HttpParams();
    Object.keys(filters).forEach(k => { if (filters[k] !== undefined && filters[k] !== '') params = params.set(k, filters[k]); });
    return this.http.get<any>(this.url, { params });
  }

  getById(id: number)     { return this.http.get<any>(`${this.url}/${id}`); }
  getDashboard()          { return this.http.get<any>(`${this.url}/dashboard`); }
  getCategories()         { return this.http.get<any>(`${this.url}/categories`); }

  getCalendar(year: number, month: number) {
    return this.http.get<any>(`${this.url}/calendar`, { params: { year: year.toString(), month: month.toString() } });
  }

  create(data: any)       { return this.http.post<any>(this.url, data); }
  update(id: number, data: any) { return this.http.put<any>(`${this.url}/${id}`, data); }
  archive(id: number, isArchived: boolean) { return this.http.put<any>(`${this.url}/${id}/archive`, { isArchived }); }

  updateStatus(id: number, status: string, note?: string) {
    return this.http.patch<any>(`${this.url}/${id}/status`, { status, note });
  }

  updateProgress(id: number, progress: number) {
    return this.http.patch<any>(`${this.url}/${id}/progress`, { progress });
  }

  addComment(id: number, text: string, isManagerNote = false) {
    return this.http.post<any>(`${this.url}/${id}/comments`, { text, isManagerNote });
  }

  uploadAttachment(id: number, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<any>(`${this.url}/${id}/attachments`, fd);
  }

  deleteAttachment(taskId: number, attachmentId: number) {
    return this.http.delete<any>(`${this.url}/${taskId}/attachments/${attachmentId}`);
  }

  delete(id: number) { return this.http.delete<any>(`${this.url}/${id}`); }

  // ── Checklist (Sub-tasks) ───────────────────────────────────
  getChecklist(taskId: number) {
    return this.http.get<any>(`${this.url}/${taskId}/checklist`);
  }

  addChecklistItem(taskId: number, text: string, textAr?: string) {
    return this.http.post<any>(`${this.url}/${taskId}/checklist`, { text, textAr });
  }

  toggleChecklistItem(taskId: number, itemId: number, isCompleted: boolean) {
    return this.http.patch<any>(`${this.url}/${taskId}/checklist/${itemId}`, { isCompleted });
  }

  deleteChecklistItem(taskId: number, itemId: number) {
    return this.http.delete<any>(`${this.url}/${taskId}/checklist/${itemId}`);
  }

  // ── Templates ───────────────────────────────────────────────
  getTemplates()                   { return this.http.get<any>(this.templateUrl); }
  getTemplate(id: number)          { return this.http.get<any>(`${this.templateUrl}/${id}`); }
  createTemplate(data: any)        { return this.http.post<any>(this.templateUrl, data); }
  updateTemplate(id: number, d: any) { return this.http.put<any>(`${this.templateUrl}/${id}`, d); }
  deleteTemplate(id: number)       { return this.http.delete<any>(`${this.templateUrl}/${id}`); }

  // ── Export ──────────────────────────────────────────────────
  exportTasksCsv(filters: any = {}) {
    let params = new HttpParams();
    Object.keys(filters).forEach(k => { if (filters[k]) params = params.set(k, filters[k]); });
    return this.http.get(`${this.exportUrl}/tasks/csv`, { params, responseType: 'blob' });
  }

  exportEmployeeReport(userId: number, from?: string, to?: string) {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to)   params = params.set('to', to);
    return this.http.get(`${this.exportUrl}/report/employee/${userId}/csv`, { params, responseType: 'blob' });
  }

  exportTasksPdf(filters: any = {}) {
    let params = new HttpParams();
    Object.keys(filters).forEach(k => { if (filters[k]) params = params.set(k, filters[k]); });
    return this.http.get(`${this.exportUrl}/tasks/pdf`, { params, responseType: 'blob' });
  }

  exportEmployeeReportPdf(userId: number, from?: string, to?: string) {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to)   params = params.set('to', to);
    return this.http.get(`${this.exportUrl}/report/employee/${userId}/pdf`, { params, responseType: 'blob' });
  }

  getDashboardExportData() {
    return this.http.get<any>(`${this.exportUrl}/dashboard/json`);
  }
}
