from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .services.dossier import build_dossier_text
from .services.ollama_client import OllamaUnavailable, summarize_dossier
from .services.source_db import fetch_patient_completed_appointments


@require_GET
def health(request):
    return JsonResponse({"status": "ok"})


@csrf_exempt
@require_POST
def summarize_patient(request, patient_id: int):
    rows = fetch_patient_completed_appointments(patient_id)
    if not rows:
        return JsonResponse(
            {"success": False, "message": "Aucune visite terminée pour ce patient."},
            status=404,
        )

    dossier_text = build_dossier_text(rows)
    try:
        summary = summarize_dossier(dossier_text)
    except OllamaUnavailable as exc:
        return JsonResponse(
            {"success": False, "message": f"Service de résumé indisponible: {exc}"},
            status=503,
        )

    return JsonResponse({"success": True, "summary": summary, "visits_considered": len(rows)})
