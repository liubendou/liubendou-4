// 推理层：优先用 4.1 版 10 亿大模型（1B GGUF 原生全离线静默推理）；
// 其次回退到 ONNX 23M 轻量模型；缺模型时退回到内置演示话术。
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const { spawn } = require('child_process')
const { BPETokenizer } = require('./bpe.cjs')
const { fallbackReply } = require('./fallback.cjs')

const state = {
  status: 'unloaded',
  engineType: 'none', // 'gguf' | 'onnx' | 'fallback'
  reason: '',
  port: null,
  proc: null,
  tokenizer: null,
  session: null,
  ort: null,
  meta: null,
  loadPromise: null,
}

function cleanup() {
  if (state.proc) {
    try {
      state.proc.kill()
    } catch {}
    state.proc = null
  }
}

process.on('exit', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

function resourceDir() {
  const candidates = [
    path.join(process.resourcesPath || '', 'resources'),
    process.resourcesPath || '',
    path.join(__dirname, '..', 'resources'),
    path.join(__dirname, 'resources'),
  ]
  for (const c of candidates) {
    if (
      c &&
      (fs.existsSync(path.join(c, 'model.gguf')) ||
        fs.existsSync(path.join(c, 'model.onnx')))
    ) {
      return c
    }
  }
  return path.join(__dirname, '..', 'resources')
}

async function waitPortReady(port, maxTries = 35) {
  for (let i = 0; i < maxTries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
          if (res.statusCode === 200) resolve()
          else reject(new Error('status ' + res.statusCode))
        })
        req.on('error', reject)
        req.setTimeout(500, () => req.destroy())
      })
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  return false
}

async function init() {
  if (state.status !== 'unloaded') return state
  if (state.loadPromise) return state.loadPromise
  state.loadPromise = (async () => {
    const dir = resourceDir()
    const ggufPath = path.join(dir, 'model.gguf')
    const serverExe = path.join(dir, 'llama-server.exe')

    // 1. 优先尝试启动 1B GGUF 原生静默推理服务
    if (fs.existsSync(ggufPath) && fs.existsSync(serverExe)) {
      try {
        const port = 18900 + Math.floor(Math.random() * 900)
        const threads = Math.max(2, Math.min(8, os.cpus().length || 4))
        const proc = spawn(
          serverExe,
          ['-m', 'model.gguf', '-c', '2048', '--port', String(port), '-t', String(threads), '--log-disable'],
          { cwd: dir, windowsHide: true, stdio: 'ignore' }
        )
        proc.on('error', (err) => console.error('[engine] llama-server spawn error:', err))

        const ready = await waitPortReady(port, 40)
        if (ready) {
          state.port = port
          state.proc = proc
          state.engineType = 'gguf'
          state.status = 'model'
          state.reason = ''
          if (fs.existsSync(path.join(dir, 'meta.json'))) {
            try {
              state.meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'))
            } catch {}
          }
          return state
        } else {
          try { proc.kill() } catch {}
        }
      } catch (err) {
        console.warn('[engine] GGUF 启动失败，尝试降级:', err)
      }
    }

    // 2. 备选方案：23M ONNX 原生推理
    const modelPath = path.join(dir, 'model.onnx')
    if (fs.existsSync(modelPath)) {
      try {
        let ort
        try {
          ort = require('onnxruntime-node')
        } catch (err) {
          const altPath = path.join(
            process.resourcesPath || '',
            'app.asar.unpacked',
            'node_modules',
            'onnxruntime-node'
          )
          if (fs.existsSync(altPath)) {
            ort = require(altPath)
          } else {
            throw err
          }
        }
        const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'))
        const tokenizer = new BPETokenizer(path.join(dir, 'tokenizer.json'))
        const session = await ort.InferenceSession.create(modelPath, {
          executionProviders: ['cpu'],
          intraOpNumThreads: Math.max(2, Math.min(8, os.cpus().length)),
          graphOptimizationLevel: 'all',
        })
        state.ort = ort
        state.meta = meta
        state.tokenizer = tokenizer
        state.session = session
        state.status = 'model'
        state.engineType = 'onnx'
        state.reason = ''
        return state
      } catch (e) {
        state.status = 'fallback'
        state.reason = `模型加载失败：${e.message}`
      }
    } else {
      state.status = 'fallback'
      state.reason = '未找到模型文件，当前为内置演示话术'
    }

    return state
  })()
  return state.loadPromise
}

