import type {
  Camp,
  GameMode,
  GamePhase,
  GameState,
  LastWordsRecord,
  NightRecord,
  Player,
  Role,
  SeerCheckRecord,
  Speech,
  VoteRecord,
  WitchNightAction,
} from '@/types/game';
import { aiProfiles, modeNames, roleNames } from '@/data/game';

const roleDeck: Role[] = [
  'werewolf',
  'werewolf',
  'werewolf',
  'villager',
  'villager',
  'villager',
  'seer',
  'witch',
  'hunter',
];
const playProfiles = aiProfiles.slice(0, 8);

const getCampByRole = (role: Role): Camp => role === 'werewolf' ? 'wolf' : 'good';

const getSeatOnly = (players: Player[], playerId?: string) => {
  const index = players.findIndex((player) => player.id === playerId);
  return `${index >= 0 ? index + 1 : '?'}号`;
};

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const buildPlayerGame = (userRole: Role): Player[] => {
  const userRoleIndex = roleDeck.indexOf(userRole);
  const remainingRoles = shuffle(roleDeck.filter((_, index) => index !== userRoleIndex));

  return [
    { id: 'you', name: '你', role: userRole, camp: getCampByRole(userRole), isUser: true, isAlive: true },
    ...playProfiles.map((profile, index) => {
      const role = remainingRoles[index];

      return {
        id: profile.id,
        name: profile.name,
        role,
        camp: getCampByRole(role),
        isUser: false,
        isAlive: true,
        profile,
      };
    }),
  ];
};

const buildWatchGame = (): Player[] => {
  const roles = shuffle(roleDeck);

  return aiProfiles.slice(0, 9).map((profile, index) => {
    const role = roles[index];
    return {
      id: profile.id,
      name: profile.name,
      role,
      camp: getCampByRole(role),
      isUser: false,
      isAlive: true,
      profile,
    };
  });
};

export const buildSpeakingOrder = (players: Player[]) => {
  const aliveIds = players.filter((player) => player.isAlive).map((player) => player.id);
  if (!aliveIds.length) {
    return [];
  }

  const startIndex = Math.floor(Math.random() * aliveIds.length);
  return [...aliveIds.slice(startIndex), ...aliveIds.slice(0, startIndex)];
};

const createSpeech = (
  player: Player,
  content: string,
  day: number,
  phase: GamePhase,
  index: number,
  playerName = player.name,
): Speech => ({
  id: `${day}-${phase}-${player.id}-${index}`,
  day,
  phase,
  playerId: player.id,
  playerName,
  content,
  tone: player.profile?.temperament || '新手视角',
  source: 'local_fallback',
});

const withDeath = (player: Player, day: number, reason: Player['deathReason']): Player => ({
  ...player,
  isAlive: false,
  deathDay: day,
  deathReason: reason,
});

export const createInitialGame = (mode: GameMode = 'play', userRole: Role = 'seer'): GameState => ({
  mode,
  userRole: mode === 'play' ? userRole : undefined,
  day: 1,
  phase: 'night',
  players: mode === 'watch' ? buildWatchGame() : buildPlayerGame(userRole),
  speakingOrder: [],
  spokenPlayerIds: [],
  speeches: [],
  votes: [],
  seerChecks: [],
  nightRecords: [],
  lastWords: [],
  userSpeechDraft: '',
  coachTip: mode === 'watch'
    ? `${modeNames[mode]}已开启。你将旁观 9 位 AI 玩家完成整局。`
    : `${modeNames[mode]}已开启。9 人局已发牌，你的身份是${roleNames[userRole]}。请完成夜晚行动后进入白天。`,
});

export const getAlivePlayers = (players: Player[]) => players.filter((player) => player.isAlive);

export const getLatestSeerCheck = (state: GameState): SeerCheckRecord | undefined =>
  state.seerChecks[state.seerChecks.length - 1];

export const createAiSeerCheck = (state: GameState): SeerCheckRecord | undefined => {
  const alivePlayers = getAlivePlayers(state.players);
  const seer = alivePlayers.find((player) => player.role === 'seer');

  if (!seer || seer.isUser || state.seerChecks.some((record) => record.day === state.day)) {
    return undefined;
  }

  const checkedIds = new Set(state.seerChecks.map((record) => record.targetId));
  const freshTargets = alivePlayers.filter((player) => player.id !== seer.id && !checkedIds.has(player.id));
  const fallbackTargets = alivePlayers.filter((player) => player.id !== seer.id);
  const targets = freshTargets.length ? freshTargets : fallbackTargets;
  const target = targets[Math.floor(Math.random() * targets.length)];

  if (!target) {
    return undefined;
  }

  return {
    day: state.day,
    targetId: target.id,
    targetName: getSeatOnly(state.players, target.id),
    targetRole: target.role,
    targetCamp: target.camp,
  };
};

export const getCurrentNightRecord = (state: GameState): NightRecord | undefined =>
  state.nightRecords.find((record) => record.day === state.day);

export const hasWitchSaved = (state: GameState) => state.nightRecords.some((record) => record.witchSaved);

export const hasWitchPoisoned = (state: GameState) =>
  state.nightRecords.some((record) => Boolean(record.witchPoisonTargetId));

export const getWolfTarget = (state: GameState, selectedWolfTargetId?: string): Player | undefined => {
  const alive = getAlivePlayers(state.players);
  const aliveGood = alive.filter((player) => player.camp === 'good');
  const user = alive.find((player) => player.isUser);
  const selectedWolfTarget = aliveGood.find((player) => player.id === selectedWolfTargetId);

  return (
    selectedWolfTarget ||
    aliveGood.find((player) => !player.isUser && player.role !== 'witch') ||
    aliveGood.find((player) => !player.isUser) ||
    user ||
    aliveGood[0]
  );
};

