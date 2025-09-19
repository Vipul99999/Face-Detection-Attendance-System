import React, { useRef, useEffect, useState } from 'react';

const FACE_DETECT_INTERVAL = 250; // ms
const STABLE_FRAMES_REQUIRED = 8;
const COOLDOWN_MS = 5000;

export default function CameraFeed({ onCapture, setCameraOn }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [status, setStatus] = useState('idle');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [stableCount, setStableCount] = useState(0);
  const [cooldown, setCooldown] = useState(false);
  const [stopCapture, setStopCapture] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(false);
  const [loadError, setLoadError] = useState('');

  const updateCameraState = typeof setCameraOn === 'function' ? setCameraOn : () => {};

  // Start camera
  const startCamera = async () => {
    setLoadingCamera(true);
    setLoadError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraOn(true);
      updateCameraState(true);
      setStatus('camera-on');
    } catch (e) {
      console.error('Camera error:', e);
      setLoadError('Camera access denied or not available');
      setStatus('camera-error');
      updateCameraState(false);
    } finally {
      setLoadingCamera(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    const tracks = videoRef.current?.srcObject?.getTracks();
    tracks?.forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOn(false);
    updateCameraState(false);
    setStatus('camera-off');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Load face-api models dynamically
  useEffect(() => {
    const loadModels = async () => {
      try {
        if (!window.faceapi) {
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js';
            s.onload = res;
            s.onerror = rej;
            document.head.appendChild(s);
          });
        }
        const MODEL_URL = '/models'; // make sure models are served here
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
      } catch (err) {
        console.warn('Could not load face-api models:', err);
        setModelsLoaded(false);
        setLoadError('Failed to load face detection models');
      }
    };
    loadModels();
  }, []);

  // Auto-capture loop
  useEffect(() => {
    if (!modelsLoaded || stopCapture || !isCameraOn) return;

    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      if (cooldown) return;

      try {
        const options = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
        const results = await window.faceapi.detectAllFaces(videoRef.current, options);

        const ctx = canvasRef.current.getContext('2d');
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (results && results.length > 0) {
          const largest = results.reduce((a, b) =>
            a.box.width * a.box.height > b.box.width * b.box.height ? a : b
          );
          const { x, y, width, height } = largest.box;
          ctx.strokeStyle = 'lime';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);

          setStableCount((prev) => {
            const newCount = prev + 1;
            if (newCount >= STABLE_FRAMES_REQUIRED) triggerCapture();
            return newCount;
          });

          setStatus(`Face detected (${stableCount + 1}/${STABLE_FRAMES_REQUIRED})`);
        } else {
          setStableCount(0);
          setStatus('no-face');
        }
      } catch (err) {
        console.error('Face detection error:', err);
      }
    }, FACE_DETECT_INTERVAL);

    return () => clearInterval(interval);
  }, [modelsLoaded, cooldown, stopCapture, isCameraOn, stableCount]);

  // Capture helper
  const captureImageBlob = async () => {
    if (!videoRef.current || !isCameraOn) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);

    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg')
    );
  };

  const triggerCapture = async () => {
    if (cooldown || stopCapture || !isCameraOn) return;
    setStatus('capturing');
    const blob = await captureImageBlob();
    try {
      const res = await onCapture(blob);
      if (!res?.attendance_marked) setStopCapture(true);
    } catch (err) {
      console.error('Capture failed:', err);
      setStatus('capture-error');
    } finally {
      setCooldown(true);
      setTimeout(() => setCooldown(false), COOLDOWN_MS);
      setStableCount(0);
      setTimeout(() => setStatus('idle'), 1200);
    }
  };

  const handleManual = async () => {
    setStatus('manual-capturing');
    const blob = await captureImageBlob();
    try {
      await onCapture(blob);
    } catch (err) {
      console.error('Manual capture failed:', err);
      setStatus('capture-error');
    } finally {
      setTimeout(() => setStatus('idle'), 1200);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg rounded-xl p-4">
  <h3 className="text-lg font-semibold mb-2 text-gray-800">
    Face Capture
  </h3>

  <div className="video-container relative border-2 border-gray-300 rounded-lg overflow-hidden max-w-md mx-auto">
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-full rounded-lg"
      style={{ maxWidth: '640px' }}
    />
    <canvas
      ref={canvasRef}
      className="overlay-canvas absolute top-0 left-0 w-full h-full pointer-events-none"
    />
    <div className="absolute top-2 left-2 bg-black bg-opacity-30 text-white px-2 py-1 rounded text-xs">
      {isCameraOn ? 'Camera On' : 'Camera Off'}
    </div>
  </div>

  <div className="mt-4 flex gap-2 items-center justify-between">
    {!isCameraOn ? (
      <button
        onClick={startCamera}
        disabled={loadingCamera}
        className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50 transition-colors"
      >
        {loadingCamera ? 'Starting...' : 'Start Camera'}
      </button>
    ) : (
      <button
        onClick={stopCamera}
        className="px-4 py-2 bg-red-600 text-white rounded transition-colors"
      >
        Stop Camera
      </button>
    )}

    <button
      onClick={handleManual}
      disabled={!isCameraOn}
      className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 transition-colors"
    >
      Manual Capture
    </button>

    <div className="ml-auto text-sm text-gray-700">
      {loadError
        ? `❌ ${loadError}`
        : modelsLoaded
        ? cooldown
          ? 'Cooldown...'
          : status
        : 'Models not loaded'}
    </div>
  </div>
</div>

  );
}
