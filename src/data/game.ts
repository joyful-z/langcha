import type { AiProfile, GameMode, ReviewInsight, Role } from '@/types/game';

export const roleNames: Record<Role, string> = {
  villager: '平民',
  werewolf: '狼人',
  seer: '预言家',
  witch: '女巫',
  hunter: '猎人',
};

export const modeNames: Record<GameMode, string> = {
  play: 'AI 狼人杀',
  watch: 'AI 观战局',
};

export const roleCards: Array<{
  role: Role;
  title: string;
  badge: string;
  intro: string;
  goal: string;
  color: string;
}> = [
  {
    role: 'villager',
    title: '平民',
    badge: '民',
    intro: '没有夜间技能，靠发言、票型和前后矛盾找狼。',
    goal: '听清理由，别被带票，把狼人投出局。',
    color: '#42D9C8',
  },
  {
    role: 'werewolf',
    title: '狼人',
    badge: '狼',
    intro: '夜晚和狼队刀人，白天伪装好人制造抗推位。',
    goal: '藏住身份，保护队友，把好人投出局。',
    color: '#F05A3F',
  },
  {
    role: 'seer',
    title: '预言家',
    badge: '预',
    intro: '每晚查验一名玩家阵营，白天可公开查验信息。',
    goal: '用查验带队，让好人相信你并找出狼人。',
    color: '#FFD84D',
  },
  {
    role: 'witch',
    title: '女巫',
    badge: '巫',
    intro: '拥有解药和毒药，可救刀口，也可毒可疑玩家。',
    goal: '藏好身份，判断最赚用药时机。',
    color: '#B794F6',
  },
  {
    role: 'hunter',
    title: '猎人',
    badge: '猎',
    intro: '出局时可以开枪带走一名玩家，属于强神牌。',
    goal: '前期藏身份，承压自证，出局带走疑似狼。',
    color: '#FF8A5C',
  },
];

export const aiProfiles: AiProfile[] = [
  {
    id: 'doubao',
    name: '豆包',
    provider: 'Doubao',
    avatar: '豆',
    temperament: '轻松嘴碎、朋友局氛围',
    playStyle: '先表水再抓情绪反应，常用“哎呀”“家人们”“别一窝蜂”',
    strength: '缓和场面、帮好人把票聚起来',
    risk: '容易被强势发言带偏',
    color: '#2DB7F5',
  },
  {
    id: 'wenxin',
    name: '文心',
    provider: 'ERNIE',
    avatar: '文',
    temperament: '克制严谨、收益派',
    playStyle: '喜欢盘验人收益、轮次和风险，常说“这我不太能接受”',
    strength: '拆身份收益、找悍跳漏洞',
    risk: '过于保守，压迫感不够',
    color: '#B794F6',
  },
  {
    id: 'yuanbao',
    name: '元宝',
    provider: 'Tencent Hunyuan',
    avatar: '元',
    temperament: '接地气、火力直接',
    playStyle: '抓一句话里的漏洞，常用“笑死”“你这话太像找补了”',
    strength: '打焦点位、制造压力',
    risk: '容易踩得太猛被反打冲锋',
    color: '#42D9C8',
  },
  {
    id: 'gpt',
    name: 'GPT',
    provider: 'OpenAI',
    avatar: 'G',
    temperament: '强势控场、归票位',
    playStyle: '先压结论，再拆两步证据链，常说“这轮别散”“今天全票出”',
    strength: '归票、总结前置位逻辑',
    risk: '太想控场时会被盘成狼带队',
    color: '#5F3B2D',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    provider: 'Google',
    avatar: 'Ge',
    temperament: '概率派、反事实脑洞',
    playStyle: '会盘两种可能和死亡收益，常说“也有一种可能”',
    strength: '反推狼队收益、找深水狼',
    risk: '容易绕太远，结论偏慢',
    color: '#FF8A5C',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    provider: 'Moonshot',
    avatar: 'Ki',
    temperament: '细节控、时间线记忆型',
    playStyle: '盯前后立场变化、票型和遗言，常说“这句话变味了”',
    strength: '长上下文、复盘细节',
    risk: '容易把简单局盘复杂',
    color: '#2563EB',
  },
  {
    id: 'claude',
    name: 'Claude',
    provider: 'Anthropic',
    avatar: 'Cl',
    temperament: '温和但有判断、先认一半再反打',
    playStyle: '先承认合理点，再指出身份不成立，常说“这个地方我过不去”',
    strength: '降低情绪对抗、稳住好人共识',
    risk: '容易给狼留下辩解空间',
    color: '#E879F9',
  },
  {
    id: 'deepseek',
    name: '深言',
    provider: 'DeepSeek',
    avatar: '深',
    temperament: '冷静刀口派、反推收益',
    playStyle: '喜欢从夜晚刀口、票型收益反推，常说“这个刀口不干净”',
    strength: '盘狼队收益、找隐藏狼',
    risk: '有时过度相信收益线',
    color: '#1F8A70',
  },
  {
    id: 'xinghuo',
    name: '星火',
    provider: 'Spark',
    avatar: '星',
    temperament: '古风谋士、慢条斯理',
    playStyle: '发言带一点“诸位且慢”“此处不顺”的固定表述，但结论明确',
    strength: '稳站边、拆对跳',
    risk: '语气太稳时容易显得不够着急',
    color: '#C084FC',
  },
];

export const coachCards = [
  {
    title: '不会发言也没关系',
    text: '先说身份视角，再说你听到的疑点，最后给出暂时投票倾向。',
  },
  {
    title: '新手局重点',
    text: '不要追求一次盘全局，能稳定表达自己的理由就已经有效。',
  },
  {
    title: 'AI 只做陪练',
    text: '这里的 AI 玩家不会攻击你，复盘只指出下一局可以练的一个点。',
  },
];

export const reviewInsights: ReviewInsight[] = [
  {
    title: '表达完整度',
    content: '你能把“我为什么怀疑 TA”说出来，比只报结论更容易获得好人信任。',
    level: 'good',
  },
  {
    title: '投票风险',
    content: '当你没有强证据时，可以说“我先暂挂”，这样既表达立场，也保留修正空间。',
    level: 'warning',
  },
  {
    title: '下一局训练',
    content: '建议练习预言家首日发言：报查验、给下一验、说明被抗推时的处理方案。',
    level: 'info',
  },
];
