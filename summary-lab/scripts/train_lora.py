#!/usr/bin/env python
"""QLoRA fine-tune a small chat model on doctor-approved (case -> summary)
pairs. Only rows with status == "approved" in the cases file are used —
drafts and rejected rows are never trained on.

Usage:
    python scripts/train_lora.py --config configs/summary_lora.yaml
    python scripts/train_lora.py --config configs/summary_lora.yaml --smoke-test
        (--smoke-test: 2 max_steps on whatever data exists, e.g. synthetic
        cases, just to prove the training loop actually runs on this GPU —
        not a real training run, don't use the resulting adapter for real.)
"""
import argparse
import json
import sys
from pathlib import Path

import torch
import yaml
from datasets import Dataset
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from trl import SFTConfig, SFTTrainer

ROOT = Path(__file__).resolve().parent.parent


def load_approved_examples(cases_file: str, system_prompt: str) -> list[dict]:
    path = ROOT / cases_file
    examples = []
    with path.open() as f:
        for line in f:
            row = json.loads(line)
            if row["status"] != "approved" or not row.get("approved_summary"):
                continue
            examples.append({
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": row["anonymized_text"]},
                    {"role": "assistant", "content": row["approved_summary"]},
                ]
            })
    return examples


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default="configs/summary_lora.yaml")
    parser.add_argument(
        "--smoke-test", action="store_true",
        help="2 max_steps, no minimum example count — verifies the training "
             "loop runs on this hardware, produces nothing usable for real.",
    )
    args = parser.parse_args()

    cfg = yaml.safe_load((ROOT / args.config).read_text())

    examples = load_approved_examples(cfg["cases_file"], cfg["system_prompt"])
    print(f"{len(examples)} approved examples in {cfg['cases_file']}")
    if not examples:
        print(
            "No approved examples yet — nothing to train on. Run "
            "export_dataset.py (or generate_synthetic_cases.py for a "
            "smoke test) -> draft_summaries.py -> review in review.html, "
            "approving at least a few rows, first.",
            file=sys.stderr,
        )
        sys.exit(1)
    if not args.smoke_test and len(examples) < 30:
        print(
            f"Only {len(examples)} approved examples — that's too few for a "
            "real fine-tune to learn anything reliable (expect at least a "
            "few dozen, ideally 100+). Pass --smoke-test if you're just "
            "verifying the pipeline runs, not training for real.",
            file=sys.stderr,
        )
        sys.exit(1)

    dataset = Dataset.from_list(examples)

    tokenizer = AutoTokenizer.from_pretrained(cfg["base_model"])
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    quant_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
    )
    model = AutoModelForCausalLM.from_pretrained(
        cfg["base_model"],
        quantization_config=quant_config,
        device_map="auto",
    )

    lora_config = LoraConfig(
        r=cfg["lora_r"],
        lora_alpha=cfg["lora_alpha"],
        lora_dropout=cfg["lora_dropout"],
        target_modules=cfg["target_modules"],
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    output_dir = ROOT / cfg["output_dir"]
    sft_config = SFTConfig(
        output_dir=str(output_dir),
        num_train_epochs=cfg["num_train_epochs"],
        per_device_train_batch_size=cfg["per_device_train_batch_size"],
        gradient_accumulation_steps=cfg["gradient_accumulation_steps"],
        learning_rate=cfg["learning_rate"],
        max_length=cfg["max_seq_length"],
        logging_steps=1,
        save_strategy="no",
        bf16=True,
        max_steps=2 if args.smoke_test else -1,
        report_to=[],
    )
    trainer = SFTTrainer(
        model=model,
        args=sft_config,
        train_dataset=dataset,
        processing_class=tokenizer,
    )
    trainer.train()

    if not args.smoke_test:
        model.save_pretrained(str(output_dir))
        tokenizer.save_pretrained(str(output_dir))
        print(f"LoRA adapter saved to {output_dir}")
    else:
        print("Smoke test finished (adapter not saved) — training loop works on this GPU.")


if __name__ == "__main__":
    main()