async function chatGGUF({ messages, onDelta, isCancelled }) {
  return new Promise((resolve, reject) => {
    const sysPrompt =
      '你是六本豆，由广州六本豆人工智能科技有限公司训练的本地心理陪伴模型。用与用户相同的语言回答，先读懂对方没说出口的部分，再用一段自然、直接的话回应，不要列清单。'

    const postData = JSON.stringify({
      messages: [
        { role: 'system', content: sysPrompt },
        ...messages.map((m) => ({ role: m.role, content: String(m.content || '') })),
      ],
      temperature: 0.72,
      max_tokens: 260,
      stream: true,
    })

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: state.port,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let full = ''
        res.on('data', (chunk) => {
          if (isCancelled && isCancelled()) {
            req.destroy()
            return resolve({ engine: 'model' })
          }
          const lines = chunk.toString().split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
              try {
                const json = JSON.parse(line.slice(6))
                const delta = json.choices[0]?.delta?.content || ''
                full += delta
                onDelta(delta)
              } catch {}
            }
          }
        })
        res.on('end', () => resolve({ engine: 'model' }))
      }
    )
    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

// ONNX 生成逻辑（兼容旧版 23M ONNX）
const LOCK_ZH =
  '<bos><u>请用中文回答，简短一点。<a><think>用户说中文，我也说中文。</think><reply>好，我用中文。</reply>'
const LOCK_EN =
  '<bos><u>Answer in English, briefly.<a><think>The user speaks English.</think><reply>Sure.</reply>'

function isChinese(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ''))
}

function lastUser(messages) {
  return messages.filter((m) => m.role === 'user').pop()
}

function buildPrompt(messages, tokenizer, maxPromptTokens) {
  const usable = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
  const lock = isChinese(lastUser(messages)?.content) ? LOCK_ZH : LOCK_EN
  let start = Math.max(0, usable.length - 6)
  while (start < usable.length) {
    let s = lock
    for (const m of usable.slice(start)) {
      if (m.role === 'user') s += `<u>${String(m.content).trim().slice(-280)}<a>`
      else s += `<reply>${String(m.content).trim().slice(0, 320)}</reply>`
    }
    if (!s.endsWith('<a>')) s += '<a>'
    if (tokenizer.encode(s).length <= maxPromptTokens || start >= usable.length - 1) return s
    start += 2
  }
  return '<bos><a>'
}

function sampleTopK(logits, temperature, topK) {
  const V = logits.length
  const K = Math.min(topK, V)
  const bestVal = new Float32Array(K)
  const bestIdx = new Int32Array(K)
  for (let i = 0; i < K; i++) {
    bestVal[i] = -Infinity
    bestIdx[i] = 0
  }
  for (let v = 0; v < V; v++) {
    const x = logits[v] / temperature
    if (x <= bestVal[K - 1]) continue
    let j = K - 2
    while (j >= 0 && x > bestVal[j]) {
      bestVal[j + 1] = bestVal[j]
      bestIdx[j + 1] = bestIdx[j]
      j -= 1
    }
    bestVal[j + 1] = x
    bestIdx[j + 1] = v
  }
  let maxV = -Infinity
  for (let i = 0; i < K; i++) if (bestVal[i] > maxV) maxV = bestVal[i]
  const probs = new Float32Array(K)
  let sum = 0
  for (let i = 0; i < K; i++) {
    const p = Math.exp(bestVal[i] - maxV)
    probs[i] = p
    sum += p
  }
  let r = Math.random() * sum
  for (let i = 0; i < K; i++) {
    r -= probs[i]
    if (r <= 0) return bestIdx[i]
  }
  return bestIdx[K - 1]
}

function zhMasked(logits, tokenizer) {
  const copy = new Float32Array(logits)
  for (const id of tokenizer.latinIds) copy[id] = -Infinity
  return copy
}

