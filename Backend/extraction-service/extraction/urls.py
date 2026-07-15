from django.urls import path

from .views import ExtractCINView

urlpatterns = [
    path("extract/cin/", ExtractCINView.as_view(), name="extract-cin"),
]
