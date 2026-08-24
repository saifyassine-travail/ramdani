from django.urls import path

from . import views

urlpatterns = [
    path("health", views.health),
    path("patients/<int:patient_id>/summary", views.summarize_patient),
]
