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
        message: "Scanner is ready. Backend connection is used during capture.",
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

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-label">Attendance</p>
            <h2 className="mt-2 font-['Sora'] text-3xl font-bold text-slate-950 md:text-4xl">Live Scanner</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
              Start camera capture and complete one quick action if liveness is enabled.
            </p>
          </div>
          <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${feedbackTone}`}>{feedback.message}</div>
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
              ? "Auto-scan runs continuously. Complete one quick live action before capture."
              : "Auto-scan runs continuously and captures attendance when the face is clear."
          }
          accent="amber"
        />

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="stat-card">
              <p className="section-label">Camera</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{cameraOn ? "Active" : "Idle"}</p>
            </article>
            <article className="stat-card">
              <p className="section-label">Backend</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{health ? "Connected" : "Unavailable"}</p>
            </article>
            <article className="stat-card">
              <p className="section-label">Liveness</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{health?.liveness?.enabled ? "Enabled" : "Disabled"}</p>
            </article>
            <article className="stat-card">
              <p className="section-label">Face Engine</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {health?.face_engine?.available ? "Ready" : health?.face_engine?.reason || "Checking"}
              </p>
            </article>
          </div>

          <div className="panel p-5">
            <p className="section-label">Recent Results</p>
            <div className="mt-4 max-h-[320px] space-y-3 overflow-auto pr-1">
              {scanHistory.length === 0 ? (
                <p className="text-sm text-slate-500">No captures in this session.</p>
              ) : (
                scanHistory.map((scan) => (
                  <div key={scan.id} className={`rounded-2xl border px-4 py-4 ${buildStatusTone(scan.status)}`}>
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
    </div>
  );
}
