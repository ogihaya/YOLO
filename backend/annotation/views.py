"""Views for the annotation/inference workflow."""
from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def health_check(request):
    """Simple endpoint for smoke-testing the stack."""
    return Response({"status": "ok"})


def train_annotation_view(request):
    """Render the Phase 2 train annotation workspace."""
    return render(request, "annotation/train.html")
