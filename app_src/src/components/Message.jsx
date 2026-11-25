import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Copy, Brain, Sparkle } from 'lucide-react'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'
import { parseProtocol, plainText } from '../lib/protocol'

function Avatar({ size = 30 }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-mint-300 to-emerald-700 opacity-80" />
      <div className="absolute inset-[2px] rounded-full bg-ink-900" />
      <div className="absolute inset-0 grid place-items-center text-[11px] font-semibold text-mint-300">
        六
      </div>
    </div>
  )
}

function Caret({ show }) {
  if (!show) return null
  return <span className="ml-[2px] inline-block h-[1em] w-[2px] translate-y-[2px] animate-caret bg-mint-400/80" />
}

function ThinkingBlock({ text, active, streaming, replyStarted }) {
  const [open, setOpen] = useState(true)
  useEffect(() => {
    if (replyStarted) setOpen(false)
  }, [replyStarted])
  if (!text) return null
  return (
    <div className="rounded-2xl border border-white/[0.055] bg-white/[0.018]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
      >
        <Brain className="h-3.5 w-3.5 text-mist-400" />
        <span className="text-[11.5px] font-medium text-mist-400">他在想什么</span>
        {active && streaming && (
          <span className="ml-1 flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1 w-1 animate-breathe rounded-full bg-mint-400"
                style={{ animationDelay: `${i * 0.25}s` }}
              />
            ))}
          </span>
        )}
        <ChevronDown
          className={cn('ml-auto h-3.5 w-3.5 text-mist-500 transition-transform', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="border-t border-white/[0.05] px-3.5 py-3 text-[12.5px] leading-[1.9] text-mist-500">
              {text}
              <Caret show={active && streaming} />
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function UserBubble({ content }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex justify-end"
    >
      <div className="max-w-[78%] rounded-2xl rounded-br-md border border-white/[0.08] bg-white/[0.055] px-4 py-2.5 text-[14px] leading-[1.75] text-mist-100">
        {content}
      </div>
    </motion.div>
  )
}

export function AssistantMessage({ message }) {
  const parsed = parseProtocol(message.content)
  const streaming = message.streaming
  const empty = !parsed.think && !parsed.reply
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText(parsed))
      setCopied(true)
      toast.success('已复制')
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('复制失败')
    }
  }

  return (
    <div className="group flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-mist-300">六本豆</span>
          {message.engine === 'fallback' && (
            <span className="rounded-full border border-ember-400/25 bg-ember-400/[0.07] px-1.5 py-[1px] text-[9px] text-ember-300">
              演示话术
            </span>
          )}
          {streaming && !parsed.reply && (
            <span className="flex items-center gap-1 text-[9.5px] text-mist-500">
              <Sparkle className="h-2.5 w-2.5" />
              正在听
            </span>
          )}
        </div>

        {empty && streaming && (
          <div className="flex items-center gap-1.5 py-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-breathe rounded-full bg-mist-500"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </div>
        )}

        <ThinkingBlock
          text={parsed.think}
          active={parsed.active === 'think'}
          streaming={streaming}
          replyStarted={!!parsed.reply}
        />

        {parsed.reply && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="whitespace-pre-wrap text-[14.5px] leading-[1.95] text-mist-100"
          >
            {parsed.reply}
            <Caret show={parsed.active === 'reply' && streaming} />
          </motion.p>
        )}

        {!streaming && parsed.done && (
          <div className="flex items-center gap-1 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={copy}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] text-mist-500 transition hover:bg-white/[0.05] hover:text-mist-200"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
