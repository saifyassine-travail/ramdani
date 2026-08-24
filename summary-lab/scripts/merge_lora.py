#!/usr/bin/env python
"""Merge a trained LoRA adapter into its base model, producing a plain HF
model directory that llama.cpp's converter (see export_to_ollama.sh) can
turn into a GGUF file. Merging in full precision (not 4-bit) — the base
model download happens again here uncompressed, which is why this is a
separate, optional step from train_lora.py rather than done automatically.
"""
import argparse
from pathlib import Path

import torch
import yaml
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adapter", default="outputs/lora-adapter")
    parser.add_argument("--output", default="outputs/merged-model")
    parser.add_argument("--config", default="configs/summary_lora.yaml")
    args = parser.parse_args()

    cfg = yaml.safe_load((ROOT / args.config).read_text())
    base_model_name = cfg["base_model"]

    print(f"Loading base model {base_model_name} in full precision...")
    base_model = AutoModelForCausalLM.from_pretrained(base_model_name, torch_dtype=torch.bfloat16)
    tokenizer = AutoTokenizer.from_pretrained(base_model_name)

    print(f"Applying LoRA adapter from {args.adapter}...")
    model = PeftModel.from_pretrained(base_model, str(ROOT / args.adapter))
    merged = model.merge_and_unload()

    out_dir = ROOT / args.output
    out_dir.mkdir(parents=True, exist_ok=True)
    merged.save_pretrained(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))
    print(f"Merged model saved to {out_dir}")


if __name__ == "__main__":
    main()
