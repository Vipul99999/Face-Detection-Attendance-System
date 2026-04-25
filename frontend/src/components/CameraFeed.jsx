import { useEffect, useMemo, useRef, useState } from "react";

import { getLivenessChallenge } from "../services/api";

const AUTO_CAPTURE_INTERVAL_MS = 2200;
const ANALYSIS_INTERVAL_MS = 180;
const AUTO_RETRY_AFTER_ERROR_MS = 3200;
const FACE_API_SCRIPT = "/vendor/face-api.min.js";
const MODEL_URL = "/models";

let faceApiLoader = null;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const eyeAspectRatio = (points) => {
  const verticalOne = distance(points[1], points[5]);
  const verticalTwo = distance(points[2], points[4]);
  const horizontal = distance(points[0], points[3]);
  return (verticalOne + verticalTwo) / (2 * Math.max(horizontal, 0.0001));
};

const loadFaceApi = async () => {
  if (window.faceapi?.nets?.tinyFaceDetector) {
    return window.faceapi;
  }

  if (!faceApiLoader) {
    faceApiLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = FACE_API_SCRIPT;
      script.async = true;
      script.onload = () => resolve(window.faceapi);
      script.onerror = () => reject(new Error("Failed to load liveness models."));
      document.head.appendChild(script);
    });
  }

  const faceapi = await faceApiLoader;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  ]);

  return faceapi;
};

function getCameraErrorDetails(error) {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      title: "Camera access is not supported",
      description: "Use a recent browser over localhost or HTTPS to access the webcam.",
    };
  }

  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        title: "Camera permission was blocked",
        description: "Allow webcam access in your browser settings and try again.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        title: "No camera was found",
        description: "Connect a webcam or switch to a device with a front camera.",
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        title: "Camera is busy",
        description: "Another app or browser tab may already be using the webcam.",
      };
    case "OverconstrainedError":
      return {
        title: "Requested camera mode is unavailable",
        description: "The current device cannot satisfy the preferred camera settings.",
      };
    default:
      return {
        title: "Camera unavailable",
        description: error?.message || "The webcam could not be started right now.",
      };
  }
}

function buildAttemptResult(result) {
  return {
    status: result?.status || "success",
    message: result?.message || "Capture completed.",
    time: result?.time || new Date().toISOString(),
    user: result?.user || "Unknown",
    similarity: result?.similarity ?? null,
    raw: result,
  };
}

