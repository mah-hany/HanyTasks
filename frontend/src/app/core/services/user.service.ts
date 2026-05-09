import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserService {
  private url = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getAll(filters: any = {})        { return this.http.get<any>(this.url, { params: filters }); }
  getAssignable()                  { return this.http.get<any>(`${this.url}/assignable`); }
  getById(id: number)              { return this.http.get<any>(`${this.url}/${id}`); }
  getOrgTree()                     { return this.http.get<any>(`${this.url}/org-tree`); }
  create(data: any)                { return this.http.post<any>(this.url, data); }
  update(id: number, data: any)    { return this.http.put<any>(`${this.url}/${id}`, data); }
  resetPassword(id: number, newPassword: string) {
    return this.http.post<any>(`${this.url}/${id}/reset-password`, { newPassword });
  }
  transfer(id: number, toDeptId: number, note: string) {
    return this.http.post<any>(`${this.url}/${id}/transfer`, { toDeptId, note });
  }
  uploadPhoto(id: number, file: File) {
    const fd = new FormData(); fd.append('photo', file);
    return this.http.post<any>(`${this.url}/${id}/photo`, fd);
  }
}
