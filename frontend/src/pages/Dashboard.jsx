import { useEffect, useMemo, useState } from "react";

import CameraFeed from "../components/CameraFeed";
import { captureImage, getSystemHealth } from "../services/api";

function buildStatusTone(status) {
  if (status === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "duplicate") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function Dashboard() {
  const [cameraOn, setCameraOn] = useState(false);
  const [health, setHealth] = useState(null);
  const [feedback, setFeedback] = useState({
    status: "idle",
    message: "Scanner ready.",
  });
  const [scanHistory, setScanHistory] = useState([]);

  const loadHealth = async () => {
    try {
      const response = await getSystemHealth();
      setHealth(response);
    } catch (_error) {
      setFeedback({
        status: "idle",
        message: "Scanner is ready. Backend connection will be used during attendance actions.",
      });
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  useEffect(() => {
    if (!cameraOn) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      loadHealth();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [cameraOn]);

  const handleCapture = async (blob, captureMeta = {}) => {
    const file = new File([blob], "attendance-capture.jpg", { type: blob.type });
    return captureImage(file, captureMeta);
  };

  const handleCaptureResult = (result) => {
    setFeedback({
      status: result.status,
      message: result.message,
    });
    setScanHistory((current) =>
      [
        {
          id: `${Date.now()}`,
          user: result.user || (result.status === "error" ? "Scan failed" : "Unknown"),
          status: result.status || "success",
          time: result.time || new Date().toISOString(),
          message: result.message || "Capture completed",
        },
        ...current,
      ].slice(0, 6)
    );
  };

  const feedbackTone = useMemo(() => buildStatusTone(feedback.status), [feedback.status]);

  const highlightItems = [
    "Real-time webcam-driven attendance capture",
    "Duplicate attendance cooldown protection",
    "Fast scan flow designed for shared classroom kiosks",
    "Admin-controlled registration and reporting workspace",
    "Active liveness challenge before attendance capture",
  ];

  const engineeringItems = [
    "React + Vite frontend with reusable camera and dashboard modules",
    "FastAPI backend with public scan APIs and protected admin APIs",
    "SQLite persistence for zero-friction local deployment",
    "InsightFace embeddings with configurable similarity thresholds",
    "Random blink plus head-turn liveness challenge to reduce photo and replay spoofing",
  ];

  return (
    <div className="space-y-6">
      <section className="hero-panel">
        <div className="max-w-3xl">
          <p className="hero-kicker">Smart Attendance</p>
          <h1 className="hero-title">Fast, touchless attendance with face verification and live user challenge.</h1>
          <p className="hero-copy">
            Open the camera, complete the quick liveness step, and let the system mark attendance in seconds. The platform is designed for classroom use with secure admin controls in the background.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <span className="startup-pill">Live camera loop</span>
            <span className="startup-pill">Active liveness</span>
            <span className="startup-pill">Admin-secured backend</span>
          </div>
        </div>
        <div className="hero-status">
          <p className="section-label">How It Works</p>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <p>1. Start the scanner and position one face clearly in frame.</p>
            <p>2. Complete one quick live action like a blink or slight head turn.</p>
            <p>3. Attendance is matched and marked automatically.</p>
          </div>
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${feedbackTone}`}>
            {feedback.message}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <CameraFeed
          onCapture={handleCapture}
          onResult={handleCaptureResult}
          setCameraOn={setCameraOn}
          autoCapture
          requireLiveness={Boolean(health?.liveness?.enabled)}
          autoStopStatuses={["success", "duplicate"]}
          title="Attendance Scanner"
          description={
            health?.liveness?.enabled
              ? "Use auto scan during live attendance, then complete one quick live action before capture."
              : "Use auto scan during live attendance. The system will capture attendance as soon as your face is clear."
          }
          accent="amber"
        />

        <div className="space-y-6">
          <div className="panel startup-grid p-5">
            <p className="section-label">Student Flow</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Public Attendance Mode</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>Students do not need an account.</p>
              <p>Open the camera, do one quick live action, and let the system identify the face.</p>
              <p>Admins manage onboarding, review records, and maintain the system from the protected panel.</p>
              <p>
                Scanner status:{" "}
                <span className="font-semibold text-slate-900">
                  {cameraOn ? "Camera active" : "Camera idle"}
                </span>
              </p>
              <p>
                Backend:{" "}
                <span className="font-semibold text-slate-900">
                  {health ? "Connected" : "Unavailable"}
                </span>
              </p>
              <p>
                Face engine:{" "}
                <span className="font-semibold text-slate-900">
                  {health?.face_engine?.available ? "Ready" : health?.face_engine?.reason || "Checking"}
                </span>
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <article className="stat-card bg-[linear-gradient(135deg,_rgba(255,247,237,0.98),_rgba(255,255,255,0.92))]">
              <p className="section-label">Mode</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">Public</p>
              <p className="mt-2 text-sm text-slate-600">Students use the scanner without signing in.</p>
            </article>
            <article className="stat-card bg-[linear-gradient(135deg,_rgba(236,253,245,0.98),_rgba(255,255,255,0.92))]">
              <p className="section-label">Liveness</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {health?.liveness?.enabled ? "Quick" : "Off"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {health?.liveness?.enabled
                  ? "One short live action before capture."
                  : "Attendance capture runs without liveness gating."}
              </p>
            </article>
            <article className="stat-card bg-[linear-gradient(135deg,_rgba(239,246,255,0.98),_rgba(255,255,255,0.92))]">
              <p className="section-label">Behavior</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">Auto-stop</p>
              <p className="mt-2 text-sm text-slate-600">Camera closes after success or duplicate detection.</p>
            </article>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-label">Latest Activity</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">Recent Scan Results</h3>
              </div>
            </div>

            <div className="mt-4 max-h-[320px] space-y-3 overflow-auto pr-1">
              {scanHistory.length === 0 ? (
                <p className="text-sm text-slate-500">No captures yet in this session.</p>
              ) : (
                scanHistory.map((scan) => (
                  <div
                    key={scan.id}
                    className={`rounded-[24px] border px-4 py-4 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.35)] ${buildStatusTone(scan.status)}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{scan.user}</p>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                        {scan.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs">
                      {scan.message} | {new Date(scan.time).toLocaleString("en-IN")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-5">
          <p className="section-label">Product Value</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">Why this project stands out</h3>
          <div className="mt-4 space-y-3">
            {highlightItems.map((item) => (
              <div
                key={item}
                className="rounded-[22px] border border-orange-100 bg-[linear-gradient(135deg,_rgba(255,237,213,0.92),_rgba(255,255,255,0.88))] px-4 py-3 text-sm text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <p className="section-label">Engineering</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">Implementation highlights</h3>
          <div className="mt-4 space-y-3">
            {engineeringItems.map((item) => (
              <div
                key={item}
                className="rounded-[22px] border border-sky-100 bg-[linear-gradient(135deg,_rgba(224,242,254,0.88),_rgba(255,255,255,0.9))] px-4 py-3 text-sm text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        
      </section>
    </div>
  );
}
