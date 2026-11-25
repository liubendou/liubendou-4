import { motion } from 'framer-motion'
import { Plus, MessageSquare, Trash2, SlidersHorizontal, Sparkles } from 'lucide-react'
import { cn, formatTime } from '../lib/utils'

export default function Sidebar({ sessions, activeId, onSelect, onNew, onDelete, onAbout }) {
  return (
    <aside className="relative z-10 flex w-[268px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-950/55 backdrop-blur-2xl">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <div className="relative h-9 w-9 shrink-0">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-mint-300 via-mint-500 to-emerald-700 opacity-90" />
          <div className="absolute inset-0 rounded-2xl blur-md bg-mint-400/40 animate-breathe" />
          <div className="absolute inset-[3px] rounded-[13px] bg-ink-950/80" />
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-[13px] font-semibold tracking-tight text-mint-300">六</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-tight text-mist-100">六本豆</div>
          <div className="truncate text-[10.5px] leading-tight text-mist-500">
            广州六本豆人工智能科技有限公司
          </div>
        </div>
      </div>

      <div className="px-3">
        <button
          onClick={onNew}
          className="focus-ring group flex w-full items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.045] px-3 py-2.5 text-[13px] font-medium text-mist-100 transition hover:border-mint-400/30 hover:bg-mint-400/[0.08]"
        >
          <Plus className="h-4 w-4 text-mint-400 transition group-hover:rotate-90" />
          新的对话
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between px-5 pb-2">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-mist-500">
          对话记录
        </span>
        {sessions.length > 0 && (
          <span className="text-[10.5px] tabular-nums text-mist-500">{sessions.length}</span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {sessions.map((s) => {
          const active = s.id === activeId
          return (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="group relative"
            >
              <button
                onClick={() => onSelect(s.id)}
                className={cn(
                  'focus-ring relative flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition',
                  active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="active-bar"
                    className="absolute left-0 top-2.5 h-[calc(100%-20px)] w-[2px] rounded-full bg-mint-400"
                  />
                )}
                <MessageSquare
                  className={cn(
                    'mt-[2px] h-3.5 w-3.5 shrink-0',
                    active ? 'text-mint-400' : 'text-mist-500'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'truncate text-[12.5px] leading-snug',
                      active ? 'text-mist-100' : 'text-mist-300'
                    )}
                  >
                    {s.title || '新的对话'}
                  </div>
                  <div className="mt-0.5 text-[10px] text-mist-500">
                    {formatTime(s.createdAt)}
                  </div>
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(s.id)
                }}
                title="删除"
                className="absolute right-2 top-2.5 hidden rounded-md p-1 text-mist-500 transition hover:bg-white/[0.06] hover:text-rose-300 group-hover:block"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )
        })}
      </div>

      <div className="border-t border-white/[0.06] p-3 space-y-1">
        <button
          onClick={() => {
            if (window.liubendou && window.liubendou.togglePet) {
              window.liubendou.togglePet()
            }
          }}
          className="focus-ring flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] text-mint-300 transition hover:bg-mint-500/10 hover:text-mint-200"
        >
          <Sparkles className="h-3.5 w-3.5 text-mint-400" />
          桌面伴侣 · 六小豆
        </button>
        <button
          onClick={onAbout}
          className="focus-ring flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] text-mist-400 transition hover:bg-white/[0.04] hover:text-mist-100"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          关于与设置
        </button>
      </div>
    </aside>
  )
}
