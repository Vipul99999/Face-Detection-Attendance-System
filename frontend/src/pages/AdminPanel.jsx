import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AttendanceTable from "../components/AttendanceTable";
import {
  downloadAuditLogsCsv,
  downloadAttendanceCsv,
  getAuditLogs,
  getAnalyticsSummary,
  getAttendance,
  getDashboardSummary,
  getStudents,
  getSystemHealth,
  isAuthError,
  reencryptEmbeddings,
} from "../services/api";

function MiniBarChart({ items }) {
  const maxValue = Math.max(...items.map((item) => item.total), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.day}>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>{item.day}</span>
            <span>{item.total}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
              style={{ width: `${(item.total / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatActionLabel(value) {
  return value.replaceAll("_", " ");
}

export default function AdminPanel({ admin, onLogout }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [health, setHealth] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditAdminFilter, setAuditAdminFilter] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [message, setMessage] = useState("Admin workspace ready.");

  const loadAdminData = async (date = "") => {
    try {
      const [summaryData, analyticsData, attendanceData, studentsData, healthData, auditData] =
        await Promise.all([
          getDashboardSummary(),
          getAnalyticsSummary(date),
          getAttendance(),
          getStudents(),
          getSystemHealth(),
          getAuditLogs(),
        ]);

      setSummary(summaryData.stats);
      setAnalytics(analyticsData);
      setRecords(attendanceData.records || []);
      setStudents(studentsData.students || []);
      setHealth(healthData);
      setAuditLogs(auditData.logs || []);
    } catch (error) {
      setMessage(error.message || "Failed to load admin data.");
      if (isAuthError(error)) {
        onLogout?.();
        navigate("/admin/login", {
          replace: true,
          state: { from: "/admin", reason: "session_expired" },
        });
      }
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleExport = async () => {
    try {
      await downloadAttendanceCsv();
      setMessage("CSV export downloaded.");
    } catch (error) {
      setMessage(error.message || "Export failed.");
    }
  };

  const handleLogout = () => {
    onLogout?.();
    navigate("/admin/login", {
      replace: true,
      state: { reason: "logged_out" },
    });
  };

  const handleReencrypt = async () => {
    try {
      const result = await reencryptEmbeddings();
      setMessage(result.message || "Embedding re-encryption completed.");
      await loadAdminData(selectedDate);
    } catch (error) {
      setMessage(error.message || "Embedding re-encryption failed.");
      if (isAuthError(error)) {
        onLogout?.();
        navigate("/admin/login", {
          replace: true,
          state: { from: "/admin", reason: "session_expired" },
        });
      }
    }
  };

  const handleAuditExport = async () => {
    try {
      await downloadAuditLogsCsv({
        action: auditActionFilter,
        admin_username: auditAdminFilter,
      });
      setMessage("Audit log export downloaded.");
    } catch (error) {
      setMessage(error.message || "Audit log export failed.");
      if (isAuthError(error)) {
        onLogout?.();
        navigate("/admin/login", {
          replace: true,
          state: { from: "/admin", reason: "session_expired" },
        });
      }
    }
  };

  const filteredAuditLogs = auditLogs.filter((log) => {
    const actionMatch =
      !auditActionFilter ||
      log.action?.toLowerCase().includes(auditActionFilter.toLowerCase());
    const adminMatch =
      !auditAdminFilter ||
      log.admin_username?.toLowerCase().includes(auditAdminFilter.toLowerCase());
    return actionMatch && adminMatch;
  });

  const overviewCards = analytics
    ? [
        { label: "Registered", value: analytics.overview.registered_students },
        { label: "Present", value: analytics.overview.present_today },
        { label: "Absent", value: analytics.overview.absent_today },
        { label: "Rate", value: `${analytics.overview.attendance_rate}%` },
      ]
    : [];

  return (
    <div className="space-y-6">
      <section className="hero-panel">
        <div className="max-w-3xl">
          <p className="hero-kicker">Admin Panel</p>
          <h1 className="hero-title">Manage registration, analytics, and attendance reporting from one place.</h1>
          <p className="hero-copy">
            Signed in as <span className="font-semibold text-slate-900">{admin?.username || "admin"}</span>.
            This panel is designed to show product maturity during portfolio or recruiter review.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="metric-tile">
              <p className="section-label">Students</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{students.length}</p>
            </div>
            <div className="metric-tile">
              <p className="section-label">Today</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{summary?.today_attendance ?? 0}</p>
            </div>
            <div className="metric-tile">
              <p className="section-label">Engine</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {health?.face_engine?.available ? "Ready" : "Attention"}
              </p>
            </div>
          </div>
        </div>
        <div className="hero-status">
          <p className="section-label">Admin Actions</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/register" className="action-button bg-emerald-600 hover:bg-emerald-700">
              Register Student
            </Link>
            <button className="action-button bg-slate-950 hover:bg-slate-800" onClick={handleExport}>
              Export CSV
            </button>
            <button className="action-button bg-amber-500 hover:bg-amber-600" onClick={handleReencrypt}>
              Re-encrypt Embeddings
            </button>
            <button
              className="action-button bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-600">
            {message}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {overviewCards.map((card) => (
          <article key={card.label} className="stat-card bg-[linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(241,245,249,0.92))]">
            <p className="section-label">{card.label}</p>
            <p className="mt-4 text-4xl font-semibold text-slate-900">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel startup-grid p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-label">Analytics</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">7-Day Attendance Trend</h3>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={async (event) => {
                const nextDate = event.target.value;
                setSelectedDate(nextDate);
                await loadAdminData(nextDate);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-5">
            {analytics?.attendance_trend?.length ? (
              <MiniBarChart items={analytics.attendance_trend} />
            ) : (
              <p className="text-sm text-slate-500">No trend data yet.</p>
            )}
          </div>
        </div>

        <div className="panel p-5">
          <p className="section-label">Summary</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">Absentee Summary</h3>
          <div className="mt-4 max-h-[280px] space-y-3 overflow-auto pr-1">
            {analytics?.absentees?.length ? (
              analytics.absentees.map((student) => (
                <div
                  key={student.id}
                  className="rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-3"
                >
                  <p className="font-medium text-slate-800">{student.name}</p>
                  <p className="mt-1 text-xs text-slate-500">No attendance recorded for {analytics.selected_date}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No absentees for the selected day.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <AttendanceTable records={records} />

        <div className="space-y-6">
          <div className="panel p-5">
            <p className="section-label">Top Students</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Most Recorded Attendance</h3>
            <div className="mt-4 space-y-3">
              {analytics?.top_students?.length ? (
                analytics.top_students.map((student) => (
                  <div key={student.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="font-medium text-slate-800">{student.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Total marks: {student.total_marks}
                      {student.last_seen
                        ? ` | Last seen: ${new Date(student.last_seen).toLocaleString("en-IN")}`
                        : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No attendance history yet.</p>
              )}
            </div>
          </div>

          <div className="panel p-5">
            <p className="section-label">Runtime</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">System Status</h3>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="glass-strip flex items-center justify-between gap-3">
                <span>Backend API</span>
                <span className="font-semibold text-slate-900">{health ? "Connected" : "Checking..."}</span>
              </div>
              <div className="glass-strip flex items-center justify-between gap-3">
                <span>Face engine</span>
                <span className="font-semibold text-slate-900">{health?.face_engine?.available ? "Ready" : health?.face_engine?.reason || "Unknown"}</span>
              </div>
              <div className="glass-strip flex items-center justify-between gap-3">
                <span>Anti-spoof model</span>
                <span className="font-semibold text-slate-900">{health?.anti_spoof?.available ? "Ready" : health?.anti_spoof?.reason || "Unknown"}</span>
              </div>
              <div className="glass-strip flex items-center justify-between gap-3">
                <span>Registered students</span>
                <span className="font-semibold text-slate-900">{students.length}</span>
              </div>
              <div className="glass-strip flex items-center justify-between gap-3">
                <span>Total attendance logs</span>
                <span className="font-semibold text-slate-900">{summary?.attendance_records ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <p className="section-label">Security</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-slate-900">Recent Admin Audit Logs</h3>
          <button
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            onClick={handleAuditExport}
          >
            Export Audit CSV
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={auditActionFilter}
            onChange={(event) => setAuditActionFilter(event.target.value)}
            placeholder="Filter by action"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          />
          <input
            value={auditAdminFilter}
            onChange={(event) => setAuditAdminFilter(event.target.value)}
            placeholder="Filter by admin username"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          />
        </div>
        <div className="mt-3">
          <button
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 transition hover:bg-slate-50"
            onClick={() => setMessage("Audit filters applied.")}
          >
            Apply Audit Filters
          </button>
        </div>
        <div className="mt-4 max-h-[320px] space-y-3 overflow-auto pr-1">
          {filteredAuditLogs.length === 0 ? (
            <p className="text-sm text-slate-500">No admin actions logged yet.</p>
          ) : (
            filteredAuditLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-medium text-slate-800">
                  {formatActionLabel(log.action)} by {log.admin_username}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(log.created_at).toLocaleString("en-IN")}
                </p>
                {log.target_type || log.target_id ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {log.target_type || "target"} {log.target_id ? `| id ${log.target_id}` : ""}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
