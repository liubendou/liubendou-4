# -*- coding: utf-8 -*-
"""GRPO 强化学习（规则奖励，无需教师模型）。
需 trl >= 0.16；显存预估 12GB 下用 LoRA r=32、batch 2、采样 4。
"""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def _to_str(c):
    if isinstance(c, str):
        return c
    if isinstance(c, list) and c and isinstance(c[0], dict):
        return c[0].get("content", "")
    return str(c)


def reward_format(completions, **kwargs):
    return [1.0 if ("<think>" in _to_str(c) and "</think>" in _to_str(c) and "<reply>" in _to_str(c) and "</reply>" in _to_str(c)) else 0.0 for c in completions]


def reward_quality(completions, **kwargs):
    from selfplay import score_reply
    return [score_reply(_to_str(c)) for c in completions]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=str(ROOT / "out" / "dpo" / "final"))
    ap.add_argument("--data", default=str(ROOT / "data" / "prompts.jsonl"))
    ap.add_argument("--out", default=str(ROOT / "out" / "grpo"))
    ap.add_argument("--lora", type=int, default=32, help="0 表示全参数（需 >=16GB 显存）")
    ap.add_argument("--batch", type=int, default=2)
    ap.add_argument("--accum", type=int, default=4)
    ap.add_argument("--gen", type=int, default=4, help="每个 prompt 采样条数")
    ap.add_argument("--max_steps", type=int, default=200)
    ap.add_argument("--lr", type=float, default=1e-6)
    args = ap.parse_args()

    from datasets import Dataset
    from peft import LoraConfig
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from trl import GRPOConfig, GRPOTrainer
    import torch

    rows = [json.loads(l) for l in Path(args.data).open(encoding="utf-8")]
    rows = [r for r in rows if r.get("prompt")]
    print(f"GRPO prompt {len(rows)} 条", flush=True)

    tok = AutoTokenizer.from_pretrained(args.model)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    model = AutoModelForCausalLM.from_pretrained(
        args.model, torch_dtype=torch.bfloat16, low_cpu_mem_usage=True,
        attn_implementation="sdpa",
    )
    model.config.use_cache = False

    lora = None
    if args.lora > 0:
        lora = LoraConfig(
            r=args.lora, lora_alpha=args.lora * 2, lora_dropout=0.0, bias="none",
            task_type="CAUSAL_LM",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        )

    cfg = GRPOConfig(
        output_dir=args.out, learning_rate=args.lr, max_steps=args.max_steps,
        per_device_train_batch_size=args.batch, gradient_accumulation_steps=args.accum,
        num_generations=args.gen, max_completion_length=240, temperature=0.9,
        beta=0.04, bf16=True, gradient_checkpointing=True, logging_steps=5,
        save_steps=100, save_total_limit=2, report_to="none",
    )
    trainer = GRPOTrainer(
        model=model, reward_funcs=[reward_format, reward_quality], args=cfg,
        train_dataset=Dataset.from_list(rows), processing_class=tok, peft_config=lora,
    )
    trainer.train()
    trainer.save_model(str(Path(args.out) / "final"))
    tok.save_pretrained(str(Path(args.out) / "final"))
    print("GRPO 完成 ->", Path(args.out) / "final", flush=True)


if __name__ == "__main__":
    main()
