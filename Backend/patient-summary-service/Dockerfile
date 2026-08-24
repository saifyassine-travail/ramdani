FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8300

# Timeout covers a cold Ollama model load + generation on CPU (see
# OLLAMA_TIMEOUT_S in services/ollama_client.py) — matches the Laravel
# proxy's own timeout so a slow-but-successful summary isn't killed here first.
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8300", \
     "--workers", "2", \
     "--timeout", "130"]
