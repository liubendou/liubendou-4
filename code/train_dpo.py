# -*- coding: utf-8 -*-
"""DPO 偏好优化（LoRA，12GB 显存安全）。数据来自 selfplay.py 的 prefs.jsonl。"""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=str(ROOT / "out" / "sft" / "final"))
    ap.add_argument("--data", default=str(ROOT / "data" / "prefs.jsonl"))
    ap.add_argument("--out", default=str(ROOT / "out" / "dpo"))
    ap.add_argument("--beta", type=float, default=0.1)
    ap.add_argument("--lr", type=float, default=5e-7)
    ap.add_argument("--epochs", type=float, default=1.0)
    ap.add_argument("--lora", type=int, default=32)
    args = ap.parse_args()

    from datasets import Dataset
    from peft import LoraConfig
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from trl import DPOConfig, DPOTrainer

    rows = [json.loads(l) for l in Path(args.data).open(encoding="utf-8")]
    rows = [r for r in rows if r.get("chosen") and r.get("rejected")]
    print(f"偏好对 {len(rows)} 条", flush=True)

    tok = AutoTokenizer.from_pretrained(args.model)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    model = AutoModelForCausalLM.from_pretrained(
        args.model, torch_dtype=__import__("torch").bfloat16,
        low_cpu_mem_usage=True, attn_implementation="sdpa",
    )
    model.config.use_cache = False

    lora = None
    if args.lora > 0:
        lora = LoraConfig(
            r=args.lora, lora_alpha=args.lora * 2, lora_dropout=0.0, bias="none",
            task_type="CAUSAL_LM",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        )

    cfg = DPOConfig(
        output_dir=args.out, beta=args.beta, learning_rate=args.lr,
        num_train_epochs=args.epochs, per_device_train_batch_size=1,
        gradient_accumulation_steps=8, gradient_checkpointing=True,
        max_length=1024, bf16=True,
        logging_steps=10, save_steps=200, save_total_limit=2,
        report_to="none", remove_unused_columns=False,
    )
    trainer = DPOTrainer(
        model=model, ref_model=None, args=cfg,
        train_dataset=Dataset.from_list(rows),
        processing_class=tok, peft_config=lora,
    )
    trainer.train()
    trainer.save_model(str(Path(args.out) / "final"))
    tok.save_pretrained(str(Path(args.out) / "final"))
    print("DPO 完成 ->", Path(args.out) / "final", flush=True)


if __name__ == "__main__":
    main()