async function generateONNX({ messages, onDelta, isCancelled, maxNewTokens = 160, temperature = 0.78, topK = 40 }) {
  const { ort, session, tokenizer, meta } = state
  tokenizer.flush()
  const cfg = meta.config
  const nLayer = cfg.n_layer
  const nKvHead = cfg.n_kv_head || cfg.n_head
  const headDim = cfg.n_embd / cfg.n_head
  const zhOut = isChinese(lastUser(messages)?.content)
  const enOut = !zhOut
  const emit = (s) =>
    onDelta(
      enOut
        ? s.replace(/。/g, '. ').replace(/(\s*\.\s*){2,}/g, '. ').replace(/\.\s+(?=[,.;:'")])/g, '.')
        : s
    )

  const prompt = buildPrompt(messages, tokenizer, Math.max(120, cfg.block_size - maxNewTokens))
  const promptIds = tokenizer.encode(prompt)

  let past = null
  let inputIds = promptIds
  let text = ''
  let sent = ''
  const recent = []
  const eosId = tokenizer.idOf('<eos>')
  const stopTags = ['</reply>', '<bos>', '<u>', '<a>', '<eos>']

  for (let step = 0; step < maxNewTokens; step++) {
    if (isCancelled && isCancelled()) break
    if (promptIds.length + step >= cfg.block_size) break
    const feeds = {}
    feeds.idx = new ort.Tensor('int64', BigInt64Array.from(inputIds.map((x) => BigInt(x))), [
      1,
      inputIds.length,
    ])
    for (let i = 0; i < nLayer; i++) {
      if (past) {
        feeds[`past_key_${i}`] = past[`present_key_${i}`]
        feeds[`past_value_${i}`] = past[`present_value_${i}`]
      } else {
        feeds[`past_key_${i}`] = new ort.Tensor('float32', new Float32Array(0), [1, nKvHead, 0, headDim])
        feeds[`past_value_${i}`] = new ort.Tensor('float32', new Float32Array(0), [1, nKvHead, 0, headDim])
      }
    }
    const out = await session.run(feeds)
    past = out
    const lastLogits = out.logits.data.subarray(
      (out.logits.dims[1] - 1) * cfg.vocab_size,
      out.logits.dims[1] * cfg.vocab_size
    )
    let logits = lastLogits
    if (zhOut) logits = zhMasked(lastLogits, tokenizer)
    for (const id of new Set(recent)) {
      if (id >= 9) logits[id] -= 1.4
    }
    let next = sampleTopK(logits, temperature, topK)
    if (next === eosId && text.length < 12) next = await pickAlternative(logits, eosId, temperature, topK)
    if (next === eosId) break
    recent.push(next)
    if (recent.length > 48) recent.shift()
    inputIds = [next]
    const piece = tokenizer.decodeStep(next)
    text += piece
    const stopAt = stopTags.map((t) => text.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0]
    if (stopAt !== undefined) {
      const cut = text.slice(0, stopAt)
      if (cut.length > sent.length) emit(cut.slice(sent.length))
      sent = cut
      break
    }
    if (text.length > sent.length) {
      emit(text.slice(sent.length))
      sent = text
    }
  }
  return text
}

async function pickAlternative(logits, blocked, temperature, topK) {
  const copy = new Float32Array(logits)
  copy[blocked] = -Infinity
  return sampleTopK(copy, temperature, topK)
}

async function chat({ messages, onDelta, isCancelled }) {
  await init()
  if (state.status === 'model') {
    if (state.engineType === 'gguf') {
      try {
        await chatGGUF({ messages, onDelta, isCancelled })
        return { engine: 'model' }
      } catch (e) {
        console.error('[engine] GGUF 生成中断，降级处理:', e)
      }
    } else if (state.engineType === 'onnx') {
      try {
        await generateONNX({ messages, onDelta, isCancelled })
        return { engine: 'model' }
      } catch (e) {
        console.error('[engine] ONNX 生成中断，降级处理:', e)
      }
    }
  }
  const text = fallbackReply(messages)
  for (const ch of chunkText(text)) {
    if (isCancelled && isCancelled()) break
    onDelta(ch)
    await sleep(18)
  }
  return { engine: 'fallback' }
}

function chunkText(text) {
  const out = []
  let i = 0
  while (i < text.length) {
    const n = 2 + Math.floor(Math.random() * 3)
    out.push(text.slice(i, i + n))
    i += n
  }
  return out
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function info() {
  return {
    status: state.status,
    engine: state.engineType,
    reason: state.reason,
    device: process.platform,
    params: state.meta ? (state.meta.params || 1000) : null,
    vocab: state.meta ? (state.meta.config?.vocab_size || 128256) : null,
  }
}

module.exports = { chat, info, init, cleanup }
