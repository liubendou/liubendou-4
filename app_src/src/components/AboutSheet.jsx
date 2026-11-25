import { Drawer } from 'vaul'
import { X, Shield, Cpu, Languages, Brain, Building2 } from 'lucide-react'

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
      <Icon className="mt-[1px] h-3.5 w-3.5 shrink-0 text-mint-400/80" />
      <div className="min-w-0">
        <div className="text-[10.5px] uppercase tracking-[0.12em] text-mist-500">{label}</div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-mist-300">{value}</div>
      </div>
    </div>
  )
}

export default function AboutSheet({ open, onOpenChange, info }) {
  const loaded = info?.status === 'model'
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-h-[86vh] w-full max-w-[640px] flex-col rounded-t-[24px] border border-white/[0.08] bg-ink-900/95 outline-none backdrop-blur-2xl">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/15" />
          <div className="flex items-center justify-between px-6 pb-3 pt-4">
            <div>
              <div className="text-[15px] font-semibold tracking-tight">关于六本豆</div>
              <div className="mt-0.5 text-[10.5px] text-mist-500">v{info?.version || '1.0.0'} · 本地推理</div>
            </div>
            <Drawer.Close asChild>
              <button className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] text-mist-400 transition hover:text-mist-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </Drawer.Close>
          </div>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-6 pb-6">
            <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-mint-400/[0.07] to-transparent px-4 py-4">
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${loaded ? 'bg-mint-400' : 'bg-ember-400'}`}
                />
                <span className="text-[12.5px] font-medium text-mist-100">
                  {loaded ? '六本豆模型已加载' : '当前为内置演示话术'}
                </span>
                <span className="rounded-full border border-white/[0.08] px-2 py-[1px] text-[9.5px] text-mist-500">
                  {loaded ? (info?.engine === 'gguf' ? 'Llama Native Engine · 1B CPU' : 'ONNX Runtime · CPU') : 'fallback'}
                </span>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-mist-400">
                {loaded
                  ? `参数 ${info?.params >= 100 ? '10 亿 (1B 旗舰)' : (info?.params || '23.5') + 'M'} · 词表 ${info?.vocab || 128256} · 深度强化中英文心理分析与防御识别`
                  : info?.reason || '未找到模型文件，界面用内置话术演示。'}
              </p>
            </div>

            <Row icon={Languages} label="语言" value="只支持中文与英文。其它语言不训练，也不会装作会。" />
            <Row
              icon={Brain}
              label="能力"
              value="在聊天里看懂一个人：命名情绪、识别防御、指出反复出现的关系模式，然后自然地说出来。戳破不单独成段，藏在对话里。"
            />
            <Row
              icon={Cpu}
              label="架构"
              value="23.5M 参数、12 层解码器；RoPE 位置编码 + RMSNorm + SwiGLU + GQA 分组注意力；Muon 优化器训练，ONNX 逐 token 流式推理。"
            />
            <Row
              icon={Building2}
              label="训练方"
              value="广州六本豆人工智能科技有限公司"
            />
            <Row
              icon={Shield}
              label="数据"
              value="公开心理对话语料（SoulChat-R1 中文咨询对话、CounselChat、ESConv 英文情绪支持），不含任何私人对话。"
            />

            <div className="rounded-2xl border border-ember-400/[0.18] bg-ember-400/[0.05] px-4 py-3.5">
              <div className="flex items-center gap-2 text-[12px] font-medium text-ember-300">
                <Shield className="h-3.5 w-3.5" />
                边界说明
              </div>
              <p className="mt-1.5 text-[11.5px] leading-[1.85] text-mist-400">
                六本豆不是医生，也不能替代心理咨询或医疗诊断。它只有 2000 万参数，擅长的是把话说得更清楚，不是给出临床结论。
                如果你或身边的人处于危机状态，请优先联系当地专业机构或急救电话。
              </p>
            </div>

            <div className="pt-1">
              <div className="mb-2 text-[10.5px] uppercase tracking-[0.14em] text-mist-500">技术栈</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Electron', 'React 18', 'Vite', 'Tailwind CSS', 'Radix UI', 'Framer Motion',
                  'GSAP', 'Lucide', 'Sonner', 'Vaul', 'ONNX Runtime',
                ].map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[10.5px] text-mist-400"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
