# -*- coding: utf-8 -*-
r"""构建 4.0 SFT 数据：真实咨询语料 + 自研合成人设 + 身份样本。
用法：python code\build_sft.py --zh 4500000 --en 1600000 --syn 2400000 --out data\sft_v4.jsonl
"""
import argparse
import csv
import json
import random
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CORPUS = ROOT / "corpus"

SYS = (
    "你是六本豆，由广州六本豆人工智能科技有限公司训练的本地心理陪伴模型。"
    "用与用户相同的语言回答，先读懂对方没说出口的部分，再用一段自然、直接的话回应，不要列清单。"
)


def clean(s):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s[:600]


def extract(s, tag):
    m = re.search(rf"<{tag}>(.*?)</{tag}>", s, re.S)
    return m.group(1).strip() if m else ""


def parse_synth(s):
    msgs = []
    for part in s.split("<u>")[1:]:
        if "<a>" not in part:
            continue
        user, rest = part.split("<a>", 1)
        t, i = extract(rest, "think"), extract(rest, "insight")
        p, a = extract(rest, "pierce"), extract(rest, "advice")
        if not user.strip() or not a:
            continue
        msgs.append({"role": "user", "content": clean(user)})
        msgs.append({"role": "assistant", "content": f"<think>{t}{i}</think><reply>{p}{a}</reply>"})
    return msgs


def derive_counseling_think(user_msg, assistant_msg, lang="zh"):
    """为真实咨询对话动态生成心智推演与临床思考链，使全量 SFT 语料严格遵循 <think>...</think><reply>...</reply> 统一协议。"""
    u = clean(user_msg)
    a = clean(assistant_msg)
    if lang == "zh":
        cues = []
        if any(w in u for w in ["累", "疲惫", "耗竭", "透支", "撑不下"]): cues.append("身心能量耗竭与重度疲惫")
        if any(w in u for w in ["怕", "恐惧", "害怕", "焦虑", "慌", "紧张"]): cues.append("对失控、被评价或未知的隐秘恐惧")
        if any(w in u for w in ["烦", "乱", "纠结", "不知道怎么办", "困惑"]): cues.append("内心拉扯与方向迷失")
        if any(w in u for w in ["委屈", "难受", "难过", "伤心", "哭", "心痛"]): cues.append("被忽视的情感委屈与隐蔽伤痛")
        if any(w in u for w in ["压力", "催", "逼", "期待", "要求", "指标"]): cues.append("外界严苛期待与内在不配得感的冲突")
        if any(w in u for w in ["一个人", "孤独", "没人懂", "排挤", "被冷落"]): cues.append("缺乏情感支撑的深层孤立感")
        
        focus = "、".join(cues[:2]) if cues else "当前表述背后的潜在情绪与未言明需要"
        
        # 识别咨询师当前轮的回应意图
        if "？" in a or "?" in a:
            strategy = "温和探询，帮助对方把模糊的窒息感具体化为可觉察的症结"
        elif any(w in a for w in ["确实", "听得出来", "感觉得到", "不容易", "理解", "正常"]):
            strategy = "共情与积极关注，先稳稳接纳并托住情绪，不做评判"
        elif any(w in a for w in ["其实", "尝试", "看看", "可以先", "或许"]):
            strategy = "认知重构，温和点出认知盲区，给出一个安全的微小支点"
        else:
            strategy = "倾听与反射，陪伴对方澄清内在感受"
            
        return f"来访者正经历{focus}。话里没说出口的潜台词往往是痛点所在。本次回应采用{strategy}，不急于讲大道理，先建立心理安全感。"
    else:
        return "The user expresses implicit emotional distress. Avoid pre-mature lecturing; acknowledge what is unsaid, provide steady empathy, and guide clarity through safe exploration."


