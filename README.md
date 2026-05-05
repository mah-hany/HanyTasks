# TaskFlow Pro — نظام إدارة المهام المؤسسي
## Enterprise Task Management System

> **Full-Stack Web App** | Angular 21 + Node.js/Express + PostgreSQL + Socket.IO

---

## 🏗️ Project Structure

```
ادارة المهام/
├── backend/          # Node.js + Express + TypeScript + Prisma
│   ├── prisma/       # Database schema + migrations + seed
│   ├── src/
│   │   ├── modules/  # auth, users, tasks, departments, notifications...
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── app.ts
│   │   ├── index.ts
│   │   ├── socket.ts
│   │   └── schedulers.ts
│   └── .env          # (create from .env.example)
└── frontend/         # Angular 21 + Angular Material 21
    ├── src/
    │   ├── app/
    │   │   ├── core/         # services, guards, interceptors
    │   │   ├── features/     # dashboard, tasks, users, org-chart...
    │   │   └── layouts/      # shell (sidebar + header)
    │   └── environments/
    └── public/assets/i18n/   # ar.json + en.json
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- npm 10+

---

### 1. Backend Setup

```bash
cd backend

# 1. Copy env file and configure it
cp .env.example .env
# Edit .env and set your DATABASE_URL

# 2. Install dependencies
npm install

# 3. Push schema to database
npx prisma db push

# 4. Seed database (creates demo users)
npm run seed

# 5. Start development server
npm run dev
```

**Backend runs on:** `http://localhost:5000`

---

### 2. Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
# OR
npx ng serve
```

**Frontend runs on:** `http://localhost:4200`

---

## 🔑 Demo Accounts

| Role | Username | Password |
|------|----------|----------|
| SuperAdmin | `superadmin` | `Admin@2026` |
| Manager | `manager1` | `Manager@2026` |
| Employee | `emp1` | `Emp@2026` |

---

## ✨ Features

### Backend API (`/api`)
| Module | Endpoints |
|--------|-----------|
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/change-password` |
| Users | `GET/POST/PUT /users`, `/users/org-tree` |
| Tasks | `GET/POST /tasks`, `/tasks/:id/status`, `/tasks/:id/comments` |
| Departments | `GET/POST /departments`, `/departments/tree` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read` |
| Reports | `GET /reports/departments-summary`, `/reports/overdue` |
| Audit | `GET /audit` |

### Frontend Features
- 🔐 **Secure Login** — Glass morphism design, brute-force protection
- 📊 **Dashboard** — KPI cards, Chart.js bar + doughnut charts
- 📋 **Kanban Board** — 5-column task view (New → Completed)
- 📁 **Task Detail** — Timeline, comments, file attachments, progress slider
- 🏢 **Org Chart** — Hierarchical tree view with search
- 👥 **Employees** — Card grid with role/dept filters
- 🔔 **Real-time Notifications** — Socket.IO bell badge
- 📑 **Reports** — Department summary + overdue report tabs
- 🌍 **Bilingual** — Arabic (RTL) / English (LTR) instant switching
- 🌙 **Dark Mode** — Persisted theme toggle

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 21, Angular Material 21, Chart.js, Socket.IO Client, ngx-translate v17 |
| Backend | Node.js, Express, TypeScript, Prisma 6, Socket.IO, node-cron |
| Database | PostgreSQL |
| Auth | JWT (access + refresh), bcryptjs |
| File Upload | Multer |
| Logging | Winston |

---

## 📝 NPM Scripts

### Backend
```bash
npm run dev      # Start with ts-node-dev (hot reload)
npm run build    # Compile TypeScript
npm run seed     # Run database seed
```

### Frontend
```bash
npm run dev      # Start Angular dev server (port 4200)
npm run build    # Build production bundle
```
