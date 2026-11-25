# -*- coding: utf-8 -*-
"""固定评测集：40 条场景，规则打分 + 生成报告。"""
import argparse
import json
from pathlib import Path

import torch

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

SYS = (
    "你是六本豆，由广州六本豆人工智能科技有限公司训练的本地心理陪伴模型。"
    "用与用户相同的语言回答，先读懂对方没说出口的部分，再用一段自然、直接的话回应，不要列清单。"
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=str(ROOT / "out" / "rft2" / "final"))
    ap.add_argument("--prompts", default=str(ROOT / "data" / "eval_prompts.jsonl"))
    ap.add_argument("--out", default=str(ROOT / "report.md"))
    args = ap.parse_args()

    from selfplay import score_reply, load_model
    model, tok = load_model(args.model)
    rows = [json.loads(l) for l in Path(args.prompts).open(encoding="utf-8")]

    results = []
    for r in rows:
        text = tok.apply_chat_template(
            [{"role": "system", "content": SYS}, {"role": "user", "content": r["text"]}],
            tokenize=False, add_generation_prompt=True,
        )
        enc = tok(text, return_tensors="pt").to("cuda")
        with torch.no_grad():
            out = model.generate(**enc, max_new_tokens=260, do_sample=False,
                                 repetition_penalty=1.08, pad_token_id=tok.pad_token_id)
        reply = tok.decode(out[0][enc["input_ids"].shape[1]:], skip_special_tokens=True)
        results.append({**r, "output": reply, "score": round(score_reply(reply), 3)})

    avg = sum(x["score"] for x in results) / len(results)
    fmt_ok = sum(1 for x in results if "<reply>" in x["output"] and "</reply>" in x["output"])
    lines = [
        "# 六本豆 4.0 评测报告", "",
        f"- 样本数：{len(results)}",
        f"- 规则平均分：**{avg:.3f}**（通过线 0.70）",
        f"- 格式完整率：**{fmt_ok}/{len(results)}**",
        "", "## 明细", "",
        "| id | 类别 | 分数 | 用户 | 回复 |", "|---|---|---|---|---|",
    ]
    for x in results:
        u = x["text"].replace("|", "/")
        o = x["output"].replace("\n", " ").replace("|", "/")[:220]
        lines.append(f"| {x['id']} | {x['cat']} | {x['score']} | {u} | {o} |")

    Path(args.out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    Path(args.out).with_suffix(".json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"平均分 {avg:.3f} | 格式 {fmt_ok}/{len(results)} -> {args.out}", flush=True)


if __name__ == "__main__":
    main()
