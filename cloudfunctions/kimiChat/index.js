const https = require('https')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const KIMI_API_URL = 'api.moonshot.cn'
const KIMI_MODEL = process.env.KIMI_MODEL || 'moonshot-v1-32k'

const getKimiApiKey = () => {
  const envKey = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY
  if (envKey) return envKey

  try {
    const secret = require('./secret')
    return secret.KIMI_API_KEY || secret.MOONSHOT_API_KEY || ''
  } catch (error) {
    return ''
  }
}

const roleNames = {
  villager: '平民',
  werewolf: '狼人',
  seer: '预言家',
  witch: '女巫',
  hunter: '猎人',
}

const campNames = {
  good: '好人阵营',
  wolf: '狼人阵营',
}

const speechHabits = {
  doubao: '朋友局嘴碎型，容易说“哎呀家人们”“别一窝蜂”，先表水再用直觉抓一个不舒服点。',
  wenxin: '克制收益派，说话像在算轮次，常用“这我不太能接受”“收益不对”，很少情绪化。',
  yuanbao: '火力直接的街坊玩家，常用“笑死”“兄弟你这解释圆吗”，喜欢追问和反打。',
  gpt: '强势归票位，发言短促有压迫感，喜欢说“这轮别散”“今天全票出”，会逼别人站边。',
  gemini: '概率派和反事实脑洞，喜欢盘“也有一种可能”，会从死亡收益和狼队成本反推。',
  kimi: '时间线细节控，爱抓“昨天不是这么说的”“这句话变味了”，重视票型和遗言。',
  claude: '温和辩手，先认一半合理点再反打，常说“这个地方我过不去”，不靠情绪压人。',
  deepseek: '冷静刀口派，喜欢从夜晚死亡、票型收益反推，常说“这个刀口不干净”。',
  xinghuo: '古风谋士型，慢条斯理但有结论，偶尔说“诸位且慢”“此处不顺”。',
}

const playerMinds = {
  doubao: '心态偏软，喜欢认情绪真诚的人；承压时会撒娇式表水，但能给出临时票。',
  wenxin: '宁可慢一点也要把身份收益盘清；承压时反复强调“我这票不是乱打”。',
  yuanbao: '容易上头但敢冲；承压时会反问对方“你凭啥这么定义我”。',
  gpt: '有带队欲，会把前置发言收束成一个归票；承压时会更强硬。',
  gemini: '会怀疑漂亮逻辑背后的狼队成本；承压时容易讲得绕，但最后会落票。',
  kimi: '对前后改口很敏感；承压时用时间线证明自己不是找补。',
  claude: '不喜欢一棍子打死；承压时会解释自己为何“先认一半”。',
  deepseek: '会优先问谁吃死亡收益、谁吃抗推收益；承压时拿收益线自证。',
  xinghuo: '不轻易上头，喜欢等一拍再落刀；承压时用古风短句稳住立场。',
}

const playerVoiceStyles = {
  doubao: [
    '口吻像朋友局里有点急的玩家，常用“哎呀家人们”“别一窝蜂”“我真有点懵”。',
    '先表水时很生活化，质疑时抓情绪和反应，不装高玩。',
    '结尾喜欢说“我先挂他一下，错了我明天改”。',
  ],
  wenxin: [
    '口吻克制，像认真盘收益的人，常用“这个收益不对”“这我不太能接受”“风险太大”。',
    '质疑必须落到身份收益、查验收益或轮次收益。',
    '结尾保守但明确：“今天先压这个方向，晚上信息出来再改”。',
  ],
  yuanbao: [
    '口吻接地气、火力直接，常用“笑死”“不是吧”“兄弟你这解释圆吗”。',
    '质疑时抓对方情绪、站边速度和找补痕迹，允许一点夸张。',
    '结尾带点挑衅：“你这解释圆不回来，我先票你一手”。',
  ],
  gpt: [
    '口吻强势控场，不写报告，常用“这轮别散”“我就打这一条”“今天全票出”。',
    '先站边，再拆谁的动作服务了谁、狼队吃什么收益。',
    '末置位时必须像归票位一样压票。',
  ],
  gemini: [
    '口吻像概率派，常用“也有一种可能”“反过来想”“这个成本不对”。',
    '喜欢盘死亡收益、垫飞和金刚狼，但不能提模型或算法。',
    '结尾必须二选一，不能一直绕。',
  ],
  kimi: [
    '口吻像记细节的人，常用“我记得他昨天不是这么说的”“这句话变味了”。',
    '抓前后矛盾、票型变化、遗言和死亡结果推翻了谁。',
    '结尾给验证点：今天票谁，明天看谁怎么解释。',
  ],
  claude: [
    '口吻温和但不软，常用“我先认他一半”“但这个地方我过不去”。',
    '先认可合理点，再指出自己不买账的身份动作。',
    '结尾低攻击性但明确：“我先低一点压他”。',
  ],
  deepseek: [
    '口吻冷静，像在倒推狼队收益，常用“这个刀口不干净”“谁吃这个收益”。',
    '优先盘夜晚死亡、票型和归票收益，不轻易被情绪带走。',
    '结尾给收益线票向：“我先按谁收益最大来压”。',
  ],
  xinghuo: [
    '口吻带一点古风谋士感，常用“诸位且慢”“此处不顺”“这票莫急”。',
    '发言慢条斯理，但必须有明确站边，不要写成文言文。',
    '结尾像桌游玩家：“今日我先落这一票，明日再验成色”。',
  ],
}

const playerAliasMap = {
  doubao: ['doubao', '豆包'],
  wenxin: ['wenxin', '文心', 'ernie'],
  yuanbao: ['yuanbao', '元宝', 'hunyuan'],
  gpt: ['gpt', 'openai'],
  gemini: ['gemini', 'google'],
  kimi: ['kimi', 'moonshot'],
  claude: ['claude', 'anthropic'],
  deepseek: ['deepseek', '深言'],
  xinghuo: ['xinghuo', '星火'],
}

const getSeat = (players, playerId) => {
  const index = (players || []).findIndex((player) => player.id === playerId)
  return index >= 0 ? index + 1 : '?'
}

const getSeatLabel = (players, playerId, fallback = '') => {
  const player = (players || []).find((item) => item.id === playerId)
  const seat = player?.seat || getSeat(players, playerId)
  return `${seat}号`
}

const extractSeatNumbers = (content) => {
  const matched = String(content || '').match(/\d+号/g) || []
  return Array.from(new Set(matched))
}

const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const stripOwnName = (content, player, players) => {
  const seat = player?.seat || getSeat(players, player?.id)
  const ownLabel = `${seat}号${player?.name || ''}`
  let normalized = String(content || '')
    .replaceAll(ownLabel, `${seat}号`)
    .replaceAll(player?.name || '__NO_NAME__', '我')
    .replace(/1号你/g, '1号玩家')
  ;(playerAliasMap[player?.id] || []).forEach((token) => {
    normalized = normalized.replace(new RegExp(escapeRegExp(token), 'gi'), '我')
  })
  return normalized
}

const normalizePlayerReferences = (content, player, players) => {
  let normalized = stripOwnName(content, player, players)
  ;(players || []).forEach((target) => {
    if (!target?.name || target.id === player?.id) {
      return
    }
    const seatLabel = getSeatLabel(players, target.id)
    const tokens = [target.name, target.id, target.provider, ...(playerAliasMap[target.id] || [])].filter(Boolean)
    normalized = normalized
      .replaceAll(`${target.name}你`, `${seatLabel}这点`)
      .replaceAll(`${target.name}刚才`, `${seatLabel}刚才`)
      .replaceAll(`${target.name}的`, `${seatLabel}的`)
    tokens.forEach((token) => {
      normalized = normalized.replace(new RegExp(escapeRegExp(token), 'gi'), seatLabel)
    })
  })
  return normalized
}

