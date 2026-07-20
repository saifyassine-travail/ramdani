FROM python:3.12-slim

WORKDIR /app

# libglib2.0-0: runtime shared library opencv-python-headless links against.
# tesseract-ocr(-fra): local OCR engine + French language data, no external API.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 tesseract-ocr tesseract-ocr-fra \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8100

# Gunicorn (2 workers) — face detection + OCR can take a couple seconds on a
# large image, so we want more than one worker and a generous timeout.
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8100", \
     "--workers", "2", \
     "--timeout", "120"]
