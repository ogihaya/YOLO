from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health_check, name="health-check"),
    path(
        "train/",
        views.train_annotation_view,
        name="train-annotation",
    ),
    path(
        "val/",
        views.val_annotation_view,
        name="val-annotation",
    ),
]
