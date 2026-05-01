# Team Task Manager

Full-stack Team Task Manager with role-based access (Admin/Member), built with FastAPI + MongoDB and React + Vite.

## Features
- Authentication: Signup / Login (JWT)
- Role-based access control: Admin, Member
- Project management: create projects, manage team members
- Task management: create, assign, update status, due dates
- Dashboard: summary counts, task status buckets, overdue tasks

## Tech Stack
- Backend: FastAPI, Motor (MongoDB), Pydantic, Passlib, python-jose
- Frontend: React, Vite, Axios, Tailwind CSS
- Database: MongoDB Atlas (or local MongoDB)

## Project Structure
- `backend/` FastAPI API
- `frontend/` React app

## Environment Variables

### Backend (`backend/.env`)
Required:
- `MONGODB_URL`
- `JWT_SECRET_KEY`

Optional:
- `DB_NAME` (default: `ethara_db`)
- `JWT_ALGORITHM` (default: `HS256`)
- `ACCESS_TOKEN_EXPIRE_MINUTES` (default: `1440`)
- `APP_TITLE` (default: `Team Task Manager API`)
- `CORS_ORIGINS` (comma-separated origins, e.g. `http://localhost:5173`)

### Frontend (`frontend/.env`)
Required:
- `VITE_API_BASE_URL` (e.g. `http://localhost:8000`)

## Local Run

### 1) Backend
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2) Frontend
```powershell
cd frontend
npm install
npm run dev
```

Open:
- Frontend: `http://localhost:5173`
- Backend docs: `http://localhost:8000/docs`

## Production Notes
- Never commit real secrets in `.env`
- Use strong `JWT_SECRET_KEY`
- Set strict `CORS_ORIGINS` (no `*` in production)
- Remove `tlsAllowInvalidCertificates=true` from MongoDB URL
- Use HTTPS in production

## Railway Deployment (Quick)
- Deploy `backend` and `frontend` as separate Railway services from same repo
- Backend start command:
  - `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Frontend build/start:
  - Build: `npm install && npm run build`
  - Start: `npm run preview -- --host 0.0.0.0 --port $PORT`
- Set `VITE_API_BASE_URL` to backend public URL
- Set backend `CORS_ORIGINS` to frontend public URL

## License
For educational / assignment use.
