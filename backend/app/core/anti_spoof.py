from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np
import onnxruntime as ort

from app.config.settings import settings
from app.core.face_utils import FaceEngine, face_engine


@dataclass
class AntiSpoofState:
    available: bool
    reason: str | None = None


class AntiSpoofEngine:
    def __init__(self, face_detector: FaceEngine) -> None:
        self._session = None
        self._input_name = None
        self._output_name = None
        self._state = AntiSpoofState(available=False, reason="Not initialized")
        self._face_detector = face_detector

    @property
    def state(self) -> AntiSpoofState:
        if self._session is None and not self._state.available:
            self.initialize()
        return self._state

    def initialize(self) -> None:
        if self._session is not None:
            return

        model_path = settings.anti_spoof_model_path
        if not model_path.exists():
            self._state = AntiSpoofState(
                available=False,
                reason=f"Anti-spoof model not found at {model_path}",
            )
            return

        try:
            session = ort.InferenceSession(
                str(model_path),
                providers=["CPUExecutionProvider"],
            )
            self._session = session
            self._input_name = session.get_inputs()[0].name
            self._output_name = session.get_outputs()[0].name
            self._state = AntiSpoofState(available=True, reason=None)
        except Exception as exc:  # pragma: no cover
            self._state = AntiSpoofState(
                available=False,
                reason=f"Anti-spoof model failed to initialize: {exc}",
            )

    def analyze(self, image_bgr: np.ndarray) -> dict:
        self.initialize()
        if not self._state.available or self._session is None:
            return {
                "available": False,
                "is_spoof": False,
                "score": None,
                "reason": self._state.reason or "Anti-spoof model unavailable",
            }

        face, meta = self._face_detector.get_primary_face(image_bgr, for_registration=False)
        if face is None:
            return {
                "available": True,
                "is_spoof": True,
                "score": None,
                "reason": meta["reason"],
            }

        crop = self._face_detector.crop_face_with_margin(image_bgr, face, margin_ratio=0.45)
        if crop.size == 0:
            return {
                "available": True,
                "is_spoof": True,
                "score": None,
                "reason": "Face crop failed for anti-spoofing.",
            }

        resized = cv2.resize(crop, (112, 112))
        blob = cv2.dnn.blobFromImage(resized, scalefactor=1.0 / 255.0, swapRB=False)
        spoof_score = float(
            self._session.run([self._output_name], {self._input_name: blob})[0][0][0]
        )
        is_spoof = spoof_score > settings.anti_spoof_threshold

        return {
            "available": True,
            "is_spoof": is_spoof,
            "score": round(spoof_score, 4),
            "threshold": settings.anti_spoof_threshold,
            "reason": "Spoof detected by ONNX anti-spoof model."
            if is_spoof
            else "Face passed ONNX anti-spoof model.",
        }


anti_spoof_engine = AntiSpoofEngine(face_engine)
