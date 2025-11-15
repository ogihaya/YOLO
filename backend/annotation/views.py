"""Views for the annotation/inference workflow."""
from __future__ import annotations

from django.middleware.csrf import get_token
from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .services.yolov9_adapter import (
    InferenceError as Yolov9InferenceError,
    Yolov9Unavailable,
    run_inference as yolov9_run_inference,
)


@api_view(["GET"])
def health_check(request):
    """Simple endpoint for smoke-testing the stack."""
    return Response({"status": "ok"})


def _dataset_context(*, phase: str, dataset_name: str, slug: str) -> dict:
    """Common metadata for annotation workspaces."""
    return {
        "phase_label": phase,
        "dataset_name": dataset_name,
        "dataset_slug": slug,
        "export_filename": f"{slug}.zip",
        "subtitle": f"画像インポート → クラス作成 → 矩形描画 → {slug}.zip としてエクスポート",
    }


def train_annotation_view(request):
    """Render the Phase 2 train annotation workspace."""
    context = _dataset_context(phase="Phase 2", dataset_name="Train", slug="train")
    return render(request, "annotation/dataset.html", context)


def val_annotation_view(request):
    """Render the Phase 3 val annotation workspace."""
    context = _dataset_context(phase="Phase 3", dataset_name="Val", slug="val")
    return render(request, "annotation/dataset.html", context)


def inference_view(request):
    """Render the inference execution screen."""
    get_token(request)
    return render(
        request,
        "annotation/inference.html",
        {
            "phase_label": "Phase 3",
            "title": "推論実行画面",
        },
    )


@api_view(["POST"])
@parser_classes([MultiPartParser])
def run_inference(request):
    """Proxy the YOLOv9 bridge to obtain inference results."""
    model_file = request.FILES.get("model")
    image_files = request.FILES.getlist("images")
    image_ids = request.data.getlist("image_ids")

    if not model_file:
        return Response(
            {"error": "model ファイルを指定してください。"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not image_files:
        return Response(
            {"error": "推論対象の画像を選択してください。"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(image_ids) != len(image_files):
        return Response(
            {"error": "image_ids と画像枚数が一致しません。"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        payload = yolov9_run_inference(model_file, zip(image_ids, image_files))
    except Yolov9Unavailable as exc:
        return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Yolov9InferenceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(payload)