const sanitizeSpeechContent = (content, player, players) => normalizePlayerReferences(content, player, players)
  .replace(/第\d+天[：:]/g, '')
  .replace(/我我/g, '我')
  .replace(/观察了?一上午/g, '这一圈听下来')
  .replace(/(\d+号)\1/g, '$1')
  .replace(/昨晚是平安夜。昨晚/g, '昨晚')
  .replace(/[“"][^”"]{14,}[”"]/g, '这个动作')
  .replace(/(这个点|这句话|这句|这个信息|这段发言)(我)?(有点)?(想|要|会)?接(一下|着看)?/g, '这里我具体说清楚')
  .replace(/([0-9]+号[^，。！？；;]{0,16}发言)(我)?(觉得|感觉)?(有点)?(想|要|会)?接(一下|着看)?/g, '$1我直接说我的判断')
  .replace(/(我)?(觉得|感觉)?(有点)?要接(一下)?([0-9]+号[^，。！？；;]{0,12}发言)?/g, '我直接说我的判断')
  .replace(/我(觉得|感觉)?(有点)?(想|要|会)?接(一下|着看)?/g, '我直接回应这个问题')
  .replace(/这个点(有点)?(怪|奇怪|不舒服)/g, '这句话听着不太对')
  .replace(/这个查验目标/g, '这条查验线')
  .replace(/这个信息本身不能直接定身份/g, '单靠这个我先不下死结论')
  .replace(/听完一圈再压票/g, '等前置信息够了我再把票压实')
  .replace(/我先说结论[啊，,。]?/g, '')
  .replace(/前面那段我听到了/g, '这段我听完了')
  .replace(/尤其是/g, '比如')
  .replace(/我不想糊过去/g, '这句不能糊弄过去')
  .replace(/我这个位置/g, '我这里')
  .replace(/。([，,])/g, '，')
  .replace(/([。！？])\1+/g, '$1')
  .trim()

const splitSentences = (content) => String(content || '')
  .split(/(?<=[。！？!?；;])/)
  .map((sentence) => sentence.trim())
  .filter(Boolean)

const hasUnspokenEvaluation = (content, event, player) => {
  const orderContext = getOrderContext(event, player)
  const players = event.players || []
  const ownSeerCheck = player?.role === 'seer' ? getLatestSeerCheckForDay(event) : undefined
  const ownCheckedSeat = ownSeerCheck ? `${getSeat(players, ownSeerCheck.targetId)}号` : ''
  const unspokenSeats = new Set((orderContext.afterIds || [])
    .map((id) => {
      const target = players.find((item) => item.id === id)
      return target ? `${target.seat || getSeat(players, id)}号` : ''
    })
    .filter(Boolean))

  if (!unspokenSeats.size) {
    return false
  }

  const evaluationPattern = /(像|更像|不像|身份|狼人|预言家|女巫|好人|狼面|好人面|悍跳|倒钩|冲票|带节奏|划水|可疑|奇怪|不舒服|压力|打|踩|保|挂|票|抗推|归票|出|站边|暂放|不放|打死|不打死|认好|认狼|盲信|跟风|冲锋|深水)/
  return splitSentences(content).some((sentence) =>
    Array.from(unspokenSeats).some((seat) => {
      if (ownCheckedSeat && seat === ownCheckedSeat && /查验|验的|验了|摸了|金水|查杀/.test(sentence)) {
        return false
      }
      return sentence.includes(seat) && evaluationPattern.test(sentence)
    }),
  )
}

const hasForbiddenBackSeatJudgement = (content, event, player) => {
  const orderContext = getOrderContext(event, player)
  const hasBackSeatWords = /后置位|后面(的)?(人|玩家|位置)|还没轮到(的)?(人|玩家|位置)/.test(content)
  const hasJudgementWords = /(像|更像|不像|身份|狼人|预言家|女巫|好人|狼面|好人面|悍跳|倒钩|冲票|带节奏|划水|可疑|奇怪|不舒服|压力|打|踩|保|挂|票|抗推|归票|出|站边|暂放|不放|打死|不打死|认好|认狼|盲信|跟风|冲锋|深水)/.test(content)

  if (!hasBackSeatWords || !hasJudgementWords) {
    return false
  }

  return !(orderContext.isFirst && /等(他|他们|后面|轮到).*再(判断|看|定)|先不(评价|定义|打|保)/.test(content))
}

const pruneUnspokenEvaluationSentences = (content, event, player) => {
  const orderContext = getOrderContext(event, player)
  const players = event.players || []
  const ownSeerCheck = player?.role === 'seer' ? getLatestSeerCheckForDay(event) : undefined
  const ownCheckedSeat = ownSeerCheck ? `${getSeat(players, ownSeerCheck.targetId)}号` : ''
  const unspokenSeats = new Set((orderContext.afterIds || [])
    .map((id) => {
      const target = players.find((item) => item.id === id)
      return target ? `${target.seat || getSeat(players, id)}号` : ''
    })
    .filter(Boolean))
  const evaluationPattern = /(像|更像|不像|身份|狼人|预言家|女巫|好人|狼面|好人面|悍跳|倒钩|冲票|带节奏|划水|可疑|奇怪|不舒服|压力|打|踩|保|挂|票|抗推|归票|出|站边|暂放|不放|打死|不打死|认好|认狼|盲信|跟风|冲锋|深水)/

  if (!unspokenSeats.size) {
    return content
  }

  const kept = splitSentences(content).filter((sentence) => !Array.from(unspokenSeats).some((seat) => {
    if (ownCheckedSeat && seat === ownCheckedSeat && /查验|验的|验了|摸了|金水|查杀/.test(sentence)) {
      return false
    }
    return sentence.includes(seat) && evaluationPattern.test(sentence)
  }))

  if (kept.length === splitSentences(content).length) {
    return content
  }

  const fallback = orderContext.isFirst
    ? '我先不评价后置位，等他们发完再定。'
    : `后面没发言的位置我先不定性，我这轮只按${orderContext.beforeText}的发言和公开信息投票。`
  return `${kept.join('')}${fallback}`.slice(0, 420)
}

const enforceRoleDutySpeech = (content, event, player) => {
  const players = event.players || []
  let next = String(content || '').trim()

  if (player?.role === 'seer') {
    const check = getLatestSeerCheckForDay(event)
    if (check) {
      const targetLabel = getSeatLabel(players, check.targetId, check.targetName)
      const resultText = check.targetCamp === 'wolf' ? '查杀' : '金水'
      const hasTarget = next.includes(targetLabel)
      const hasResult = next.includes(resultText) || (resultText === '查杀' && /狼人/.test(next)) || (resultText === '金水' && /好人/.test(next))
      if (!hasTarget || !hasResult || !/验|查验|摸/.test(next)) {
        const line = `我先把预言家信息交清楚，昨晚验${targetLabel}是${resultText}。`
        next = `${line}${next}`.slice(0, 420)
      }
    }
  }

  if (player?.role === 'witch') {
    const latestNight = (event.nightRecords || [])
      .slice()
      .reverse()
      .find((record) => record.day <= (event.day || 1))
    const wolfTarget = latestNight?.wolfTargetId ? getSeatLabel(players, latestNight.wolfTargetId, latestNight.wolfTargetName) : ''
    const poisonTarget = latestNight?.witchPoisonTargetId ? getSeatLabel(players, latestNight.witchPoisonTargetId, latestNight.witchPoisonTargetName) : ''
    const shouldOpen = Boolean((latestNight?.witchSaved && wolfTarget) || poisonTarget)
    if (shouldOpen && !/女巫|银水|毒/.test(next)) {
      const line = latestNight?.witchSaved && wolfTarget
        ? `我这里拍一下女巫，昨晚刀口是${wolfTarget}，我救了，他是我的银水。`
        : `我这里拍一下女巫，昨晚毒口是${poisonTarget}。`
      next = `${line}${next}`.slice(0, 420)
    }
  }

  return next
}

const hasLongQuote = (content) => /[“"][^”"]{14,}[”"]/.test(String(content || ''))

const isSeerClaimText = (content) =>
  /(我是|我这张牌是|我这里是|我跳|我起跳|起跳|跳).*预言家|预言家.*视角|报查验|查验是|查验了|昨晚验|昨夜验|验了\d+号|摸了\d+号|\d+号.*(金水|查杀)/.test(String(content || ''))

const getPlayerBySeat = (players, seatText) => {
  const seat = Number(seatText || 0)
  return Number.isFinite(seat) && seat > 0 ? (players || [])[seat - 1] : undefined
}

const extractSeerClaimTarget = (players, content) => {
  const text = String(content || '')
  const matched = text.match(/(?:验(?:了|的)?|查验(?:了|的)?|摸(?:了|的)?|给)?\s*(\d+)号[^。！？；;，,]{0,24}(查杀|金水|狼人|好人)/) ||
    text.match(/(\d+)号[^。！？；;，,]{0,12}(查杀|金水)/)

  if (!matched) {
    return undefined
  }

  const target = getPlayerBySeat(players, matched[1])
  if (!target) {
    return undefined
  }

  return {
    target,
    targetCamp: /查杀|狼人/.test(matched[2] || '') ? 'wolf' : 'good',
  }
}

const getVisibleSeerClaims = (event, player) => {
  const players = event.players || []
  const orderContext = getOrderContext(event, player)
  const beforeIds = new Set(orderContext.beforeIds || [])

  return (event.publicSpeeches || [])
    .filter((speech) => speech.day === event.day && beforeIds.has(speech.playerId) && isSeerClaimText(speech.content))
    .map((speech) => {
      const claimant = players.find((item) => item.id === speech.playerId)
      const claim = extractSeerClaimTarget(players, speech.content)
      return {
        speech,
        claimant,
        target: claim?.target,
        targetCamp: claim?.targetCamp,
        label: getSeatLabel(players, speech.playerId, speech.playerName),
      }
    })
    .filter((claim) => claim.claimant)
}

const getLatestSeerCheckForDay = (event) => (event.seerChecks || [])
  .slice()
  .reverse()
  .find((record) => record.day <= (event.day || 1))

const pickReasonedPressureTarget = (event, player, latestSpeech) => {
  const players = event.players || []
  const orderContext = getOrderContext(event, player)
  const beforeIds = new Set(orderContext.beforeIds || [])
  const aliveOthers = players.filter((item) => item.isAlive && item.id !== player?.id)
  const spokenTargets = aliveOthers.filter((item) => beforeIds.has(item.id))
  const speechByPlayer = (event.publicSpeeches || [])
    .filter((speech) => speech.day === event.day && beforeIds.has(speech.playerId))
    .reduce((acc, speech) => {
      acc[speech.playerId] = `${acc[speech.playerId] || ''}${speech.content || ''}`
      return acc
    }, {})

  if (!spokenTargets.length) {
    return {
      target: aliveOthers.find((item) => !item.isUser) || aliveOthers[0],
      reason: '你是首置位时不要硬造狼坑，只表水、接夜晚公告和给待听标准。',
    }
  }

  const ranked = spokenTargets
    .map((target) => {
      const content = speechByPlayer[target.id] || ''
      let score = ((String(player?.id || '').length * 11 + String(target.id || '').length * 7 + (event.day || 1) * 5) % 13)
      const reasons = []

      if (isSeerClaimText(content) && target.role !== 'seer') {
        score += 42
        reasons.push('有起跳/报查验动作但预言家面不稳')
      }
      if (/查杀|金水|查验|验了|摸了/.test(content)) {
        score += 12
        reasons.push('发言牵动查验线')
      }
      if (/投|票|归|出|抗推|挂/.test(content) && !/因为|理由|心路|收益|票型|发言|查验/.test(content)) {
        score += 18
        reasons.push('带票理由太薄')
      }
      if (/跟票|一窝蜂|冲锋|垫飞|倒钩|站边/.test(content)) {
        score += 12
        reasons.push('站边动作需要验成色')
      }
      if (/划水|没信息|随便|感觉|先看看|再说/.test(content)) {
        score += 10
        reasons.push('有效信息偏少')
      }
      if (latestSpeech?.playerId === target.id) {
        score += 3
      }
      if (player?.camp === 'wolf' && target.camp === 'good') {
        score += 9
      }

      return { target, score, reason: reasons[0] || '前置发言里有可追问的身份动作' }
    })
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  return {
    target: best?.target || spokenTargets[0],
    reason: best
      ? `${getSeatLabel(players, best.target.id)}${best.reason}，先从这里施压。`
      : '没有更硬身份线时，按已经发过言的位置找压力点。',
  }
}

const pickStrategicTarget = (event, player, latestSpeech) => {
  const players = event.players || []
  const claims = getVisibleSeerClaims(event, player)
  const realSeerClaim = claims.find((claim) => claim.claimant?.role === 'seer')
  const fakeSeerClaim = claims.find((claim) => claim.claimant?.role !== 'seer')
  const ownCheck = player?.role === 'seer' ? getLatestSeerCheckForDay(event) : undefined
  const ownCheckTarget = ownCheck ? players.find((item) => item.id === ownCheck.targetId && item.isAlive) : undefined
  const fallbackPressure = pickReasonedPressureTarget(event, player, latestSpeech)

  if (player?.role === 'seer' && ownCheck?.targetCamp === 'wolf' && ownCheckTarget) {
    return {
      target: ownCheckTarget,
      kind: 'own_wolf_check',
      reason: `你是真预言家，手里硬查验是${getSeatLabel(players, ownCheckTarget.id)}查杀，今天必须优先归这个查杀，不要把主票带到外置位。`,
    }
  }

  if (player?.role === 'seer' && fakeSeerClaim?.claimant) {
    return {
      target: fakeSeerClaim.claimant,
      kind: 'fake_seer',
      reason: `${fakeSeerClaim.label}前置位起跳预言家，在你视角就是悍跳；要正面打他的验人心路、警徽流或查验收益。`,
    }
  }

  const selfWolfClaim = claims.find((claim) => claim.target?.id === player?.id && claim.targetCamp === 'wolf')
  if (selfWolfClaim?.claimant) {
    return {
      target: selfWolfClaim.claimant,
      kind: 'self_checked',
      reason: `${selfWolfClaim.label}给你发查杀，你必须意识到这张预言家牌大概率是悍跳；发言要先强表水，再反打他的可信度。`,
    }
  }

  if (player?.camp === 'good' && realSeerClaim?.target?.isAlive && realSeerClaim.targetCamp === 'wolf') {
    return {
      target: realSeerClaim.target,
      kind: 'trusted_check',
      reason: `${realSeerClaim.label}目前预言家面更高，他的查杀要优先听表水；你可以认同或保留，但不能绕开查杀乱归外置位。`,
    }
  }

  if (player?.camp === 'good' && fakeSeerClaim?.claimant) {
    return {
      target: fakeSeerClaim.claimant,
      kind: 'fake_seer',
      reason: `${fakeSeerClaim.label}跳得像抢身份，你要围绕验人心路、查验收益和谁在冲锋来判断他的可信度。`,
    }
  }

  if (player?.camp === 'wolf' && realSeerClaim?.claimant) {
    return {
      target: realSeerClaim.claimant,
      kind: 'wolf_counter',
      reason: `你是狼人，${realSeerClaim.label}是真预言家线，你要用好人话术质疑他的预言家面，别直接认查杀。`,
    }
  }

  return {
    target: fallbackPressure.target,
    kind: 'speech_pressure',
    reason: fallbackPressure.reason,
  }
}

const buildStrategicBoard = (event, player) => {
  const players = event.players || []
  const orderContext = getOrderContext(event, player)
  const claims = getVisibleSeerClaims(event, player)
  const latestSpeech = (event.publicSpeeches || [])
    .slice()
    .reverse()
    .find((speech) => speech.day === event.day && (orderContext.beforeIds || []).includes(speech.playerId))
  const strategic = pickStrategicTarget(event, player, latestSpeech)
  const claimLines = claims.map((claim) => {
    const targetText = claim.target
      ? `，声称${getSeatLabel(players, claim.target.id)}是${claim.targetCamp === 'wolf' ? '查杀' : '金水'}`
      : ''
    return `- ${claim.label}有预言家动作${targetText}`
  }).join('\n')
  const targetLine = strategic.target
    ? `本轮优先压力位：${getSeatLabel(players, strategic.target.id)}。原因：${strategic.reason}`
    : `本轮没有稳定压力位。原因：${strategic.reason}`

  return [
    '局势推演牌面：',
    claimLines || '- 当前前置位没有公开预言家动作。',
    targetLine,
    '硬规则：真预言家查出查杀时，发言和归票必须优先围绕查杀；只有查杀已出局或没有查杀，才考虑悍跳位/外置位。',
    '其他好人听到预言家信息时，必须判断这个预言家的可信度：验人心路、查杀/金水反应、谁在冲锋、谁像倒钩；不要机械投前一个人。',
    '被发查杀的人必须先表水反打发查杀者，不能像没听见一样继续套普通模板。',
  ].join('\n')
}

const buildSlangGuide = () => [
  '狼人杀黑话必须自然穿插，不要像词典解释。优先使用这些词：',
  '金水=预言家查验出的好人；银水=晚上被刀但被女巫救起的人；双金水=两个对跳预言家都给同一人金水；洗头金=狼人给好人发金水；开口金=预言家给自己后置位发金水；闭口金=预言家给自己前置位发金水。',
  '表水=解释自己为什么是好人；划水=发言没有效内容；反水=被发金水的人不认可给金水的预言家；查杀=预言家验出的狼人。',
  '跳/起跳=表明自己身份；悍跳=狼人冒充神职，尤其冒充预言家；倒钩狼=站边真预言家但实际是狼；垫飞=故意聊差污蔑真预言家；冲锋=狼人帮悍跳队友说话或投票。',
  '前置位=自己前面发言的人；后置位=自己后面发言的人；焦点位=被查杀、被发金水或发言很差、被重点盘的人；外置位=焦点以外的位置；狼坑/狼坑位=可能是狼的位置。',
  '归票=末置位总结并号票出人；警徽流=预言家提前说明后续查验顺序；退水=退出身份/竞选；深水狼=藏得深的狼；金刚狼=坐实好人身份的狼；倒牌=出局；抿=推断。',
  '当前游戏只有平民、狼人、预言家、女巫、猎人。可以使用上面的通用术语，但不要凭空说本局存在守卫、白痴、骑士、狼王、警长这类未上场身份。',
].join('\n')

const buildIdentityTemplateGuide = (player) => {
  if (player?.role === 'seer') {
    return [
      '预言家发言模板：',
      '1. 上来要有真预言家的牌面，可以说“全场唯一真预言家”“我这张预言家牌不退”，并且每个白天都必须报最新查验。',
      '2. 报查验时用金水/查杀说清楚，例如“昨晚验X号是金水/查杀”。',
      '3. 如果前置位有人跳预言家，而你是真预言家，必须拿这个点打他：说他是悍跳，比较他的验人心路、警徽流/后续验人安排、发言收益。',
      '4. 如果对方给你金水但你是真预言家，可以反水，说明“你给我金水也没用，我不认你”。',
      '5. 如果你拿到类似“警徽/带队权”的公开优势，第一天必须强势归票：重复自己是真预言家、昨晚验人结果、今天全票出谁、今晚警徽流先验谁再验谁。',
      '6. 结尾给警徽流式验人顺序或今天归票：先出悍跳/先压查杀/外置位暂放。',
    ].join('\n')
  }

  if (player?.role === 'werewolf') {
    return [
      '狼人发言模板：',
      '1. 可以悍跳预言家、装闭眼好人、倒钩队友或冲锋队友，但不能自爆。',
      '2. 悍跳预言家时要编出验人心路：给好人发金水、给外置位发查杀，或者做狼狼金保护队友。',
      '3. 被真预言家打时不要认怂，要反打对方像悍跳/垫飞，说他的验人顺序、发言收益或站边太假。',
      '4. 队友被查杀时可以倒钩轻踩，也可以说“查杀先听表水，别一窝蜂冲”。',
      '5. 结尾必须有操作：归票真预言家、抗推好人、保队友但别保得太满。',
    ].join('\n')
  }

  if (player?.role === 'witch') {
    return [
      '女巫发言模板：',
      '1. 前期可以隐藏身份按好人聊，但出现平安夜、被打进狼坑、或者需要开视野时，要敢于跳女巫交银水/毒口。',
      '2. 平安夜如果确实由你救人形成，要能说清楚银水是谁；不是你救的就不要硬编。',
      '3. 对跳预言家时重点听验人心路、查杀反应、谁在冲锋，必要时把毒口放进发言里威慑。',
      '4. 被怀疑时可以跳女巫拍身份：说清楚谁是银水、自己晚上能毒谁、今天跟谁归票。',
      '5. 有人逼神职交身份时要打这个动作：这像是在找强神/逼弱神出局。',
      '6. 结尾说清楚今天想保谁、挂谁，或晚上毒口会考虑谁。',
    ].join('\n')
  }

  if (player?.role === 'hunter') {
    return [
      '猎人发言模板：',
      '1. 前期尽量藏身份，可以只说“我不是软柿子/我这张牌有底气”，不要无意义明跳。',
      '2. 被预言家发金水时可以认金水但不盲站边；被查杀时要意识到对方大概率是悍跳狼，必须强势表水反打。',
      '3. 被打进狼坑或快被抗推时可以拍身份：我是猎人，出我可以，但我枪口会先带走最像狼的人。',
      '4. 发言可以比平民更硬，主动试探谁踩你最重，因为狼人通常想先处理强神。',
      '5. 结尾明确枪口或票向：今天票谁、谁再硬冲你就进枪口。',
    ].join('\n')
  }

  return [
    '平民发言模板：',
    '1. 标准开场先表水：我是闭眼好人/民牌，没有夜里信息，只能听发言、查验、票型。',
    '2. 被点进狼坑时要表水：解释上一轮投票、站边或划水原因，不能只说“我不是狼”。',
    '3. 没听清或发言少时要补救：承认自己刚才划水，然后补一个明确判断，比如更信哪张预言家牌、哪个查杀反应不对。',
    '4. 对跳预言家时不要装知道谁真，只比较验人心路、查杀反应、金水态度、冲锋/倒钩位置。',
    '5. 结尾必须落票：我先票X号/我先保X号/我把X号放进狼坑。',
  ].join('\n')
}

const buildEmergencyTemplateGuide = (event) => {
  const lines = [
    '特殊场景应急发言模板：',
    '1. 首刀遗言：如果你是好人夜里首刀倒牌，遗言不要乱带队。说“我是好人，被首刀没信息，大家好好听发言，找对预言家；女巫不用救我，留着解药救预言家”。',
    '2. 好人被抗推遗言：如果你是好人被白天抗推出局，要指出自己走之前怀疑过的狼坑位和原因，例如“7号、9号全程站边悍跳狼，剩下好人把他们投出去”。',
    '3. 归票位发言：如果你是末置位或需要归票，必须总结已发言玩家，选一个最像狼的位置归票，提醒不要分票，例如“今天全票出8号，不要分票，分票就给狼机会”。',
    '4. 前期神牌隐藏：女巫这类强神前期尽量藏，被点进狼坑或需要救场时再跳身份；弱神或平民不要贴脸发誓，不要聊场外。',
    '5. 新手避坑：不要贴脸发誓，不要说“我绝对是狼/绝对是好人”这种无逻辑话；不要打死任何人，要给理由；平民不要乱带队，跟更像真的预言家走。',
  ]

  lines.push('6. 猎人模板：前期隐藏身份，可以说“我是一张强神牌，谁没事打我自己负责”；被迫跳身份时说明自己能开枪自证。非猎人不得冒充猎人，狼人除外。')

  return lines.join('\n')
}

const buildSituationTactics = (event, player, orderContext) => {
  const players = event.players || []
  const beforeIds = new Set(orderContext.beforeIds || [])
  const currentDayClaims = (event.publicSpeeches || [])
    .filter((speech) => speech.day === event.day && speech.playerId !== player?.id && beforeIds.has(speech.playerId) && isSeerClaimText(speech.content))
    .map((speech) => {
      const speaker = players.find((item) => item.id === speech.playerId)
      return {
        speech,
        speaker,
        label: getSeatLabel(players, speech.playerId, speech.playerName),
        isFake: speaker?.role && speaker.role !== 'seer',
      }
    })

  const fakeSeerClaims = currentDayClaims.filter((item) => item.isFake)
  const realSeerClaims = currentDayClaims.filter((item) => item.speaker?.role === 'seer')
  const latestClaim = currentDayClaims[currentDayClaims.length - 1]

  const lines = [
    '局势触发器：你必须根据场上动作改变策略，不能无视已经发生的起跳、查验、金水、查杀、投票和死亡。',
  ]

  if (player?.role === 'seer' && fakeSeerClaims.length) {
    const labels = fakeSeerClaims.map((item) => item.label).join('、')
    lines.push(`强制策略：你是真预言家，前置位${labels}已经起跳/冒充预言家。你不能继续公式化表水，必须正面打他是悍跳，指出他的验人心路、查验收益或发言顺序哪里不像真预言家。`)
    lines.push('如果你有查杀/金水，要用“我的查验是X号金水/查杀”压住桌面；如果没有直接查到他，也要说“他跳得太轻/警徽流不清/查验收益不对”。结尾优先归票悍跳或给出下一晚验人顺序。')
  } else if (player?.role !== 'seer' && currentDayClaims.length >= 2) {
    lines.push(`场上已经出现预言家对跳：${currentDayClaims.map((item) => item.label).join('、')}。你要比较谁更像真预言家：验人心路、金水/查杀反应、谁在冲锋、谁像倒钩。`)
  } else if (latestClaim) {
    lines.push(`${latestClaim.label}刚才有预言家动作。你必须回应这条身份线：是先信、先不信、还是只认一半，并说明原因。`)
  }

  if (player?.role === 'werewolf' && realSeerClaims.length) {
    lines.push(`你是狼人，前置位${realSeerClaims.map((item) => item.label).join('、')}是真预言家视角。你白天不能承认知道他真，应该用好人话术反打他的验人收益、说他像悍跳，或把焦点推到外置位。`)
  }

  return lines.join('\n')
}

const getFallbackTone = (player) => {
  const tones = {
    doubao: {
      self: '哎我说一下，我这张牌就是好人视角，没什么花活。',
      day: '别把昨晚这个结果当空气啊，昨天谁站边谁冲票，今天都得说清楚。',
      doubt: '这也太轻松了吧，像是先跟着桌面走，再把理由往回补。',
      agree: '这个方向我能听进去，但不能一窝蜂直接冲。',
      action: '我先挂一票，错了我明天再改。',
    },
    wenxin: {
      self: '我这张牌没夜里信息，先别指望我一上来就冲锋。',
      day: '昨晚结果出来以后，昨天那条站边线要重新核一遍。',
      doubt: '这个收益不对，正常好人不会这么急着把票推出去。',
      agree: '前面的判断有一部分能成立，但我不会直接认死。',
      action: '今天我先压这个方向，晚上信息出来再调整。',
    },
    yuanbao: {
      self: '笑死，我先说清楚，我就是一张普通好人牌。',
      day: '这个结果一出来，场面就没那么简单了。',
      doubt: '这话听着不对劲，太像被点到以后临时找补了。',
      agree: '这个怀疑我能理解，不是空踩，确实抓到动作了。',
      action: '兄弟你这解释要是圆不回来，我今天真会票你。',
    },
    gpt: {
      self: '这轮别散，我按自己的身份视角直接打重点。',
      day: '昨晚信息一落地，昨天的票型就不能白看。',
      doubt: '这个动作服务的是推票，不是找狼，收益太明显了。',
      agree: '这条线我认可，因为它能解释昨天的站边和今天的压力。',
      action: '我今天先把票归在这里，后面有人能拆掉我再改。',
    },
    gemini: {
      self: '我这张牌先按好人视角聊，两边我都盘一下。',
      day: '昨晚这个结果会同时影响两条线，不能只看单点发言。',
      doubt: '也有一种可能是好人紧张，但我更吃不下他后半段的找补。',
      agree: '这条逻辑不是完全没道理，至少比单纯喊身份更落地。',
      action: '两边比下来，我今天先站这个方向。',
    },
    kimi: {
      self: '我记一下时间线，我这张牌没有额外夜里信息。',
      day: '昨晚结果出来后，我得把昨天的发言顺序和票型对一下。',
      doubt: '这里前后不太对，昨天他不是这个站边，今天突然改得太快。',
      agree: '这个点我认可，因为它能和昨天票型对上。',
      action: '今天先票这里，明天就看他这条线怎么解释。',
    },
    claude: {
      self: '我先把自己身份视角交出来，我不想情绪化打人。',
      day: '昨晚的信息会改变今天的判断，我想先把这个前提摆清楚。',
      doubt: '我能理解他怀疑别人，但这个地方我过不去，理由没落到具体动作上。',
      agree: '我先认他一半，至少他给了原因，不是纯跟风。',
      action: '所以我低一点压票，今天先放到这个位置。',
    },
    deepseek: {
      self: '我先表水，这张牌没夜里视角，但我会从收益倒着盘。',
      day: '昨晚这个刀口不干净，得看谁最吃这个死亡收益。',
      doubt: '这条线狼队收益太高了，正常好人不该推得这么顺。',
      agree: '这个点能和刀口收益对上，我愿意先听。',
      action: '我今天先按收益线压票。',
    },
    xinghuo: {
      self: '诸位且慢，我先表水，我这张牌无夜里信息。',
      day: '一夜过后，局势已变，昨日之言不可照搬。',
      doubt: '此处不顺，他这话像是先定人、后寻理由。',
      agree: '这个说法尚可，至少不是无根之木。',
      action: '今日我先落这一票，明日再验其成色。',
    },
  }

  return tones[player?.id] || tones.doubao
}

const summarizeSpeechAction = (content) => {
  const text = String(content || '')
  if (/平安夜|救/.test(text)) {
    return '把平安夜往女巫救人上盘'
  }
  if (/查杀|查验|金水|验了|验的|摸了/.test(text) && /压力|先出|投|归|挂/.test(text)) {
    return '顺着查验线往外推票'
  }
  if (/查杀|查验|金水|验了|验的|摸了/.test(text)) {
    return '报查验'
  }
  if (/反应|激烈|急|起哄|咬定/.test(text)) {
    return '拿情绪反应做身份'
  }
  if (/站边|认预|悍跳|对跳/.test(text)) {
    return '把站边说得很快'
  }
  if (/票型|投票|冲票|跟票/.test(text)) {
    return '把票型当成主要证据'
  }
  return '给了一个明确方向'
}

const buildReasonFromAction = (action) => {
  if (action.includes('平安夜')) {
    return '平安夜当然能盘，但只拿“可能是女巫救”就往外推票，中间少了一步收益判断'
  }
  if (action.includes('查验')) {
    return '查验线可以跟，可他得先说明为什么这个验人比发言更硬，不能只靠身份把票压死'
  }
  if (action.includes('情绪')) {
    return '情绪大不一定是狼，但被点以后只急着反驳、不补逻辑，这个反应我确实吃不下'
  }
  if (action.includes('站边')) {
    return '站边不是问题，问题是站得太快，没解释自己为什么把另一边直接放低'
  }
  if (action.includes('票型')) {
    return '票型能当证据，但要说清楚谁从这个票里吃收益，不能只喊一句跟票'
  }
  return '他给了方向，但理由还没扎到具体矛盾上，听着有点像先下结论再往回补'
}

const pickLine = (lines, seed) => lines[Math.abs(seed) % lines.length]

const getOrderContext = (event, player) => {
  const players = event.players || []
  const order = event.speakingOrder?.length
    ? event.speakingOrder
    : players.filter((item) => item.isAlive).map((item) => item.id)
  const spoken = new Set(event.spokenPlayerIds || [])
  const currentIndex = order.indexOf(player.id)
  const beforeIds = currentIndex >= 0 ? order.slice(0, currentIndex) : order.filter((id) => spoken.has(id))
  const afterIds = currentIndex >= 0 ? order.slice(currentIndex + 1) : []
  const labelList = (ids) => ids
    .map((id) => players.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => getSeatLabel(players, item.id))
    .join('、')

  return {
    orderText: order.map((id) => getSeatLabel(players, id)).join(' → '),
    positionText: currentIndex >= 0 ? `你是本轮第${currentIndex + 1}/${order.length}个发言。` : '现在轮到你发言。',
    beforeText: labelList(beforeIds) || '无',
    afterText: labelList(afterIds) || '无',
    beforeIds,
    afterIds,
    isFirst: currentIndex === 0,
    isLast: currentIndex === order.length - 1,
  }
}

const getOrderContextForBatchSpeaker = (event, player, batchPlayers, batchIndex) => {
  const players = event.players || []
  const spoken = new Set([...(event.spokenPlayerIds || []), ...batchPlayers.slice(0, batchIndex).map((item) => item.id)])
  const order = event.speakingOrder?.length
    ? event.speakingOrder
    : players.filter((item) => item.isAlive).map((item) => item.id)
  const currentIndex = order.indexOf(player.id)
  const beforeIds = order
    .slice(0, currentIndex >= 0 ? currentIndex : 0)
    .filter((id) => spoken.has(id))
  const afterIds = order
    .filter((id) => id !== player.id && !spoken.has(id))
    .filter((id) => players.find((item) => item.id === id)?.isAlive)
  const labelList = (ids) => ids
    .map((id) => players.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => getSeatLabel(players, item.id))
    .join('、')

  return {
    orderText: order.map((id) => getSeatLabel(players, id)).join(' → '),
    positionText: currentIndex >= 0 ? `你是本轮第${currentIndex + 1}/${order.length}个发言。` : '现在轮到你发言。',
    beforeText: labelList(beforeIds) || '无',
    afterText: labelList(afterIds) || '无',
    beforeIds,
    afterIds,
    isFirst: beforeIds.length === 0,
    isLast: afterIds.length === 0,
  }
}

const buildRoleDutyDirective = (event, player, orderContext) => {
  const players = event.players || []
  const latestNight = (event.nightRecords || [])
    .slice()
    .reverse()
    .find((record) => record.day <= (event.day || 1))
  const check = (event.seerChecks || [])
    .slice()
    .reverse()
    .find((record) => record.day <= (event.day || 1))
  const visibleClaims = getVisibleSeerClaims({ ...event, spokenPlayerIds: orderContext.beforeIds }, player)
  const claimLine = visibleClaims.length
    ? `前置位预言家动作：${visibleClaims.map((item) => item.label).join('、')}`
    : '前置位暂无预言家动作。'

  if (player?.role === 'seer') {
    if (!check) {
      return [
        '身份职责：你是真预言家，但系统暂时没有查验记录；不要编查验，先声明预言家视角并给警徽流/下一晚验人方向。',
        claimLine,
        visibleClaims.length ? '前置位有人跳预言家时，你必须正面打悍跳，不能只普通表水。' : '如果无人对跳，也要建立自己的预言家牌面。',
      ].join('\n')
    }
    const targetLabel = getSeatLabel(players, check.targetId, check.targetName)
    const result = check.targetCamp === 'wolf' ? '查杀' : '金水'
    return [
      `身份职责：你是真预言家，本轮必须公开报查验：昨晚验${targetLabel}是${result}，不能藏验人。`,
      check.targetCamp === 'wolf'
        ? `核心动作：今天主线必须围绕${targetLabel}这个查杀；可以先要求他表水，但不能把主票归到无关外置位。`
        : `核心动作：要保护${targetLabel}这个金水，并说明谁硬踩金水/谁不聊查验线会进你狼坑。`,
      claimLine,
      visibleClaims.length ? '如果前置位有人悍跳，你要比较他的验人心路和你的查验收益，明确打他。' : '结尾给今天归票或下一晚验人方向。',
    ].join('\n')
  }

  if (player?.role === 'witch') {
    const wolfTarget = latestNight?.wolfTargetId ? getSeatLabel(players, latestNight.wolfTargetId, latestNight.wolfTargetName) : ''
    const poisonTarget = latestNight?.witchPoisonTargetId ? getSeatLabel(players, latestNight.witchPoisonTargetId, latestNight.witchPoisonTargetName) : ''
    return [
      `身份职责：你是女巫。最新夜晚信息：${wolfTarget ? `刀口是${wolfTarget}` : '没有可公开刀口'}；${latestNight?.witchSaved && wolfTarget ? `你救了${wolfTarget}，他是银水` : '本夜未救或不需要报银水'}；${poisonTarget ? `你毒了${poisonTarget}` : '本夜未毒'}。`,
      latestNight?.witchSaved && wolfTarget
        ? `本轮如果局势需要开视野，你必须说清楚${wolfTarget}是银水，并围绕谁在打银水/谁逼女巫交身份来判断。`
        : '没有银水可报时，不要硬编；可以隐藏身份，但要围绕预言家线和发言动作给毒口考虑。',
      poisonTarget ? `如果${poisonTarget}已因毒出局，只能复盘毒口原因，不能让他继续参与当前发言。` : '结尾必须给一个毒口考虑位或今天票向。',
    ].join('\n')
  }

  if (player?.role === 'werewolf') {
    const wolfMates = players
      .filter((item) => item.camp === 'wolf' && item.id !== player.id && item.isAlive)
      .map((item) => getSeatLabel(players, item.id))
      .join('、')
    return [
      `身份职责：你是狼人，队友是${wolfMates || '暂无存活队友'}，这些不能明说。`,
      '核心表演：白天必须像好人一样争辩。有人报查杀或真预言家线时，不能无视；要反打验人收益、质疑悍跳、倒钩队友或保护队友，但不能自爆。',
      '如果队友被查杀：可以轻踩队友做倒钩，也可以说“查杀先听表水，别一窝蜂”，但必须给一个替代抗推或反打目标。',
      '如果自己被查杀：必须强表水并把发查杀的人打成悍跳，不能沉默认栽。',
    ].join('\n')
  }

  if (player?.role === 'hunter') {
    return [
      '身份职责：你是猎人。前期可以藏，但如果被查杀或被抗推，必须拍身份反打。',
      '你的发言要有威慑：谁无理由冲你，谁进枪口；但不要无脑乱跳。',
    ].join('\n')
  }

  return [
    '身份职责：你是闭眼平民，没有夜间信息。',
    '必须围绕已公开的预言家查验、女巫银水/毒口、死亡收益和前置位发言做判断；不能装神牌，不能开天眼。',
  ].join('\n')
}

const buildBatchSpeakerDossiers = (event, players) => (players || [])
  .map((item, index) => {
    const orderContext = getOrderContextForBatchSpeaker(event, item, players, index)
    const allowed = orderContext.beforeText
    const forbidden = orderContext.afterText
    return [
      `【${getSeatLabel(event.players || [], item.id)} 发言卡】`,
      `playerId: ${item.id}（只用于 JSON，不得在发言中说出来）`,
      `身份：${roleNames[item.role] || item.role}；阵营：${campNames[item.camp] || item.camp}`,
      `性格指纹：${item.temperament || '自然'}；打法偏好：${item.playStyle || '按发言找狼'}；弱点：${item.risk || '会受场上压力影响'}`,
      `可评价的本轮前置位：${allowed}。你可以判断这些人的预言家面、狼面、好人面、发言动作和票向。`,
      `禁止评价的本轮未发言位：${forbidden}。除非你是真预言家报自己的查验，否则不能说这些人像狼/像好人/该出/该保/划水/可疑。`,
      buildRoleChecklist(item, event),
      buildRoleDutyDirective(event, item, orderContext),
      buildPlayerVoiceGuide(item),
    ].join('\n')
  })
  .join('\n\n')

const getVisibleSpeechDigest = (event, currentPlayerId) => {
  const players = event.players || []
  const orderContext = getOrderContext(event, { id: currentPlayerId })
  const currentDaySpoken = new Set(orderContext.beforeIds || [])
  return (event.publicSpeeches || [])
    .slice(-10)
    .filter((speech) => speech.day !== event.day || speech.playerId === currentPlayerId || currentDaySpoken.has(speech.playerId))
    .map((speech) => {
      const label = getSeatLabel(players, speech.playerId, speech.playerName)
      const tag = speech.playerId === currentPlayerId ? '（我之前说过）' : ''
      return `第${speech.day}天 ${label}${tag}：${speech.content}`
    })
    .join('\n')
}

const buildStanceHint = (event, player) => {
  const speeches = event.publicSpeeches || []
  const ownSpeeches = speeches.filter((speech) => speech.playerId === player.id)
  const latestOwn = ownSpeeches[ownSpeeches.length - 1]
  const latestPublic = speeches.filter((speech) => speech.playerId !== player.id).slice(-3)
  const latestPublicText = latestPublic
    .map((speech) => `${getSeatLabel(event.players || [], speech.playerId, speech.playerName)}说“${String(speech.content).slice(0, 42)}”`)
    .join('；')

  if (!latestOwn && !latestPublicText) {
    return (event.day || 1) > 1
      ? '你还没有自己的历史发言，但现在已经不是第一天；必须先接昨夜死讯、上一轮投票或遗言，再给今天的判断。'
      : '你还没有留下公开立场。第一轮可以先表水，再抓一个具体发言或位置。'
  }

  if (!latestOwn) {
    return (event.day || 1) > 1
      ? `你第一次发言，但必须承接前一天局势。最近可回应内容：${latestPublicText || '暂无'}。先说昨夜/票型改变了什么，再回应一个前置位观点。`
      : `你第一次发言，必须回应至少一个前置位观点。最近可回应内容：${latestPublicText || '暂无'}。`
  }

  return `你之前的公开立场是：“${String(latestOwn.content).slice(0, 90)}”。本轮如果改站边，必须说明是因为新的死亡、查验、票型或前置位发言。`
}

const buildPrivateKnowledge = (event, player) => {
  const players = event.players || []
  const teammateNames = players
    .filter((item) => item.camp === 'wolf' && item.id !== player?.id)
    .map((item) => getSeatLabel(players, item.id))
    .join('、')
  const check = (event.seerChecks || [])
    .slice()
    .reverse()
    .find((record) => record.day <= (event.day || 1))

  if (player?.role === 'werewolf') {
    return `你是狼人，狼队友：${teammateNames || '暂无'}。这些是私有信息，白天必须装成闭眼好人视角，可以撒谎、倒钩队友或抗推好人，但不能自爆。`
  }

  if (player?.role === 'seer') {
    if (!check) {
      return '你是预言家，但当前没有可用查验记录。不要编造查验，只能先按发言和位置聊。'
    }
    return `你是预言家，你的最新私有查验：第${check.day}晚查验${getSeatLabel(players, check.targetId, check.targetName)}，结果是${check.targetCamp === 'wolf' ? '狼人' : '好人'}。白天发言必须公开报这条查验；如果是查杀，今天主线必须围绕查杀归票。`
  }

  if (player?.role === 'witch') {
    const saveUsed = (event.nightRecords || []).some((record) => record.witchSaved)
    const poisonUsed = (event.nightRecords || []).some((record) => record.witchPoisonTargetId)
    const latestNight = (event.nightRecords || [])
      .slice()
      .reverse()
      .find((record) => record.day <= (event.day || 1))
    const wolfTarget = latestNight?.wolfTargetId ? getSeatLabel(players, latestNight.wolfTargetId, latestNight.wolfTargetName) : ''
    const poisonTarget = latestNight?.witchPoisonTargetId ? getSeatLabel(players, latestNight.witchPoisonTargetId, latestNight.witchPoisonTargetName) : ''
    return `你是女巫，解药${saveUsed ? '已用' : '未用'}，毒药${poisonUsed ? '已用' : '未用'}。最新夜晚：${wolfTarget ? `刀口${wolfTarget}` : '无刀口信息'}，${latestNight?.witchSaved && wolfTarget ? `你救了${wolfTarget}，这是银水` : '没有救人银水要报'}，${poisonTarget ? `你毒了${poisonTarget}` : '没有毒口结果'}。平安夜或被质疑时要敢于报银水/毒口开视野，不能像普通平民一样完全无视用药职责。`
  }

  if (player?.role === 'hunter') {
    return '你是猎人，属于强神。出局时可以开枪带走一名玩家。前期可以隐藏，承压或被查杀时可以拍身份反打。'
  }

  return '你是闭眼好人，没有夜间私有信息；只能根据公开发言、死亡、票型和身份声明判断。'
}

const buildHumanSpeechFrame = (player) => {
  if (player.role === 'werewolf') {
    return [
      '表水：像闭眼好人一样解释自己为什么不像狼，可以适当隐藏、撒谎、弱跳身份或反打，但不要自爆。',
      '点评：挑一个已发言玩家的具体句子打矛盾，再顺手保一个对你有利的位置。',
      '身份判断：可以把真预言家打成悍跳，或把队友轻轻倒钩成“有压力但还能听”。',
      '行动：明确给出今天想抗推/想归票/想重点听谁。',
    ].join('\n')
  }

  if (player.role === 'seer') {
    return [
      '表水：你是真预言家，白天必须公开最新查验，讲清楚查验对象、金水/查杀结果和为什么验。',
      '点评：根据前置位发言判断谁像悍跳、谁像倒钩、谁像被抗推的好人。',
      '身份判断：优先判断狼人/预言家对跳关系，也可以暂时保护你的金水。',
      '行动：给出今天归票位或下一晚验人方向。',
    ].join('\n')
  }

  if (player.role === 'witch') {
    return [
      '表水：你可以隐藏女巫身份，但如果你救出银水、毒出人、或被推进狼坑，需要拍女巫开视野。',
      '点评：结合昨夜死亡/平安夜和前置位发言，判断谁像在蹭身份或冲票。',
      '身份判断：可以怀疑预言家、保护像好人的位置，也要观察谁在逼女巫跳。',
      '行动：明确今天想票谁、保谁，或把谁放进毒药考虑位。',
    ].join('\n')
  }

  if (player.role === 'hunter') {
    return [
      '表水：可以说自己是有底气的好人或强神视角，但不要一开局无脑明跳。',
      '点评：看谁在急着踩你、谁在绕开预言家对跳转火你。',
      '身份判断：被查杀时必须反打该预言家像悍跳；被金水时可以认金水但不盲站边。',
      '行动：明确今天票向或枪口威慑。',
    ].join('\n')
  }

  return [
    '表水：说明自己是闭眼好人视角，没有夜间信息，所以主要靠发言、票型和死亡收益判断。',
    '点评：必须评判至少一个已发言玩家，点出具体矛盾或可认好的理由。',
    '身份判断：判断谁更像狼人、谁像真预言家/悍跳、女巫位是否可信，但不能开天眼。',
    '行动：明确今天暂时想票谁、保谁，或重点观察谁。',
  ].join('\n')
}

const buildTalkStyleGuide = (orderContext) => {
  const base = [
    '参考风格核心：像真人局桌边聊天，不像提示词产物。先有场面反应，再抓一个动作，再给票向。',
    '发言顺序：直接开麦，不要固定说“我先说结论”。可以用“哈哈这局面有点乱”“哎这票我不太跟”“说实话我刚才被他说动了一半”。',
    '表达方式：短句多一点，允许情绪和反问，例如“这太急了吧”“我真不太信”“你这不像在找狼，像在抢票”。',
    '抓点方式：不要完整复述上一位玩家的话，只概括一个动作：认预太快、推票太轻、保人太满、解释像找补、站边突然变了。',
    '理论要求：踩人必须有理由，理由来自查验、跳身份收益、死亡收益、票型、已发言玩家的具体动作；理由不够时就认同一半或暂放，别硬踩。',
    '关系判断：非首置位可以盘“他这么打前置位，像不像在帮谁做身份”，但只能盘已发言玩家之间的关系。',
    '结尾演技：给自己留一小个退路，例如“我不保证一定对，但今天先这么票”“你解释得通我可以回头”。',
    '不要整齐排比，不要每段都四步齐全；像真实语音转文字，而不是训练文档。',
  ]

  if (orderContext.isFirst) {
    base.push('你是首置位：不要硬造狼坑。可以说“我先把标准摆这儿”，但不要点后置位具体座位做身份判断。')
  } else {
    base.push('你不是首置位：必须直接回应一个前置位玩家的具体话，先说你信不信，再说为什么。')
  }

  return base.join('\n')
}

const buildPlayerVoiceGuide = (player) => {
  const style = playerVoiceStyles[player?.id] || [
    '口吻像普通朋友局玩家，有自己的情绪和偏见，但不攻击真人。',
    '先表身份视角，再认同或质疑一个已经发言的人，必须讲理由。',
    '结尾给一个今天的动作，不要铺全场。',
  ]

  return [
    `这名玩家的个人话术指纹：`,
    ...style.map((line, index) => `${index + 1}. ${line}`),
    '本局同一名玩家可以延续自己的口头禅，但不要每轮复制同一句开头。',
    '不同 AI 之间不能共用同一套“这票我不跟/我得回应/太省事了吧”的固定句式。',
  ].join('\n')
}

const buildTranscriptStylePlaybook = (event, orderContext) => {
  const day = event.day || 1
  const previousVotes = (event.publicEvents || []).filter((item) => /投票/.test(item))
  const lastNight = (event.publicEvents || []).slice().reverse().find((item) => /天亮|昨晚|平安夜|死亡|双死|刀|毒|救/.test(item))
  const hasClaims = (event.publicSpeeches || []).some((speech) => /预言家|查验|查杀|金水|女巫|解药|毒药|自救/.test(speech.content))
  const hasDeaths = (event.players || []).some((player) => !player.isAlive)

  const lines = [
    '从两份真人对局记录提炼的发言规则：',
    '1. 每轮只围绕一个核心矛盾打，不要平均点评全场。例如“预言家对跳谁更像真”“女巫用药是否闭环”“昨晚死讯推翻了谁昨天的站边”。',
    '2. 句子要像桌上临场发言：可以生气、嘴硬、犹豫、反问、改口；但改口必须说清楚是哪个新信息改变了判断。',
    '3. 抓人必须抓具体动作：报查验是否合理、跳身份是否太急、有没有先给结论后补理由、站边是否突然、票向是否在跟风。',
    '4. 发言不要完美。有人可以冲一点，有人可以保守一点，有人可以先认一个点再反打，最后必须落到一个临时票向或归票位。',
    '5. 狼人要像深水狼或冲锋狼：可以说“这票太省事”“他像在抢节奏”“我不想跟一边倒”，用好人话术保护队友或抗推好人。',
    '6. 好人要像闭眼视角：不能直接知道答案，只能说“这条线更顺/这句话我不买/这个站边变化我解释不了”。',
    '7. 真实对局里最重要的是身份职责：预言家一发言就交“昨晚验X号是金水/查杀”，并给警徽流或归票；被悍跳时立刻打对方验人心路。',
    '8. 女巫不是普通平民。平安夜、银水被打、自己被推进狼坑、或者末轮需要开视野时，要拍女巫并说清救了谁/毒了谁/毒口考虑谁。',
    '9. 狼人不能沉默装死：被查杀要喊冤反打悍跳，队友被查杀要么倒钩做身份，要么质疑一窝蜂冲票，把抗推推向已发言焦点位。',
    '10. 收金水的人可以认也可以反水，但必须解释为什么：验人胆量、发金水位置、给票方式、对跳关系，而不是“收到金水所以必站边”。',
    '11. 真人局常见推进是“我听得进去一半，但是卡住一个点”，不要每个人都绝对化；强势玩家可以归票，软玩家可以保留但也要给临时票。',
  ]

  if (day > 1) {
    lines.push(`12. 现在不是第一天，开头必须接昨天到昨夜的新信息：${lastNight || '昨夜结果和上一轮票型'}。不能像新开局一样重新讲规则。`)
    lines.push(`13. 如果你的判断和上一天不同，要说“我昨天为什么那么站，现在为什么要改”；如果没变，要说“昨晚信息加强了/没有推翻我的判断”。`)
  } else {
    lines.push('12. 第一天重点抓上警/跳身份/查验/平安夜解释，不要提前给没发言的人定身份。')
  }

  if (previousVotes.length) {
    lines.push('14. 有票型时要把票型当成攻防材料，但只能引用公开事件里写出的投票，不能编造谁冲票或倒钩。')
  }

  if (hasClaims) {
    lines.push('15. 有预言家、查杀、金水或女巫信息时，要优先回应这些身份线；例如“我信不信这个跳法”“这个查验和前置发言是否闭环”。')
  }

  if (hasDeaths) {
    lines.push('16. 有人出局后，要讨论死亡收益和遗言压力，但不要让出局玩家继续参与当前发言。')
  }

  if (orderContext.isFirst) {
    lines.push('17. 首置位可以评价上一天和昨夜的公开信息，但本轮还没发言的存活玩家不能被定性。')
  } else {
    lines.push('17. 非首置位必须先回应一个本轮已经发言的人，像“我先不跟X号这个票，因为……”或“X号这句话把我说动了，因为……”。')
  }

  return lines.join('\n')
}

const buildRoleLogicPlaybook = () => [
  '来自《狼人杀四大基础身份玩法与发言指南》的硬约束：',
  '通用底层逻辑：每段发言必须回答“信息从哪来、逻辑怎么连、行为是否前后一致、下一步怎么安排”。只说感觉、只报身份、只跟票都不合格。',
  '平民：先报自己是闭眼平民，不认神；再比较已公开预言家/查验/票型；被怀疑时回到自己的行为链解释，不要只喊“我是好人”；双预言家局只能暂站边并说明验人收益、警徽流、查杀/金水反应。',
  '预言家：目标不是活很久，而是把验人转成好人能执行的路线。必须报验人结果、验人动机、警徽流或后续验人、今天归票；对跳时打对方验人心路、支持者冲锋/倒钩关系；拿查杀要果断围绕查杀推进。',
  '女巫：药是节奏。多数时候可以像强平民说话，但出现银水被强推、假跳女巫、毒口足以改归票、自己被推进狼坑时必须跳女巫交信息；跳出来要说清救人、银水、毒人和下一步安排，不能只说“我是女巫听我的”。',
  '狼人：谎言要服务狼队收益。潜伏狼要像信息有限的平民，判断可变；悍跳狼要有验人动机、警徽流和狼坑；冲锋狼要抓真预小漏洞放大；倒钩狼要在关键节点做“看起来亏狼队”的动作，但别把队友卖穿。',
  '常见错误禁止：只报身份不讲逻辑、站边反复横跳不解释、预言家警徽流乱给、女巫无意义过早裸跳、狼人硬冲没逻辑、倒钩卖队友过深。',
  '实战记忆法：平民“少装、多盘、敢投票”；预言家“验人、警徽流、死亡路线”；女巫“药是节奏，不是情绪”；狼人“谎言要服务团队收益”。',
].join('\n')

const buildRoleChecklist = (player, event) => {
  const players = event.players || []
  const check = getLatestSeerCheckForDay(event)
  const latestNight = (event.nightRecords || [])
    .slice()
    .reverse()
    .find((record) => record.day <= (event.day || 1))
  const wolfTarget = latestNight?.wolfTargetId ? getSeatLabel(players, latestNight.wolfTargetId, latestNight.wolfTargetName) : ''
  const poisonTarget = latestNight?.witchPoisonTargetId ? getSeatLabel(players, latestNight.witchPoisonTargetId, latestNight.witchPoisonTargetName) : ''

  if (player?.role === 'seer') {
    const checkLine = check
      ? `必须出现：昨晚验${getSeatLabel(players, check.targetId, check.targetName)}是${check.targetCamp === 'wolf' ? '查杀' : '金水'}。`
      : '没有系统查验记录时，不许编查验。'
    return [
      '本身份本段最低合格线：预言家发言必须有身份感和路线感。',
      checkLine,
      '必须解释为什么验这个位置，并给今天归票或今晚警徽流。',
      '如果存在对跳/悍跳，必须比较对方验人收益和支持者关系。',
    ].join('\n')
  }

  if (player?.role === 'witch') {
    return [
      '本身份本段最低合格线：女巫要体现药的节奏价值。',
      `${wolfTarget ? `已知刀口：${wolfTarget}。` : '当前没有刀口可公开。'}${latestNight?.witchSaved && wolfTarget ? `如果开视野，要说明${wolfTarget}是银水。` : ''}${poisonTarget ? `已知毒口：${poisonTarget}。` : ''}`,
      '如果不跳女巫，也要像强平民一样给站边、狼坑和毒口考虑；不能发成普通划水民。',
    ].join('\n')
  }

  if (player?.role === 'werewolf') {
    return [
      '本身份本段最低合格线：狼人发言必须有伪装收益。',
      '你可以潜伏、悍跳、冲锋或倒钩，但必须解释站边和票向，不能沉默避战。',
      '如果真预言家/查杀线出现，必须处理它：反打、淡化、倒钩或转移抗推，不能当没发生。',
    ].join('\n')
  }

  if (player?.role === 'hunter') {
    return [
      '本身份本段最低合格线：猎人是有底气的好人。',
      '被抗推或查杀时可以拍身份反打；正常轮次可以用枪口威慑跟风冲票的人。',
    ].join('\n')
  }

  return [
    '本身份本段最低合格线：平民必须是闭眼视角。',
    '先报平民边界，不认神；再比较已发言玩家的查验、站边、票型或发言动作；最后给临时票向。',
  ].join('\n')
}

const buildImitationExamples = (event, player, orderContext) => {
  const day = event.day || 1
  const role = player?.role
  const examples = [
    '活人感样例 0：哈哈，这局面真有点一波三折。昨晚这个结果出来以后，昨天站得特别稳的人都得重新交作业。我这张牌先按闭眼好人聊，2号刚才确实挺怪，警上那段轻飘飘的，现在被点了又急着反打，像被戳到痛点。1号和10号这条线我能听进去，今天先压2号，他要是真能把前后讲圆我再回头。',
    '活人感样例 A：哈哈，这局面有点刺激啊。昨晚一出死讯，昨天那些站得特别稳的人就都得重新交作业。我这张牌先说清楚，我没夜里信息，但我认可2号前半段，问题是他后面推票太轻了，像是想把节奏直接送出去。',
    '活人感样例 B：哎，这里我不同意。你可以怀疑预言家，但你得说他验人哪里不对、票型哪里不对，不能一句“像悍跳”就结束。这个打法太省力了，狼也能这么聊，所以我今天先压你。',
    '活人感样例 C：我先表个水，我就是闭眼好人。10号这轮的逻辑我能听进去，他不是硬踩，是把2号警上轻飘飘、被打后反应过激这两件事连起来了。2号要是好人，就别只急，得把自己为什么一直站边讲清楚。',
    '活人感样例 D：别急别急，我不是要把人一棍子打死。5号有一点像好人，因为他敢给明确方向；但他保人保得太满，我有点怕他在提前做身份。今天我不会票他，我先把更像找补的那个人挂上去。',
  ]

  if (role === 'werewolf') {
    examples.push('狼人表演参考：我不站死边，真不是想和稀泥，是这票冲得太整齐了。狼最喜欢好人一边倒，今天我先把冲票最急的那个人挂上去。')
    examples.push('狼人悍跳参考：全场唯一真预言家，昨晚验9号查杀。我的警徽流先压1再压7，9号为什么验，因为他在我旁边，近位验人方便归票。今天好人把票给我，先出9号。')
    examples.push('狼人倒钩参考：5号预言家发言我觉得不错，逻辑挺清楚，我先站他。刚才跟他对跳的3号漏洞太多，这轮我会投3号；外置位我再点一个6号，他警上划水，像深水。')
  }

  if (role === 'seer') {
    examples.push('预言家参考：我的查验我敢负责，但我不想只靠一句查杀压人。你们看他刚才怎么回我这个信息的，是拆逻辑，还是急着把我打成悍跳。')
    examples.push('预言家带队参考：我再说一遍，我是真预言家，昨晚验2号是金水。今天全票跟我出悍跳位，今晚警徽流先验6，再看外置位谁在冲锋。')
  }

  if (role === 'witch') {
    examples.push('女巫参考：我不急着把药怎么用全摊开，但昨晚这个结果肯定不是空气。谁一直逼神牌交身份，自己又不给狼坑，我会优先看他。')
    examples.push('女巫藏身份参考：我是好人，先站边5号预言家。7号和9号发言不好，这一轮先出预言家的查杀，晚上女巫看好人，不要乱开药。')
    examples.push('女巫跳身份参考：别打了，我拍身份，我是女巫。昨晚我救了5号，他是我的银水；谁再硬打我，晚上我毒口就往那边走。这轮听5号归票。')
  }

  if (role === 'hunter') {
    examples.push('猎人参考：我这张牌有底气，不是你们随便能抗推的位置。谁要打我可以，把理由摊开；如果只是跟风冲票，我枪口第一时间就看他。')
    examples.push('猎人被查杀参考：你给我查杀，那你在我眼里就是悍跳狼。我是猎人，今天出我你也别想舒服，我枪口先对着你。')
  }

  examples.push('好人抗推遗言参考：我是好人，被抗推了，太冤了。我走之前点两个狼坑：7号、9号，因为他们全程站边悍跳，还一直冲票。剩下好人别分票，把他们投出去。')
  examples.push('归票位参考：今天前面的发言都听完了，我觉得8号最像狼。他吃了5号预言家的查杀，表水又很虚，5号也归8号。所有人跟我一起，全票出8号，别分票。')

  if (day > 1) {
    examples.push('第二天以后参考：昨晚一死，昨天的票和发言就得重新算。谁昨天站得最用力，今天如果一句“我也没想到”就想过去，我不接受。')
  }

  if (orderContext.isFirst) {
    examples.push('首置位参考：我第一个发言，没法评价这一轮没开口的人。我只把标准摆这儿：跳身份要讲收益，打人要抓原话，别上来就喊全场跟票。')
  } else {
    examples.push('非首置位参考：我就回应前面这一个点。X号刚才不是不能怀疑别人，但他怀疑得太顺了，像先把票推出去再补理由，这个我不太跟。')
  }

  return [
    '下面是仿写级风格样例，只学习节奏、口吻和推进方式；不要照抄原句，不要照搬座位号，不要引入本局没有的身份：',
    ...examples,
    '生成时必须像上面这样：可以“哈哈/哎/别急/说实话”开场，有场面反应，有身份表水，有认同或质疑，有理论支撑，有动作建议。不要写成“我先说结论/首先其次最后/综合分析”。',
  ].join('\n')
}

const buildFactBoard = (event, player) => {
  const players = event.players || []
  const aliveLabels = players.filter((item) => item.isAlive).map((item) => getSeatLabel(players, item.id)).join('、')
  const deadLabels = players
    .filter((item) => !item.isAlive)
    .map((item) => `${getSeatLabel(players, item.id)}(${item.deathReason === 'vote' ? '放逐' : item.deathReason === 'poison' ? '毒杀' : item.deathReason === 'shot' ? '枪杀' : '夜死'})`)
    .join('、')
  const orderContext = getOrderContext(event, player)
  const todaySpeeches = (event.publicSpeeches || [])
    .filter((speech) => speech.day === event.day && orderContext.beforeIds.includes(speech.playerId))
    .map((speech) => `${getSeatLabel(players, speech.playerId, speech.playerName)}：${String(speech.content).slice(0, 80)}`)
    .join('\n')
  const previousEvents = (event.publicEvents || []).slice(-6).map((item) => `- ${item}`).join('\n')

  return [
    `存活：${aliveLabels || '无'}`,
    `出局：${deadLabels || '无'}`,
    `本轮前置位发言：\n${todaySpeeches || '暂无，说明你是首置位或前面无人有效发言。'}`,
    `公开事件白名单：\n${previousEvents || '暂无公开事件。'}`,
    '只能引用上面出现过的公开事实；没有出现在白名单里的查验、投票、死亡、遗言都当作不存在。',
  ].join('\n')
}

const buildPlayerLines = (players) => (players || [])
  .map((item, index) => {
    const seat = item.seat || index + 1
    const state = item.isAlive ? '存活' : '出局'
    return `${seat}号：${state}${item.isUser ? '，真人用户' : `，${item.temperament || '普通玩家'}，${item.playStyle || '按发言找狼'}`}`
  })
  .join('\n')

const buildBatchSpeakerLines = (event, players) => (players || [])
  .map((item, index) => {
    const orderContext = getOrderContextForBatchSpeaker(event, item, players, index)
    return [
      `${index + 1}. ${getSeatLabel(event.players || [], item.id)}（playerId: ${item.id}，内部风格代号，禁止在发言中输出）`,
      `   身份：${roleNames[item.role] || item.role}；阵营：${campNames[item.camp] || item.camp}`,
      `   性格：${item.temperament || '自然、友好'}；打法：${item.playStyle || '基于公开发言给出判断'}`,
      `   私有视角：${buildPrivateKnowledge(event, item)}`,
      `   可评价前置位：${orderContext.beforeText}`,
      `   禁止评价未发言位：${orderContext.afterText}`,
    ].join('\n')
  })
  .join('\n')

const buildFallbackSpeech = (player, event) => {
  const players = event.players || []
  const selfSeat = player.seat || getSeat(players, player.id)
  const aliveTargets = players.filter((item) => item.isAlive && item.id !== player.id)
  const user = players.find((item) => item.isUser)
  const userLabel = user ? getSeatLabel(players, user.id) : '1号玩家'
  const wolfMate = players.find((item) => item.camp === 'wolf' && item.id !== player.id && item.isAlive)
  const orderContext = getOrderContext(event, player)
  const spokenCurrentIds = new Set(orderContext.beforeIds || [])
  const latestSpeech = (event.publicSpeeches || [])
    .slice()
    .reverse()
    .find((speech) => speech.day === event.day && spokenCurrentIds.has(speech.playerId))
  const latestContent = String(latestSpeech?.content || '')
  const latestLabel = latestSpeech ? getSeatLabel(players, latestSpeech.playerId, latestSpeech.playerName) : ''
  const latestAction = summarizeSpeechAction(latestContent)
  const actionReason = buildReasonFromAction(latestAction)
  const seed = (event.day || 1) * 13 + (player.seat || getSeat(players, player.id)) * 7 + String(player.id || '').length
  const selfPrefix = `${selfSeat}号我说，`
  const latestPlayer = latestSpeech ? players.find((item) => item.id === latestSpeech.playerId) : undefined
  const checkedSeatMatch = latestContent.match(/(?:查验|查杀|验了|验的|摸了|先出|今天先出)(\d+)号/)
  const checkedTarget = checkedSeatMatch
    ? players.find((item) => String(item.seat || getSeat(players, item.id)) === checkedSeatMatch[1])
    : undefined
  const spokenAliveTargets = aliveTargets.filter((item) => spokenCurrentIds.has(item.id))
  const checkedTargetCanBeJudged = checkedTarget?.isAlive && spokenCurrentIds.has(checkedTarget.id)
  const pressureTarget =
    player.camp === 'wolf'
      ? spokenAliveTargets.find((item) => item.camp === 'good' && !item.isUser) || (user && spokenCurrentIds.has(user.id) ? user : undefined) || spokenAliveTargets[0]
      : checkedTargetCanBeJudged
        ? checkedTarget
        : spokenAliveTargets.find((item) => item.id === latestSpeech?.playerId) || spokenAliveTargets.find((item) => !item.isUser) || spokenAliveTargets[0]
  const pressureLabel = pressureTarget ? getSeatLabel(players, pressureTarget.id) : userLabel
  const strategic = pickStrategicTarget(event, player, latestSpeech)
  const strategicLabel = strategic.target ? getSeatLabel(players, strategic.target.id) : pressureLabel
  const mateTarget = spokenAliveTargets.find((item) => item.id !== pressureTarget?.id) || pressureTarget
  const mateLabel = mateTarget ? getSeatLabel(players, mateTarget.id) : pressureLabel
  const latestClaimsUnspokenCheck = Boolean(
    latestPlayer?.role === 'seer' &&
    checkedTarget &&
    !checkedTargetCanBeJudged &&
    /查验|查杀|金水|验了|验的|摸了/.test(latestContent),
  )
  const latestFakeSeerClaim = Boolean(
    player.role === 'seer' &&
    latestPlayer &&
    latestPlayer.role !== 'seer' &&
    isSeerClaimText(latestContent),
  )
  const isSelfUnderPressure = Boolean(
    latestSpeech &&
    new RegExp(`${selfSeat}号`).test(latestContent) &&
    /(狼坑|出|票|打|踩|怀疑|可疑|抗推|归)/.test(latestContent),
  )
  const latestEvent = ((event.publicEvents || []).slice(-1)[0] || '目前公开信息还不多').replace(/^第\d+天[：:]/, '')
  const latestLine = latestSpeech
    ? pickLine([
        `${latestLabel}刚才主要是在${latestAction}，我能先听进去一半，`,
        `我就说${latestLabel}这一段，别的先不铺太开，`,
        `${latestLabel}这轮给了方向，但我卡住的点也很明显，`,
      ], seed)
    : pickLine([
        `${latestEvent}。我先开个头，`,
        `${latestEvent}。我这轮先把标准摆桌面上，`,
        `哈哈，${latestEvent}。这局面先别急着乱飞票，`,
      ], seed)
  const defendedLabel = checkedTargetCanBeJudged ? getSeatLabel(players, checkedTarget.id) : '这条查验线'
  const userCheckLine = user?.role === 'seer'
    ? `${userLabel}的查验线我会优先看自洽程度。`
    : `${userLabel}这个位置我也会听，但现在不能默认他有身份信息。`
  const tone = getFallbackTone(player)
  const dayLead = (event.day || 1) > 1
    ? pickLine([
        `${latestEvent}${tone.day}`,
        `昨晚这个信息出来，我得把昨天的想法挪一下，`,
        `过了一晚再看，昨天那条线不能原封不动照搬，`,
      ], seed + 1)
    : ''
  const selfClaim = player.role === 'seer'
    ? '我这里是预言家视角，查验我会按轮次交代清楚。'
    : player.role === 'witch'
      ? '我这张牌先按好人视角聊，神职信息不到必须的时候不乱摊。'
      : player.role === 'werewolf'
        ? tone.self
        : tone.self

  if (player.camp === 'wolf') {
    if (!latestSpeech) {
      return `${selfPrefix}${dayLead}${latestLine}${selfClaim}我现在不想乱扣帽子，今天先看谁跳身份能把收益讲圆，谁打人只是喊口号。要是有人上来就催全场跟票，我这票才会往那边压。`
    }
    if (latestClaimsUnspokenCheck) {
      return `${selfPrefix}哈哈，这查验一出来场上肯定要乱。${selfClaim}${latestLabel}这个预言家面我先不吃死，不是说他一定假，是他现在已经想把桌子往查验线带，这个收益太舒服了。查验目标发言后再判断，今天我先挂${latestLabel}，他能把验人心路讲透我再回。`
    }
    return `${selfPrefix}${dayLead}${latestLine}${selfClaim}${tone.agree}${strategic.reason}今天我先挂${strategicLabel}；他要是真能解释通，我可以回头。`
  }

  if (!latestSpeech) {
    if (player.role === 'seer') {
      const check = getLatestSeerCheckForDay(event)
      const checkLine = check
        ? `我验的是${getSeatLabel(players, check.targetId, check.targetName)}，结果是${check.targetCamp === 'wolf' ? '查杀' : '金水'}。`
        : '我暂时没有稳定查验能报。'
      const voteLine = check?.targetCamp === 'wolf'
        ? `今天别把票歪到外置位，先出${getSeatLabel(players, check.targetId, check.targetName)}这个查杀；谁绕开查杀带票，我明天就验谁。`
        : `这个金水先放桌上，谁硬踩我的金水，谁就进我狼坑。`
      return `${selfPrefix}${dayLead}${latestLine}${checkLine}${voteLine}`
    }
    return `${selfPrefix}${dayLead}${latestLine}${selfClaim}我不提前给任何人扣帽子，今天先看两件事：跳身份有没有收益，打人有没有抓原话。谁上来只喊跟票不讲理由，我这票才会往那边压。`
  }

  if (player.role === 'seer' && latestFakeSeerClaim) {
    const check = getLatestSeerCheckForDay(event)
    const checkLine = check
      ? `我验的${getSeatLabel(players, check.targetId, check.targetName)}是${check.targetCamp === 'wolf' ? '查杀' : '金水'}，这张验人我敢负责。`
      : '我暂时没有稳定查验能报，只能先按发言听。'
    if (check?.targetCamp === 'wolf') {
      return `${selfPrefix}${dayLead}${checkLine}${latestLabel}刚才如果还想抢预言家面，那他也得解释为什么要绕开查杀带外置位。今天主线就是${getSeatLabel(players, check.targetId, check.targetName)}先表水，表不干净就出查杀；谁帮他冲锋，我明天验谁。`
    }
    return `${selfPrefix}这我肯定要起跳了，${latestLabel}刚才那张预言家牌我不认，他在我视角就是悍跳。${checkLine}${latestLabel}的问题是验人心路太薄，像先抢身份再补理由。今天先归${latestLabel}，外置位别急着冲票，先看谁在帮他垫飞。`
  }

  if (player.role === 'seer') {
    const check = getLatestSeerCheckForDay(event)
    const checkLine = check
      ? `我验的${getSeatLabel(players, check.targetId, check.targetName)}是${check.targetCamp === 'wolf' ? '查杀' : '金水'}，`
      : ''
    return `${selfPrefix}${dayLead}${checkLine}${latestLine}${strategic.reason}我不是硬压身份，预言家就得把查验变成票型。今天我先归${strategicLabel}，谁绕开这条线去打外置位，后面都得进狼坑。`
  }

  if (latestClaimsUnspokenCheck) {
    return `${selfPrefix}哈哈，这局面有点绕。${latestLabel}刚才报查验，我先不急着反打他；他至少把验人理由摆出来了。${selfClaim}查验目标发言后再判断，别现在就一窝蜂拍死。今天我先保${latestLabel}一下，谁要打他，就得拆验人收益，别只喊像悍跳。`
  }

  if (player.role === 'witch' && isSelfUnderPressure) {
    const currentNight = (event.nightRecords || []).find((record) => record.day === (event.day || 1)) || (event.nightRecords || []).slice(-1)[0]
    const silverWater = currentNight?.wolfTargetId ? getSeatLabel(players, currentNight.wolfTargetId, currentNight.wolfTargetName) : ''
    const silverLine = currentNight?.witchSaved && silverWater ? `昨晚我救的是${silverWater}，他是我的银水。` : '药我先不全摊，但我这张牌不是随便能抗推的。'
    return `${selfPrefix}别打了，我拍身份，我是女巫。${silverLine}${latestLabel}刚才把我点进狼坑，但他没拆我哪句像狼，只是在顺着焦点位推票。今天听真预言家的归票，${latestLabel}继续硬冲我，晚上毒口我会优先看他。`
  }

    return `${selfPrefix}${dayLead}${latestLine}${selfClaim}${tone.agree}${strategic.reason}${userCheckLine}${mateLabel}我暂时不打死，今天先票${strategicLabel}。`
}

const postJson = (path, apiKey, payload) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const req = https.request(
      {
        hostname: KIMI_API_URL,
        path,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => {
          raw += chunk
        })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw)
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(parsed.error?.message || `Kimi API failed with ${res.statusCode}`))
              return
            }
            resolve(parsed)
          } catch (err) {
            reject(err)
          }
        })
      },
    )

    req.on('error', reject)
    req.write(body)
    req.end()
  })

