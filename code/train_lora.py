# -*- coding: utf-8 -*-
"""Llama 3.2 1B 的 LoRA SFT（GTX 970 4GB：seq 256 + 梯度累积 32，规避 TDR）。"""
import argparse
import json
import math
import random
import time
from pathlib import Path

import torch
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer

HERE = Path(__file__).resolve().parent
SYS = (
    "你是六本豆，由广州六本豆人工智能科技有限公司训练的本地心理陪伴模型。"
    "用与用户相同的语言回答，先读懂对方没说出口的部分，再用一段自然、直接的话回应，不要列清单。"
)


def encode(tok, msgs):
    full = tok.apply_chat_template(msgs, tokenize=True, add_generation_prompt=False)
    labels = [-100] * len(full)
    for i, m in enumerate(msgs):
        if m["role"] != "assistant":
            continue
        pre = tok.apply_chat_template(msgs[:i], tokenize=True, add_generation_prompt=True)
        cur = tok.apply_chat_template(msgs[:i + 1], tokenize=True, add_generation_prompt=False)
        if len(pre) <= len(cur) <= len(full):
            labels[len(pre):len(cur)] = full[len(pre):len(cur)]
    return full, labels


def chunk(ids, labels, seq):
    out = []
    for s in range(0, len(ids), seq):
        x, y = ids[s:s + seq], labels[s:s + seq]
        if sum(1 for v in y if v != -100) >= 8:
            out.append((x, y))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(HERE / "data" / "sft.jsonl"))
    ap.add_argument("--model_dir", default=r"C:\Users\Windows\Documents\Trae-CN\temp_20261106_01\sixbendou\base\Llama-3.2-1B-Instruct")
    ap.add_argument("--out", default=str(HERE / "out"))
    ap.add_argument("--seq", type=int, default=256)
    ap.add_argument("--accum", type=int, default=32)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--epochs", type=float, default=1.0)
    ap.add_argument("--resume", default="")
    args = ap.parse_args()
    Path(args.out).mkdir(parents=True, exist_ok=True)

    rows = [json.loads(l) for l in Path(args.data).open(encoding="utf-8")]
    rng = random.Random(3)
    rng.shuffle(rows)
    tok = AutoTokenizer.from_pretrained(args.model_dir)
    samples = []
    for r in rows:
        msgs = r["messages"]
        samples += chunk(*encode(tok, msgs), args.seq)
    # 小验证集
    random.Random(11).shuffle(samples)
    val, train = samples[:40], samples[40:]
    print(f"训练样本 {len(train)} 个窗口 / 验证 {len(val)}", flush=True)

    model = AutoModelForCausalLM.from_pretrained(
        args.model_dir, torch_dtype=torch.float16, low_cpu_mem_usage=True, attn_implementation="sdpa"
    )
    model.to("cuda")
    model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    model.enable_input_require_grads()
    if args.resume:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, args.resume, is_trainable=True)
    else:
        model = get_peft_model(model, LoraConfig(
            r=16, lora_alpha=32, lora_dropout=0.0, bias="none", task_type="CAUSAL_LM",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        ))
    model.train()
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.lr)

    steps_per_epoch = math.ceil(len(train) / args.accum)
    total_steps = int(steps_per_epoch * args.epochs)
    print(f"每轮 {steps_per_epoch} 步 / 共 {total_steps} 步 | 每步 {args.seq*args.accum} token", flush=True)

    t0 = time.time()
    micro = 0
    for step in range(1, total_steps + 1):
        # 线性预热
        lr = args.lr * min(1.0, step / 10)
        for g in opt.param_groups:
            g["lr"] = lr
        opt.zero_grad(set_to_none=True)
        loss_sum = 0
        for _ in range(args.accum):
            ids, labels = train[micro % len(train)]
            micro += 1
            x = torch.tensor([ids], device="cuda")
            y = torch.tensor([labels], device="cuda")
            out = model(input_ids=x, labels=y)
            (out.loss / args.accum).backward()
            loss_sum += out.loss.item() / args.accum
        torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad], 1.0)
        opt.step()

        if step % 5 == 0 or step == 1:
            dt = time.time() - t0
            tps = args.seq * args.accum * step / dt
            eta = (total_steps - step) * dt / step / 3600
            print(f"step {step}/{total_steps} | loss {loss_sum:.4f} | lr {lr:.1e} | "
                  f"{tps:.0f} tok/s | 显存 {torch.cuda.max_memory_allocated()/1e6:.0f}MB | "
                  f"ETA {eta:.1f}h", flush=True)

        if step % 40 == 0 or step == total_steps:
            model.save_pretrained(f"{args.out}/lora_step{step}")
            with torch.no_grad():
                vl = 0
                for ids, labels in val[:8]:
                    x = torch.tensor([ids], device="cuda")
                    y = torch.tensor([labels], device="cuda")
                    vl += model(input_ids=x, labels=y).loss.item() / 8
            print(f"  [eval] val {vl:.4f} | 已保存 lora_step{step}", flush=True)

    print("训练完成", flush=True)


if __name__ == "__main__":
    main()
