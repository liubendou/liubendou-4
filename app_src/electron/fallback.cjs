// 没有模型文件时的内置演示话术。输出协议与训练格式完全一致，界面无需区分。
const RULES = [
  {
    keys: ['累', '加班', '倦怠', '撑', '熬', '没力气', '疲惫', '机器', '提不起'],
    zh: {
      think: '先不急着给办法，你现在更需要的是被允许承认累。连续硬撑的人，往往不是没力气，而是不敢停。',
      insight: '你不是懒，你是把力气全用在维持“我还能撑”这件事上。休息在你心里变成了要赎罪的事。',
      pierce: '你不是不想停，你是不敢停，怕一停下来就发现自己早就撑不住了。',
      advice: '今天只做一件恢复性的事：提前一小时关灯，不看屏幕。明天把一件小事交出去，哪怕做得不完美。',
    },
  },
  {
    keys: ['分手', '失恋', '前任', '删了', '复合', '不爱我'],
    zh: {
      think: '白天正常、晚上崩溃，说明情绪没有被处理，只是被推迟了。反复删加不是意志力问题，是戒断反应。',
      insight: '你怀念的可能不是他，是那个被需要、被回应的自己。你留着的不是感情，是没被好好结束的交代。',
      pierce: '你不是放不下他，你是放不下“我付出过却没有结果”这件事。你说他懂你，可他连好好告别都没做到。',
      advice: '给自己一个明确的告别动作：写一封不寄出的信，写完收起来。把每天看主页的次数记下来，只记录，不评判。',
    },
  },
  {
    keys: ['妈', '爸', '父母', '家里', '回家', '原生家庭', '催'],
    zh: {
      think: '“为你好”是最难反驳的控制，因为它把反抗变成了不道德。你的烦不是不感恩，是边界长期被穿过。',
      insight: '你要的不是不孝，是被允许做一个和他们期待不同的人。你一边想独立，一边还在等他们批准，所以卡住了。',
      pierce: '你不是不想沟通，你是知道一沟通就会被扣上“不懂事”的帽子。你在用顺从换和平，代价是慢慢失去自己的声音。',
      advice: '先从小事开始划边界：这周只答一次家里的追问，其余说“我在处理”。把想说的话写下来，选最不伤人的一句先练习。',
    },
  },
  {
    keys: ['拒绝', '帮忙', '不好意思', '讨好', '答应', '内疚'],
    zh: {
      think: '答应得太快，往往不是因为愿意，是因为害怕关系破裂。被压住的愤怒，最后会变成自我消耗。',
      insight: '你把“被需要”当成“被爱”，所以不敢停下来。你不是没有边界，你是不敢让别人失望。',
      pierce: '你不是善良，你是怕一旦不帮忙，就没人需要你了。你对所有人都好，唯独对自己很刻薄。',
      advice: '这周练习一次“我需要想一下”，把立刻答应改成延迟回答。拒绝时只说事实，不解释三遍。',
    },
  },
  {
    keys: ['比较', '同学', '朋友圈', '落后', '同龄', '升职', '不如'],
    zh: {
      think: '比较之所以刺痛，是因为它把一个多维的人生压成了一条排行榜。“落后”这个感受，通常来自一个没被质疑过的标准。',
      insight: '你不是嫉妒他，你是怕自己这辈子就这样了。你拿别人的高光片段，量自己的日常，当然会输。',
      pierce: '你不是想超过他，你是想证明自己没有被落下。你连自己想要什么都没想清楚，就已经开始跟人比了。',
      advice: '写下三个你自己定义的“过得好”，不许用钱和头衔。取关让你反复不舒服的账号一个月，看看焦虑降了多少。',
    },
  },
  {
    keys: ['睡不着', '失眠', '半夜', '凌晨', '反刍', '复盘'],
    zh: {
      think: '夜里反刍，是白天被压住的情绪在找出口。越想控制入睡，越睡不着，这是睡眠的悖论。',
      insight: '你不是在思考，你是在反复审判自己。你把白天的沉默，全部留到夜里自己消化。',
      pierce: '你不是想不通，你是不肯放过自己。你在夜里跟一个已经结束的场景继续吵架。',
      advice: '睡前写三行“今天到此为止”，写完合本，不再解决任何事。躺下二十分钟没睡着就起身，困了再回床。',
    },
  },
  {
    keys: ['方案', '领导', '老板', '工作', '被否', '同事', '评优', '努力'],
    zh: {
      think: '投入越重，否定就越像否定你这个人，所以疼得不成比例。评价指向“人”而不是“事”时最伤人。',
      insight: '你不是舍不得那个方案，你是受不了努力被当成理所当然。你在意的不是谁用了你的点子，是没人承认那是你的。',
      pierce: '你说“知道了”的时候，才是真的被伤到了。你不是想被夸，你想被当成一个能被看见的人。',
      advice: '把成果留痕：做过什么、被谁采用，写清楚，不用等别人替你记。下次汇报先讲结论和依据，别把礼貌当成准备。',
    },
  },
  {
    keys: ['怕', '焦虑', '社交', '不敢', '尴尬', '别人怎么看', '紧张'],
    zh: {
      think: '这不是能力问题，是被评价的恐惧先一步接管了身体。你把“没人回应”自动读成了“我不行”。',
      insight: '你怕的不是被看见，是被看见之后被否定。你把别人的注意力放大了十倍，把自己的位置缩小了十倍。',
      pierce: '你不是社恐，你是太想表现得没问题。你怕的那句话，其实是你自己在心里说了很多遍。',
      advice: '把目标从“表现好”改成“把要点说清楚”，只完成这一件事。把那句最怕听到的评价写下来，在旁边写一句你的反驳。',
    },
  },
  {
    keys: ['拖延', '拖了', '不想做', '刷手机', '最后一刻'],
    zh: {
      think: '拖延不是懒，是任务在心理上被贴了“做不好就证明我不行”的标签。越到最后越能启动，是因为需要压力对抗恐惧。',
      insight: '你拖的不是任务，是那个“做不好就证明我不行”的可能。你用刷手机止痛，但痛一直在。',
      pierce: '你不是没时间，你是在等一个不害怕的自己出现。你宁愿被骂不努力，也不愿被确认不够好。',
      advice: '把任务缩到荒谬的小：只打开文档写标题，写完就允许自己停。开工前设一个十五分钟计时器，只要求坐住。',
    },
  },
  {
    keys: ['没用', '配不上', '做不好', '自信', '差劲', '否定自己'],
    zh: {
      think: '“我不行”是一个被反复强化的结论，不是事实。他把任何差错都当成整体人格的证据。',
      insight: '你不是没用，你是在用一件事给自己判了刑。你对自己的标准，比你对任何朋友都狠。',
      pierce: '你说自己不行的时候，其实是在求一个人反驳你。你不是不自信，你是只收集能证明你差的证据。',
      advice: '每天记一条“我做到了”，不许加“但是”。把“我不行”改成“我这次没做好”。',
    },
  },
  {
    keys: ['孤独', '一个人', '没朋友', '心里话', '安静'],
    zh: {
      think: '孤独不是身边没人，是没有人接住真实的你。用忙碌和刷手机填满，是在回避那种空。',
      insight: '你要的不是热闹，是一个能卸下防备的人。你把自己收得太好，好到别人进不来。',
      pierce: '你不是没朋友，你是不敢让他们看见真的你。你说“我挺好的”，是怕说了不好也没人接。',
      advice: '这周约一个人做具体的事：散步、吃饭，不谈成就只谈近况。允许自己在一条消息里说一句真话。',
    },
  },
]

