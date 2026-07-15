# extraction-service

A standalone Django + DRF microservice that extracts structured data from a
scanned Moroccan CIN (Carte Nationale d'Identite) using the Gemini vision API
(zero-shot, no training), and returns a cropped face photo.

It runs **alongside** the Laravel `MediAssist` API — it does not modify it.

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
found · `502` the Gemini call itself failed.

## Setup

```bash
cd Backend/extraction-service
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Unix: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then set GEMINI_API_KEY
```

## Run

```bash
python manage.py runserver 0.0.0.0:8100
```

## Test

```bash
python manage.py test
```

The test mocks both the Gemini call and the OpenCV face crop, so it needs no API
key, no network, and no real image.
