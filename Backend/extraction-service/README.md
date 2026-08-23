# extraction-service

A standalone Django + DRF microservice that extracts structured data from a
scanned Moroccan CIN (Carte Nationale d'Identite) and returns a cropped face
photo. OCR runs **fully offline**, no API key, no per-scan cost, no image
ever leaves the machine:

* **Primary engine — local vision LLM via [Ollama](https://ollama.com)**
  (`extraction/services/ollama_ocr.py`). The model reads the card image
  directly (zero-shot, no training) instead of plain-text OCR + regex, which
  is far more robust to the real biometric card layout (bilingual
  Arabic/Latin, no field labels, and photos that are very often rotated
  90/180°). Needs `ollama serve` running locally with a vision model pulled
  — see Setup below.
* **Fallback engine — Tesseract** (`extraction/services/tesseract_ocr.py`,
  the original implementation). Used automatically if Ollama can't be
  reached, or directly via `OCR_ENGINE=tesseract`. Less accurate on real
  cards but has no extra runtime beyond the Tesseract binary — useful on a
  clinic PC where Ollama isn't (yet) set up.

Engine selection/fallback logic lives in `extraction/services/ocr_client.py`
(see its docstring for the exact rules). It runs **alongside** the Laravel
`MediAssist` API — it does not modify it.

## Endpoint

`POST /api/extract/cin/` — multipart upload, field `file` (JPG/JPEG/PNG, max 10 MB).

Response (200):

```json
{
  "data": {
    "first_name": "Mohammed",
    "last_name": "Alaoui",
    "full_name": "Mohammed Alaoui",
    "cin_number": "K01234567",
    "date_of_birth": "1990-05-14",
    "place_of_birth": "Casablanca",
    "expiry_date": "2032-01-01"
  },
  "photo_base64": "<base64 JPEG of the cropped face>",
  "validation": { "cin_number": true, "date_of_birth": true, "expiry_date": true, "full_name": true }
}
```

Status codes: `400` invalid upload · `422` extraction/validation failed or no face
found · `502` the OCR engine itself failed (including Ollama unreachable AND
the Tesseract fallback also failing).

## Setup

**1. Install Ollama and pull a vision model** (skip this if you only want the
Tesseract fallback, via `OCR_ENGINE=tesseract`):

```bash
winget install -e --id Ollama.Ollama    # or see https://ollama.com/download
ollama serve                             # starts the local API on :11434
ollama pull qwen2.5vl:3b                 # ~3.2GB; fits a 4GB-class GPU
```

A larger tag (`qwen2.5vl:latest`, 8.3B / ~6GB) is more accurate but slower
without a GPU it fully fits on — on CPU alone, expect roughly 20s/image once
the model is warm (the first call after `ollama serve` starts is slower,
since it has to load the model into memory).

**2. Install the Python service:**

```bash
cd Backend/extraction-service
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Unix: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # defaults to OCR_ENGINE=ollama, adjust OLLAMA_HOST/MODEL as needed
```

## Run

```bash
python manage.py runserver 0.0.0.0:8100
```

## Test

```bash
python manage.py test
```

The test mocks the OCR engine call and the OpenCV face crop, so it needs no
Ollama instance running, no network, and no real image.