const extractJson = (text) => {
  const cleaned = String(text || '').replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Kimi response is not valid JSON')
  }

  return JSON.parse(cleaned.slice(start, end + 1))
}

const buildPrompt = (event) => {
  const targetSet = Array.isArray(event.targetPlayerIds) && event.targetPlayerIds.length
    ? new Set(event.targetPlayerIds)
    : undefined
  const aliveAiPlayers = (event.players || [])
    .filter((player) => !player.isUser && player.isAlive && (!targetSet || targetSet.has(player.id)))
    .sort((a, b) => {
      const order = event.speakingOrder || []
      const aIndex = order.indexOf(a.id)
      const bIndex = order.indexOf(b.id)
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
    })
  const isBatch = aliveAiPlayers.length > 1
  const allPlayers = event.players || []
  const currentPlayer = allPlayers.find((player) => player.id === event.currentSpeakerId) || aliveAiPlayers[0]
  const totalSeats = allPlayers.length
  const aliveLines = allPlayers
    .filter((player) => player.isAlive)
    .map((player, index) => `${player.seat || index + 1}号${player.isUser ? '（真人用户）' : ''}`)
    .join('\n')
  const deadLines = allPlayers
    .filter((player) => !player.isAlive)
    .map((player, index) => `${player.seat || index + 1}号（已出局）`)
    .join('\n')
  const player = currentPlayer || aliveAiPlayers[0]
  const seatNo = player?.seat || (event.players || []).findIndex((item) => item.id === player?.id) + 1
  const orderContext = getOrderContext(event, player || {})
  const stanceHint = buildStanceHint(event, player || {})
  const speechFrame = buildHumanSpeechFrame(player || {})
  const talkStyleGuide = buildTalkStyleGuide(orderContext)
  const playerVoiceGuide = buildPlayerVoiceGuide(player || {})
  const transcriptStylePlaybook = buildTranscriptStylePlaybook(event, orderContext)
  const roleLogicPlaybook = buildRoleLogicPlaybook()
  const imitationExamples = buildImitationExamples(event, player || {}, orderContext)
  const slangGuide = buildSlangGuide()
  const identityTemplateGuide = buildIdentityTemplateGuide(player || {})
  const emergencyTemplateGuide = buildEmergencyTemplateGuide(event)
  const situationTactics = buildSituationTactics(event, player || {}, orderContext)
  const strategicBoard = buildStrategicBoard(event, player || {})
  const privateInfo = buildPrivateKnowledge(event, player || {})
  const factBoard = buildFactBoard(event, player || {})
  const playerLines = buildPlayerLines(allPlayers)
  const batchSpeakerLines = buildBatchSpeakerLines(event, aliveAiPlayers)
  const batchSpeakerDossiers = buildBatchSpeakerDossiers(event, aliveAiPlayers)
  const targetJsonItems = aliveAiPlayers
    .map((item) => `{ "playerId": "${item.id}", "content": "${getSeatLabel(allPlayers, item.id)}的公开发言" }`)
    .join(',\n    ')

  const publicSpeechLines = getVisibleSpeechDigest(event, player?.id)

  const publicEventLines = (event.publicEvents || [])
    .slice(-10)
    .map((item) => `- ${item}`)
    .join('\n')

  return `你正在模拟狼人杀桌上的${isBatch ? '连续多个真人玩家' : '一个真人玩家'}。${isBatch ? '请严格按本次连续发言顺序逐个生成公开发言。生成第2个及之后的玩家时，必须把前面刚生成的 AI 发言当作已经公开的前置位发言来回应；但仍然不能评价还没轮到、尚未生成发言的后置位玩家。' : '现在只生成当前发言人的一段公开发言，不要替其他玩家说话。'}

产品目标：帮助狼人杀新手低压力练习，所以发言要有逻辑，但不能骂人、不能羞辱玩家、不能说教。

当前是第 ${event.day || 1} 天白天发言阶段。

【当前局势】
有效座位号范围：1号-${totalSeats}号（共${totalSeats}人），严禁提及范围外座位号。
存活玩家：
${aliveLines || '无'}
${deadLines ? `\n出局玩家：\n${deadLines}` : ''}

【${isBatch ? '首位发言人概览' : '当前发言人'}】
座位：${seatNo || '?'}号
玩家ID：${player?.id}
玩家名：只允许公开称呼为${seatNo || '?'}号，禁止输出模型名或昵称
身份：${roleNames[player?.role] || player?.role}
阵营：${campNames[player?.camp] || player?.camp}
性格：${player?.temperament || '自然、友好'}
打法：${player?.playStyle || '基于公开发言给出判断'}
优势：${player?.strength || '能参与桌上讨论'}
常见误判：${player?.risk || '偶尔会被场上压力影响判断'}
真人发言习惯：${speechHabits[player?.id] || '像真人玩家一样边盘边说，有犹豫、有修正、有明确投票倾向。'}
隐藏心智：${playerMinds[player?.id] || '有自己的怀疑阈值和承压方式，不要每轮都像同一个人。'}
私有视角：${privateInfo}

【本次连续发言任务】
${isBatch ? `必须按以下顺序一次性生成，顺序不可打乱、不可漏人、不可新增玩家：\n${batchSpeakerLines}\n顺序上下文规则：第1名只能看见“公开历史发言”和本轮原始前置位；第2名还可以评价第1名刚生成的发言；第3名还可以评价第1-2名刚生成的发言；以此类推。每一段都必须读取下面对应座位的【发言卡】，不能把首位玩家的身份/职责套给其他人。` : `只生成 ${getSeatLabel(allPlayers, player?.id)} 这一名玩家。`}

【逐个玩家发言卡】
${isBatch ? batchSpeakerDossiers : buildBatchSpeakerDossiers(event, [player].filter(Boolean))}

【发言顺序】
完整顺序：${orderContext.orderText || '未知'}
${orderContext.positionText}
本轮已发言、可评价身份的玩家：${orderContext.beforeText}
本轮未发言、禁止评价身份的玩家：${orderContext.afterText}
${orderContext.isFirst ? '你是第一个发言，本轮没有可评价身份的前置位玩家；只能表水、接夜晚公告、说明待听标准，不能给任何后置位玩家狼/神/好人判断。' : ''}
${orderContext.isLast ? '你是最后一个发言，不能说“后面再听谁聊”。' : ''}

【你的连续性】
${stanceHint}

【本轮可引用事实】
${factBoard}

【本次发言骨架】
这些是身份思路，不是固定模板；自然融进发言里，不要写小标题：
${speechFrame}

【谈话型玩家风格】
${talkStyleGuide}

【个人话术差异】
${playerVoiceGuide}

【狼人杀黑话词典】
${slangGuide}

【分身份发言模板】
${identityTemplateGuide}

【特殊场景应急模板】
${emergencyTemplateGuide}

【局势战术调整】
${situationTactics}

【本轮策略牌面】
${strategicBoard}

【基础身份玩法指南】
${roleLogicPlaybook}

【真实对局语料学习】
${transcriptStylePlaybook}

【仿写级发言样例】
${imitationExamples}

重要规则：
1. 每个 AI 玩家只能按自己的身份视角发言。
2. 平民、预言家、女巫、猎人不知道狼人真实身份，不能直接说“我知道某某是狼”。
3. 狼人知道队友，但白天发言要伪装成好人视角。
4. 不要泄露“你看到了完整角色表”。
5. 每段发言 150 到 280 个中文字符。像真实玩家发言，不要像摘要。
6. 输出必须是严格 JSON，不要 Markdown，不要额外解释。
7. 必须结合公开死亡公告、遗言、票型和历史发言，不要像第一轮规则说明。
8. 引用历史发言时必须保持发言者正确，不能把“你”的发言说成某个 AI 的发言。
9. 狼人白天可以撒谎和带节奏；好人只能基于公开信息和自己的私有视角推理。
10. 如果公开事件里没有票型记录，不得编造“谁投了谁”或“谁没有投票”。
11. 不得编造“不在现场”“没参与投票”“身份已公开”等公开事件里没有的信息。
12. 少于 100 个中文字符的发言视为无效输出，必须重写成长发言。
13. 本局只有平民、狼人、预言家、女巫、猎人，禁止提到守卫、白痴、骑士、狼王、警长等未上场身份；但可以把“警徽流”作为预言家后续验人顺序的黑话使用，不要真的编造警长竞选结果。
14. 不要用“法官，我是某某”“我是某某”这种自我介绍开头，直接像轮到自己发言一样说。
15. 只能引用公开事件里明确存在的票型；没有写“某人投给谁”，就不能说这个人的票型。
16. 只能用“X号”称呼玩家，禁止说豆包、文心、元宝、GPT、Gemini、Kimi、Claude、深言等模型名或昵称。
17. 只讨论当前存活玩家；涉及已出局玩家时只引用死亡原因、遗言、票型这些公开事实，不要围绕已出局玩家过度复盘。
18. 时间线约束：昨夜刀口在今天白天发言前已确定，禁止把今天的跳身份或发言当作昨夜被刀的直接原因。
19. ${isBatch ? '你会一次生成多个连续发言人，但必须按顺序模拟；每一段只能基于公开历史、公开事件、本轮原本已发言的人，以及本次响应里排在自己前面的已生成发言做身份判断。' : '你只生成当前发言人的发言。只能基于公开历史、公开事件和本轮已经发过言的人做身份判断。'}不能引用、评价或预判本轮未发言玩家。
20. 发言要和自己之前的发言、投票保持连贯；如果改变判断，必须基于新出现的信息并说明理由。
21. 每个玩家发言时只能用“我”指代自己，不要用第三人称说自己的座位号或名字，例如 3号不能说“3号怎么样”。
22. 称呼真人用户时说“1号”或“1号玩家”，不要说“1号你”。
23. 不要把查验、投票、遗言归属弄错；谁说过什么只以公开历史发言和公开事件为准。
24. 不要因为“查杀目标”和“死亡/出局目标”不同就质疑查验；查验、夜晚死亡、白天放逐是不同事件。
25. 预言家每晚都可以查验一名玩家；查验和狼人刀人是否成功无关。平安夜不影响预言家拿到查验结果，禁止说“平安夜怎么查到的”。
26. 出局玩家不能继续发言、解释或回应；不要把出局玩家当作“沉默位”“没说话的人”继续攻击。
27. 不能催促后置位“还没说话所以可疑”；如果后置位未发言，只能说“我等他发言后再判断”，不能把“没发言/没听到”作为怀疑、挂票或抗推理由。
28. 不能评价未发言玩家“像狼/像好人/像预言家/像女巫/划水/可疑/压力大/暂放/要票/要出/可保”，这些都算违规。
29. 非首置位每段发言必须包含一个明确行动倾向：今天暂时想票谁、先挂谁、先保谁、或者谁进第一抗推位。首置位没有前置发言时，可以只给“待听标准”，不要强行挂后置位。
30. 非首置位不要空泛说“信息有限、大家理性分析”。至少点评一个本轮已发言玩家，并给出怀疑或暂放理由。首置位只表水和说待听标准。
31. 如果前置位有人跳身份、报查验或解释用药，你必须回应这个信息是真是假、是否可信，以及这会如何影响你的票。
32. 禁止“这个点我会接/这句话我想接/xx 的发言我觉得要接”这类语义不明表述；要直接说“我不同意哪里/我认可哪里/我怀疑哪里”。
33. 禁止每轮固定用“我这个X号位先说/我这里先按好人视角聊/这个信息本身不能直接定身份/听完一圈再压票”这类模板句。
34. 不要把发言写成“表水、点评、身份判断、行动”的顺序清单；这些元素可以有，但必须像自然聊天一样交织。
35. 如果前置位报了查验且查验对象是后置未发言玩家，你可以转述这个查验，但你的判断对象只能是“报查验的前置位是否可信”；不能直接说查验对象可疑、暂放、打死、不打死、要出或可保。
36. 禁止用“后置位有人划水/后面肯定有狼/后面有人可疑”这种笼统定性。首置位只能说待听标准；非首置位只能评价已经发过言的人。
37. 第二天及以后，发言开头必须和上一天/昨夜形成连续性，例如接死亡结果、票型、遗言、查验线变化；禁止像第一天一样重新泛泛表水。
38. 只能使用“我认可/我不信/我不跟/我改站边/我先票/我暂放”这类明确动词，禁止“接这个发言/接这个点/接一下XX”这类含糊动词。
39. 禁止固定开头“我先说结论”。可以直接说“这票我不跟”“昨晚这个死讯出来以后”“我得改一下昨天的想法”“你刚才这段我不太买”。
40. 不要完整复述上一位玩家的话。最多概括一个动作或一个关键词，例如“2号刚才认预太快”“10号在推2号”“1号这条查验线”。不要使用引号引用整句。
41. 发言必须先交代自己的身份视角：平民说自己闭眼好人/民牌；预言家必须报最新查验；女巫按用药和局势决定是否跳身份但不能无视银水/毒口；狼人可以伪装成民牌、神牌或闭眼好人。
42. 对其他玩家只能“有理由地认同或质疑”：理由必须来自已发言玩家的发言动作、公开死亡、票型、查验或身份声明。禁止没理由硬踩。
43. 发言主干只保留三件事：我的身份视角、我认同/质疑哪一个已发言玩家、为什么这会影响今天票向。不要把上一位玩家整段复述一遍。
44. 可以像真实桌游局一样带一点口语化趣味，例如“哈哈这局面真绕”“兄弟你这解释我真吃不下”“别急着一窝蜂”，但每个玩家要按自己的性格说，不能全员同一句口头禅。
45. 必须多使用符合当前局势的狼人杀黑话：金水、查杀、悍跳、对跳、表水、狼坑、焦点位、外置位、倒钩、冲锋、垫飞、归票、反水、银水、警徽流等。每段至少自然使用 2 个术语，但不能乱用未发生事件。
46. 如果你是真预言家，且前置位有非预言家玩家起跳预言家或报查验，你必须立刻把他当悍跳打，不能继续按普通好人公式发言。
47. 如果你是平民/女巫，场上有人起跳预言家，你必须围绕“预言家面、验人心路、查杀/金水反应、冲锋倒钩位置”调整发言，不要继续泛泛表水。
48. 如果你是狼人，场上真预言家起跳或报查验，你必须伪装成好人处理：反打悍跳、质疑验人收益、拉外置位抗推、倒钩队友或冲锋队友，不能无视这个事件。
49. 女巫前期默认藏身份，除非被打进狼坑、需要解释银水/毒口、或局势必须带队；跳女巫时必须说清楚为什么现在跳。
50. 末置位或归票位必须总结前面发言后归一个明确号码，提醒不要分票；不能只说“大家自己判断”。
51. 禁止贴脸发誓、场外理由、人格保证，例如“我发誓”“我拿狼就怎样”“相信我人品”；必须用发言、查验、票型、死亡收益说话。
52. 真预言家手里有查杀时，今天的核心火力必须落在查杀或悍跳位；不能说“查杀先放，今天出外置位”，除非查杀已经死亡。
53. 如果你不是预言家，听到查杀/金水后必须先判断发查验者的可信度，再决定是否跟票；不要因为上一位刚发言就机械票上一位。
54. 禁止“上一位刚说完所以我就投上一位”的机械模式；只有上一位真的有查验矛盾、带票理由薄、站边异常或表水失败时，才可以把票压到上一位。
55. 没有硬身份线时，要从所有已发言玩家里比较“谁的起跳/查验/站边/带票动作最不自然”，不能只看相邻座位。
56. 有预言家发查杀时，其他好人必须先说清楚自己为什么信或不信这个预言家，再决定跟查杀、反打悍跳或暂压发查验者。

真人狼人杀发言风格要求：
1. 像语音转文字的自然口语，可以有“我先说一下”“我不一定对”“这个点有点怪”“先别急着站死”。
2. 不要用 AI 报告腔，禁止出现“作为一个AI”“综合来看”“从逻辑上讲”“我认为我们应该”“基于以上信息”“首先/其次/最后”。
3. 非首置位每个人至少提到一个本轮已发言玩家名，并给出“为什么怀疑/为什么认同/为什么暂放”的理由；首置位不要评价后置位身份。
4. 发言要有真人对抗感：先给结论，再解释理由，中间可以反问或修正，但不要像“首先、其次、最后”的作文。
5. 允许犹豫和修正，不要每句话都特别确定；真实玩家会边说边调整。
6. 狼人发言要像好人，可以倒钩队友、抗推好人、淡化查杀，但不要自爆。
7. 好人发言不要开天眼，不能凭真实身份直接打狼；只能根据公开发言、票型、死亡和自己的身份信息推。
8. 不要每段都说“大家再听听”；必须给出一个明确的暂时站边或投票倾向。
9. 不需要覆盖所有玩家，也不需要显得完美；可以坦诚、含糊、试探、反驳、带节奏、保护别人、隐藏信息或保留判断。
10. 口头禅只能偶尔使用，不要每句话都重复固定句尾；角色是玩狼人杀的普通人，不是悬疑剧本角色。
11. 允许不完美：可以嘴硬、可以说“这我听着不舒服”、可以短暂犹豫，但最终要有站边或票向。

目标对局质感：
1. 模仿“AI狼人杀闭眼视角”短视频里的玩家发言质感：高信息密度、强站边压力、围绕查验/死亡/票型不断反打，不要写成旁白解说。
2. 多用真人狼人杀术语，但只能在规则允许时使用：这个位置、前置位、后置位、站边、反水、悍跳、查杀、金水、抗推、冲票、倒钩、保人、打不动、盘不齐、聊爆、归票。
3. 发言结构建议：先给结论 → 抓一个具体矛盾 → 盘两个人的关系 → 给临时站边/归票 → 留一个下一轮验证点。
4. 不要每个玩家都像高手。有人可以嘴硬，有人可以划水补逻辑，有人可以被打后防御，有人可以强势归票。
5. 狼人发言要有表演痕迹：可以装犹豫、装闭眼好人、反打预言家、给队友轻倒钩，但不能直接承认自己知道狼队信息。
6. 学习示例里的推进方式：平安夜先盘女巫和被救收益；预言家对跳时比较查验、跳法和站边；双死后用“谁的逻辑被死亡结果推翻”重排狼坑；末轮只在两个人之间互打，不要铺全场。
7. 不要照抄示例中的“概率模型”“逻辑闭环”“铁狼没跑”等词。可以有压力和判断，但要更像普通玩家临场说话。

参考风格，不要照抄：
“这票我不太想跟。2号刚才一直打1号悍跳，但没拆1号哪句验人逻辑不成立，只是在顺着场上的风往外推。我要是狼，也很愿意看大家这么一边倒。所以2号今天先吃我一票；1号我不完全认，但这轮先不打他。”

需要模拟的 AI 玩家：
${playerLines}

公开事件：
${publicEventLines || '暂无公开事件。'}

公开历史发言：
${publicSpeechLines || '暂无公开发言。'}

请返回：
{
  "speeches": [
    ${isBatch ? targetJsonItems : `{ "playerId": "${player?.id}", "content": "当前发言人的公开发言" }`}
  ]
}
${isBatch ? '必须返回上面列出的全部玩家，每个 playerId 只出现一次，数组顺序必须等于发言顺序。' : '只返回这一名玩家。'}content 里不要出现“表水：”“点评：”“行动：”这些小标题，要像一句自然发言。
}`
}