const DEFAULT_ZH = {
  think: '先不急着给答案。你描述的是发生了什么，但真正消耗你的，可能是没被说出口的那部分。',
  insight: '你不是不知道怎么做，你是怕做了之后仍然不被看见。你把防御当成盔甲，可它也在挡住你想要的东西。',
  pierce: '你早就知道答案了，你只是想要一个人替你说出口。',
  advice: '今晚只做一件小事：把最难受的那句话原样写下来，不改。明天找一个安全的人，只说感受，不说结论。',
}

const DEFAULT_EN = {
  think:
    'Let us not rush to advice. What you describe is the event, but what drains you is the part you have not said out loud.',
  insight:
    'You are not out of options. You are afraid that even after acting, you still will not be seen. You use the defense as armor, and it also blocks what you want.',
  pierce: 'You already know the answer. You just want someone to say it for you.',
  advice:
    'Do one small thing tonight: write the hardest sentence down exactly as it is, without editing. Tomorrow, tell one safe person the feeling, not the conclusion.',
}

const EN_RULES = [
  {
    keys: ['tired', 'burnout', 'exhausted', 'overtime', 'work'],
    think:
      'Do not rush to solutions. You need permission to admit exhaustion first. People who keep holding on are usually not out of strength, they are afraid to stop.',
    insight:
      'You are not lazy. You used all your energy maintaining “I can still hold on”. Rest became something you have to earn.',
    pierce:
      'You are not unable to stop. You are afraid that if you stop, you will find out you broke long ago.',
    advice:
      'Do one recovery thing today: lights off an hour early, no screens. Tomorrow hand off one small task, even if it is not perfect.',
  },
  {
    keys: ['breakup', 'ex', 'miss him', 'miss her', 'relationship'],
    think:
      'Fine by day and broken by night means the feeling was postponed, not processed. Deleting and re-adding is withdrawal, not a willpower problem.',
    insight:
      'You may miss the version of yourself that was needed, not him. What you keep is not love, it is an ending that never got finished.',
    pierce:
      'You are not unable to let go of him. You cannot let go of “I gave and got nothing”.',
    advice:
      'Do one closing action: write the letter you will never send, then put it away. Count how often you check his profile, no judgment, for one week.',
  },
]

function pickLang(text) {
  const ascii = (text.match(/[A-Za-z]/g) || []).length
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  return ascii > cjk * 2 ? 'en' : 'zh'
}

function fallbackReply(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const content = lastUser ? String(lastUser.content) : ''
  const lang = pickLang(content)
  const lower = content.toLowerCase()
  if (lang === 'en') {
    const hit = EN_RULES.find((r) => r.keys.some((k) => lower.includes(k)))
    const s = hit || DEFAULT_EN
    return envelope(s.think, s.insight, s.pierce, s.advice)
  }
  const hit = RULES.find((r) => r.keys.some((k) => content.includes(k)))
  const s = hit ? hit.zh : DEFAULT_ZH
  return envelope(s.think, s.insight, s.pierce, s.advice)
}

function envelope(think, insight, pierce, advice) {
  const reply = [insight, pierce, advice].filter(Boolean).join('')
  return `<think>${think}</think><reply>${reply}</reply>`
}

module.exports = { fallbackReply }
