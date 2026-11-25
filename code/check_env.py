# -*- coding: utf-8 -*-
"""环境自检：CUDA / 显卡架构 / 显存 / 依赖版本。"""
import sys

def main():
    import torch
    print("python :", sys.version.split()[0])
    print("torch  :", torch.__version__, "| cuda:", torch.version.cuda)
    print("cuda ok:", torch.cuda.is_available())
    if not torch.cuda.is_available():
        print("!! CUDA 不可用：请确认安装的是 cu128 版 torch，且驱动版本 >= 570")
        return
    i = torch.cuda.current_device()
    p = torch.cuda.get_device_properties(i)
    print(f"gpu    : {p.name} | sm_{p.major}{p.minor} | {p.total_memory/2**30:.1f} GB")
    if p.major < 12:
        print("!! 计算能力低于 sm_120，若为 5070 请检查是否装错 torch 源")
    x = torch.randn(2048, 2048, device="cuda", dtype=torch.bfloat16)
    torch.cuda.synchronize()
    import time
    t0 = time.time()
    for _ in range(5):
        y = x @ x
    torch.cuda.synchronize()
    print(f"bf16 matmul: {(time.time()-t0)/5*1000:.1f} ms / 2048^3")
    try:
        import bitsandbytes as bnb  # noqa
        print("bnb    :", bnb.__version__)
    except Exception as e:
        print("bnb    : 不可用（将回退 Adafactor）", e)
    for m in ("transformers", "peft", "trl", "datasets", "accelerate"):
        try:
            mod = __import__(m)
            print(f"{m:12}:", getattr(mod, "__version__", "?"))
        except Exception as e:
            print(f"{m:12}: 缺失 {e}")

if __name__ == "__main__":
    main()
