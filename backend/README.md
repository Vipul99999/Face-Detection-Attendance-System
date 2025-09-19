# Face Attendance Backend

## Run locally

1. Create virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate   # on Windows: venv\Scripts\activate

Install deps:

pip install -r requirements.txt


Start MongoDB locally (mongod)

Run backend:

uvicorn app.main:app --reload --port 8000

API Endpoints

POST /api/v1/register → Register new user (name + face image)

POST /api/v1/capture → Capture face and mark attendance

GET /api/v1/attendance → Fetch attendance records


---

# ✅ Next Steps

1. Run MongoDB locally (or connect to cloud Atlas).  
2. Install deps & run backend:  
   ```bash
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000


Keep frontend running (npm run dev), it will call backend at http://localhost:8000/api/v1.

Test workflow:

Go to Register page → enter name + upload/capture → registers user.

Go to Dashboard → face appears → attendance is logged.