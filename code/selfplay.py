# -*- coding: utf-8 -*-
"""自博弈偏好数据：同一 prompt 采样 N 条，用规则奖励排序，产出 DPO 偏好对 + RFT 最优轨迹。"""
import argparse
import json
import random
import re
from collections import Counter
from pathlib import Path

import torch

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

SYS = (
    "你是六本豆，由广州六本豆人工智能科技有限公司训练的本地心理陪伴模型。"
    "用与用户相同的语言回答，先读懂对方没说出口的部分，再用一段自然、直接的话回应，不要列清单。"
)

EMPTY = ["我理解你的感受", "抱抱你", "你要相信自己", "一切都会好起来的", "你不是一个人",
         "加油", "慢慢来", "时间会治愈", "你很勇敢", "这很正常", "别想太多", "开心一点",
         "i understand how you feel", "everything will be fine", "stay strong", "you got this"]
PATTERN_ZH = ["每次", "总是", "其实", "怕", "不敢", "一直", "习惯", "宁愿", "嘴上", "装作"]
PATTERN_EN = ["always", "every time", "afraid", "never", "pretend", "keep"]
ACTION_ZH = ["今晚", "这周", "明天", "先", "写下来", "说一句", "拒绝", "告诉", "试一次", "约", "把注意力", "停止点"]
ACTION_EN = ["tonight", "this week", "tomorrow", "write", "say", "refuse", "ask", "try", "allow yourself", "turn the"]


def cjk_ratio(s):
    return sum(1 for c in s if "\u4e00" <= c <= "\u9fff") / max(1, len(s))


def score_reply(text):
    """返回 0~1 的规则奖励，selfplay / GRPO / eval 共用。
    已强化：
    1. 思考链质量验证：<think> 必须有实际心理推演内容，拒绝空标签刷分；
    2. 反作弊（Anti-Reward Hacking）：惩罚堆砌关键词行为；
    3. 临床深度鼓励：认可对未说出口情绪与防御模式的觉察。
    """
    t = text.strip()
    m_reply = re.search(r"<reply>(.*?)</reply>", t, re.S)
    reply = (m_reply.group(1) if m_reply else t).strip()
    zh = cjk_ratio(reply) > 0.3
    n = len(reply) if zh else len(reply.split())

    # 1. 结构与思考完整性 (0.25)
    m_th = re.search(r"<think>(.*?)</think>", t, re.S)
    think = (m_th.group(1) if m_th else "").strip()
    fmt = 0.25 if (think and len(think) >= 15 and reply and "<think>" in t and "</think>" in t and "<reply>" in t and "</reply>" in t) else (0.10 if (reply and "<reply>" in t and "</reply>" in t) else 0.0)

    # 2. 长度控制 (0.20)
    if zh:
        length = 0.20 if 60 <= n <= 130 else (0.12 if 40 <= n < 60 or 130 < n <= 180 else 0.0)
    else:
        length = 0.20 if 40 <= n <= 95 else (0.12 if 25 <= n < 40 or 95 < n <= 150 else 0.0)

    # 3. 反空话模板 (0.20)
    low = reply.lower()
    empty_hit = any(p.lower() in low for p in EMPTY)
    empty = 0.0 if empty_hit else 0.20

    # 4. 洞察与行动建议 (0.35) —— 严格按语言匹配，禁止中英混杂刷分
    body_no_tags = re.sub(r"</?(think|reply)>", "", t)
    if zh:
        pattern_hits = sum(1 for p in PATTERN_ZH if p in reply)
        action_hits = sum(1 for p in ACTION_ZH if p in reply)
        lang_mix_pen = -0.35 if re.search(r"[A-Za-z]{2,}", body_no_tags) else 0.0
    else:
        pattern_hits = sum(1 for p in PATTERN_EN if p in low)
        action_hits = sum(1 for p in ACTION_EN if p in low)
        lang_mix_pen = -0.35 if re.search(r"[\u4e00-\u9fff。，！？]", body_no_tags) else 0.0

    # 防作弊惩罚：堆砌关键词刷分直接扣分
    hack_pen = -0.15 if (pattern_hits >= 3 or action_hits >= 3) else 0.0

    insight = 0.20 if (("你" in reply if zh else "you" in low) and 1 <= pattern_hits <= 2) else (0.05 if pattern_hits > 0 else 0.0)
    action = 0.15 if 1 <= action_hits <= 2 else (0.05 if action_hits > 2 else 0.0)

    # 5. 8-gram 复读惩罚 (-0.20)
    grams = [reply[i:i + 8] for i in range(0, max(0, len(reply) - 8), 4)]
    rep = 0.0
    if grams:
        top = Counter(grams).most_common(1)[0][1]
        ratio = top / len(grams)
        if ratio > 0.25:
            rep = -0.20

    # 6. 思考链临床推演加分 (最高 0.05 额外奖励)
    th_depth = 0.0
    if think:
        clinical_keywords = ["情绪", "防御", "恐惧", "需要", "接纳", "潜台词", "未说", "安全感", "认知", "困扰", "压力", "委屈"]
        if sum(1 for k in clinical_keywords if k in think) >= 2:
            th_depth = 0.05

    return max(0.0, min(1.0, fmt + length + empty + insight + action + rep + hack_pen + lang_mix_pen + th_depth))


