// 纯 JS 的 ByteLevel BPE 分词器，直接读取 HuggingFace tokenizers 的 tokenizer.json。
// 这样打包 exe 时不需要任何原生分词依赖，也不会因为 Electron ABI 出问题。
const fs = require('fs')

function bytesToUnicode() {
  const bs = []
  for (let i = 33; i <= 126; i++) bs.push(i)
  for (let i = 161; i <= 172; i++) bs.push(i)
  for (let i = 174; i <= 255; i++) bs.push(i)
  const cs = bs.slice()
  let n = 0
  for (let b = 0; b < 256; b++) {
    if (!bs.includes(b)) {
      bs.push(b)
      cs.push(256 + n)
      n += 1
    }
  }
  const enc = new Map()
  const dec = new Map()
  for (let i = 0; i < bs.length; i++) {
    enc.set(bs[i], String.fromCharCode(cs[i]))
    dec.set(String.fromCharCode(cs[i]), bs[i])
  }
  return { enc, dec }
}

// GPT-2 / ByteLevel 默认预分词正则
const PRE_TOKENIZE =
  /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu

class BPETokenizer {
  constructor(jsonPath) {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    this.model = raw.model
    this.tokenToId = new Map()
    this.idToToken = new Map()
    for (const [tok, id] of Object.entries(raw.model.vocab)) {
      this.tokenToId.set(tok, id)
      this.idToToken.set(id, tok)
    }
    this.merges = new Map()
    const merges = raw.model.merges || []
    merges.forEach((m, i) => {
      const key = Array.isArray(m) ? `${m[0]} ${m[1]}` : m
      if (!this.merges.has(key)) this.merges.set(key, i)
    })

    this.added = []
    for (const t of raw.added_tokens || []) {
      this.added.push(t.content)
      if (!this.tokenToId.has(t.content)) {
        this.tokenToId.set(t.content, t.id)
        this.idToToken.set(t.id, t.content)
      }
    }
    this.added.sort((a, b) => b.length - a.length)
    this.special = new Set(this.added)
    this.unk = this.tokenToId.get('<unk>') ?? 0

    // 只含拉丁字母的词表 id，用于中文模式下的解码屏蔽
    this.latinIds = new Set()
    for (const [tok, id] of Object.entries(raw.model.vocab)) {
      if (/[A-Za-z]/.test(tok)) this.latinIds.add(id)
    }
    for (const t of raw.added_tokens || []) this.latinIds.delete(t.id)

    const { enc, dec } = bytesToUnicode()
    this.byteEncoder = enc
    this.byteDecoder = dec
    this._textDecoder = new TextDecoder('utf-8', { fatal: false })
  }

  _bpe(word) {
    let symbols = Array.from(word)
    while (symbols.length > 1) {
      let bestRank = Infinity
      let bestIdx = -1
      for (let i = 0; i < symbols.length - 1; i++) {
        const key = `${symbols[i]} ${symbols[i + 1]}`
        const rank = this.merges.get(key)
        if (rank !== undefined && rank < bestRank) {
          bestRank = rank
          bestIdx = i
        }
      }
      if (bestIdx < 0) break
      symbols.splice(bestIdx, 2, symbols[bestIdx] + symbols[bestIdx + 1])
    }
    return symbols.map((s) => (this.tokenToId.has(s) ? this.tokenToId.get(s) : this.unk))
  }

  _encodeSegment(text, out) {
    const matches = text.match(PRE_TOKENIZE) || []
    for (const m of matches) {
      const bytes = Buffer.from(m, 'utf8')
      let mapped = ''
      for (const b of bytes) mapped += this.byteEncoder.get(b)
      for (const id of this._bpe(mapped)) out.push(id)
    }
  }

  encode(text) {
    const ids = []
    let rest = text
    while (rest.length) {
      let hit = null
      for (const tok of this.added) {
        const idx = rest.indexOf(tok)
        if (idx >= 0 && (hit === null || idx < hit.idx)) hit = { idx, tok }
        if (hit && hit.idx === 0) break
      }
      if (!hit) {
        this._encodeSegment(rest, ids)
        break
      }
      if (hit.idx > 0) this._encodeSegment(rest.slice(0, hit.idx), ids)
      ids.push(this.tokenToId.get(hit.tok))
      rest = rest.slice(hit.idx + hit.tok.length)
    }
    return ids
  }

  // 单步流式解码：把 token 变成字节，交给持续性的 TextDecoder，
  // 这样被 BPE 拆开的 UTF-8 字节也能正确拼回中文。
  decodeStep(id) {
    const tok = this.idToToken.get(id)
    if (tok === undefined) return ''
    if (this.special.has(tok)) return this._textDecoder.decode() + tok
    const bytes = []
    for (const ch of tok) {
      const b = this.byteDecoder.get(ch)
      if (b !== undefined) bytes.push(b)
    }
    return this._textDecoder.decode(Uint8Array.from(bytes), { stream: true })
  }

  flush() {
    return this._textDecoder.decode()
  }

  idOf(tok) {
    return this.tokenToId.has(tok) ? this.tokenToId.get(tok) : this.unk
  }
}

module.exports = { BPETokenizer }
