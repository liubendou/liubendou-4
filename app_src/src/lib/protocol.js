// 解析模型输出：<think>…</think><reply>…</reply>
// 思考折叠展示，回复自然成段；不再拆分「洞察/戳破/建议」标签。
export function parseProtocol(raw = '') {
  const text = String(raw)
    .replace(/<bos>/g, '')
    .replace(/<eos>/g, '')
    .replace(/<u>/g, '')
    .replace(/<a>/g, '')
  const res = { think: '', reply: '', active: null, done: false }

  const tOpen = text.indexOf('<think>')
  if (tOpen >= 0) {
    const start = tOpen + 7
    const tClose = text.indexOf('</think>', start)
    if (tClose >= 0) res.think = text.slice(start, tClose).trim()
    else {
      res.think = text.slice(start).replace(/<reply>[\s\S]*$/, '').trim()
      res.active = 'think'
    }
  }

  const rOpen = text.indexOf('<reply>')
  if (rOpen >= 0) {
    const start = rOpen + 7
    const rClose = text.indexOf('</reply>', start)
    if (rClose >= 0) res.reply = text.slice(start, rClose).trim()
    else {
      res.reply = text.slice(start).trim()
      res.active = 'reply'
    }
  } else if (tOpen >= 0) {
    // 模型偶尔省略 <reply>：把 </think> 之后的内容当作回复
    const tClose = text.indexOf('</think>')
    if (tClose >= 0) {
      res.reply = text.slice(tClose + 8).trim()
      if (res.reply) res.active = 'reply'
    }
  } else {
    res.reply = text.trim()
    if (res.reply) res.active = 'reply'
  }

  res.done = text.includes('</reply>') || text.includes('<eos>')
  if (res.done) res.active = null
  return res
}

export function plainText(parsed) {
  const parts = []
  if (parsed.think) parts.push(`【思考】${parsed.think}`)
  if (parsed.reply) parts.push(parsed.reply)
  return parts.join('\n\n')
}
