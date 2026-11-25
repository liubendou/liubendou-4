# 六本豆 4.0 训练规格说明

> 本文件是交给「训练机」（RTX 5070 12GB / Ryzen 9 / 24GB DDR5 双通道）上的 agent 的执行依据。
> 基座：Llama 3.2 1B Instruct（Meta 社区许可）。产品端只发布 Q4 量化模型，推理始终走 CPU。

---

## 1. 版本目标

| 维度 | 3.x 现状 | 4.0 目标 |
|---|---|---|
| 参数 | 1B，LoRA（r=16） | 1B，**全参数微调** + 后训练 |
| 上下文 | 256 | **2048**（RoPE 外推至 4096 可选） |
| 数据 | 119 万 token | **800–1000 万 token** |
| 后训练 | 仅 SFT | SFT → DPO → GRPO(规则奖励) → RFT 两轮 |
| 洞察准确率 | 未测 | **≥70%**（40 条评测集） |
| 空话率 | 高 | **<10%** |
| 回复长度 | 偏长 | **60–120 字** |
| 首字延迟（8GB 办公本） | ~2s | **<1.5s** |
| 用户记忆 | 无 | 本地画像 + 会话摘要（产品侧开发，不属模型训练） |

**不做**：联网、通用助手、医学诊断、替代专业治疗、教师模型蒸馏（本项目要求自研）。

---

## 2. 硬件分工

- 训练机（5070 12GB）：全参数 SFT、DPO、GRPO、RFT、GGUF 导出。
- 交付机（任意 8GB 内存 Windows）：只跑 Q4 推理，最低门槛不变。
- Blackwell 必须使用 **CUDA 12.8+** 的 PyTorch（sm_120），否则报 `no kernel image is available`。

显存预算（1B / bf16 / 全参数）：

| 项 | 占用 |
|---|---|
| 权重 | 2.5GB |
| 梯度 | 2.5GB |
| 8-bit AdamW 状态 | ~2.5GB |
| 激活（seq 2048, batch 1, 梯度检查点） | ~2GB |
| 峰值 | **~9.5–10.5GB** |

安全配置：`batch=1, accum=16, seq=2048`。若 OOM，依次降 `seq→1536`、改 LoRA。

---

## 3. 数据规格

| 来源 | 内容 | 预算（token） |
|---|---|---|
| SoulChat-R1 多轮 | 中文真实咨询 | 4,500,000 |
| CounselChat | 英文单轮咨询 | 800,000 |
| ESConv | 英文多轮支持对话 | 800,000 |
| 自研合成（gen_data.py） | 中文/英文人设与戳破语料 | 2,400,000 |
| 身份样本 | 名字/公司/能力/边界 | 50,000 |
| 合计 | | **≈ 8.55M** |

构建命令：

```powershell
python code\build_sft.py --zh 4500000 --en 1600000 --syn 2400000 --out data\sft_v4.jsonl
```

要求：
- 多轮样本必须保留完整轮次，不得截断成单问单答。
- 助手回复统一包在 `<reply>…</reply>`，内心推理包在 `<think>…</think>`。
- 合成数据占比不超过 30%，避免模板味。

---

## 4. 训练阶段

### 阶段 A：全参数 SFT（约 40–70 分钟）

```powershell
python code\train_sft.py --data data\sft_v4.jsonl --seq 2048 --batch 1 --accum 16 --lr 1e-5 --epochs 1 --out out\sft
```

- 优化器：bitsandbytes `AdamW8bit`；不可用时自动退回 Adafactor。
- 调度：WSD（前 3% 预热，末 15% 衰减到峰值 10%）。
- 每 100 步存盘，末步存 `out/sft/final`。
- 验收：val loss < 1.6；随机抽 8 条输出格式完整（含 `</reply>`）。

### 阶段 B：自博弈偏好数据（约 30 分钟）

```powershell
python code\selfplay.py --model out\sft\final --n 4 --num 3000 --out data\prefs.jsonl
```

- 对每个用户提问采样 4 条回复，用规则奖励打分。
- chosen = 最高分，rejected = 最低分；分差 <0.15 的样本丢弃。
- 同时输出 `data/rft.jsonl`（只保留最优轨迹，供阶段 D）。

### 阶段 C1：DPO（约 30–40 分钟）

```powershell
python code\train_dpo.py --model out\sft\final --data data\prefs.jsonl --beta 0.1 --out out\dpo
```

