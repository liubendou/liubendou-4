# 六本豆 4.0 交接包

给「训练机」（RTX 5070 12GB / R9 / 24GB DDR5）上的 agent 使用。

## 目录

```
base/         Llama-3.2-1B-Instruct 完整权重（2.4GB，已含 tokenizer）
corpus/       原始语料：SoulChat-R1(74MB) / CounselChat / ESConv
data/         sft.jsonl（v3 现成 119 万 token，可直接做 smoke test）
code/         全部训练脚本 + 数据构建 + 评测 + 导出
app_src/      桌面端源码（不含 node_modules/dist/release）
env/          环境安装脚本与依赖清单
SPEC_v4.md    4.0 规格说明（先读这个）
```

## 快速开始（按顺序）

1. **装环境**（管理员 PowerShell）：
   ```powershell
   powershell -ExecutionPolicy Bypass -File env\setup.ps1
   ```
2. **自检**（1 分钟，确认 CUDA 可用）：
   ```powershell
   python code\check_env.py
   ```
3. **冒烟训练**（用现成的 data\sft.jsonl，只跑 20 步，约 3 分钟）：
   ```powershell
   python code\train_sft.py --data data\sft.jsonl --seq 512 --batch 1 --accum 2 --max_steps 20 --out out\smoke
   ```
   验收：显存 < 11GB、loss 有下降、`out\smoke\final` 生成。
4. **构建 4.0 数据**（约 8.5M token，10–20 分钟）：
   ```powershell
   python code\build_sft.py --zh 4500000 --en 1600000 --syn 2400000 --out data\sft_v4.jsonl
   ```
5. **按 SPEC_v4.md 第 4 节依次执行** SFT → selfplay → DPO → GRPO → RFT → export。

## 注意事项

- Blackwell 必须 CUDA 12.8 版 PyTorch，普通 cu121 会报 `no kernel image`。
- 脚本路径都相对本目录，**不要移动 code/ 与 data/ 的关系**。
- 训练日志请写到 `logs\`，每阶段结束保留 `out/` 下的 checkpoint。
- 生成式阶段（selfplay / GRPO）显存峰值最高，先用 `--num 50` 小规模验证。
- 训练机不需要联网推理，也不需要安装 Electron。

## 与本机（交付机）的关系

- 本机负责：桌面端改造（llama.cpp 后端）、打包 exe、记忆系统。
- 训练机负责：模型训练与 GGUF 导出。
- 交接物：`release/liubendou-4.0-q4km.gguf` + `tokenizer.json` + `meta.json` + `report.md`。

## 要不要等 v3 训练完？

**不用。** v4.0 从基座重新训练，不依赖 v3 的 LoRA 权重；v3 的 checkpoint 只作为对照基线。
训练机上可以立即开始，两个训练任务互不冲突（v3 在本机 970 上跑，v4 在训练机上跑）。