export const resolveNight = (
  state: GameState,
  selectedWolfTargetId?: string,
  witchAction?: WitchNightAction,
): { players: Player[]; nightRecord: NightRecord; winner?: Camp } => {
  const alive = getAlivePlayers(state.players);
  const aliveWolves = alive.filter((player) => player.camp === 'wolf');
  const witch = alive.find((player) => player.role === 'witch');
  const userWitch = witch?.isUser;
  const wolfTarget = getWolfTarget(state, selectedWolfTargetId);
  const canUseAntidote = Boolean(witch && wolfTarget && !hasWitchSaved(state));
  const canUsePoison = Boolean(witch && !hasWitchPoisoned(state));
  const witchSaved = userWitch
    ? Boolean(witchAction?.useAntidote && canUseAntidote)
    : Boolean(witch && wolfTarget && !hasWitchSaved(state) && state.day === 1);
  const selectedPoisonTarget = alive.find((player) => player.id === witchAction?.poisonTargetId && player.id !== witch?.id);
  const poisonTarget = userWitch
    ? canUsePoison && witchAction?.usePoison ? selectedPoisonTarget : undefined
    : witch && !hasWitchPoisoned(state) && state.day >= 2
      ? aliveWolves.find((player) => player.id === 'wenxin') || aliveWolves[0]
      : undefined;

  const deadByNight = wolfTarget && !witchSaved ? [wolfTarget] : [];
  const deadByPoison = poisonTarget ? [poisonTarget] : [];
  const deadPlayerIds = Array.from(new Set([...deadByNight, ...deadByPoison].map((player) => player.id)));
  const players = state.players.map((player) => {
    if (deadByNight.some((dead) => dead.id === player.id)) {
      return withDeath(player, state.day, 'night');
    }
    if (deadByPoison.some((dead) => dead.id === player.id)) {
      return withDeath(player, state.day, 'poison');
    }
    return player;
  });

  const deadNames = players.filter((player) => deadPlayerIds.includes(player.id)).map((player) => getSeatOnly(players, player.id));
  const announcement = deadNames.length ? `昨晚死亡的是：${deadNames.join('、')}。` : '昨晚是平安夜。';
  const nightRecord: NightRecord = {
    day: state.day,
    wolfTargetId: wolfTarget?.id,
    wolfTargetName: wolfTarget ? getSeatOnly(players, wolfTarget.id) : undefined,
    witchSaved,
    witchPoisonTargetId: poisonTarget?.id,
    witchPoisonTargetName: poisonTarget ? getSeatOnly(players, poisonTarget.id) : undefined,
    deadPlayerIds,
    announcement,
  };

  return { players, nightRecord, winner: decideWinner(players) };
};

const getSeatLabel = (state: GameState, playerId: string) => {
  const index = state.players.findIndex((player) => player.id === playerId);
  return `${index + 1}号`;
};

const getPlayerBySeat = (state: GameState, seatText?: string) => {
  const seat = Number(seatText || 0);
  return Number.isFinite(seat) && seat > 0 ? state.players[seat - 1] : undefined;
};

const extractSeerClaimTarget = (state: GameState, content: string) => {
  const text = String(content || '');
  const matched = text.match(/(?:验(?:了|的)?|查验(?:了|的)?|摸(?:了|的)?|给)?\s*(\d+)号[^。！？；;，,]{0,24}(查杀|金水|狼人|好人)/) ||
    text.match(/(\d+)号[^。！？；;，,]{0,12}(查杀|金水)/);

  if (!matched) {
    return undefined;
  }

  const resultText = matched[2] || matched[1];
  const seatText = matched[1];
  const target = getPlayerBySeat(state, seatText);

  if (!target) {
    return undefined;
  }

  return {
    target,
    targetCamp: /查杀|狼人/.test(resultText) ? 'wolf' as Camp : 'good' as Camp,
  };
};

const getVisibleSeerClaims = (state: GameState, speaker: Player) => {
  const speakerOrderIndex = state.speakingOrder.indexOf(speaker.id);
  const previousSpeakerIds = speakerOrderIndex >= 0
    ? new Set(state.speakingOrder.slice(0, speakerOrderIndex))
    : new Set(state.spokenPlayerIds);

  return state.speeches
    .filter((speech) => speech.day === state.day && previousSpeakerIds.has(speech.playerId) && isSeerClaimText(speech.content))
    .map((speech) => {
      const claimant = state.players.find((player) => player.id === speech.playerId);
      const claim = extractSeerClaimTarget(state, speech.content);

      return {
        speech,
        claimant,
        target: claim?.target,
        targetCamp: claim?.targetCamp,
        label: getSeatLabel(state, speech.playerId),
      };
    })
    .filter((claim) => Boolean(claim.claimant));
};

const getLatestSeerCheckForDay = (state: GameState) =>
  state.seerChecks
    .slice()
    .reverse()
    .find((record) => record.day <= state.day);

const getPreviousSpeakerIds = (state: GameState, speaker: Player) => {
  const speakerOrderIndex = state.speakingOrder.indexOf(speaker.id);
  return speakerOrderIndex >= 0
    ? new Set(state.speakingOrder.slice(0, speakerOrderIndex))
    : new Set(state.spokenPlayerIds);
};

