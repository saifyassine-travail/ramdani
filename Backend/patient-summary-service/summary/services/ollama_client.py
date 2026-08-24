"""Calls a local Ollama chat model to turn an anonymized dossier text into a
short French summary. SUMMARY_MODEL defaults to the general-purpose draft
model (see summary-lab) — once a real fine-tune exists (summary-lab's
export_to_ollama.sh registers it as "mediassist-summary"), just set
SUMMARY_MODEL=mediassist-summary and restart this service; nothing else
changes.
"""
import json
import os
import urllib.error
import urllib.request

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://host.docker.internal:11434")
SUMMARY_MODEL = os.environ.get("SUMMARY_MODEL", "qwen2.5:7b")
TIMEOUT_S = int(os.environ.get("OLLAMA_TIMEOUT_S", "120"))

SYSTEM_PROMPT = (
    "Tu es un assistant médical qui résume le dossier d'un patient pour un "
    "médecin généraliste/gynécologue, en français, de façon concise "
    "(6-10 lignes maximum pour un historique multi-visites). Ne mentionne "
    "jamais de nom, numéro, ou tout identifiant personnel (il n'y en a de "
    "toute façon aucun dans le texte fourni) : reste uniquement sur le "
    "contenu clinique. Structure: tendance générale, éléments cliniques "
    "récurrents ou notables, traitements en cours ou récents, points de "
    "vigilance pour la prochaine consultation."
)


class OllamaUnavailable(Exception):
    pass


def summarize_dossier(dossier_text: str) -> str:
    payload = {
        "model": SUMMARY_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": dossier_text},
        ],
        "stream": False,
    }
    req = urllib.request.Request(
        f"{OLLAMA_HOST}/api/chat",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            body = json.loads(resp.read())
    except (urllib.error.URLError, TimeoutError) as exc:
        raise OllamaUnavailable(str(exc)) from exc
    return body["message"]["content"].strip()
