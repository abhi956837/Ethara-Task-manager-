TEAM TASK MANAGER
=================

Full-stack team task manager with Admin/Member roles.

FEATURES
- Signup/Login (JWT)
- RBAC (Admin, Member)
- Projects + team members
- Task create/assign/status tracking
- Dashboard with status/overdue summaries

STACK
- Backend: FastAPI + MongoDB
- Frontend: React + Vite

FOLDERS
- backend/
- frontend/

ENV
Backend .env:
- MONGODB_URL
- JWT_SECRET_KEY
- DB_NAME (optional)
- JWT_ALGORITHM (optional)
- ACCESS_TOKEN_EXPIRE_MINUTES (optional)
- APP_TITLE (optional)
- CORS_ORIGINS (optional)

Frontend .env:
- VITE_API_BASE_URL

RUN BACKEND
1. cd backend
2. python -m venv .venv
3. .\.venv\Scripts\Activate.ps1
4. pip install -r requirements.txt
5. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

RUN FRONTEND
1. cd frontend
2. npm install
3. npm run dev

URLS
- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs

SECURITY NOTES
- Do not commit real secrets
- Use strict CORS in production
- Use HTTPS
