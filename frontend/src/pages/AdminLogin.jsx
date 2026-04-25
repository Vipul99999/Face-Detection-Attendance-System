import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { adminLogin } from "../services/api";

export default function AdminLogin({ onLoggedIn }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const redirectTo = useMemo(() => {
    const from = location.state?.from;
    return typeof from === "string" && from.startsWith("/") ? from : "/admin";
  }, [location.state]);
  const initialMessage =
    location.state?.reason === "logged_out"
      ? "You have been logged out. Sign in again to return to admin tools."
      : "Use your admin credentials to manage the system.";
  const [message, setMessage] = useState(initialMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await adminLogin(username, password);
      onLoggedIn?.(result);
      setMessage("Login successful.");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setMessage(error.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <section className="hero-panel">
        <div className="max-w-2xl">
          <p className="hero-kicker">Admin Access</p>
          <h1 className="hero-title">Secure the management side of the attendance system.</h1>
          <p className="hero-copy">
            Students only need the scanner. Admins control registration, records, exports, and analytics.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="metric-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Role</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Admin only</p>
            </div>
            <div className="metric-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Session</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Persistent</p>
            </div>
            <div className="metric-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Protection</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Route guarded</p>
            </div>
          </div>
        </div>
        <div className="hero-status">
          <p className="section-label">Why it matters</p>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>Protect enrollment, attendance history, and export operations.</p>
            <p>Keep the public scanner frictionless while the admin side stays controlled.</p>
          </div>
        </div>
      </section>

      <form className="panel mx-auto mt-6 max-w-xl p-6" onSubmit={handleSubmit}>
        <p className="section-label">
          Login
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">Admin Sign In</h2>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="input-field"
              placeholder="Admin username"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field"
              placeholder="Admin password"
            />
          </label>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="action-button bg-slate-950 hover:bg-slate-800 disabled:opacity-60"
          >
            {isSubmitting ? "Signing In..." : "Login"}
          </button>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          {message}
        </div>
      </form>
    </div>
  );
}
