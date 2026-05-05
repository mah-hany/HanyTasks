import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private url = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) {}

  getAll(filters: any = {}) {
    let params = new HttpParams();
    Object.keys(filters).forEach(k => { if (filters[k] !== undefined && filters[k] !== '') params = params.set(k, filters[k]); });
    return this.http.get<any>(this.url, { params });
  }

  getById(id: number) { return this.http.get<any>(`${this.url}/${id}`); }
  getDashboard()      { return this.http.get<any>(`${this.url}/dashboard`); }
  getCategories()     { return this.http.get<any>(`${this.url}/categories`); }

  create(data: any)   { return this.http.post<any>(this.url, data); }

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

  delete(id: number) {
    return this.http.delete<any>(`${this.url}/${id}`);
  }
}
