import React from "react"
import { Routes, Route, NavLink } from "react-router-dom"
import Dashboard from "./pages/Dashboard"
import Register from "./pages/Register"

export default function App() {
  const navClasses =
    "px-3 py-1 rounded transition-colors duration-200 text-sm font-medium"

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-5xl mx-auto flex items-center px-4 py-3">
          <h1 className="text-lg md:text-xl font-bold text-gray-800">
            Face Attendance 
          </h1>
          <div className="ml-auto flex gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `${navClasses} ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 hover:bg-slate-300 text-gray-800"
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/register"
              className={({ isActive }) =>
                `${navClasses} ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 hover:bg-slate-300 text-gray-800"
                }`
              }
            >
              Register
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </main>
    </div>
  )
}