export default function CameraFeed({
  onCapture,
  onResult,
  setCameraOn,
  autoCapture = false,
  requireLiveness = false,
  title = "Camera Feed",
  description = "Start the camera and capture a clean face frame.",
  accent = "amber",
  autoStopStatuses = ["success", "duplicate"],
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const analysisIntervalRef = useRef(null);
  const lastBlinkStateRef = useRef(false);
  const autoTriggeredForChallengeRef = useRef(false);
  const missingFaceFramesRef = useRef(0);
  const nextAutoAttemptAtRef = useRef(0);

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState("Camera idle");
  const [cameraError, setCameraError] = useState(null);
  const [autoMode, setAutoMode] = useState(autoCapture);
  const [livenessReady, setLivenessReady] = useState(false);
  const [livenessChallenge, setLivenessChallenge] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [blinkCount, setBlinkCount] = useState(0);
  const [turnOffset, setTurnOffset] = useState(0);
  const [stableFrames, setStableFrames] = useState(0);
  const [modelsLoaded, setModelsLoaded] = useState(!requireLiveness);
  const [lastResult, setLastResult] = useState(null);

  const accentClasses = useMemo(() => {
    if (accent === "emerald") {
      return {
        badge: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20",
        button: "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600",
      };
    }

    return {
      badge: "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/20",
      button: "bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500",
    };
  }, [accent]);

  const updateCameraState =
    typeof setCameraOn === "function" ? setCameraOn : () => {};

  const resetLivenessState = () => {
    setLivenessReady(false);
    setCompletedSteps([]);
    setBlinkCount(0);
    setTurnOffset(0);
    setStableFrames(0);
    lastBlinkStateRef.current = false;
    autoTriggeredForChallengeRef.current = false;
    missingFaceFramesRef.current = 0;
    nextAutoAttemptAtRef.current = 0;
  };

  const refreshLivenessChallenge = async () => {
    if (!requireLiveness) {
      return;
    }

    resetLivenessState();
    try {
      const response = await getLivenessChallenge();
      setLivenessChallenge(response.challenge);
      const stepLabel =
        response.challenge.steps[0]?.replaceAll("_", " ") || "blink";
      setStatus(`Do this once: ${stepLabel}.`);
    } catch (error) {
      setLastResult({
        status: "error",
        message: error.message || "Unable to create a new liveness challenge.",
        code: error.code || "LIVENESS_CHALLENGE_FAILED",
        time: new Date().toISOString(),
        canRetry: true,
      });
      setStatus("Liveness challenge unavailable");
    }
  };

  const stopCamera = ({ preserveStatus = false, nextStatus = "" } = {}) => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraOn(false);
    setIsBusy(false);
    setStatus(preserveStatus ? nextStatus || status : "Camera stopped");
    updateCameraState(false);
    resetLivenessState();
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (!requireLiveness) {
      return;
    }

    loadFaceApi()
      .then(() => setModelsLoaded(true))
      .catch((loadError) => {
        setCameraError({
          title: "Liveness models failed to load",
          description: loadError.message || "The browser could not load the liveness assets.",
        });
        setModelsLoaded(false);
      });
  }, [requireLiveness]);

  const startCamera = async () => {
    setCameraError(null);
    setLastResult(null);
    setStatus("Requesting camera access...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsCameraOn(true);
      updateCameraState(true);

      if (requireLiveness) {
        await refreshLivenessChallenge();
      } else {
        setStatus(autoMode ? "Auto capture is active" : "Camera ready");
      }
    } catch (error) {
      const details = getCameraErrorDetails(error);
      setCameraError(details);
      setStatus(details.title);
      updateCameraState(false);
    }
  };

  const makeBlobFromFrame = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      throw new Error("Camera frame is not ready yet.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
  };

  const buildLivenessProof = () => ({
    completed_steps: completedSteps,
    metrics: {
      blink_count: blinkCount,
      turn_offset: turnOffset,
      stable_frames: stableFrames,
    },
  });

  const triggerCapture = async (source = "manual") => {
    if (!isCameraOn || isBusy) {
      return null;
    }
    if (requireLiveness && !livenessReady) {
      const nextResult = {
        status: "error",
        message: "Complete the active liveness challenge before scanning.",
        code: "LIVENESS_REQUIRED",
        time: new Date().toISOString(),
        canRetry: true,
      };
      setLastResult(nextResult);
      setStatus("Complete blink and head-turn first.");
      onResult?.(nextResult);
      return null;
    }

    setIsBusy(true);
    setStatus(source === "auto" ? "Scanning face..." : "Capturing frame...");

    try {
      const blob = await makeBlobFromFrame();
      if (!blob) {
        throw new Error("Could not create an image from the camera.");
      }

      const result = await onCapture(blob, {
        livenessToken: livenessChallenge?.token,
        livenessProof: requireLiveness ? buildLivenessProof() : null,
      });
      const nextResult = buildAttemptResult(result);
      setLastResult(nextResult);
      setStatus(nextResult.message);
      onResult?.(nextResult);

      if (requireLiveness && !autoStopStatuses.includes(nextResult.status)) {
        await refreshLivenessChallenge();
      }
      if (autoStopStatuses.includes(nextResult.status)) {
        stopCamera({ preserveStatus: true, nextStatus: nextResult.message });
      }
      return result;
    } catch (error) {
      const friendlyMessage =
        error.code === "FACE_CAPTURE_REJECTED"
          ? error.message || "Keep one clear face in frame and try again."
          : error.message || "Capture failed.";
      const nextResult = {
        status: "error",
        message: friendlyMessage,
        code: error.code || "CAPTURE_FAILED",
        details: error.details || null,
        time: new Date().toISOString(),
        canRetry: true,
      };
      setLastResult(nextResult);
      setStatus(friendlyMessage);
      nextAutoAttemptAtRef.current = Date.now() + AUTO_RETRY_AFTER_ERROR_MS;
      onResult?.(nextResult);
      if (requireLiveness) {
        await refreshLivenessChallenge();
      }
      return null;
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    if (!requireLiveness || !isCameraOn || !modelsLoaded || !livenessChallenge) {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
      return;
    }

    analysisIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || isBusy) {
        return;
      }

      try {
        const faceapi = window.faceapi;
        const result = await faceapi
          .detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
          )
          .withFaceLandmarks(true);

        if (!result?.landmarks) {
          missingFaceFramesRef.current += 1;
          if (missingFaceFramesRef.current >= 8 && completedSteps.length === 0) {
            setStatus("Keep one face centered in the frame.");
          }
          return;
        }

        missingFaceFramesRef.current = 0;

        setStableFrames((value) => value + 1);

        const landmarks = result.landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const jaw = landmarks.getJawOutline();
        const nose = landmarks.getNose();

        const ear = (eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2;
        const jawLeft = jaw[0];
        const jawRight = jaw[16];
        const noseTip = nose[3];
        const faceCenterX = (jawLeft.x + jawRight.x) / 2;
        const faceWidth = Math.max(jawRight.x - jawLeft.x, 1);
        const normalizedTurnOffset = (noseTip.x - faceCenterX) / faceWidth;
        setTurnOffset((current) => Math.max(current, Math.abs(normalizedTurnOffset)));

        const blinkClosed = ear < 0.19;
        const blinkOpen = ear > 0.24;
        if (blinkClosed && !lastBlinkStateRef.current) {
          lastBlinkStateRef.current = true;
        } else if (blinkOpen && lastBlinkStateRef.current) {
          lastBlinkStateRef.current = false;
          setBlinkCount((value) => value + 1);
          setCompletedSteps((current) =>
            current.includes("blink") ? current : [...current, "blink"]
          );
        }

        const stepTurnLeft = livenessChallenge.steps.includes("turn_left");
        const stepTurnRight = livenessChallenge.steps.includes("turn_right");

        if (stepTurnLeft && normalizedTurnOffset < -0.04) {
          setCompletedSteps((current) =>
            current.includes("turn_left") ? current : [...current, "turn_left"]
          );
        }

        if (stepTurnRight && normalizedTurnOffset > 0.04) {
          setCompletedSteps((current) =>
            current.includes("turn_right") ? current : [...current, "turn_right"]
          );
        }
      } catch (_analysisError) {
        setStatus("Liveness analysis running...");
      }
    }, ANALYSIS_INTERVAL_MS);

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
    };
  }, [isBusy, isCameraOn, livenessChallenge, modelsLoaded, requireLiveness]);

  useEffect(() => {
    if (!requireLiveness || !livenessChallenge) {
      return;
    }

    const ready = livenessChallenge.steps.every((step) => completedSteps.includes(step));
    setLivenessReady(ready);
    if (ready) {
      setStatus(autoMode ? "Verified. Capturing now..." : "Verified. Tap capture.");
    } else {
      const pending = livenessChallenge.steps
        .filter((step) => !completedSteps.includes(step))
        .map((step) => step.replaceAll("_", " "));
      setStatus(`Do this now: ${pending.join(" then ")}`);
    }
  }, [autoMode, completedSteps, livenessChallenge, requireLiveness]);

  useEffect(() => {
    if (!autoMode || !requireLiveness || !livenessReady || !isCameraOn || isBusy) {
      return;
    }
    if (autoTriggeredForChallengeRef.current) {
      return;
    }

    autoTriggeredForChallengeRef.current = true;
    const timeoutId = setTimeout(() => {
      triggerCapture("auto");
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [autoMode, isBusy, isCameraOn, livenessReady, requireLiveness]);

  useEffect(() => {
    if (!isCameraOn || !autoMode) {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
      return;
    }

    captureIntervalRef.current = setInterval(() => {
      if (Date.now() < nextAutoAttemptAtRef.current) {
        return;
      }
      if (!requireLiveness || livenessReady) {
        triggerCapture("auto");
      }
    }, AUTO_CAPTURE_INTERVAL_MS);

    return () => {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
    };
  }, [autoMode, isCameraOn, livenessReady, requireLiveness]);

  const resultTone =
    lastResult?.status === "success"
      ? "text-emerald-700"
      : lastResult?.status === "duplicate"
        ? "text-amber-700"
        : lastResult?.status === "error"
          ? "text-rose-700"
          : "text-slate-600";

  return (
    <section className="panel overflow-hidden p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-label">
            Camera
          </p>
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 max-w-xl text-sm text-slate-500">{description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accentClasses.badge}`}>
          {isCameraOn ? "Live" : "Offline"}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-[30px] border border-slate-900/90 bg-slate-950 shadow-[0_26px_60px_-36px_rgba(15,23,42,0.72)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-white/10 to-transparent" />
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="aspect-video w-full object-cover"
        />
        {!isCameraOn ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/85 px-6 text-center text-slate-200">
            <div className="max-w-md">
              <p className="text-lg font-semibold">
                {cameraError?.title || "Camera preview will appear here"}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {cameraError?.description || "Use a front-facing view with one student clearly visible."}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!isCameraOn ? (
          <button className={`action-button ${accentClasses.button}`} onClick={startCamera}>
            Start Camera
          </button>
        ) : (
          <button className="action-button bg-slate-900 hover:bg-slate-700" onClick={() => stopCamera()}>
            Stop Camera
          </button>
        )}

        {!autoMode ? (
          <button
            className="action-button bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => triggerCapture("manual")}
            disabled={!isCameraOn || isBusy || (requireLiveness && !livenessReady)}
          >
            {isBusy ? "Working..." : requireLiveness ? "Capture After Liveness" : "Capture Now"}
          </button>
        ) : null}

        {autoCapture ? (
          <button
            className="action-button bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={() => setAutoMode((value) => !value)}
            disabled={!isCameraOn}
          >
            {autoMode ? "Manual Mode" : "Auto Mode"}
          </button>
        ) : null}

        {lastResult?.canRetry ? (
          <button
            className="action-button bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => triggerCapture("manual")}
            disabled={!isCameraOn || isBusy}
          >
            Retry Scan
          </button>
        ) : null}

        {requireLiveness && !autoMode ? (
          <button
            className="action-button bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={refreshLivenessChallenge}
            disabled={!isCameraOn || isBusy}
          >
            New Challenge
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-600">
        <div className="rounded-[22px] border border-slate-200/80 bg-white/70 px-4 py-3">
          <p className="font-medium text-slate-700">{status}</p>
        </div>
        {requireLiveness ? (
          <>
            <p className="rounded-[20px] bg-slate-50/80 px-4 py-3">
              Challenge:{" "}
              <span className="font-medium text-slate-900">
                {livenessChallenge?.steps?.map((step) => step.replaceAll("_", " ")).join(" or ") || "loading"}
              </span>
            </p>
            <p className="rounded-[20px] bg-slate-50/80 px-4 py-3">
              Progress:{" "}
              <span className="font-medium text-slate-900">
                {completedSteps.length
                  ? completedSteps.map((step) => step.replaceAll("_", " ")).join(", ")
                  : "No steps completed yet"}
              </span>
            </p>
            {!autoMode ? (
              <p className="rounded-[20px] bg-slate-50/80 px-4 py-3">
                Anti-spoof metrics:{" "}
                <span className="font-medium text-slate-900">
                  blinks {blinkCount}, turn {turnOffset.toFixed(3)}, stable frames {stableFrames}
                </span>
              </p>
            ) : null}
            {!modelsLoaded ? (
              <p className="font-medium text-amber-700">Loading liveness model assets...</p>
            ) : null}
          </>
        ) : null}
        {lastResult ? (
          <p className={`font-medium ${resultTone}`}>{lastResult.message}</p>
        ) : null}
      </div>
    </section>
  );
}
