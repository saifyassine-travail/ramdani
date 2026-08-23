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

# Gunicorn (2 workers). Timeout must cover the slowest leg of a CIN scan: a
# cold Ollama model load (can exceed a minute on CPU for an 8B-class model)
# plus inference — matches OLLAMA_TIMEOUT_S (ollama_ocr.py) and the Laravel
# proxy / nginx timeouts upstream of this service, so a slow-but-successful
# scan isn't killed here first.
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8100", \
     "--workers", "2", \
     "--timeout", "300"]
