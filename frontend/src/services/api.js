import axios from "axios";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
const AUTH_STORAGE_KEY = "face-attendance-admin-session";

class ApiClientError extends Error {
  constructor({
    message,
    code = "UNKNOWN_ERROR",
    status = 500,
    details = null,
    data = null,
  }) {
    super(message || "Something went wrong");
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.data = data;
  }
}

const publicClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

const adminClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

function normalizeError(error, fallback) {
  const responseData = error?.response?.data;
  return new ApiClientError({
    message: responseData?.message || error?.message || fallback || "Something went wrong",
    code: responseData?.error?.code || "UNKNOWN_ERROR",
    status: error?.response?.status || 500,
    details: responseData?.error?.details || null,
    data: responseData || null,
  });
}

function parseStoredSession(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed?.token) {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

adminClient.interceptors.request.use((config) => {
  const session = getStoredSession();
  if (session?.token) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});

export function getStoredSession() {
  return parseStoredSession(window.localStorage.getItem(AUTH_STORAGE_KEY));
}

export function getStoredToken() {
  return getStoredSession()?.token || "";
}

export function setStoredSession(session) {
  const normalizedSession = {
    token: session.token,
    role: session.role || "admin",
    admin: session.admin || null,
  };
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalizedSession));
}

export function setStoredToken(token) {
  const current = getStoredSession();
  setStoredSession({
    token,
    admin: current?.admin || null,
    role: "admin",
  });
}

export function clearStoredToken() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isAuthError(error) {
  return error?.status === 401;
}

export async function adminLogin(username, password) {
  try {
    const form = new FormData();
    form.append("username", username);
    form.append("password", password);
    const response = await publicClient.post("/admin/login", form);
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Login failed");
  }
}

export async function getAdminMe() {
  try {
    const response = await adminClient.get("/admin/me");
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Unable to load admin profile");
  }
}

export async function getSystemHealth() {
  try {
    const response = await publicClient.get("/health");
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Unable to load system health");
  }
}

export async function getDashboardSummary() {
  try {
    const response = await adminClient.get("/dashboard/summary");
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Unable to load dashboard summary");
  }
}

export async function getAnalyticsSummary(date = "") {
  try {
    const response = await adminClient.get("/analytics/summary", {
      params: date ? { date } : {},
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Unable to load analytics summary");
  }
}

export async function getStudents() {
  try {
    const response = await adminClient.get("/students");
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Unable to load students");
  }
}

export async function deleteStudent(studentId, confirmPassword) {
  try {
    const form = new FormData();
    form.append("confirm_password", confirmPassword);
    const response = await adminClient.post(`/students/${studentId}/purge`, form);
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to delete student");
  }
}

export async function getAuditLogs() {
  try {
    const response = await adminClient.get("/audit-logs");
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Unable to load audit logs");
  }
}

export async function reencryptEmbeddings() {
  try {
    const response = await adminClient.post("/security/embeddings/re-encrypt");
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to re-encrypt embeddings");
  }
}

export async function registerUser(name, file) {
  try {
    const form = new FormData();
    form.append("name", name);
    form.append("file", file);

    const response = await adminClient.post("/register", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to register student");
  }
}

export async function captureImage(file, options = {}) {
  try {
    const form = new FormData();
    form.append("file", file);
    if (options.livenessToken) {
      form.append("liveness_token", options.livenessToken);
    }
    if (options.livenessProof) {
      form.append("liveness_proof", JSON.stringify(options.livenessProof));
    }

    const response = await publicClient.post("/capture/auto", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to capture attendance");
  }
}

export async function getLivenessChallenge() {
  try {
    const response = await publicClient.get("/liveness/challenge");
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Unable to load liveness challenge");
  }
}

export async function getAttendance() {
  try {
    const response = await adminClient.get("/attendance");
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Unable to load attendance");
  }
}

export async function downloadAttendanceCsv() {
  const token = getStoredToken();
  if (!token) {
    throw new ApiClientError({
      message: "Log in as admin to export attendance.",
      code: "AUTH_REQUIRED",
      status: 401,
    });
  }

  const response = await fetch(`${API_BASE}/attendance/export.csv`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const message = response.status === 401 ? "Your session expired. Please log in again." : "Failed to download CSV export.";
    throw new ApiClientError({
      message,
      code: response.status === 401 ? "SESSION_EXPIRED" : "EXPORT_FAILED",
      status: response.status,
    });
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "attendance_export.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadAuditLogsCsv(filters = {}) {
  const { logs = [] } = await getAuditLogs();
  const filteredLogs = logs.filter((log) => {
    const actionMatch =
      !filters.action ||
      log.action?.toLowerCase().includes(String(filters.action).toLowerCase());
    const adminMatch =
      !filters.admin_username ||
      log.admin_username?.toLowerCase().includes(String(filters.admin_username).toLowerCase());
    return actionMatch && adminMatch;
  });

  const header = [
    "id",
    "admin_username",
    "action",
    "target_type",
    "target_id",
    "created_at",
    "details_json",
  ];
  const rows = filteredLogs.map((log) =>
    [
      log.id,
      log.admin_username,
      log.action,
      log.target_type || "",
      log.target_id || "",
      log.created_at,
      JSON.stringify(log.details || {}),
    ].join(",")
  );
  const csvContent = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "audit_logs_export.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
