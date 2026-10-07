import type { AiChatRequest, AiChatResponse } from '@/types/game';

const dayOne = [
  '这轮先别急着站死，第一天硬信息少，但不代表可以空过。谁跳预言家，就把为什么验、为什么今天要推这个人讲明白；只喊“像狼”不拆原话，我肯定不跟。现在我先看3号文心的发言质量。',
  '这票我现在不想乱跟。1号如果报查验，就把查验线讲清楚；如果没有硬查杀，那我更看谁在强行带节奏。4号元宝要是只说感觉怪、不点具体句子，我会直接挂他。今天先在3号和4号里找压力位。',
  '别把话说太满。5号GPT说得完整，不等于一定好，狼也很会先搭框架再让好人跟。3号文心如果一直保守、不交怀疑对象，也不能一直放着。现在我更想看1号怎么给查验和票向。',
  '我说个不一定对的判断。平安夜只能说明刀口没落地，不能反推谁一定是神。2号豆包现在我先不打，他至少在给判断；3号文心如果继续绕，我今天会先压3号。',
  '今天别散票，散票最舒服的一定是狼。1号要是真预言家，就把查验结果和最想出的点摊开；没有强信息的话，先处理发言最空的人。我临时票挂3号文心，除非5号GPT后面硬带节奏。',
];

const dayTwo = [
  '昨晚这个结果出来以后，昨天的站边得重新算。谁昨天冲得最急，今天如果一句“我也没想到”就想过去，我不接受。票型里跟得太顺的位置要解释，我今天先盯昨天最想带票的人。',
  '昨晚信息不能空过。现在别再只说感觉怪，要说死亡收益落到谁身上。要是倒牌的人昨天一直打5号GPT，那5号至少得回应；要是倒的是边缘位，也可能是狼在躲刀口分析。我今天先看3号文心和5号GPT。',
  '我有个点没放下，昨天谁跟票跟得太快，这个才有用；没记录的票别硬编。好人跟票一般会犹豫，狼冲票反而顺。6号Kimi如果要拍身份，就把用药或查验逻辑说干净。',
  '今天不能各聊各的了。1号预言家如果还有查验，先报结果，再说这个结果怎么改狼坑。遗言只能当公开事实看，不能当圣旨。我现在优先打票型收益最大的人，3号和5号如果互保太明显，里面要开狼。',
  '今天最好别散票。狼最想看到好人各怀疑各的，最后两票一冲带走一个好人。查验信息我会听，但查验不是免死金牌，发言也要过关。我的临时归票压昨天解释最模糊的位置。',
];

export default function localAiFallback(data?: AiChatRequest): AiChatResponse {
  const targetSet = data?.targetPlayerIds?.length ? new Set(data.targetPlayerIds) : undefined;
  const players = data?.players.filter((player) => !player.isUser && player.isAlive && (!targetSet || targetSet.has(player.id))) || [];
  const lines = data?.day === 1 ? dayOne : dayTwo;
  const latestEvent = data?.publicEvents?.[data.publicEvents.length - 1];

  return {
    source: 'mock',
    model: 'local-fallback',
    speeches: players.map((player, index) => {
      const line = lines.find((item, lineIndex) => lineIndex >= index && !item.includes(player.name)) ||
        lines.find((item) => !item.includes(player.name)) ||
        lines[index % lines.length].split(player.name).join('我');

      return {
        playerId: player.id,
        content: `${latestEvent ? latestEvent + ' ' : ''}${line}`,
      };
    }),
  };
}