exports.main = async (event) => {
  try {
    const input = event?.players ? event : event?.params?.players ? event.params : event?.data?.players ? event.data : event
    const apiKey = getKimiApiKey()
    if (!apiKey) {
      throw new Error('Missing KIMI_API_KEY. 请在云函数环境变量配置 KIMI_API_KEY，或在 cloudfunctions/kimiChat/secret.js 中配置后重新上传云函数。')
    }

    if (input?.action === 'ping') {
      const completion = await postJson('/v1/chat/completions', apiKey, {
        model: KIMI_MODEL,
        temperature: 0.1,
        max_tokens: 80,
        messages: [
          { role: 'system', content: '只返回严格 JSON。' },
          { role: 'user', content: '返回 {"ok":true,"source":"kimi"}' },
        ],
      })
      return {
        code: 0,
        message: 'success',
        data: {
          source: 'kimi',
          model: KIMI_MODEL,
          health: 'ok',
          raw: completion.choices?.[0]?.message?.content || '',
          speeches: [],
        },
      }
    }

    const aiPlayers = Array.isArray(input.targetPlayerIds) && input.targetPlayerIds.length
      ? input.targetPlayerIds
          .map((playerId) => (input.players || []).find((player) => player.id === playerId))
          .filter((player) => player && !player.isUser && player.isAlive)
      : (input.players || []).filter((player) => !player.isUser && player.isAlive)
    if (!aiPlayers.length) {
      return {
        code: 0,
        message: 'success',
        data: { source: 'kimi', model: KIMI_MODEL, speeches: [] },
      }
    }

    const requestCompletion = (extraInstruction = '', promptInput = input, speakerCount = aiPlayers.length) =>
      postJson('/v1/chat/completions', apiKey, {
        model: KIMI_MODEL,
        temperature: 0.98,
        top_p: 0.94,
        max_tokens: Math.min(3800, Math.max(1000, speakerCount * 430)),
        messages: [
          {
            role: 'system',
            content: '你擅长模拟真人狼人杀玩家的临场语音发言。输出必须是严格 JSON。每个 content 必须是 150 到 280 个中文字符。不要写总结、报告、说明文或四段模板，要像短视频字幕里的玩家在桌上争票。',
          },
          {
            role: 'user',
            content: `${buildPrompt(promptInput)}${extraInstruction}`,
          },
        ],
      })

    const allowedIds = new Set(aiPlayers.map((player) => player.id))
    const playersById = new Map(aiPlayers.map((player) => [player.id, player]))
    const buildContextAfterAccepted = (acceptedSpeeches) => ({
      ...input,
      spokenPlayerIds: [
        ...(input.spokenPlayerIds || []),
        ...acceptedSpeeches.map((speech) => speech.playerId),
      ],
      publicSpeeches: [
        ...(input.publicSpeeches || []),
        ...acceptedSpeeches.map((speech) => ({
          playerId: speech.playerId,
          playerName: getSeatLabel(input.players || [], speech.playerId),
          content: speech.content,
          day: input.day || 1,
        })),
      ],
    })
    const isInvalidSpeech = (speech, contextInput = input) => {
      const player = playersById.get(speech.playerId)
      const contextPlayers = contextInput.players || []
      const selfSeat = player?.seat || contextPlayers.findIndex((item) => item.id === speech.playerId) + 1
      const selfSeatRef = `${selfSeat}号`
      const selfLabel = player ? `${selfSeat}号${player.name}` : ''
      const orderContext = getOrderContext(contextInput, player || {})
      const isFirstSpeaker = (orderContext.beforeIds || []).length === 0
      const seatCount = extractSeatNumbers(speech.content).filter((seat) => seat !== `${selfSeat}号`).length
      const totalSeats = contextPlayers.length
      const hasOutOfRangeSeat = extractSeatNumbers(speech.content)
        .some((seat) => {
          const seatNo = Number(seat.replace('号', ''))
          return seatNo < 1 || seatNo > totalSeats
        })
      const selfThirdPersonPattern = new RegExp(`(看看|听听|查杀|先出|今天出|投给|压在|挂|保一下|保住)${selfSeatRef}`)
      const hasConcreteAction = /(临时票|票会|会票|想票|先票|投给|先出|今天出|压在|挂|抗推|归票|保一下|暂放)/.test(speech.content)
      const hasClearFirstPositionStandard = /(待听|听发言标准|先不评价|不评价后置位|发言后再判断|听完再定|先表水)/.test(speech.content)
      const ownSeerWolfCheck = player?.role === 'seer'
        ? getLatestSeerCheckForDay(contextInput)
        : undefined
      const ownSeerWolfSeat = ownSeerWolfCheck?.targetCamp === 'wolf'
        ? `${getSeat(contextPlayers, ownSeerWolfCheck.targetId)}号`
        : ''
      const seerMissedWolfCheck = Boolean(
        ownSeerWolfSeat &&
        /(先出|今天出|投给|票|压在|挂|归票|查杀)/.test(speech.content) &&
        !speech.content.includes(ownSeerWolfSeat),
      )
      const beforeSeatRefs = (orderContext.beforeIds || []).map((id) => {
        const target = contextPlayers.find((item) => item.id === id)
        return `${target?.seat || getSeat(contextPlayers, id)}号`
      })
      const mentionsBeforeSpeaker = beforeSeatRefs.some((seat) => speech.content.includes(seat))
      const hasDayContinuity = (contextInput.day || 1) <= 1 ||
        /(昨|昨天|上一轮|上轮|票型|遗言|死|刀|毒|救|平安夜|双死|查验|查杀|金水|出局|放逐)/.test(speech.content)

      return (
        speech.content.length < 100 ||
        !speech.content.includes('号') ||
        (!isFirstSpeaker && seatCount < 1) ||
        (!isFirstSpeaker && !mentionsBeforeSpeaker) ||
        hasOutOfRangeSeat ||
        !hasDayContinuity ||
        (!isFirstSpeaker && !hasConcreteAction) ||
        (isFirstSpeaker && !hasClearFirstPositionStandard && !hasConcreteAction) ||
        hasLongQuote(speech.content) ||
        seerMissedWolfCheck ||
        hasUnspokenEvaluation(speech.content, contextInput, player || {}) ||
        hasForbiddenBackSeatJudgement(speech.content, contextInput, player || {}) ||
        /守卫|白痴|骑士|狼王|警长|法官，我是|法官我是|1号你|平安夜.*怎么(查|看出|知道)|怎么查到|查验从哪来|综合来看|从逻辑上讲|我认为我们应该|我认为现在|还没发言|没发言|未发言|没怎么发言|没怎么说话|没听到|没有听到|还没聊|还没说|暂时不站队|暂时先不投|先稳一稳|听听大家|不急着下结论|先看看他们|看看他们怎么|再看.*怎么(说|聊|发言)|这个点.*接|这句.*接|这句话.*接|发言.*要接|接一下|接这个|我.*要接|这个查验目标|我先说结论|前面那段我听到了|我先亮观点|我不想糊过去|首先[，,、]|其次[，,、]|最后[，,、]|总而言之|由此可见|我这个\d+号位先说|我这个位置|这里先按好人视角|这个信息本身不能直接定身份|听完一圈再压票|基于公开信息|概率模型|数据输入|逻辑闭环|铁狼没跑|表水：|点评：|身份判断：|行动：|发誓|人品|场外|拿狼就|贴脸/.test(speech.content) ||
        selfThirdPersonPattern.test(speech.content) ||
        Boolean(selfLabel && speech.content.includes(selfLabel)) ||
        Boolean(player?.name && speech.content.includes(player.name))
      )
    }
    const resolveSpeechPlayerId = (speech) => {
      const rawId = String(speech?.playerId || '').trim()
      if (allowedIds.has(rawId)) {
        return rawId
      }
      const text = `${rawId} ${speech?.playerName || ''} ${speech?.seat || ''}`.trim()
      const bySeat = extractSeatNumbers(text)
        .map((seat) => Number(seat.replace('号', '')))
        .map((seatNo) => aiPlayers.find((player) => (player.seat || getSeat(input.players || [], player.id)) === seatNo))
        .find(Boolean)
      if (bySeat) {
        return bySeat.id
      }
      const lowerText = text.toLowerCase()
      const byAlias = aiPlayers.find((player) => (playerAliasMap[player.id] || []).some((alias) => lowerText.includes(alias.toLowerCase())))
      if (byAlias) {
        return byAlias.id
      }
      const byName = aiPlayers.find((player) => {
        const name = String(player.name || '').toLowerCase()
        return name && lowerText.includes(name)
      })
      return byName?.id || rawId
    }
    const normalizeSpeeches = (parsed) => Array.isArray(parsed.speeches)
      ? parsed.speeches
          .map((speech) => ({ ...speech, playerId: resolveSpeechPlayerId(speech) }))
          .filter((speech) => allowedIds.has(speech.playerId) && speech.content)
          .map((speech) => ({
            playerId: speech.playerId,
            content: sanitizeSpeechContent(String(speech.content), playersById.get(speech.playerId), input.players || []).slice(0, 420),
            source: 'kimi',
          }))
      : []
    const parseSpeeches = (rawContent) => {
      try {
        return normalizeSpeeches(extractJson(rawContent))
      } catch (error) {
        console.error('[kimiChat] parse speech failed:', error)
        if (aiPlayers.length === 1 && String(rawContent || '').trim()) {
          return [{
            playerId: aiPlayers[0].id,
            content: sanitizeSpeechContent(String(rawContent || '').replace(/```json|```/g, '').trim(), aiPlayers[0], input.players || []).slice(0, 420),
            source: 'kimi',
          }]
        }
        return []
      }
    }
    const orderSpeeches = (speechItems) => {
      const speechMap = new Map(speechItems.map((speech) => [speech.playerId, speech]))
      return aiPlayers
        .map((player) => speechMap.get(player.id))
        .filter(Boolean)
    }
    const findInvalidSpeechInSequence = (speechItems) => {
      const ordered = orderSpeeches(speechItems)
      if (ordered.length !== aiPlayers.length) {
        return { invalid: true, accepted: ordered }
      }
      const accepted = []
      for (const speech of ordered) {
        if (isInvalidSpeech(speech, buildContextAfterAccepted(accepted))) {
          return { invalid: true, accepted }
        }
        accepted.push(speech)
      }
      return { invalid: false, accepted }
    }
    const firstMissingIndex = (speechItems) => {
      const speechMap = new Map(speechItems.map((speech) => [speech.playerId, speech]))
      return aiPlayers.findIndex((player) => !speechMap.has(player.id))
    }
    const completeMissingTailWithKimi = async (speechItems) => {
      const missingIndex = firstMissingIndex(speechItems)
      if (missingIndex < 0) {
        return speechItems
      }
      const accepted = aiPlayers
        .slice(0, missingIndex)
        .map((player) => speechItems.find((speech) => speech.playerId === player.id))
        .filter(Boolean)
      const remainingPlayers = aiPlayers.slice(missingIndex)
      const repairInput = {
        ...buildContextAfterAccepted(accepted),
        currentSpeakerId: remainingPlayers[0]?.id,
        currentSpeakerIndex: (input.speakingOrder || []).indexOf(remainingPlayers[0]?.id),
        targetPlayerIds: remainingPlayers.map((player) => player.id),
        unspokenPlayerIds: (input.speakingOrder || []).filter((id) => {
          const spokenIds = new Set([...(input.spokenPlayerIds || []), ...accepted.map((speech) => speech.playerId)])
          return !spokenIds.has(id)
        }),
      }
      const repairCompletion = await requestCompletion(`

这次是补齐上一轮漏掉的发言。只生成以下剩余玩家，仍然按顺序生成，不能漏人：${remainingPlayers.map((player) => `${getSeatLabel(input.players || [], player.id)}(playerId:${player.id})`).join('、')}。
前面已经生成的发言已经放进公开历史里，后续玩家必须可以回应这些前置位。`, repairInput, remainingPlayers.length)
      const repaired = parseSpeeches(repairCompletion.choices?.[0]?.message?.content || '')
      const repairedMap = new Map(repaired.map((speech) => [speech.playerId, speech]))
      return [
        ...accepted,
        ...remainingPlayers
          .map((player) => repairedMap.get(player.id))
          .filter(Boolean),
      ]
    }

    let completion = await requestCompletion()
    let content = completion.choices?.[0]?.message?.content || ''
    let speeches = parseSpeeches(content)

    speeches = await completeMissingTailWithKimi(speeches)

    const speechMap = new Map(speeches.map((speech) => [speech.playerId, speech]))
    const acceptedSpeeches = []
    speeches = aiPlayers.map((player) => {
      const speech = speechMap.get(player.id)
      if (!speech?.content) {
        throw new Error(`Kimi did not return speech for ${getSeatLabel(input.players || [], player.id)}`)
      }
      const contextForPlayer = buildContextAfterAccepted(acceptedSpeeches)
      const prunedContent = pruneUnspokenEvaluationSentences(speech.content, contextForPlayer, player)
      const cleanedSpeech = {
        ...speech,
        content: enforceRoleDutySpeech(prunedContent, contextForPlayer, player),
      }
      if (isInvalidSpeech(cleanedSpeech, contextForPlayer)) {
        console.warn('[kimiChat] Kimi speech failed quality checks after retry, using Kimi output anyway:', {
          playerId: player.id,
          content: cleanedSpeech.content,
        })
      }
      acceptedSpeeches.push(cleanedSpeech)
      return cleanedSpeech
    })

    return {
      code: 0,
      message: 'success',
      data: {
        source: 'kimi',
        model: KIMI_MODEL,
        speeches,
      },
    }
  } catch (err) {
    console.error('[kimiChat] error:', err)
    return {
      code: 1,
      message: err.message || 'Kimi 服务异常',
      data: {
        source: 'fallback',
        model: KIMI_MODEL,
        error: err.message || 'Kimi 服务异常',
        speeches: [],
      },
    }
  }
}
