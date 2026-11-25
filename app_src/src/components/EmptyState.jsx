import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { ArrowRight, Cpu } from 'lucide-react'

const PROMPTS = [
  { label: '我最近特别累，什么都不想干', tag: '耗竭' },
  { label: '我知道不该这样，但就是控制不住', tag: '反复' },
  { label: '好像所有人都过得比我好', tag: '比较' },
  { label: '我不太想回家，一回去就被比较', tag: '家庭' },
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } },
}

const item = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
}

export default function EmptyState({ onPick, info }) {
  const sweep = useRef(null)

  useEffect(() => {
    if (!sweep.current) return
    const tween = gsap.fromTo(
      sweep.current,
      { xPercent: -110, opacity: 0 },
      { xPercent: 110, opacity: 1, duration: 2.2, ease: 'power2.inOut', delay: 0.5, repeat: -1, repeatDelay: 3.2 }
    )
    return () => {
      tween.kill()
    }
  }, [])

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto my-auto flex w-full max-w-[860px] flex-col px-8 py-10"
    >
      <motion.div variants={item} className="mb-5 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-400/20 bg-mint-400/[0.06] px-2.5 py-1 text-[10.5px] text-mint-300">
          <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-mint-400" />
          本地运行 · 只做心理分析
        </span>
        {info?.status === 'model' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-mint-400/20 bg-mint-400/[0.06] px-2.5 py-1 text-[10.5px] text-mint-300">
            <Cpu className="h-3 w-3" />
            六本豆 4.1 旗舰版 (1B)
          </span>
        )}
      </motion.div>

      <motion.h1
        variants={item}
        className="relative text-[42px] font-semibold leading-[1.18] tracking-[-0.02em] text-mist-100"
      >
        <span>你今天，</span>
        <span className="font-serif italic text-mint-300">怎么了</span>
        <span>？</span>
        <span className="pointer-events-none absolute -bottom-1 left-0 block h-[1px] w-[280px] overflow-hidden">
          <span
            ref={sweep}
            className="block h-full w-1/2 bg-gradient-to-r from-transparent via-mint-400/70 to-transparent"
          />
        </span>
      </motion.h1>

      <motion.p variants={item} className="mt-5 max-w-[560px] text-[14.5px] leading-[1.9] text-mist-400">
        不用组织语言，也不用先把自己说得很理性。
        <br />
        把最难受的那句丢过来，我会把它拆开给你看。
      </motion.p>

      <motion.div variants={item} className="mt-9 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {PROMPTS.map((p) => (
          <button
            key={p.label}
            onClick={() => onPick(p.label)}
            className="focus-ring group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3.5 text-left transition-all duration-300 hover:-translate-y-[2px] hover:border-mint-400/25 hover:bg-white/[0.045] hover:shadow-panel"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-[10.5px] text-mist-500 transition group-hover:border-mint-400/25 group-hover:text-mint-300">
              {p.tag}
            </span>
            <span className="flex-1 text-[13px] leading-snug text-mist-300 transition group-hover:text-mist-100">
              {p.label}
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-mist-500 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </button>
        ))}
      </motion.div>
    </motion.div>
  )
}
