// 冒烟测试：直接调用 Electron 的推理层，验证 ONNX + 分词器 + 流式输出。
const path = require('path')
const engine = require(path.join(__dirname, '..', 'electron', 'engine.cjs'))

async function main() {
  const t0 = Date.now()
  await engine.init()
  console.log('info:', engine.info())

  let chunks = 0
  let text = ''
  let tFirst = null
  const messages = [{ role: 'user', content: process.argv[2] || '我最近特别累，什么都不想干' }]
  const res = await engine.chat({
    messages,
    onDelta: (d) => {
      if (!tFirst) tFirst = Date.now() - t0
      chunks += 1
      text += d
      process.stdout.write(d)
    },
    isCancelled: () => false,
  })
  const ms = Date.now() - t0
  console.log('\n\n' + '-'.repeat(60))
  console.log('引擎:', res.engine)
  console.log('首字延迟:', tFirst, 'ms')
  console.log('总耗时:', ms, 'ms', '分片:', chunks)
  console.log('字符数:', text.length, '速度:', (text.length / (ms / 1000)).toFixed(1), '字/秒')
  const hasThink = /<think>[\s\S]*?<\/think>/.test(text)
  const hasReply = /<reply>[\s\S]+/.test(text)
  const ok = hasThink && hasReply
  console.log('思考段:', hasThink ? 'YES' : 'NO', ' 回复段:', hasReply ? 'YES' : 'NO')
  console.log(ok ? '格式完整：PASS' : '格式不完整：FAIL')
  process.exit(ok ? 0 : 2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