def load_model(path):
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(path)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    tok.padding_side = "left"
    if (Path(path) / "adapter_config.json").exists():
        from peft import PeftModel
        base_cfg = json.loads((Path(path) / "adapter_config.json").read_text(encoding="utf-8"))
        model = AutoModelForCausalLM.from_pretrained(
            base_cfg["base_model_name_or_path"],
            torch_dtype=torch.bfloat16, low_cpu_mem_usage=True, attn_implementation="sdpa"
        )
        model = PeftModel.from_pretrained(model, path)
        model = model.merge_and_unload()
    else:
        model = AutoModelForCausalLM.from_pretrained(
            path, torch_dtype=torch.bfloat16, low_cpu_mem_usage=True, attn_implementation="sdpa"
        )
    model.to("cuda").eval()
    return model, tok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=str(ROOT / "out" / "sft" / "final"))
    ap.add_argument("--prompts", default=str(ROOT / "data" / "sft.jsonl"))
    ap.add_argument("--n", type=int, default=4)
    ap.add_argument("--num", type=int, default=3000)
    ap.add_argument("--max_new", type=int, default=260)
    ap.add_argument("--out", default=str(ROOT / "data" / "prefs.jsonl"))
    args = ap.parse_args()

    model, tok = load_model(args.model)

    prompts = []
    seen = set()
    with Path(args.prompts).open(encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            msgs = r.get("messages") or []
            users = [m["content"] for m in msgs if m.get("role") == "user"]
            if not users:
                continue
            q = users[0][:400]
            if q in seen:
                continue
            seen.add(q)
            prompts.append(q)
            if len(prompts) >= args.num:
                break
    print(f"prompt {len(prompts)} 条 × 采样 {args.n}", flush=True)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    def flush_files(prefs_list, rft_list, grpo_list):
        with out.open("w", encoding="utf-8") as f:
            for r in prefs_list:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        with out.with_name("rft.jsonl").open("w", encoding="utf-8") as f:
            for r in rft_list:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        with out.with_name("prompts.jsonl").open("w", encoding="utf-8") as f:
            for r in grpo_list:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

    prefs, rft, grpo = [], [], []
    batch_size = 8
    for b_start in range(0, len(prompts), batch_size):
        batch_qs = prompts[b_start:b_start + batch_size]
        texts = [
            tok.apply_chat_template(
                [{"role": "system", "content": SYS}, {"role": "user", "content": q}],
                tokenize=False, add_generation_prompt=True,
            )
            for q in batch_qs
        ]
        expanded_texts = [t for t in texts for _ in range(args.n)]
        enc = tok(expanded_texts, return_tensors="pt", padding=True).to("cuda")
        with torch.no_grad():
            outs = model.generate(
                **enc, max_new_tokens=args.max_new, do_sample=True, temperature=0.9,
                top_p=0.95, repetition_penalty=1.08, pad_token_id=tok.pad_token_id,
            )
        in_len = enc["input_ids"].shape[1]
        all_cands = [tok.decode(o[in_len:], skip_special_tokens=True) for o in outs]

        for i, q in enumerate(batch_qs):
            text = texts[i]
            cands = all_cands[i * args.n:(i + 1) * args.n]
            scores = [score_reply(c) for c in cands]
            best = max(range(len(cands)), key=lambda k: scores[k])
            worst = min(range(len(cands)), key=lambda k: scores[k])
            if scores[best] - scores[worst] >= 0.15:
                prefs.append({"prompt": text, "chosen": cands[best], "rejected": cands[worst],
                              "score_gap": round(scores[best] - scores[worst], 3)})
            rft.append({"messages": [
                {"role": "system", "content": SYS},
                {"role": "user", "content": q},
                {"role": "assistant", "content": cands[best]},
            ]})
            grpo.append({"prompt": text})

        done = min(b_start + batch_size, len(prompts))
        if done % 40 == 0 or done == len(prompts):
            flush_files(prefs, rft, grpo)
            print(f"  {done}/{len(prompts)} | 当前偏好对 {len(prefs)}", flush=True)

    print(f"偏好对 {len(prefs)} -> {out} | RFT {len(rft)} | GRPO prompts {len(grpo)}", flush=True)


if __name__ == "__main__":
    main()
