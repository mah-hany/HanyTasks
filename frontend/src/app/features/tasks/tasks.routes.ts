import { Routes } from '@angular/router';

export const TASKS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./tasks-list/tasks-list.component').then(m => m.TasksListComponent) },
  { path: ':id', loadComponent: () => import('./task-detail/task-detail.component').then(m => m.TaskDetailComponent) },
];