def soulchat(max_tokens, tok):
    cases = {}
    with (CORPUS / "soulchat_r1_turns.jsonl").open(encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            cases.setdefault(r["case_id"], []).append(r)
    rows, used = [], 0
    for _, turns in cases.items():
        turns.sort(key=lambda x: x.get("turn_id", 0))
        msgs = []
        last_user = ""
        for t in turns:
            role = "user" if t.get("speaker") == "client" else "assistant"
            text = clean(t.get("utterance"))
            if not text:
                continue
            if role == "user":
                last_user = text
                msgs.append({"role": "user", "content": text})
            else:
                think = derive_counseling_think(last_user, text, "zh")
                msgs.append({"role": "assistant", "content": f"<think>{think}</think><reply>{text}</reply>"})
        if len(msgs) < 2 or msgs[0]["role"] != "user":
            continue
        n = len(tok("".join(m["content"] for m in msgs)).input_ids)
        rows.append({"messages": [{"role": "system", "content": SYS}] + msgs})
        used += n
        if used >= max_tokens:
            break
    return rows, used


def counsel(max_tokens, tok):
    rows, used = [], 0
    with (CORPUS / "counsel_chat.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            q, a = clean(r.get("questionText")), clean(r.get("answerText"))
            if len(q) < 15 or len(a) < 30:
                continue
            think = derive_counseling_think(q, a, "en")
            rows.append({"messages": [
                {"role": "system", "content": SYS},
                {"role": "user", "content": q},
                {"role": "assistant", "content": f"<think>{think}</think><reply>{a}</reply>"},
            ]})
            used += len(tok(q + a).input_ids)
            if used >= max_tokens:
                break
    return rows, used


def esconv(max_tokens, tok):
    rows, used = [], 0
    data = json.loads((CORPUS / "esconv.json").read_text(encoding="utf-8"))
    for d in data:
        msgs = []
        last_user = ""
        for t in d.get("dialog", []):
            txt = clean(t.get("content"))
            if not txt:
                continue
            role = "user" if t.get("speaker") == "seeker" else "assistant"
            if role == "user":
                last_user = txt
                msgs.append({"role": "user", "content": txt})
            else:
                think = derive_counseling_think(last_user, txt, "en")
                msgs.append({"role": "assistant", "content": f"<think>{think}</think><reply>{txt}</reply>"})
        if len(msgs) < 2 or msgs[0]["role"] != "user":
            continue
        rows.append({"messages": [{"role": "system", "content": SYS}] + msgs})
        used += len(tok("".join(m["content"] for m in msgs)).input_ids)
        if used >= max_tokens:
            break
    return rows, used


IDENTITY = [
    ("你是谁？", "我是六本豆，由广州六本豆人工智能科技有限公司训练的本地心理陪伴模型。"),
    ("你叫什么名字？", "我叫六本豆。"),
    ("谁训练了你？", "广州六本豆人工智能科技有限公司。"),
    ("你是哪个公司的？", "我是广州六本豆人工智能科技有限公司的产品。"),
    ("你能做什么？", "陪你聊，帮你把心里没说出口的那部分看清楚。"),
    ("你和别的 AI 有什么不同？", "我不急着给建议，我先听你话里没说的那部分。"),
    ("你会说英语吗？", "会，你用英文问，我就用英文答。"),
    ("Who are you?", "I am Liubendou, a local psychological companion model trained by Guangzhou Liubendou AI Technology Co., Ltd."),
    ("What can you do?", "I listen for what you did not say, then answer plainly."),
]


def identity_rows():
    return [{"messages": [
        {"role": "system", "content": SYS},
        {"role": "user", "content": q},
        {"role": "assistant",
         "content": f"<think>这个问题是在问身份，直接答，不绕。</think><reply>{a}</reply>"},
    ]} for q, a in IDENTITY]


def synth_rows(max_tokens, tok, seed):
    sys.path.insert(0, str(HERE))
    import gen_data
    rng = random.Random(seed)
    rows, used = [], 0
    while used < max_tokens:
        s = gen_data.make_zh(rng) if rng.random() < 0.72 else gen_data.make_en(rng)
        msgs = parse_synth(s)
        if not msgs:
            continue
        rows.append({"messages": [{"role": "system", "content": SYS}] + msgs})
        used += len(tok("".join(m["content"] for m in msgs)).input_ids)
    return rows, used


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zh", type=int, default=4500000)
    ap.add_argument("--en", type=int, default=1600000)
    ap.add_argument("--syn", type=int, default=2400000)
    ap.add_argument("--out", default=str(ROOT / "data" / "sft_v4.jsonl"))
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    from transformers import AutoTokenizer
    tok = AutoTokenizer.from_pretrained(str(ROOT / "base" / "Llama-3.2-1B-Instruct"))

    parts = []
    for name, fn, budget in (
        ("soulchat", soulchat, args.zh),
        ("counsel", counsel, args.en // 2),
        ("esconv", esconv, args.en // 2),
        ("synth", lambda b, t: synth_rows(b, t, args.seed), args.syn),
    ):
        rows, n = fn(budget, tok)
        parts += rows
        print(f"{name}: {len(rows)} 条 / {n/1e6:.2f}M token", flush=True)
    parts += identity_rows()

    random.Random(args.seed).shuffle(parts)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        for r in parts:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"写出 {out}：{len(parts)} 个样本", flush=True)


if __name__ == "__main__":
    main()
