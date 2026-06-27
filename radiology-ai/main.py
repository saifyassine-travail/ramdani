"""
MediAssist Radiology AI — FastAPI server
Runs on port 8001 (Laravel runs on 8000)

Endpoints:
  POST /analyze        — upload X-ray/MRI/CT, returns findings + annotated images
  GET  /health         — liveness check
  GET  /models         — show loaded models info
"""

import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from analyzer import RadiologyAnalyzer
from ct_analyzer import CTAnalyzer

# CT segmentation is minutes-long on CPU, so it runs as a background job the
# frontend polls — the upload request never blocks. In-memory store (one process).
CT_JOBS: dict = {}
_ct_executor = ThreadPoolExecutor(max_workers=1)  # one heavy CT at a time


def _run_ct_job(job_id: str, data: bytes):
    CT_JOBS[job_id] = {"status": "running", "started_at": time.time()}
    try:
        result = ct_analyzer.analyze(data)
        result["processing_time_ms"] = round((time.time() - CT_JOBS[job_id]["started_at"]) * 1000)
        CT_JOBS[job_id] = {"status": "done", "result": result}
    except Exception as exc:
        print(f"[ERROR] CT job {job_id} failed: {exc}")
        CT_JOBS[job_id] = {"status": "error", "error": str(exc)}
    # Keep the store small (results carry a base64 PNG each).
    if len(CT_JOBS) > 30:
        for k in list(CT_JOBS)[:-30]:
            CT_JOBS.pop(k, None)

# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

analyzer: RadiologyAnalyzer | None = None
ct_analyzer: CTAnalyzer | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global analyzer, ct_analyzer
    print("=" * 50)
    print("  MediAssist Radiology AI — loading models…")
    print("=" * 50)
    t0 = time.time()
    analyzer = RadiologyAnalyzer()
    ct_analyzer = CTAnalyzer()  # lightweight: only checks availability here
    print(f"  Models ready in {time.time() - t0:.1f}s  (CT route: {'on' if ct_analyzer.available else 'off'})")
    print("=" * 50)
    yield
    print("Shutting down…")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="MediAssist Radiology AI",
    description="Analyse automatique d'images radiologiques — TorchXRayVision + MedSAM2",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

ALLOWED_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/dicom", "image/x-dicom",        # DICOM support if Pillow-DICOM installed
    "application/octet-stream",             # some DICOM uploads arrive as this
}

MAX_SIZE_MB = 20


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": analyzer is not None,
        "medsam2": analyzer.sam.available if analyzer else False,
        "ct_route": ct_analyzer.available if ct_analyzer else False,
    }


@app.get("/models")
def models_info():
    if analyzer is None:
        raise HTTPException(503, "Models not loaded yet")
    return {
        "xrv_model":      "densenet121-res224-all (NIH + CheXpert + MIMIC + PadChest)",
        "pathologies":    list(analyzer.xrv_model.pathologies),
        "medsam2":        analyzer.sam.available,
        "device":         str(analyzer.device),
    }


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if analyzer is None:
        raise HTTPException(503, "Models still loading — try again in a moment")

    # ── Validate content type ──────────────────────────────────────────
    ct = (file.content_type or "").lower()
    if ct not in ALLOWED_TYPES and not ct.startswith("image/"):
        raise HTTPException(
            400,
            f"Type de fichier non supporté: {ct}. "
            "Envoyez une image JPEG, PNG ou DICOM."
        )

    # ── Validate size ──────────────────────────────────────────────────
    image_bytes = await file.read()
    if len(image_bytes) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, f"Fichier trop volumineux (max {MAX_SIZE_MB} MB)")

    if len(image_bytes) < 100:
        raise HTTPException(400, "Fichier vide ou corrompu")

    # ── Run analysis ───────────────────────────────────────────────────
    try:
        t0 = time.time()
        result = analyzer.analyze(image_bytes)
        result["processing_time_ms"] = round((time.time() - t0) * 1000)
        return JSONResponse(result)

    except Exception as exc:
        print(f"[ERROR] Analysis failed: {exc}")
        raise HTTPException(500, f"Erreur lors de l'analyse: {str(exc)}")


@app.post("/preview-ct")
async def preview_ct(file: UploadFile = File(...)):
    """Fast grayscale montage of a CT volume (no segmentation). ~1-2 s."""
    name = (file.filename or "").lower()
    if not (name.endswith(".nii") or name.endswith(".nii.gz")):
        raise HTTPException(400, "Envoyez un volume CT au format NIfTI (.nii ou .nii.gz).")
    data = await file.read()
    if len(data) < 100:
        raise HTTPException(400, "Fichier vide ou corrompu")
    try:
        from ct_analyzer import preview_montage
        return JSONResponse(preview_montage(data))
    except Exception as exc:
        print(f"[ERROR] CT preview failed: {exc}")
        raise HTTPException(500, f"Aperçu CT impossible: {str(exc)}")


@app.post("/analyze-ct")
async def analyze_ct(file: UploadFile = File(...)):
    """Start a CT segmentation job (NIfTI). Returns a job_id to poll — never blocks."""
    if ct_analyzer is None or not ct_analyzer.available:
        raise HTTPException(
            503,
            "Route CT indisponible. Installez totalsegmentator + nibabel dans l'environnement radiology-ai.",
        )
    name = (file.filename or "").lower()
    if not (name.endswith(".nii") or name.endswith(".nii.gz")):
        raise HTTPException(400, "Envoyez un volume CT au format NIfTI (.nii ou .nii.gz).")

    data = await file.read()
    if len(data) < 100:
        raise HTTPException(400, "Fichier vide ou corrompu")

    job_id = uuid.uuid4().hex[:12]
    CT_JOBS[job_id] = {"status": "pending"}
    _ct_executor.submit(_run_ct_job, job_id, data)
    return JSONResponse({"job_id": job_id, "status": "pending"})


@app.get("/ct-job/{job_id}")
def ct_job(job_id: str):
    """Poll a CT job: {status: pending|running|done|error, result?, error?}."""
    job = CT_JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Tâche CT introuvable (expirée ou serveur redémarré).")
    return JSONResponse(job)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
        log_level="info",
    )
