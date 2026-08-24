from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import SentReminder


@require_GET
def health(request):
    last = SentReminder.objects.order_by("-sent_at").first()
    return JsonResponse(
        {
            "status": "ok",
            "last_reminder_sent_at": last.sent_at.isoformat() if last else None,
        }
    )


@csrf_exempt
@require_POST
def send_now(request):
    """Manual trigger for testing — internal network only (this service has
    no published port), so no auth beyond that. Accepts ?dry_run=1."""
    from .services.reminder_job import run_reminder_batch

    dry_run = request.GET.get("dry_run") == "1"
    result = run_reminder_batch(dry_run=dry_run)
    return JsonResponse({"dry_run": dry_run, **result})
