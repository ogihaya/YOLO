from __future__ import annotations

import sys
from pathlib import Path
from typing import Iterable, Tuple

from django.core.files.uploadedfile import UploadedFile

YOLO_ROOT = Path(__file__).resolve().parents[2] / "yolov9"
if YOLO_ROOT.exists() and str(YOLO_ROOT) not in sys.path:
    sys.path.append(str(YOLO_ROOT))

try:
    from bridge import ImageRequest, InferenceError, YoloV9Bridge
except Exception as exc:  # pragma: no cover - import guard
    YoloV9Bridge = None
    InferenceError = RuntimeError
    _IMPORT_ERROR = exc
else:
    _IMPORT_ERROR = None


class Yolov9Unavailable(RuntimeError):
    """Raised when the underlying YOLOv9 assets cannot be imported."""


def _ensure_engine() -> YoloV9Bridge:
    if not YoloV9Bridge:
        raise Yolov9Unavailable(f"YOLOv9 bridgeを初期化できません: {_IMPORT_ERROR}")
    if not hasattr(_ensure_engine, "_engine"):
        _ensure_engine._engine = YoloV9Bridge()
    return _ensure_engine._engine


def run_inference(
    model_file: UploadedFile, images: Iterable[Tuple[str, UploadedFile]]
) -> dict:
    """
    Invoke the YOLOv9 bridge with uploaded assets.

    Parameters
    ----------
    model_file:
        Uploaded .pt file from the browser.
    images:
        Iterable of tuples (image_id, file) where image_id is generated on the client.
    """

    engine = _ensure_engine()
    model_bytes = model_file.read()
    model_file.seek(0)

    requests = []
    for image_id, upload in images:
        raw_bytes = upload.read()
        upload.seek(0)
        requests.append(
            ImageRequest(image_id=image_id, filename=upload.name, data=raw_bytes)
        )

    return {
        "model_filename": model_file.name or "model.pt",
        **engine.run(model_bytes, requests),
    }


__all__ = ["run_inference", "Yolov9Unavailable", "InferenceError"]
