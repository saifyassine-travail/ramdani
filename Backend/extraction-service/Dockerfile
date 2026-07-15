FROM python:3.12-slim

WORKDIR /app

# Runtime shared library that opencv-python-headless links against on slim images.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8100

# Gunicorn (2 workers) — face detection + a Gemini round-trip can take a couple
# seconds, so we want more than one worker. Generous timeout for slow API calls.
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8100", \
     "--workers", "2", \
     "--timeout", "120"]
