#!/usr/bin/env bash
# Merge the LoRA adapter into the base model, convert to GGUF, and register
# it in the local Ollama so the app can call it like any other model
# (ollama run mediassist-summary / http://127.0.0.1:11434 with model name
# "mediassist-summary"). Run this AFTER train_lora.py has produced a real
# (non-smoke-test) adapter in outputs/lora-adapter.
set -euo pipefail
cd "$(dirname "$0")/.."

ADAPTER_DIR="outputs/lora-adapter"
MERGED_DIR="outputs/merged-model"
GGUF_PATH="outputs/mediassist-summary.gguf"
LLAMA_CPP_DIR="outputs/llama.cpp"
OLLAMA_MODEL_NAME="mediassist-summary"

if [ ! -d "$ADAPTER_DIR" ]; then
    echo "No adapter at $ADAPTER_DIR — run train_lora.py first." >&2
    exit 1
fi

echo "### 1/4 — Merging LoRA adapter into the base model ###"
python scripts/merge_lora.py --adapter "$ADAPTER_DIR" --output "$MERGED_DIR"

echo "### 2/4 — Fetching llama.cpp's GGUF converter (one-time) ###"
if [ ! -d "$LLAMA_CPP_DIR" ]; then
    git clone --depth 1 https://github.com/ggml-org/llama.cpp "$LLAMA_CPP_DIR"
fi
pip install -q -r "$LLAMA_CPP_DIR/requirements/requirements-convert_hf_to_gguf.txt"

echo "### 3/4 — Converting to GGUF (q4_K_M quantization) ###"
python "$LLAMA_CPP_DIR/convert_hf_to_gguf.py" "$MERGED_DIR" \
    --outfile "$GGUF_PATH" --outtype q8_0

echo "### 4/4 — Registering with Ollama as '$OLLAMA_MODEL_NAME' ###"
cat > outputs/Modelfile <<EOF
FROM $GGUF_PATH
SYSTEM "$(python -c "import yaml; print(yaml.safe_load(open('configs/summary_lora.yaml'))['system_prompt'].strip())")"
EOF
ollama create "$OLLAMA_MODEL_NAME" -f outputs/Modelfile

echo "Done. Test with: ollama run $OLLAMA_MODEL_NAME"
