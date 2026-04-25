import { useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";

import AdminLogin from "./pages/AdminLogin";
import AdminPanel from "./pages/AdminPanel";
import Dashboard from "./pages/Dashboard";
import Register from "./pages/Register";
import {
  clearStoredToken,
  getAdminMe,
  getStoredSession,
  isAuthError,
  setStoredSession,
} from "./services/api";

const publicNavItems = [
  { to: "/", label: "Scanner" },
  { to: "/admin/login", label: "Admin Login" },
];

function SessionBoot({ message }) {
  return (
    <div className="panel p-6">
      <h2 className="text-xl font-semibold text-slate-900">Loading session</h2>
      <p className="mt-3 text-sm text-slate-600">{message}</p>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const [session, setSession] = useState(() => getStoredSession());
  const [authReady, setAuthReady] = useState(false);
  const [bootError, setBootError] = useState("");
  const admin = session?.role === "admin" ? session.admin : null;

  useEffect(() => {
    let isMounted = true;
    const storedSession = getStoredSession();

    if (!storedSession?.token) {
      setAuthReady(true);
      return () => {
        isMounted = false;
      };
    }

    getAdminMe()
      .then((data) => {
        if (!isMounted) {
          return;
        }
        const nextSession = {
          token: storedSession.token,
          role: "admin",
          admin: data.admin,
        };
        setStoredSession(nextSession);
        setSession(nextSession);
        setBootError("");
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        clearStoredToken();
        setSession(null);
        setBootError(isAuthError(error) ? "" : error.message || "Unable to restore session.");
      })
      .finally(() => {
        if (isMounted) {
          setAuthReady(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isAdmin = Boolean(admin);
  const navItems = useMemo(() => {
    if (!isAdmin) {
      return publicNavItems;
    }

    return [
      { to: "/", label: "Scanner" },
      { to: "/admin", label: "Admin Panel" },
      { to: "/register", label: "Register" },
    ];
  }, [isAdmin]);

  const handleLoggedIn = (loginPayload) => {
    const nextSession = {
      token: loginPayload.token,
      role: "admin",
      admin: loginPayload.admin,
    };
    setStoredSession(nextSession);
    setSession(nextSession);
    setBootError("");
  };

  const handleLogout = () => {
    clearStoredToken();
    setSession(null);
  };

  const ProtectedRoute = ({ children }) => {
    if (!authReady) {
      return <SessionBoot message="Checking admin access before entering the protected workspace." />;
    }

    if (!isAdmin) {
      return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
    }
    return children;
  };

  const PublicOnlyAdminRoute = ({ children }) => {
    if (!authReady) {
      return <SessionBoot message="Restoring your session so we can route you to the right place." />;
    }

    if (isAdmin) {
      return <Navigate to="/admin" replace />;
    }
    return children;
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/65 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.36em] text-orange-600">
              Touchless Campus Flow
            </p>
            <h1 className="mt-1 font-['Sora'] text-2xl font-bold text-slate-950 md:text-3xl">
              Face Detection Attendance System
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Public scanner for students, protected workspace for admins.
            </p>
          </div>

          <nav className="flex flex-wrap gap-2 rounded-full border border-white/80 bg-white/70 p-1.5 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.34)] backdrop-blur-xl">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? isAdmin
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20"
                        : "bg-slate-950 text-white shadow-lg shadow-slate-950/15"
                      : "bg-transparent text-slate-700 hover:bg-white hover:text-slate-950"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {bootError ? (
          <div className="panel p-6">
            <h2 className="text-xl font-semibold text-slate-900">Application Error</h2>
            <p className="mt-3 text-sm text-slate-600">{bootError}</p>
          </div>
        ) : null}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/admin/login"
            element={
              <PublicOnlyAdminRoute>
                <AdminLogin onLoggedIn={handleLoggedIn} />
              </PublicOnlyAdminRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPanel admin={admin} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/register"
            element={
              <ProtectedRoute>
                <Register onUnauthorized={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
