import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import CameraFeed from "../components/CameraFeed";
import { deleteStudent, getStudents, isAuthError, registerUser } from "../services/api";

export default function Register({ onUnauthorized }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [message, setMessage] = useState("Use a front-facing photo with one student only.");
  const [students, setStudents] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshStudents = async () => {
    try {
      const response = await getStudents();
      setStudents(response.students || []);
    } catch (error) {
      setMessage(error.message || "Failed to load registered students.");
      if (isAuthError(error)) {
        onUnauthorized?.();
        navigate("/admin/login", {
          replace: true,
          state: { from: "/register", reason: "session_expired" },
        });
      }
    }
  };

  useEffect(() => {
    refreshStudents();
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return undefined;
    }

    const nextUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [selectedFile]);

  const submitRegistration = async (event) => {
    event.preventDefault();

    if (!name.trim() || !selectedFile) {
      setMessage("Enter the student name and provide one clear face image.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerUser(name, selectedFile);
      setMessage(result.message || "Student registered successfully.");
      setName("");
      setSelectedFile(null);
      await refreshStudents();
    } catch (error) {
      setMessage(error.message || "Registration failed.");
      if (isAuthError(error)) {
        onUnauthorized?.();
        navigate("/admin/login", {
          replace: true,
          state: { from: "/register", reason: "session_expired" },
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCameraCapture = async (blob) => {
    const file = new File([blob], "student-register.jpg", { type: blob.type });
    setSelectedFile(file);
    setMessage("Photo captured. Review it, then click Register Student.");
    return { message: "Photo captured for registration." };
  };

  const handleDeleteStudent = async (student) => {
    const confirmed = window.confirm(
      `Delete ${student.name} and purge related biometric attendance data?`
    );
    if (!confirmed) return;

    const confirmPassword = window.prompt(
      "Re-enter your admin password to confirm biometric purge."
    );
    if (!confirmPassword) {
      setMessage("Biometric purge cancelled.");
      return;
    }

    try {
      const result = await deleteStudent(student.id, confirmPassword);
      setMessage(result.message || "Student deleted successfully.");
      await refreshStudents();
    } catch (error) {
      setMessage(error.message || "Failed to delete student.");
      if (isAuthError(error)) {
        onUnauthorized?.();
        navigate("/admin/login", {
          replace: true,
          state: { from: "/register", reason: "session_expired" },
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <section className="hero-panel">
        <div className="max-w-3xl">
          <p className="hero-kicker">Student Onboarding</p>
          <h1 className="hero-title">Build a strong attendance dataset with a simple registration workflow.</h1>
          <p className="hero-copy">
            This MVP keeps registration focused: one student, one clean image, and instant feedback
            if the face is duplicate or low quality.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="metric-tile">
              <p className="section-label">Workflow</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">One face</p>
            </div>
            <div className="metric-tile">
              <p className="section-label">Capture</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Upload or camera</p>
            </div>
            <div className="metric-tile">
              <p className="section-label">Feedback</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Instant validation</p>
            </div>
          </div>
        </div>
        <div className="hero-status">
          <p className="section-label">Admin Only</p>
          <p className="mt-2 text-sm text-slate-700">
            Registration is protected so only admins can add students to the recognition system.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="startup-pill">Fast onboarding</span>
            <span className="startup-pill">Duplicate guard</span>
          </div>
          <button
            className="mt-4 action-button bg-slate-950 hover:bg-slate-800"
            onClick={() => navigate("/admin")}
            type="button"
          >
            Back to Admin Panel
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form className="panel p-6" onSubmit={submitRegistration}>
          <p className="section-label">Form</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Register Student</h2>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Student Name
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input-field"
                placeholder="Enter full name"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Upload Photo
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                className="block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600"
              />
            </label>

            {previewUrl ? (
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                <img
                  src={previewUrl}
                  alt="Student preview"
                  className="h-64 w-full object-cover"
                />
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
                Image preview will appear here after upload or camera capture.
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="action-button bg-emerald-600 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Registering..." : "Register Student"}
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            {message}
          </div>
        </form>

        <div className="space-y-6">
          <CameraFeed
            onCapture={handleCameraCapture}
            title="Registration Camera"
            description="Capture one clear image if you do not want to upload a file manually."
            accent="emerald"
          />

          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-label">Registered</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">Current Students</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {students.length} students
              </span>
            </div>

            <div className="mt-4 max-h-[340px] space-y-3 overflow-auto pr-1">
              {students.length === 0 ? (
                <p className="text-sm text-slate-500">No one registered yet.</p>
              ) : (
                students.map((student) => (
                  <div
                    key={student.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-800">{student.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Added on {new Date(student.created_at).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(student)}
                        className="rounded-full bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
