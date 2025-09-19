import axios from "axios";

// Use env variable for backend URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

// Register a new user with name + face image
export async function registerUser(name, file) {
  const form = new FormData();
  form.append("name", name);
  form.append("file", file);

  const res = await axios.post(`${API_BASE}/register`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

// Capture image for attendance
export async function captureImage(file) {
  const form = new FormData();
  form.append("file", file);

  const res = await axios.post(`${API_BASE}/capture/auto`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

// Get all attendance records
export async function getAttendance() {
  const res = await axios.get(`${API_BASE}/attendance`);
  return res.data;
}
