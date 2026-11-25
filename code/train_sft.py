# -*- coding: utf-8 -*-
"""六本豆 4.0 SFT：RTX 5070 12GB 全参数微调（bf16）。
默认 seq 2048 / batch 1 / accum 16（每步 32k token）。显存不够时加 --lora。
"""
import argparse
import json
import math
import random
import time
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def encode(tok, msgs):
    """整段 chat 模板编码，只在 assistant 段算 loss。"""
    full = tok.apply_chat_template(msgs, tokenize=True, add_generation_prompt=False, return_dict=False)
    if isinstance(full, dict):
        full = full["input_ids"]
    labels = [-100] * len(full)
    for i, m in enumerate(msgs):
        if m["role"] != "assistant":
            continue
        pre = tok.apply_chat_template(msgs[:i], tokenize=True, add_generation_prompt=True, return_dict=False)
        cur = tok.apply_chat_template(msgs[: i + 1], tokenize=True, add_generation_prompt=False, return_dict=False)
        if isinstance(pre, dict):
            pre = pre["input_ids"]
        if isinstance(cur, dict):
            cur = cur["input_ids"]
        if len(pre) <= len(cur) <= len(full):
            labels[len(pre):len(cur)] = full[len(pre):len(cur)]
    return full, labels


def chunk(ids, labels, seq):
    out = []
    for s in range(0, len(ids), seq):
        x, y = ids[s:s + seq], labels[s:s + seq]
        if len(x) >= 16 and sum(1 for v in y if v != -100) >= 8:
            out.append((x, y))
    return out


def collate_batch(batch, pad_token_id):
    """动态 Padding，解决变长切片在 batch > 1 时的维度崩溃问题，并生成 attention_mask。"""
    max_len = max(len(b[0]) for b in batch)
    input_ids, labels, masks = [], [], []
    for x, y in batch:
        pad_len = max_len - len(x)
        input_ids.append(x + [pad_token_id] * pad_len)
        labels.append(y + [-100] * pad_len)
        masks.append([1] * len(x) + [0] * pad_len)
    return (
        torch.tensor(input_ids, dtype=torch.long, device="cuda"),
        torch.tensor(labels, dtype=torch.long, device="cuda"),
        torch.tensor(masks, dtype=torch.long, device="cuda"),
    )