- 学习率 5e-7，1 epoch，参考模型冻结。
- 验收：chosen/rejected 的 reward margin 为正且逐步扩大。

### 阶段 C2：GRPO（规则奖励，2–3 小时，可选但推荐）

```powershell
python code\train_grpo.py --model out\dpo\final --data data\prompts.jsonl --out out\grpo
```

- 每个 prompt 采样 8 条，组内归一化优势。
- 显存不够时用 `--lora r=32`（GRPO 阶段允许回到 LoRA）。
- 奖励函数见第 5 节。

### 阶段 D：RFT 自博弈回炉（约 1 小时 ×2 轮）

```powershell
python code\selfplay.py --model out\grpo\final --n 4 --num 3000 --out data\prefs_r2.jsonl
python code\train_dpo.py --model out\grpo\final --data data\prefs_r2.jsonl --out out\rft1
```

第二轮对 `out\rft1\final` 重复一次。

### 阶段 E：导出

```powershell
powershell -ExecutionPolicy Bypass -File code\export_gguf.ps1 -Model out\rft2\final -Out release
```

产物：`release/liubendou-4.0-q4km.gguf`（约 700MB）+ `release/tokenizer.json` + `release/meta.json`。

---

## 5. 奖励函数（全部本地可算，无教师模型）

总分 = 0.25×格式 + 0.20×长度 + 0.20×反空话 + 0.20×洞察具体性 + 0.15×建议可执行 − 0.20×复读惩罚

| 项 | 规则 | 权重 |
|---|---|---|
| 格式 | `<think>…</think><reply>…</reply>` 均闭合，reply 非空 | 0.25 |
| 长度 | reply 60–120 字（英文 40–90 词）满分，<30 或 >200 扣分 | 0.20 |
| 反空话 | 命中「我理解你的感受/抱抱你/你要相信自己/一切都会好」等 12 条模板 → 0 分 | 0.20 |
| 洞察具体性 | reply 含第二人称 + 行为模式词（每次/总是/其实/怕/不敢/一直在） | 0.20 |
| 建议可执行 | 出现具体动作（今晚/这周/写下来/先说一句/拒绝一次） | 0.15 |
| 复读 | 8-gram 重复率 >0.25 扣分 | −0.20 |

完整实现见 `code/selfplay.py::score_reply`，GRPO 复用同一函数。

---

## 6. 评测

- 评测集：`data/eval_prompts.jsonl`，40 条（中文 32 / 英文 8），覆盖耗竭、亲密关系、家庭、职场、自我价值、丧失、社交焦虑、拖延。
- 命令：`python code\eval.py --model out\rft2\final --out report.md`
- 每个样本由规则打分 + 人工三项（是否听懂潜台词 / 戳破是否准确不冒犯 / 建议是否可执行）。
- 通过标准：规则平均分 ≥0.70；人工「听懂」≥70%；空话命中率 <10%。

---

## 7. 交付物清单（训练机 → 本机）

1. `release/liubendou-4.0-q4km.gguf`
2. `release/tokenizer.json`、`release/meta.json`（含 name/company/params/context/protocol）
3. `report.md`（评测结果）
4. `out/rft2/final/`（完整权重，留档，便于后续继续训练）

本机拿到后：替换 `app/resources/` 内的模型，改造 `electron/engine.cjs` 为 llama.cpp 后端，重新打包安装版 + 便携版。

---

## 8. 边界与合规

- 产品内保留「Built with Meta Llama 3.2」归属声明；不得宣称基座为完全自研。
- 六本豆 = 人格、数据管线、奖励函数、后训练流程、软件，这些是自研部分。
- 模型输出不得用于诊断或替代治疗；首次启动展示边界说明。
- 全部数据仅本地存放，训练产物不上传。

---

## 9. 风险与回退

| 风险 | 表现 | 回退 |
|---|---|---|
| Blackwell 驱动/CUDA 不匹配 | `no kernel image` | 装 CUDA 12.8 版 PyTorch |
| 全参数 OOM | 显存 >11.5GB | seq 1536 / batch 1 / 开 `--lora r=32` |
| DPO 后回复变短变呆 | 长度骤降 | beta 降到 0.05，混入 10% SFT 数据 |
| GRPO 不升反降 | 奖励震荡 | 降到 4 采样、只保留格式+反空话两项奖励 |
| 量化掉点 | Q4 后明显变差 | 用 imatrix 校准（export 脚本已含） |
