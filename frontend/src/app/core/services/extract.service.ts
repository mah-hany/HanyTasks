import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ExtractService {
  private base = `${environment.apiUrl}/extracts`;

  constructor(private http: HttpClient) {}

  getAll(filters: any = {}) {
    let p = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v)); });
    return this.http.get<any>(this.base, { params: p });
  }

  getById(id: number)               { return this.http.get<any>(`${this.base}/${id}`); }
  create(data: any)                 { return this.http.post<any>(this.base, data); }
  updateStatus(id: number, status: string, returnComment?: string) {
    return this.http.patch<any>(`${this.base}/${id}/status`, { status, returnComment });
  }
  delete(id: number)                { return this.http.delete<any>(`${this.base}/${id}`); }

  // Lookup data
  getContractors() { return this.http.get<any>(`${environment.apiUrl}/contractors`); }
  getProjects()    { return this.http.get<any>(`${environment.apiUrl}/projects`); }
  createContractor(data: any) { return this.http.post<any>(`${environment.apiUrl}/contractors`, data); }
  createProject(data: any)    { return this.http.post<any>(`${environment.apiUrl}/projects`, data); }
}
