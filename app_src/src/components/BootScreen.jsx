import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const STAGES = ['启动内核', '载入分词器', '载入模型权重', '校准推理引擎']

export default function BootScreen({ visible, done }) {
  const [pct, setPct] = useState(12)
  const [stage, setStage] = useState(0)
  const [dismiss, setDismiss] = useState(false)
  const [minTimePassed, setMinTimePassed] = useState(false)

  // 保证至少展示 1.8 秒完整的模型加载仪式动画
  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), 1800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setStage((s) => {
        const next = (s + 1) % STAGES.length
        return next
      })
      setPct((p) => {
        if (p < 85) return p + Math.floor(Math.random() * 18 + 10)
        return p < 96 ? p + 2 : 96
      })
    }, 450)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (done && minTimePassed) {
      setPct(100)
      setStage(3)
      const t = setTimeout(() => setDismiss(true), 600)
      return () => clearTimeout(t)
    }
  }, [done, minTimePassed])

  return (
    <AnimatePresence>
      {visible && !dismiss && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-ink-950"
        >
          <div className="pointer-events-none absolute inset-0">
            <motion.div
              animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.7, 0.35] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint-400/[0.07] blur-3xl"
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
              className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]"
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col items-center"
          >
            <div className="relative mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-mint-400/25 bg-mint-400/[0.06]">
              <span className="font-serif text-[26px] leading-none text-mint-200">六</span>
              <motion.span
                animate={{ opacity: [0.25, 0.75, 0.25] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="absolute inset-0 rounded-2xl shadow-glow"
              />
            </div>

            <div className="text-[17px] font-medium tracking-tight text-mist-100">六本豆 · 心理模型加载中</div>
            <div className="mt-1.5 flex items-center gap-2 text-[12px] text-mist-500">
              <span className="inline-block h-1.5 w-1.5 animate-breathe rounded-full bg-mint-400" />
              <span>{STAGES[stage]}</span>
              <span className="tabular-nums text-mist-400">{Math.min(100, pct)}%</span>
            </div>

            <div className="mt-6 h-[2px] w-52 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full bg-gradient-to-r from-mint-400 to-emerald-400"
                style={{ width: `${Math.min(100, pct)}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
