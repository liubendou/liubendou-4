# -*- coding: utf-8 -*-
"""把 LoRA adapter 合并回基座，输出可直接转 GGUF 的完整权重。"""
import argparse
import json
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    src = Path(args.model)
    if not (src / "adapter_config.json").exists():
        print("没有 adapter，直接复制目录")
        import shutil
        shutil.copytree(src, Path(args.out), dirs_exist_ok=True)
        return

    cfg = json.loads((src / "adapter_config.json").read_text(encoding="utf-8"))
    base = cfg["base_model_name_or_path"]
    print("基座:", base, flush=True)
    model = AutoModelForCausalLM.from_pretrained(base, torch_dtype=torch.bfloat16,
                                                 low_cpu_mem_usage=True)
    from peft import PeftModel
    model = PeftModel.from_pretrained(model, str(src))
    model = model.merge_and_unload()
    model.save_pretrained(args.out, safe_serialization=True)
    AutoTokenizer.from_pretrained(str(src)).save_pretrained(args.out)
    print("合并完成 ->", args.out, flush=True)


if __name__ == "__main__":
    main()