const pickReasonedPressureTarget = (state: GameState, speaker: Player, latestSpeech?: Speech) => {
  const aliveOthers = getAlivePlayers(state.players).filter((player) => player.id !== speaker.id);
  const previousSpeakerIds = getPreviousSpeakerIds(state, speaker);
  const spokenTargets = aliveOthers.filter((player) => previousSpeakerIds.has(player.id));
  const speechByPlayer = state.speeches
    .filter((speech) => speech.day === state.day && previousSpeakerIds.has(speech.playerId))
    .reduce<Record<string, string>>((acc, speech) => {
      acc[speech.playerId] = `${acc[speech.playerId] || ''}${speech.content}`;
      return acc;
    }, {});

  if (!spokenTargets.length) {
    return {
      target: aliveOthers.find((player) => !player.isUser) || aliveOthers[0],
      reason: '我是首置位，不能硬造狼坑，只先交身份视角和待听标准。',
    };
  }

  const ranked = spokenTargets
    .map((target) => {
      const content = speechByPlayer[target.id] || '';
      let score = ((speaker.id.length * 11 + target.id.length * 7 + state.day * 5) % 13);
      const reasons: string[] = [];

      if (isSeerClaimText(content) && target.role !== 'seer') {
        score += 42;
        reasons.push('有起跳/报查验动作但预言家面不稳');
      }
      if (/查杀|金水|查验|验了|摸了/.test(content)) {
        score += 12;
        reasons.push('发言牵动查验线');
      }
      if (/投|票|归|出|抗推|挂/.test(content) && !/因为|理由|心路|收益|票型|发言|查验/.test(content)) {
        score += 18;
        reasons.push('带票理由太薄');
      }
      if (/跟票|一窝蜂|冲锋|垫飞|倒钩|站边/.test(content)) {
        score += 12;
        reasons.push('站边动作需要验成色');
      }
      if (/划水|没信息|随便|感觉|先看看|再说/.test(content)) {
        score += 10;
        reasons.push('有效信息偏少');
      }
      if (latestSpeech?.playerId === target.id) {
        score += 3;
      }
      if (speaker.camp === 'wolf' && target.camp === 'good') {
        score += 9;
      }

      return { target, score, reason: reasons[0] || '前置发言里有可追问的身份动作' };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  return {
    target: best?.target || spokenTargets[0],
    reason: best
      ? `${getSeatLabel(state, best.target.id)}${best.reason}，我先从这里施压。`
      : '我先按已经发过言的位置找压力点。',
  };
};

const pickStrategicTarget = (state: GameState, speaker: Player, latestSpeech?: Speech) => {
  const claims = getVisibleSeerClaims(state, speaker);
  const realSeerClaim = claims.find((claim) => claim.claimant?.role === 'seer');
  const fakeSeerClaim = claims.find((claim) => claim.claimant?.role !== 'seer');
  const ownCheck = speaker.role === 'seer' ? getLatestSeerCheckForDay(state) : undefined;
  const ownCheckTarget = ownCheck ? state.players.find((player) => player.id === ownCheck.targetId && player.isAlive) : undefined;
  const fallbackPressure = pickReasonedPressureTarget(state, speaker, latestSpeech);

  if (speaker.role === 'seer' && ownCheck?.targetCamp === 'wolf' && ownCheckTarget) {
    return {
      target: ownCheckTarget,
      kind: 'own_wolf_check',
      reason: `我手里有硬查验，${getSeatLabel(state, ownCheckTarget.id)}是查杀，今天票必须先压这张牌。`,
    };
  }

  if (speaker.role === 'seer' && fakeSeerClaim?.claimant) {
    return {
      target: fakeSeerClaim.claimant,
      kind: 'fake_seer',
      reason: `${fakeSeerClaim.label}前置位起跳预言家，在我视角就是悍跳，我要先打这张牌。`,
    };
  }

  const selfWolfClaim = claims.find((claim) => claim.target?.id === speaker.id && claim.targetCamp === 'wolf');
  if (selfWolfClaim?.claimant) {
    return {
      target: selfWolfClaim.claimant,
      kind: 'self_checked',
      reason: `${selfWolfClaim.label}给我发查杀，我这张牌肯定不能认，他的预言家面要被重新审。`,
    };
  }

  if (speaker.camp === 'good' && realSeerClaim?.target?.isAlive && realSeerClaim.targetCamp === 'wolf') {
    return {
      target: realSeerClaim.target,
      kind: 'trusted_check',
      reason: `${realSeerClaim.label}这张预言家牌目前验人心路更顺，他的查杀我会优先压。`,
    };
  }

  if (speaker.camp === 'good' && fakeSeerClaim?.claimant) {
    return {
      target: fakeSeerClaim.claimant,
      kind: 'fake_seer',
      reason: `${fakeSeerClaim.label}跳得像在抢身份，查验收益没讲透，我先把他放进狼坑。`,
    };
  }

  if (speaker.camp === 'wolf' && realSeerClaim?.claimant) {
    return {
      target: realSeerClaim.claimant,
      kind: 'wolf_counter',
      reason: `${realSeerClaim.label}把桌面往查验线压得太舒服，我要反打他的预言家面。`,
    };
  }

  return {
    target: fallbackPressure.target,
    kind: 'speech_pressure',
    reason: fallbackPressure.reason,
  };
};

const pickDiscussionTargets = (state: GameState, speaker: Player) => {
  const aliveOthers = getAlivePlayers(state.players).filter((player) => player.id !== speaker.id);
  const previousSpeakerIds = getPreviousSpeakerIds(state, speaker);
  const spokenAliveOthers = aliveOthers.filter((player) => previousSpeakerIds.has(player.id));
  const latestSpeech = state.speeches
    .slice()
    .reverse()
    .find((speech) =>
      speech.day === state.day &&
      speech.playerId !== speaker.id &&
      previousSpeakerIds.has(speech.playerId) &&
      aliveOthers.some((player) => player.id === speech.playerId),
    );
  const pressure = latestSpeech
    ? spokenAliveOthers.find((player) => player.id === latestSpeech.playerId)
    : undefined;
  const reserve = spokenAliveOthers.find((player) => player.id !== pressure?.id && !player.isUser) ||
    spokenAliveOthers.find((player) => player.id !== pressure?.id) ||
    pressure;

  return { pressure, reserve, latestSpeech };
};

const getFallbackTone = (player: Player) => {
  const tones: Record<string, { self: string; day: string; doubt: string; agree: string; action: string }> = {
    doubao: {
      self: '哎呀家人们，我先表个水，我这张牌就是好人视角，没什么花活。',
      day: '别把昨晚这个结果当空气啊，昨天谁站边谁冲票，今天都得说清楚。',
      doubt: '这也太轻松了吧，像先跟着桌面走，再把理由往回补。',
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
      self: '笑死，我先说清楚，我就是一张民牌视角。',
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
  };

  return tones[player.id] || tones.doubao;
};

const summarizeSpeechAction = (content: string) => {
  if (/平安夜|救/.test(content)) {
    return '把平安夜往女巫救人上盘';
  }
  if (/查杀|查验|金水|验了|验的|摸了/.test(content) && /压力|先出|投|归|挂/.test(content)) {
    return '顺着查验线往外推票';
  }
  if (/查杀|查验|金水|验了|验的|摸了/.test(content)) {
    return '报查验';
  }
  if (/反应|激烈|急|起哄|咬定/.test(content)) {
    return '拿情绪反应做身份';
  }
  if (/站边|认预|悍跳|对跳/.test(content)) {
    return '把站边说得很快';
  }
  if (/票型|投票|冲票|跟票/.test(content)) {
    return '把票型当成主要证据';
  }
  return '给了一个明确方向';
};

const pickLine = (lines: string[], seed: number) => lines[Math.abs(seed) % lines.length];

const isSeerClaimText = (content: string) =>
  /(我是|我这张牌是|我这里是|我跳|我起跳|起跳|跳).*预言家|预言家.*视角|报查验|查验是|查验了|昨晚验|昨夜验|验了\d+号|摸了\d+号|\d+号.*(金水|查杀)/.test(String(content || ''));

const buildContextualFallbackSpeech = (state: GameState, player: Player, index: number) => {
  const announcement = getCurrentNightRecord(state)?.announcement || '法官信息现在没有给出额外死讯。';
  const { pressure, reserve, latestSpeech } = pickDiscussionTargets(state, player);
  const selfSeat = getSeatLabel(state, player.id).replace(player.name, '');
  const pressureLabel = pressure ? getSeatLabel(state, pressure.id) : '';
  const reserveLabel = reserve ? getSeatLabel(state, reserve.id) : '';
  const latestContent = latestSpeech?.content || '';
  const latestLabel = latestSpeech ? getSeatLabel(state, latestSpeech.playerId) : '';
  const latestAction = summarizeSpeechAction(latestContent);
  const seed = state.day * 13 + index * 7 + player.id.length;
  const selfPrefix = `${selfSeat}我说，`;
  const latestPlayer = latestSpeech ? state.players.find((item) => item.id === latestSpeech.playerId) : undefined;
  const strategic = pickStrategicTarget(state, player, latestSpeech);
  const strategicLabel = strategic.target ? getSeatLabel(state, strategic.target.id) : pressureLabel;
  const checkedSeatMatch = latestContent.match(/(?:查验|查杀|验了|验的|摸了|先出|今天先出)(\d+)号/);
  const checkedTarget = checkedSeatMatch
    ? state.players.find((item) => String(state.players.findIndex((candidate) => candidate.id === item.id) + 1) === checkedSeatMatch[1])
    : undefined;
  const speakerOrderIndex = state.speakingOrder.indexOf(player.id);
  const previousSpeakerIds = speakerOrderIndex >= 0
    ? new Set(state.speakingOrder.slice(0, speakerOrderIndex))
    : new Set(state.spokenPlayerIds);
  const checkedTargetCanBeJudged = Boolean(checkedTarget?.isAlive && previousSpeakerIds.has(checkedTarget.id));
  const latestClaimsUnspokenCheck = Boolean(
    latestPlayer?.role === 'seer' &&
    checkedTarget &&
    !checkedTargetCanBeJudged &&
    /查验|查杀|金水|验了|验的|摸了/.test(latestContent),
  );
  const latestFakeSeerClaim = Boolean(
    player.role === 'seer' &&
    latestPlayer &&
    latestPlayer.role !== 'seer' &&
    isSeerClaimText(latestContent),
  );
  const isSelfUnderPressure = Boolean(
    latestSpeech &&
    new RegExp(`${selfSeat}号`).test(latestContent) &&
    /(狼坑|出|票|打|踩|怀疑|可疑|抗推|归)/.test(latestContent),
  );
  const latestLine = latestSpeech
    ? pickLine([
        `${latestLabel}刚才主要是在${latestAction}，我能先听进去一半，`,
        `我就说${latestLabel}这一段，别的先不铺太开，`,
        `${latestLabel}这轮给了方向，但我卡住的点也很明显，`,
      ], seed)
    : pickLine([
        `${announcement}我先开个头，`,
        `${announcement}我这轮先把标准摆桌面上，`,
        `哈哈，${announcement}这局面先别急着乱飞票，`,
      ], seed);
  const tone = getFallbackTone(player);
  const dayLead = state.day > 1
    ? pickLine([
        `${announcement}${tone.day}`,
        `昨晚这个信息出来，我得把昨天的想法挪一下，`,
        `过了一晚再看，昨天那条线不能原封不动照搬，`,
      ], seed + 1)
    : '';
  const selfClaim = player.role === 'seer'
    ? '我这里是预言家视角，查验我会按轮次交代清楚。'
    : player.role === 'witch'
      ? '我这张牌先按好人视角聊，神职信息不到必须的时候不乱摊。'
      : tone.self;

  if (!latestSpeech) {
    if (player.role === 'seer') {
      const check = getLatestSeerCheckForDay(state);
      const checkLine = check
        ? `我验的是${getSeatLabel(state, check.targetId)}，结果是${check.targetCamp === 'wolf' ? '查杀' : '金水'}，这信息我先放出来。`
        : '我暂时没有稳定查验能报。';
      const voteLine = check?.targetCamp === 'wolf'
        ? `今天别散票，先出${getSeatLabel(state, check.targetId)}这个查杀；谁跳出来保他，我明天就验谁。`
        : `我的金水先放桌上，今天外置位我先听发言，谁硬踩金水谁进我狼坑。`;
      return `${selfPrefix}${dayLead}${latestLine}${checkLine}${voteLine}`;
    }

    return `${selfPrefix}${dayLead}${latestLine}${selfClaim}我不提前给任何人扣帽子，今天先看两件事：跳身份有没有收益，打人有没有抓原话。谁上来只喊跟票不讲理由，我这票才会往那边压。`;
  }

  if (player.role === 'seer') {
    const check = getLatestSeerCheckForDay(state);
    const checkLine = check
      ? `我验的${getSeatLabel(state, check.targetId)}是${check.targetCamp === 'wolf' ? '查杀' : '金水'}，这张验人我敢负责。`
      : '我暂时没有稳定查验能报，只能先按发言听。';
    if (check?.targetCamp === 'wolf') {
      return `${selfPrefix}${dayLead}${checkLine}${latestLine}${strategic.reason}别把票歪到外置位，查杀牌先交表水，表不干净今天就出${strategicLabel}。谁绕开查杀去带别的位置，我就要盘他是不是在冲锋或者垫飞。`;
    }
    if (latestFakeSeerClaim) {
      return `${selfPrefix}这我肯定要起跳了，${latestLabel}刚才那张预言家牌我不认，他在我视角就是悍跳。${checkLine}${latestLabel}的问题是验人心路太薄，像先抢身份再补理由。今天先归${latestLabel}，外置位别急着冲票，先看谁在帮他垫飞。`;
    }
    return `${selfPrefix}${dayLead}${checkLine}${latestLine}${strategic.reason}${reserveLabel}先放一手，今天我先归${strategicLabel}。`;
  }

  if (player.role === 'werewolf') {
    const realSeerClaim = latestPlayer?.role === 'seer' && isSeerClaimText(latestContent);
    if (realSeerClaim) {
      return `${selfPrefix}${dayLead}${latestLine}${selfClaim}${latestLabel}这张预言家牌我先不认，验人心路太顺了，像先起跳抢桌子再补警徽流。${pressureLabel}如果是焦点位也得先表水，不能直接被查杀带走。今天我先挂${latestLabel}，外置位别一窝蜂冲票。`;
    }
    if (latestClaimsUnspokenCheck) {
      return `${selfPrefix}哈哈，这查验一出来场上肯定要乱。${selfClaim}${latestLabel}这个预言家面我先不吃死，不是说他一定假，是他现在已经想把桌子往查验线带，这个收益太舒服了。查验目标发言后再判断，今天我先挂${latestLabel}，他能把验人心路讲透我再回。`;
    }
    return `${selfPrefix}${dayLead}${latestLine}${selfClaim}${tone.agree}${strategic.reason}${reserveLabel}如果继续顺着这个方向推，也得把理由补出来。今天我的票先压${strategicLabel}。`;
  }

  if (player.role === 'witch') {
    if (isSelfUnderPressure) {
      const currentNight = getCurrentNightRecord(state);
      const silverWater = currentNight?.wolfTargetId ? getSeatLabel(state, currentNight.wolfTargetId) : '';
      const silverLine = currentNight?.witchSaved && silverWater ? `昨晚我救的是${silverWater}，他是我的银水。` : '药我先不全摊，但我这张牌不是随便能抗推的。';
      return `${selfPrefix}别打了，我拍身份，我是女巫。${silverLine}${latestLabel}刚才把我点进狼坑，但他没拆我哪句像狼，只是在顺着焦点位推票。今天听真预言家的归票，${latestLabel}继续硬冲我，晚上毒口我会优先看他。`;
    }
    if (latestClaimsUnspokenCheck) {
    return `${selfPrefix}哈哈，这局面有点绕。${latestLabel}刚才报查验，我先不急着反打他；他至少把验人理由摆出来了。我这张牌先按好人视角聊。查验目标发言后再判断，别现在就一窝蜂拍死。今天我先保${latestLabel}一下，谁要打他，就得拆验人收益，别只喊像悍跳。`;
    }
    return `${selfPrefix}${dayLead}${latestLine}我不想被人逼着交底。${strategic.reason}这不像在找狼，更像在逼神牌。${reserveLabel}暂时还能听，今天我先挂${strategicLabel}。`;
  }

  if (player.role === 'hunter') {
    if (isSelfUnderPressure) {
      return `${selfPrefix}行，别硬推我了，我拍身份，我是猎人。${latestLabel}刚才把我往狼坑里塞，但没拆我哪句聊爆，只是在顺着焦点位冲票。今天谁要出我可以，我枪口优先看${latestLabel}；如果他是好人，那就是我判断背锅。`;
    }
    return `${selfPrefix}${dayLead}${latestLine}我这张牌不是软柿子，先按好人强神视角聊。${strategic.reason}${reserveLabel}我暂时放一手。今天我先票${strategicLabel}，谁要强打我，自己想清楚收益。`;
  }

  const endings = [
    `今天我的临时票先挂${strategicLabel}，${reserveLabel}我不认死，但先不进第一抗推。`,
    `我会先站这个方向，票压${strategicLabel}；要是他能把这段讲圆，我可以回头。`,
    `这轮别散，我先把${strategicLabel}放进第一抗推位，${reserveLabel}的反应下一轮再看。`,
  ];

  if (latestClaimsUnspokenCheck) {
    return `${selfPrefix}哈哈，这局面有点绕。${latestLabel}刚才报查验，我先不急着反打他；他至少把验人理由摆出来了。${tone.self}查验目标发言后再判断，别现在就一窝蜂拍死。今天我先保${latestLabel}一下，谁要打他，就得拆验人收益，别只喊像悍跳。`;
  }

  return `${selfPrefix}${dayLead}${latestLine}${tone.self}${strategic.reason}${reserveLabel}有一点好人面，至少他没有空喊。${endings[index % endings.length]}`;
};

export const generateAiSpeeches = (state: GameState, targetPlayerIds?: string[]): Speech[] => {
  const targetSet = targetPlayerIds?.length ? new Set(targetPlayerIds) : undefined;

  return getAlivePlayers(state.players)
    .filter((player) => !player.isUser && (!targetSet || targetSet.has(player.id)))
    .map((player, index) => {
      const line = buildContextualFallbackSpeech(state, player, index);
      return createSpeech(player, line, state.day, 'day', index, getSeatLabel(state, player.id));
    });
};

export const generateUserSpeech = (state: GameState): string => {
  const user = state.players.find((player) => player.isUser);
  const latestCheck = getLatestSeerCheck(state);
  const nightRecord = getCurrentNightRecord(state);
  const checkLine = latestCheck
    ? `今晚我查验了${latestCheck.targetName}，结果是${latestCheck.targetCamp === 'wolf' ? '狼人' : '好人'}。`
    : '我还没有公开明确查验信息。';
  const nightLine = nightRecord ? `法官信息是：${nightRecord.announcement}` : '';

  if (user?.role === 'seer') {
    const checkTargetLine = latestCheck?.targetCamp === 'wolf'
      ? `今天主线别歪，我先归${latestCheck.targetName}这个查杀；他表水如果拆不掉我的验人心路，好人票就集中在这里。`
      : latestCheck
        ? `我的金水先放桌上，今天重点看谁硬踩金水、谁在身份线旁边垫飞。`
        : '今天我先听发言质量，重点看谁在回避身份线和投票理由。';
    return state.day === 1
      ? `我是预言家视角，${checkLine}${nightLine} ${checkTargetLine}`
      : `我延续昨天的预言家视角：${checkLine}${nightLine} 现在要结合票型看谁在回避关键问题。${checkTargetLine}不要分票给狼人冲票空间。`;
  }

  if (user?.role === 'werewolf') {
    return `${nightLine} 我先不站死边，1号位到现在的信息我会听，但我更想看谁在借查验线强行冲票。今天我会先把票压在发言最急、最想带节奏的位置，别让场上只剩跟票。`;
  }

  if (user?.role === 'witch') {
    return `${nightLine} 我先按好人逻辑聊，不急着交身份。今天我重点看谁在解释夜晚信息时前后不一致，谁只给结论不给理由。我的票会先放在发言最虚的位置。`;
  }

  if (user?.role === 'hunter') {
    return `${nightLine} 我先表水，我是好人强神视角。今天谁打我都可以，但要给出具体逻辑，别靠情绪硬踩。我会重点看谁在带抗推位，必要时我会拍身份把场面稳住。`;
  }

  return `${nightLine} 我是闭眼好人视角，手里没有技能信息，所以更看重发言和票型。今天我会重点听谁在回避具体问题，谁在跟着别人冲票。我的临时票会挂在解释最少的位置。`;
};

const getSeerWolfCheckTarget = (state: GameState) =>
  state.seerChecks
    .slice()
    .reverse()
    .find((record) => record.targetCamp === 'wolf' && state.players.find((player) => player.id === record.targetId)?.isAlive);

const getCurrentDaySeerClaims = (state: GameState) =>
  state.speeches
    .filter((speech) => speech.day === state.day && isSeerClaimText(speech.content))
    .map((speech) => {
      const claimant = state.players.find((player) => player.id === speech.playerId);
      const claim = extractSeerClaimTarget(state, speech.content);
      return {
        claimant,
        target: claim?.target,
        targetCamp: claim?.targetCamp,
        content: speech.content,
      };
    })
    .filter((claim) => Boolean(claim.claimant));

const pickVoteBySpeechQuality = (state: GameState, voter: Player) => {
  const aliveOthers = getAlivePlayers(state.players).filter((player) => player.id !== voter.id);
  const daySpeeches = state.speeches.filter((speech) => speech.day === state.day);
  const ranked = aliveOthers
    .map((target) => {
      const content = daySpeeches
        .filter((speech) => speech.playerId === target.id)
        .map((speech) => speech.content)
        .join('');
      let score = ((voter.id.length * 17 + target.id.length * 5 + state.day * 3) % 11);

      if (isSeerClaimText(content) && target.role !== 'seer') {
        score += 30;
      }
      if (/查杀|金水|查验|验了|摸了/.test(content)) {
        score += 8;
      }
      if (/投|票|归|出|抗推|挂/.test(content) && !/因为|理由|心路|收益|票型|发言|查验/.test(content)) {
        score += 14;
      }
      if (/划水|没信息|随便|感觉|先看看|再说/.test(content)) {
        score += 8;
      }
      if (voter.camp === 'wolf' && target.camp === 'good') {
        score += 10;
      }

      return { target, score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.target;
};

export const buildVotes = (state: GameState): VoteRecord[] => {
  const alive = getAlivePlayers(state.players);
  const seerWolfCheck = getSeerWolfCheckTarget(state);
  const realSeer = alive.find((player) => player.role === 'seer');
  const dayClaims = getCurrentDaySeerClaims(state);
  const fakeWerewolfSeerClaim = alive.find((player) =>
    player.role !== 'seer' &&
    player.camp === 'wolf' &&
    state.speeches.some((speech) =>
      speech.day === state.day &&
      speech.playerId === player.id &&
      isSeerClaimText(speech.content),
    ),
  );
  const fallbackTarget = alive.find((player) => player.id === (state.day === 1 ? 'wenxin' : 'gpt')) ||
    alive.find((player) => !player.isUser && player.camp === 'wolf') ||
    alive.find((player) => !player.isUser);
  const goodTargetId = seerWolfCheck?.targetId || fakeWerewolfSeerClaim?.id || fallbackTarget?.id || 'wenxin';
  const wolfCounterTarget = realSeer?.id ||
    alive.find((player) => player.camp === 'good' && !player.isUser)?.id ||
    alive.find((player) => player.camp === 'good')?.id ||
    'you';

  return alive.map((player) => {
    const realClaim = dayClaims.find((claim) => claim.claimant?.role === 'seer');
    const fakeClaim = dayClaims.find((claim) => claim.claimant?.role !== 'seer');
    const speechQualityTarget = pickVoteBySpeechQuality(state, player);
    let targetId = speechQualityTarget?.id || goodTargetId;

    if (player.role === 'seer' && seerWolfCheck?.targetId) {
      targetId = seerWolfCheck.targetId;
    } else if (player.camp === 'good') {
      if (seerWolfCheck?.targetId) {
        targetId = seerWolfCheck.targetId;
      } else if (fakeClaim?.claimant?.isAlive) {
        targetId = fakeClaim.claimant.id;
      } else if (realClaim?.target?.isAlive && realClaim.targetCamp === 'wolf') {
        targetId = realClaim.target.id;
      }
    } else if (seerWolfCheck?.targetId && state.players.find((item) => item.id === seerWolfCheck.targetId)?.camp === 'wolf') {
      const shouldBusTeammate = (player.id.length + state.day) % 4 === 0 && player.id !== seerWolfCheck.targetId;
      targetId = shouldBusTeammate ? seerWolfCheck.targetId : wolfCounterTarget;
    } else if (realSeer?.id) {
      targetId = (player.id.length + state.day) % 3 === 0
        ? realSeer.id
        : speechQualityTarget?.id || wolfCounterTarget;
    }

    return {
      voterId: player.id,
      targetId: targetId === player.id
        ? alive.find((item) => item.id !== player.id)?.id || goodTargetId
        : targetId,
    };
  });
};

export const resolveVote = (state: GameState, votes: VoteRecord[]) => {
  const counts = votes.reduce<Record<string, number>>((acc, vote) => {
    acc[vote.targetId] = (acc[vote.targetId] || 0) + 1;
    return acc;
  }, {});
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const eliminatedPlayerId = sorted[0]?.[0];
  const isTie = sorted.length > 1 && sorted[0][1] === sorted[1][1];
  const players = isTie
    ? state.players
    : state.players.map((player) =>
        player.id === eliminatedPlayerId ? withDeath(player, state.day, 'vote') : player,
      );

  return { players, eliminatedPlayerId: isTie ? undefined : eliminatedPlayerId, isTie };
};

export const resolveHunterShot = (state: GameState, hunter: Player): { players: Player[]; shotPlayer?: Player } => {
  if (hunter.role !== 'hunter') {
    return { players: state.players };
  }

  const aliveTargets = getAlivePlayers(state.players).filter((player) => player.id !== hunter.id);
  const fakeWerewolfSeerClaim = aliveTargets.find((player) =>
    player.camp === 'wolf' &&
    state.speeches.some((speech) =>
      speech.day === state.day &&
      speech.playerId === player.id &&
      isSeerClaimText(speech.content),
    ),
  );
  const shotPlayer = fakeWerewolfSeerClaim ||
    aliveTargets.find((player) => player.camp === 'wolf') ||
    aliveTargets.find((player) => !player.isUser);

  if (!shotPlayer) {
    return { players: state.players };
  }

  return {
    shotPlayer,
    players: state.players.map((player) =>
      player.id === shotPlayer.id ? withDeath(player, state.day, 'shot') : player,
    ),
  };
};

export const createLastWords = (player: Player, day: number, state?: GameState): LastWordsRecord => {
  const alive = state ? getAlivePlayers(state.players).filter((item) => item.id !== player.id) : [];
  const labelOf = (target: Player) => state ? getSeatLabel(state, target.id) : target.name;
  const seer = alive.find((item) => item.role === 'seer');
  const fakeSeer = state?.speeches
    .filter((speech) => speech.day === day && speech.playerId !== player.id && isSeerClaimText(speech.content))
    .map((speech) => state.players.find((item) => item.id === speech.playerId))
    .find((item): item is Player => Boolean(item && item.role !== 'seer'));
  const suspicious = [
    fakeSeer,
    alive.find((item) => item.camp === 'wolf' && item.id !== fakeSeer?.id),
    alive.find((item) => item.camp === 'wolf'),
  ].filter((item): item is Player => Boolean(item));
  const firstWolf = suspicious[0] ? labelOf(suspicious[0]) : '冲票最急的位置';
  const secondWolf = suspicious[1] ? labelOf(suspicious[1]) : '跟风最重的位置';
  const seerLabel = seer && state ? getSeatLabel(state, seer.id) : '更像真的预言家';
  const seed = day * 17 + player.id.length;
  const canTellHardTruth = seed % 3 !== 0;
  const shouldHideGoodInfo = player.camp === 'good' && seed % 4 === 0;

  let content: string;

  if (player.camp === 'wolf') {
    content = `我是好人，这轮被抗推太冤了。我走之前点一下，${seerLabel}这张预言家牌我不一定认，刚才票冲得太齐，里面肯定有狼借刀。剩下好人别分票，回头重点看最早带我节奏的人。`;
  } else if (player.role === 'seer') {
    content = canTellHardTruth
      ? `我是真预言家，被抗推只能交遗言了。好人别散，我这条查验线继续走，优先看刚才冲我票的人，尤其是${firstWolf}。今晚没有我验人了，女巫如果还在，毒口优先往冲锋位看。`
      : `我不多喊了，我是一张被抗推出去的好人牌。刚才票型太齐，${firstWolf}和${secondWolf}这两个位置至少开一狼。别因为我倒牌就彻底散票，继续按发言找悍跳。`;
  } else if (player.role === 'witch') {
    content = shouldHideGoodInfo
      ? `我是好人，这轮被推出去有点亏。药的信息我不全摊，免得狼晚上顺着找神。你们回头重点看${firstWolf}，他推我太顺了，像在捡抗推。`
      : `别分票了，我拍身份，我是女巫。这轮把我抗推出去很亏，刚才冲我最猛的${firstWolf}一定要进狼坑。剩下好人跟${seerLabel}的归票走，晚上信息别再乱盘。`;
  } else if (player.role === 'hunter') {
    content = shouldHideGoodInfo
      ? `我是好人，被抗推可以，但你们别分票。${firstWolf}这一轮带票太急，${secondWolf}跟票也没拆逻辑，我走之后先看这两个。`
      : `我是猎人，被抗推我肯定要留枪口。${firstWolf}这一轮带票太急，${secondWolf}跟票也没拆逻辑。我要是倒牌，优先把最像狼的位置带走；剩下好人别分票，继续听${seerLabel}的线。`;
  } else {
    content = canTellHardTruth
      ? `我是好人，被抗推了，太冤了。我走之前点两个狼坑：${firstWolf}、${secondWolf}，因为他们一个带票一个跟票，发言都没拆清楚逻辑。剩下好人别分票，跟更像真的预言家走。`
      : `我是好人，但我也可能盘错。遗言只留一句：别因为我出局就无脑认带队的人，${firstWolf}这张牌我最不放心，剩下你们自己对票型。`;
  }

  return {
    day,
    playerId: player.id,
    playerName: state ? getSeatOnly(state.players, player.id) : player.name,
    content,
  };
};

export const decideWinner = (players: Player[]): Camp | undefined => {
  const alive = getAlivePlayers(players);
  const wolves = alive.filter((player) => player.camp === 'wolf').length;
  const gods = alive.filter((player) => player.camp === 'good' && ['seer', 'witch', 'hunter'].includes(player.role)).length;
  const villagers = alive.filter((player) => player.camp === 'good' && player.role === 'villager').length;

  if (wolves === 0) {
    return 'good';
  }

  if (gods === 0 || villagers === 0 || wolves >= gods + villagers) {
    return 'wolf';
  }

  return undefined;
};

export const getVoteSummary = (state: GameState) => {
  const byId = state.players.reduce<Record<string, Player>>((acc, player) => {
    acc[player.id] = player;
    return acc;
  }, {});

  return state.votes.map((vote) => ({
    voterId: vote.voterId,
    targetId: vote.targetId,
    voterName: byId[vote.voterId] ? getSeatOnly(state.players, vote.voterId) : vote.voterId,
    targetName: byId[vote.targetId] ? getSeatOnly(state.players, vote.targetId) : vote.targetId,
  }));
};

export const getPhaseLabel = (phase: GamePhase) => {
  const labels: Record<GamePhase, string> = {
    night: '夜晚行动',
    day: '白天发言',
    vote: '投票放逐',
    lastWords: '遗言阶段',
    result: '赛后复盘',
  };

  return labels[phase];
};
