import { useEffect, useMemo, useRef, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { Cpu, Sparkles, CircleDot } from 'lucide-react'
import Sidebar from './components/Sidebar'
import EmptyState from './components/EmptyState'
import Composer from './components/Composer'
import AboutSheet from './components/AboutSheet'
import BootScreen from './components/BootScreen'
import { AssistantMessage, UserBubble } from './components/Message'
import { loadSessions, makeSession, saveSessions } from './lib/store'
import { DEMO_STREAM } from './lib/demo'
import { cn, uid } from './lib/utils'

function Ambient() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-40 -top-48 h-[520px] w-[520px] animate-drift rounded-full bg-mint-400/[0.055] blur-[120px]" />
      <div className="absolute -right-32 top-[-120px] h-[460px] w-[460px] animate-drift rounded-full bg-ember-400/[0.045] blur-[120px] [animation-delay:-8s]" />
      <div className="absolute bottom-[-220px] left-1/3 h-[420px] w-[620px] animate-breathe rounded-full bg-emerald-500/[0.035] blur-[140px]" />
    </div>
  )
}

export default function App() {
  const [sessions, setSessions] = useState(() => {
    const stored = loadSessions()
    return stored && stored.length ? stored : [makeSession()]
  })
  const [activeId, setActiveId] = useState(() => sessions[0].id)
  const [streaming, setStreaming] = useState(false)
  const [info, setInfo] = useState(null)
  const [bootDone, setBootDone] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  const listRef = useRef(null)
  const stickRef = useRef(true)
  const reqRef = useRef(null)
  const activeIdRef = useRef(activeId)

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) || sessions[0],
    [sessions, activeId]
  )

  useEffect(() => {
    saveSessions(sessions)
  }, [sessions])

  useEffect(() => {
    const api = window.liubendou
    if (!api) {
      const t = setTimeout(() => setInfo({ status: 'fallback' }), 1400)
      return () => clearTimeout(t)
    }
    let alive = true
    let timer = null
    const poll = async () => {
      try {
        const i = await api.info()
        if (!alive) return
        setInfo(i)
        if (i.status === 'model' || i.status === 'fallback') return
      } catch {}
      timer = setTimeout(poll, 700)
    }
    poll()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!info || info.status === 'unloaded') return
    const t = setTimeout(() => setBootDone(true), 700)
    return () => clearTimeout(t)
  }, [info])

  useEffect(() => {
    const api = window.liubendou
    if (!api) return

    const patchLast = (patch) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeIdRef.current) return s
          const msgs = s.messages.map((m, i) =>
            i === s.messages.length - 1 ? { ...m, ...patch(m) } : m
          )
          return { ...s, messages: msgs }
        })
      )
    }

    const offChunk = api.onChunk(({ requestId, delta }) => {
      if (requestId !== reqRef.current) return
      patchLast((m) => ({ content: m.content + delta, streaming: true }))
    })

    const offDone = api.onDone(({ requestId, engine, error }) => {
      if (requestId !== reqRef.current) return
      reqRef.current = null
      setStreaming(false)
      patchLast(() => ({ streaming: false, engine }))
      if (error) toast.error('生成中断', { description: error })
    })

    return () => {
      offChunk()
      offDone()
    }
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [sessions])

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90
  }

  const send = async (text) => {
    const clean = text.trim()
    if (!clean || streaming) return
    const sid = active.id
    const history = active.messages
      .filter((m) => (m.role === 'user' || m.content) && !m.streaming)
      .map((m) => ({ role: m.role, content: m.content }))

    const userMsg = { id: uid(), role: 'user', content: clean }
    const aiMsg = { id: uid(), role: 'assistant', content: '', streaming: true, engine: null }
    const title =
      active.messages.length === 0
        ? clean.length > 16
          ? clean.slice(0, 16) + '…'
          : clean
        : active.title

    stickRef.current = true
    setSessions((prev) =>
      prev.map((s) => (s.id === sid ? { ...s, title, messages: [...s.messages, userMsg, aiMsg] } : s))
    )
    setStreaming(true)

    const requestId = uid()
    reqRef.current = requestId

    const api = window.liubendou
    if (!api) {
      // 浏览器预览：用内置演示流
      let i = 0
      const timer = setInterval(() => {
        i += 4
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sid) return s
            const msgs = s.messages.map((m, idx) =>
              idx === s.messages.length - 1
                ? { ...m, content: DEMO_STREAM.slice(0, i), streaming: i < DEMO_STREAM.length }
                : m
            )
            return { ...s, messages: msgs }
          })
        )
        if (i >= DEMO_STREAM.length) {
          clearInterval(timer)
          reqRef.current = null
          setStreaming(false)
        }
      }, 30)
      return
    }

    try {
      await api.chat({ requestId, messages: [...history, { role: 'user', content: clean }] })
    } catch (e) {
      reqRef.current = null
      setStreaming(false)
      toast.error('无法启动推理', { description: String(e.message || e) })
    }
  }

  const stop = () => {
    if (reqRef.current && window.liubendou) window.liubendou.cancel(reqRef.current)
    setStreaming(false)
  }

  const newChat = () => {
    if (active && active.messages.length === 0) return
    const s = makeSession()
    setSessions((prev) => [s, ...prev])
    setActiveId(s.id)
    stickRef.current = true
  }

  const deleteChat = (id) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (!next.length) {
        const s = makeSession()
        setActiveId(s.id)
        return [s]
      }
      if (id === activeId) setActiveId(next[0].id)
      return next
    })
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <Ambient />
      <Sidebar
        sessions={sessions}
        activeId={active?.id}
        onSelect={setActiveId}
        onNew={newChat}
        onDelete={deleteChat}
        onAbout={() => setAboutOpen(true)}
      />

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-[58px] shrink-0 items-center justify-between border-b border-white/[0.055] px-7">
          <div className="flex min-w-0 items-center gap-2.5">
            <CircleDot className="h-3 w-3 text-mint-400/70" />
            <span className="truncate text-[13px] font-medium text-mist-200">
              {active?.title || '新的对话'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px]',
                info?.status === 'model'
                  ? 'border-mint-400/20 bg-mint-400/[0.06] text-mint-300'
                  : 'border-white/[0.07] bg-white/[0.02] text-mist-400'
              )}
            >
              <Cpu className="h-3 w-3" />
              {info?.status === 'model' ? '本地模型' : info && info.status !== 'unloaded' ? '演示模式' : '启动中'}
            </span>
            <button
              onClick={() => setAboutOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] px-2.5 py-1 text-[10.5px] text-mist-400 transition hover:border-mint-400/25 hover:text-mint-300"
            >
              <Sparkles className="h-3 w-3" />
              关于
            </button>
          </div>
        </header>

        <div ref={listRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
          {active?.messages.length === 0 ? (
            <div className="flex min-h-full flex-col">
              <EmptyState onPick={send} info={info} />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[860px] space-y-8 px-8 py-8">
              {active.messages.map((m) =>
                m.role === 'user' ? (
                  <UserBubble key={m.id} content={m.content} />
                ) : (
                  <div key={m.id} className="group">
                    <AssistantMessage message={m} />
                  </div>
                )
              )}
              <div className="h-4" />
            </div>
          )}
        </div>

        <Composer onSend={send} streaming={streaming} onStop={stop} />
      </main>

      <AboutSheet open={aboutOpen} onOpenChange={setAboutOpen} info={info} />

      <BootScreen visible={!bootDone} done={Boolean(info && info.status !== 'unloaded')} />

      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#0f131a',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#eef2f7',
            fontSize: '12.5px',
          },
        }}
      />
    </div>
  )
}