def wsd_lr(step, total, peak, warmup=0.03, decay=0.15):
    if step < total * warmup:
        return peak * (step + 1) / max(1, total * warmup)
    if step > total * (1 - decay):
        return peak * max(0.1, (total - step) / max(1, total * decay))
    return peak


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=str(ROOT / "base" / "Llama-3.2-1B-Instruct"))
    ap.add_argument("--data", default=str(ROOT / "data" / "sft_v4.jsonl"))
    ap.add_argument("--out", default=str(ROOT / "out" / "sft"))
    ap.add_argument("--seq", type=int, default=2048)
    ap.add_argument("--batch", type=int, default=1)
    ap.add_argument("--accum", type=int, default=16)
    ap.add_argument("--lr", type=float, default=1e-5)
    ap.add_argument("--epochs", type=float, default=1.0)
    ap.add_argument("--max_steps", type=int, default=0)
    ap.add_argument("--resume", default="")
    ap.add_argument("--start_step", type=int, default=1)
    ap.add_argument("--lora", default="", help="如 r=32，显存不足时启用 LoRA")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    rows = [json.loads(l) for l in Path(args.data).open(encoding="utf-8")]
    tok = AutoTokenizer.from_pretrained(args.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    samples = []
    for r in rows:
        samples += chunk(*encode(tok, r["messages"]), args.seq)
    random.Random(11).shuffle(samples)
    val, train = samples[:200], samples[200:]
    print(f"训练窗口 {len(train)} / 验证 {len(val)} | 数据 {args.data}", flush=True)

    model = AutoModelForCausalLM.from_pretrained(
        args.base, torch_dtype=torch.bfloat16, low_cpu_mem_usage=True,
        attn_implementation="sdpa",
    )
    model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    model.config.use_cache = False

    if args.resume:
        state = Path(args.resume) / "model.safetensors"
        if state.exists():
            from safetensors.torch import load_file
            model.load_state_dict(load_file(str(state)), strict=False)
            print("已加载权重", args.resume, flush=True)

    lora_r = 0
    if args.lora:
        from peft import LoraConfig, get_peft_model, set_peft_model_state_dict
        lora_r = int(args.lora.split("=")[-1]) if "=" in args.lora else int(args.lora)
        model.enable_input_require_grads()
        model = get_peft_model(model, LoraConfig(
            r=lora_r, lora_alpha=lora_r * 2, lora_dropout=0.0, bias="none",
            task_type="CAUSAL_LM",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        ))
        print(f"LoRA r={lora_r}", flush=True)

        if args.resume:
            adapter_state = Path(args.resume) / "adapter_model.safetensors"
            if adapter_state.exists():
                from safetensors.torch import load_file
                set_peft_model_state_dict(model, load_file(str(adapter_state)))
                print(f"已恢复 LoRA 权重 from {args.resume}", flush=True)

    model.to("cuda")
    model.train()

    params = [p for p in model.parameters() if p.requires_grad]
    try:
        import bitsandbytes as bnb
        opt = bnb.optim.AdamW8bit(params, lr=args.lr, betas=(0.9, 0.95), weight_decay=0.1)
        print("优化器 AdamW8bit", flush=True)
    except Exception:
        opt = torch.optim.AdamW(params, lr=args.lr, betas=(0.9, 0.95), weight_decay=0.1)
        print("优化器 torch AdamW（全参数时显存更高）", flush=True)

    steps_per_epoch = math.ceil(len(train) / args.accum)
    total = int(steps_per_epoch * args.epochs) if args.max_steps <= 0 else args.max_steps
    print(f"共 {total} 步 | 每步 {args.seq * args.batch * args.accum} token", flush=True)

    t0 = time.time()
    micro = (args.start_step - 1) * args.batch * args.accum
    for step in range(args.start_step, total + 1):
        lr = wsd_lr(step, total, args.lr)
        for g in opt.param_groups:
            g["lr"] = lr
        opt.zero_grad(set_to_none=True)
        loss_sum = 0.0
        for _ in range(args.accum):
            batch = [train[(micro + j) % len(train)] for j in range(args.batch)]
            micro += args.batch
            x, y, mask = collate_batch(batch, tok.pad_token_id)
            loss = model(input_ids=x, attention_mask=mask, labels=y).loss
            (loss / args.accum).backward()
            loss_sum += loss.item() / args.accum
        torch.nn.utils.clip_grad_norm_(params, 1.0)
        opt.step()

        if step % 5 == 0 or step == 1:
            dt = time.time() - t0
            tps = args.seq * args.batch * args.accum * step / dt
            eta = (total - step) * dt / step / 3600
            print(f"step {step}/{total} | loss {loss_sum:.4f} | lr {lr:.2e} | "
                  f"{tps:.0f} tok/s | 显存 {torch.cuda.max_memory_allocated()/2**30:.2f}GB | "
                  f"ETA {eta:.2f}h", flush=True)

        if step % 100 == 0 or step == total:
            model.save_pretrained(out / f"step{step}")
            torch.cuda.empty_cache()
            with torch.no_grad():
                vl = 0.0
                eval_subset = val[:16]
                for ids, lab in eval_subset:
                    vx, vy, vmask = collate_batch([(ids, lab)], tok.pad_token_id)
                    vl += model(input_ids=vx, attention_mask=vmask,
                                labels=vy).loss.item() / max(1, len(eval_subset))
            print(f"  [eval] val {vl:.4f} | 已保存 step{step}", flush=True)

    model.save_pretrained(out / "final")
    tok.save_pretrained(out / "final")
    print("训练完成 ->", out / "final", flush=True)


if __name__ == "__main__":
    main()
