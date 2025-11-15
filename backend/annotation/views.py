"""Views for the annotation/inference workflow."""
from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response


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
