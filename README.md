# 📌 Face Detection Attendance System

### 🔹 Overview
A **real-time face recognition attendance system** that automates attendance logging using **ArcFace (InsightFace)** for embeddings, **OpenCV** for image processing, and a **FastAPI backend with MongoDB** for secure data storage.  
Includes a **React.js dashboard** to visualize live attendance records. The system ensures robustness with **anti-spoofing checks** and **duplicate detection**.

---

### 🔹 Features
✅ **Face Registration** – Register new users with their name + face embedding  
✅ **Attendance Marking** – Automatically detects and logs attendance when a face is captured  
✅ **Anti-Spoofing** – Prevents spoofing attempts (flat photos, unrealistic poses, etc.)  
✅ **Duplicate Face Detection** – Uses cosine similarity to avoid duplicate user registrations  
✅ **Dashboard (React.js)** – Live camera feed with real-time attendance updates  
✅ **REST APIs** – Secure FastAPI endpoints for registration, face capture & attendance retrieval  

---

### 🔹 Tech Stack
- **Backend:** Python, FastAPI, Uvicorn, MongoDB, PyMongo  
- **Frontend:** React.js, Axios, Tailwind CSS  
- **Face Recognition:** InsightFace (ArcFace embeddings), OpenCV  
- **Utilities:** NumPy, scikit-learn (cosine similarity), python-multipart, dotenv  

---

---

### 🔹 Demo

![Project Demo](./public/Face_Project.gif)

---

### 🔹 Screenshots

#### 🖥️ Dashboard Page View  
![Dashboard Page Screenshot](.public/Dashboard_Page.png)

#### 📷 Register Page View  
![Register Page Screenshot](./public/Register_Page.png.png)

---

### 🔹 System Architecture

📸 React.js Frontend (Camera + Dashboard)
    └─ Captures live video feed and displays real-time attendance data

🔗 FastAPI Backend
    └─ Handles REST APIs for registration, face capture, and attendance logging

🧠 Face Recognition Engine (OpenCV + ArcFace)
    └─ Processes frames, extracts embeddings, performs anti-spoofing and duplicate checks

🗄️ MongoDB Database
    └─ Stores user profiles, face embeddings, and attendance records securely

---

---
### 🔹 Installation & Setup

#### 1️⃣ Clone the repository
```bash
git clone https://github.com/yourusername/face-attendance-system.git
cd face-attendance-system

cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

cd frontend
npm install
npm run dev

---