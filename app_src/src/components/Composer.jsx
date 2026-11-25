import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Square, Sparkles } from 'lucide-react'
import { cn } from '../lib/utils'

export default function Composer({ onSend, streaming, onStop }) {
  const [value, setValue] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`
  }, [value])

  const submit = () => {
    if (streaming) return
    const text = value.trim()
    if (!text) return
    onSend(text)
    setValue('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const canSend = value.trim().length > 0 && !streaming

  return (
    <div className="shrink-0 px-6 pb-5 pt-2">
      <div className="mx-auto w-full max-w-[840px]">
        <div
          className={cn(
            'group relative rounded-2xl border border-white/[0.08] bg-white/[0.035] backdrop-blur-xl transition-all duration-300',
            'focus-within:border-mint-400/35 focus-within:bg-white/[0.05] focus-within:shadow-glow'
          )}
        >
          <div className="flex items-end gap-2 p-2.5 pl-4">
            <textarea
              ref={ref}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={2000}
              placeholder="说说你现在发生的事，哪怕只是一句“我很累”。"
              className="max-h-[168px] min-h-[42px] flex-1 resize-none bg-transparent py-2.5 text-[14px] leading-[1.7] text-mist-100 placeholder:text-mist-500 focus:outline-none"
            />
            {streaming ? (
              <button
                onClick={onStop}
                title="停止生成"
                className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.10] bg-white/[0.06] text-mist-300 transition hover:border-rose-300/40 hover:text-rose-300"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!canSend}
                title="发送"
                className={cn(
                  'mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-all duration-300',
                  canSend
                    ? 'bg-gradient-to-br from-mint-300 to-mint-500 text-ink-950 shadow-[0_0_20px_rgba(110,231,200,0.35)] hover:scale-[1.04] active:scale-95'
                    : 'border border-white/[0.06] bg-white/[0.03] text-mist-500'
                )}
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between px-2 text-[10.5px] text-mist-500">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-mint-400/60" />
            六本豆只做中英文心理分析，不替代专业心理咨询
          </span>
          <span className="hidden sm:block">Enter 发送 · Shift+Enter 换行</span>
        </div>
      </div>
    </div>
  )
}
