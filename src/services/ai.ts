import { callFunction } from '@/services/cloud';
import type { GameState, KimiChatRequest, KimiChatResponse, Speech } from '@/types/game';
import { getVoteSummary } from '@/utils/gameEngine';

const getSeat = (state: GameState, playerId: string) =>
  state.players.findIndex((player) => player.id === playerId) + 1;

const getSeatName = (state: GameState, playerId: string) => {
  const seat = getSeat(state, playerId);
  return `${seat || '?'}号`;
};

const buildKimiRequest = (state: GameState, targetPlayerIds?: string[]): KimiChatRequest => ({
  day: state.day,
  mode: state.mode,
  phase: state.phase,
  currentSpeakerId: targetPlayerIds?.length === 1 ? targetPlayerIds[0] : undefined,
  currentSpeakerIndex: targetPlayerIds?.length === 1 && targetPlayerIds[0]
    ? state.speakingOrder.indexOf(targetPlayerIds[0])
    : undefined,
  targetPlayerIds,
  speakingOrder: state.speakingOrder,
  spokenPlayerIds: state.spokenPlayerIds,
  unspokenPlayerIds: state.speakingOrder.filter((id) => !state.spokenPlayerIds.includes(id)),
  players: state.players.map((player, index) => ({
    id: player.id,
    name: `${index + 1}号`,
    seat: index + 1,
    role: player.role,
    camp: player.camp,
    isUser: player.isUser,
    isAlive: player.isAlive,
    deathReason: player.deathReason,
    temperament: player.profile?.temperament,
    playStyle: player.profile?.playStyle,
    strength: player.profile?.strength,
    risk: player.profile?.risk,
  })),
  publicSpeeches: state.speeches.map((speech) => ({
    playerId: speech.playerId,
    playerName: getSeatName(state, speech.playerId),
    content: speech.content,
    day: speech.day,
  })),
  publicEvents: [
    ...state.nightRecords.map((record) => `第${record.day}天：${record.announcement}`),
    ...getVoteSummary(state).map((record) => `第${state.day}天投票：${getSeatName(state, record.voterId)} -> ${getSeatName(state, record.targetId)}`),
    ...state.lastWords.map((record) => `第${record.day}天遗言：${getSeatName(state, record.playerId)}：${record.content}`),
  ],
  seerChecks: state.seerChecks,
  nightRecords: state.nightRecords,
});

export const requestAiSpeeches = async (state: GameState, targetPlayerIds?: string[]): Promise<Speech[]> => {
  try {
    console.info('[AI] request Kimi speeches', { day: state.day, mode: state.mode, targetPlayerIds });
    const result = await callFunction<KimiChatResponse>('kimiChat', buildKimiRequest(state, targetPlayerIds));
    const targetPlayers = targetPlayerIds?.length
      ? targetPlayerIds
          .map((playerId) => state.players.find((player) => player.id === playerId))
          .filter((player): player is NonNullable<typeof player> => Boolean(player && !player.isUser && player.isAlive))
      : state.players.filter((player) => !player.isUser && player.isAlive);

    if (!result.speeches.length) {
      throw new Error('Kimi returned empty speeches');
    }

    return targetPlayers.map((player, index) => {
      const generated = result.speeches.find((item) => item.playerId === player.id);
      if (!generated?.content || generated.source !== 'kimi') {
        throw new Error(`Kimi did not return a valid speech for ${player.id}`);
      }

      return {
        id: `${state.day}-day-${player.id}-${index}`,
        day: state.day,
        phase: 'day',
        playerId: player.id,
        playerName: getSeatName(state, player.id),
        content: generated.content,
        tone: `Kimi 模拟 · ${player.profile?.temperament || '新手视角'}`,
        source: 'kimi',
      };
    });
  } catch (error) {
    console.error('[AI] request Kimi speeches failed', error);
    throw error;
  }
};
