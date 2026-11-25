# 导出 GGUF（Q4_K_M）+ tokenizer/meta
# 用法：powershell -ExecutionPolicy Bypass -File code\export_gguf.ps1 -Model out\rft2\final -Out release
param(
  [string]$Model = "out\rft2\final",
  [string]$Out = "release",
  [string]$LlamaRoot = "..\llama.cpp"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force $Out | Out-Null

Write-Host "== 1/4 合并 LoRA =="
python code\merge_lora.py --model $Model --out "$Out\merged"

Write-Host "== 2/4 转为 f16 GGUF =="
if (-not (Test-Path $LlamaRoot)) { throw "找不到 llama.cpp，请先 git clone 并编译（见 SPEC 附录）" }
python "$LlamaRoot\convert_hf_to_gguf.py" "$Out\merged" --outfile "$Out\liubendou-4.0-f16.gguf" --outtype f16

Write-Host "== 3/4 量化 Q4_K_M =="
$q = Get-ChildItem "$LlamaRoot\build" -Recurse -Filter "llama-quantize.exe" | Select-Object -First 1
if (-not $q) { throw "找不到 llama-quantize.exe，请先编译 llama.cpp" }
& $q.FullName "$Out\liubendou-4.0-f16.gguf" "$Out\liubendou-4.0-q4km.gguf" Q4_K_M

Write-Host "== 4/4 写 tokenizer / meta =="
Copy-Item "$Out\merged\tokenizer.json" "$Out\tokenizer.json" -Force
@{
  name = "六本豆 4.0"
  company = "广州六本豆人工智能科技有限公司"
  base = "Llama-3.2-1B-Instruct (Built with Meta Llama 3.2)"
  file = "liubendou-4.0-q4km.gguf"
  context = 2048
  protocol = "<think>...</think><reply>...</reply>"
} | ConvertTo-Json -Depth 5 | Set-Content "$Out\meta.json" -Encoding UTF8

Write-Host "完成 -> $Out\liubendou-4.0-q4km.gguf"
