from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np
from numpy.linalg import norm

try:
    from insightface.app import FaceAnalysis
except Exception:  # pragma: no cover
    FaceAnalysis = None


@dataclass
class FaceEngineState:
    available: bool
    reason: str | None = None


class FaceEngine:
    def __init__(self) -> None:
        self._app = None
        self._state = FaceEngineState(available=False, reason="Not initialized")

    def initialize(self) -> None:
        if self._app is not None:
            return

        if FaceAnalysis is None:
            self._state = FaceEngineState(
                available=False,
                reason="InsightFace is not installed. Install backend requirements first.",
            )
            return

        try:
            app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
            app.prepare(ctx_id=0, det_size=(640, 640))
            self._app = app
            self._state = FaceEngineState(available=True, reason=None)
        except Exception as exc:  # pragma: no cover
            self._state = FaceEngineState(
                available=False,
                reason=f"Face engine failed to initialize: {exc}",
            )

    @property
    def state(self) -> FaceEngineState:
        if self._app is None and not self._state.available:
            self.initialize()
        return self._state

    def detect_faces(self, image: np.ndarray) -> list[Any]:
        self.initialize()
        if not self._state.available or self._app is None:
            return []
        return self._app.get(image)

    def get_primary_face(
        self, image: np.ndarray, for_registration: bool = False
    ) -> tuple[Any | None, dict[str, Any]]:
        if image is None:
            return None, {"spoof": False, "reason": "Invalid image"}

        faces = self.detect_faces(image)
        if not faces:
            return None, {"spoof": False, "reason": "No face detected"}

        if for_registration and len(faces) != 1:
            return None, {
                "spoof": False,
                "reason": "Use an image with exactly one clear face",
            }

        face = max(
            faces,
            key=lambda current: (current.bbox[2] - current.bbox[0])
            * (current.bbox[3] - current.bbox[1]),
        )

        spoof, reason = self._check_image_quality(face, image, for_registration)
        if spoof:
            return None, {"spoof": True, "reason": reason}

        return face, {"spoof": False, "reason": "ok"}

    def extract_embedding(
        self, image: np.ndarray, for_registration: bool = False
    ) -> tuple[list[float] | None, dict[str, Any]]:
        self.initialize()

        if not self._state.available or self._app is None:
            return None, {
                "spoof": False,
                "reason": self._state.reason or "Face engine unavailable",
            }

        face, meta = self.get_primary_face(image, for_registration=for_registration)
        if face is None:
            return None, meta

        return face.normed_embedding.tolist(), meta

    @staticmethod
    def crop_face_with_margin(
        image: np.ndarray, face: Any, margin_ratio: float = 0.35
    ) -> np.ndarray:
        bbox = face.bbox
        x1, y1, x2, y2 = [int(round(value)) for value in bbox[:4]]
        width = max(x2 - x1, 1)
        height = max(y2 - y1, 1)
        margin_x = int(width * margin_ratio)
        margin_y = int(height * margin_ratio)

        start_x = max(0, x1 - margin_x)
        start_y = max(0, y1 - margin_y)
        end_x = min(image.shape[1], x2 + margin_x)
        end_y = min(image.shape[0], y2 + margin_y)
        return image[start_y:end_y, start_x:end_x]

    @staticmethod
    def _check_image_quality(
        face: Any, image: np.ndarray, for_registration: bool
    ) -> tuple[bool, str]:
        if face.det_score < 0.45:
            return True, "Face confidence is too low. Move closer to the camera."

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        if blur_score < 35:
            return True, "Image is too blurry. Hold still and try again."

        if for_registration:
            return False, "ok"

        try:
            yaw, pitch, _roll = np.degrees(face.pose)
        except Exception:
            return False, "ok"

        # Attendance capture should tolerate mild head movement from normal webcam use.
        if abs(yaw) > 55 or abs(pitch) > 40:
            return True, "Keep your face roughly toward the camera."

        bbox = face.bbox
        face_width = max(float(bbox[2] - bbox[0]), 1.0)
        face_height = max(float(bbox[3] - bbox[1]), 1.0)
        if face_width < 80 or face_height < 80:
            return True, "Move a little closer to the camera."

        brightness = float(gray.mean())
        if brightness < 35 or brightness > 225:
            return True, "Lighting is not suitable. Avoid very dark or over-bright frames."

        return False, "ok"


face_engine = FaceEngine()


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    first = np.array(vec1)
    second = np.array(vec2)
    denom = norm(first) * norm(second)
    if denom == 0:
        return 0.0
    return float(np.dot(first, second) / denom)
