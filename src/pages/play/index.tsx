import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import { modeNames, roleNames } from '@/data/game';
import { requestAiSpeeches } from '@/services/ai';
import type { GameMode, GameState, Role, Speech, VoteRecord } from '@/types/game';
import {
  buildSpeakingOrder,
  buildVotes,
  createAiSeerCheck,
  createLastWords,
  createInitialGame,
  decideWinner,
  generateUserSpeech,
  getAlivePlayers,
  getCurrentNightRecord,
  getPhaseLabel,
  getWolfTarget,
  hasWitchPoisoned,
  hasWitchSaved,
  getVoteSummary,
  resolveHunterShot,
  resolveNight,
  resolveVote,
} from '@/utils/gameEngine';
import styles from './index.module.scss';

const roleMarkOptions = [
  { value: '', label: '标记' },
  { value: 'seer', label: '预' },
  { value: 'villager', label: '民' },
  { value: 'werewolf', label: '狼' },
  { value: 'witch', label: '女' },
  { value: 'hunter', label: '猎' },
] as const;

const speechSourceLabels: Record<NonNullable<Speech['source']>, string> = {
  kimi: 'Kimi',
  cloud_fallback: '云兜底',
  local_fallback: '本地兜底',
  user: '玩家',
};

const AI_SPEECH_BATCH_SIZE = 9;

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error || '未知错误');

const getSeatLabel = (state: GameState, playerId?: string) => {
  const index = state.players.findIndex((player) => player.id === playerId);
  return `${index >= 0 ? index + 1 : '?'}号`;
};

const PlayPage: React.FC = () => {
  const [game, setGame] = useState<GameState>(() => createInitialGame('play', 'seer'));
  const [selectedTargetId, setSelectedTargetId] = useState('wenxin');
  const [selectedInspectId, setSelectedInspectId] = useState('gpt');
  const [selectedWolfTargetId, setSelectedWolfTargetId] = useState('');
  const [useAntidote, setUseAntidote] = useState(false);
  const [usePoison, setUsePoison] = useState(false);
  const [selectedPoisonTargetId, setSelectedPoisonTargetId] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [roleMarks, setRoleMarks] = useState<Record<string, string>>({});

  const wait = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

  useEffect(() => {
    try {
      const storedMode = Taro.getStorageSync<GameMode>('selectedMode');
      const storedRole = Taro.getStorageSync<Role>('selectedRole');
      if (storedMode) {
        const safeMode: GameMode = storedMode === 'watch' ? 'watch' : 'play';
        const safeRole: Role = ['villager', 'werewolf', 'seer', 'witch', 'hunter'].includes(storedRole) ? storedRole : 'seer';
        const nextGame = createInitialGame(safeMode, safeRole);
        setGame(nextGame);
        setSelectedInspectId('gpt');
        setSelectedWolfTargetId(nextGame.players.find((player) => player.camp === 'good' && player.isAlive)?.id || '');
        setUseAntidote(false);
        setUsePoison(false);
        setSelectedPoisonTargetId(nextGame.players.find((player) => !player.isUser && player.isAlive)?.id || '');
        setRoleMarks({});
      }
    } catch (error) {
      console.error('[Play] read selected mode failed', error);
    }
  }, []);

  useEffect(() => {
    try {
      Taro.setStorageSync('latestGameState', game);
    } catch (error) {
      console.error('[Play] save latest game failed', error);
    }
  }, [game]);

  const alivePlayers = useMemo(() => getAlivePlayers(game.players), [game.players]);
  const userPlayer = game.players.find((player) => player.isUser);
  const eliminatedPlayer = game.players.find((player) => player.id === game.eliminatedPlayerId);
  const currentSeerCheck = game.seerChecks.find((record) => record.day === game.day);
  const currentNightRecord = getCurrentNightRecord(game);
  const latestLastWords = game.lastWords[game.lastWords.length - 1];
  const voteSummary = useMemo(() => getVoteSummary(game), [game]);
  const inspectablePlayers = alivePlayers.filter((player) => !player.isUser);
  const wolfTargets = alivePlayers.filter((player) => player.camp === 'good');
  const wolfTeammates = alivePlayers.filter((player) => player.camp === 'wolf' && !player.isUser);
  const visibleWolfTarget = getWolfTarget(game);
  const canUseAntidote = Boolean(userPlayer?.role === 'witch' && !hasWitchSaved(game) && visibleWolfTarget);
  const canUsePoison = Boolean(userPlayer?.role === 'witch' && !hasWitchPoisoned(game));
  const poisonTargets = alivePlayers.filter((player) => !player.isUser && player.id !== userPlayer?.id);
  const selectedInspectPlayer = inspectablePlayers.find((player) => player.id === selectedInspectId);
  const selectedWolfTarget = wolfTargets.find((player) => player.id === selectedWolfTargetId);
  const selectedPoisonTarget = poisonTargets.find((player) => player.id === selectedPoisonTargetId);
  const nextSpeakerId = game.speakingOrder.find((id) => !game.spokenPlayerIds.includes(id));
  const nextSpeaker = game.players.find((player) => player.id === nextSpeakerId);
  const cycleRoleMark = (playerId: string) => {
    setRoleMarks((current) => {
      const currentIndex = roleMarkOptions.findIndex((item) => item.value === (current[playerId] || ''));
      const next = roleMarkOptions[(currentIndex + 1) % roleMarkOptions.length];

      if (!next.value) {
        const { [playerId]: _removed, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [playerId]: next.value,
      };
    });
  };
  const phaseClassName = useMemo(() => {
    if (game.phase === 'night') {
      return styles.phaseNight;
    }

    if (game.phase === 'vote' || game.phase === 'lastWords') {
      return styles.phaseDusk;
    }

    if (game.phase === 'result') {
      return styles.phaseResult;
    }

    return styles.phaseDay;
  }, [game.phase]);

  const phaseSceneText = game.phase === 'night'
    ? '黑夜行动'
    : game.phase === 'vote'
      ? '黄昏投票'
      : game.phase === 'lastWords'
        ? '落日遗言'
        : game.phase === 'result'
          ? '对局结束'
          : '白天发言';
  const speechGroups = useMemo(() => {
    const grouped = game.speeches.reduce<Array<{ day: number; speeches: Speech[] }>>((acc, speech) => {
      const group = acc.find((item) => item.day === speech.day);
      if (group) {
        group.speeches.push(speech);
        return acc;
      }

      return [...acc, { day: speech.day, speeches: [speech] }];
    }, []);

    return grouped.sort((left, right) => left.day - right.day);
  }, [game.speeches]);

  const appendAiSpeechesUntilUser = async (baseState: GameState): Promise<GameState> => {
    const spokenSet = new Set(baseState.spokenPlayerIds);
    const pendingAiIds: string[] = [];

    for (const playerId of baseState.speakingOrder) {
      if (spokenSet.has(playerId)) {
        continue;
      }

      const player = baseState.players.find((item) => item.id === playerId);
      if (!player || !player.isAlive) {
        spokenSet.add(playerId);
        continue;
      }

      if (player.isUser) {
        break;
      }

      pendingAiIds.push(playerId);
      spokenSet.add(playerId);
    }

    if (!pendingAiIds.length) {
      const complete = baseState.speakingOrder.every((id) => spokenSet.has(id));

      return {
        ...baseState,
        spokenPlayerIds: Array.from(spokenSet),
        phase: complete ? 'vote' : 'day',
        coachTip: complete
          ? '本轮发言结束。现在进入投票阶段。'
          : `轮到你发言了。当前从 ${baseState.speakingOrder.map((id) => {
              const index = baseState.players.findIndex((player) => player.id === id);
              return `${index + 1}号`;
            }).join(' → ')} 顺时针发言。`,
      };
    }

    let workingState: GameState = {
      ...baseState,
      spokenPlayerIds: Array.from(spokenSet).filter((id) => !pendingAiIds.includes(id)),
    };

    for (let start = 0; start < pendingAiIds.length; start += AI_SPEECH_BATCH_SIZE) {
      const batchIds = pendingAiIds.slice(start, start + AI_SPEECH_BATCH_SIZE);
      const firstPlayer = workingState.players.find((item) => item.id === batchIds[0]);
      setGame({
        ...workingState,
        phase: 'day',
        coachTip: firstPlayer
          ? `${getSeatLabel(workingState, firstPlayer.id)}开始听前置位，Kimi 正在顺序生成这一批发言...`
          : 'Kimi 正在按顺序生成 AI 发言...',
      });
      await wait(650);

      const generatedSpeeches = await requestAiSpeeches(workingState, batchIds);
      const speechByPlayerId = new Map(generatedSpeeches.map((speech) => [speech.playerId, speech]));

      for (const playerId of batchIds) {
        const player = workingState.players.find((item) => item.id === playerId);
        setGame({
          ...workingState,
          phase: 'day',
          coachTip: player
            ? `${getSeatLabel(workingState, player.id)}正在整理前置位发言...`
            : 'AI 玩家正在思考发言...',
        });
        await wait(350);
        const speech = speechByPlayerId.get(playerId);
        workingState = {
          ...workingState,
          speeches: speech ? [...workingState.speeches, speech] : workingState.speeches,
          spokenPlayerIds: [...workingState.spokenPlayerIds, playerId],
        };
        setGame({
          ...workingState,
          phase: 'day',
          coachTip: speech
            ? `${getSeatLabel(workingState, speech.playerId)}已发言。系统会继续轮到下一位，直到轮到你或进入投票。`
            : '这一位 AI 没有生成有效发言，系统会继续推进。',
        });
        await wait(350);
      }
    }

    const nextSpokenIds = workingState.spokenPlayerIds;
    const complete = workingState.speakingOrder.every((id) => nextSpokenIds.includes(id));

    return {
      ...workingState,
      spokenPlayerIds: nextSpokenIds,
      phase: complete ? 'vote' : 'day',
      coachTip: complete
        ? '本轮发言结束。现在进入投票阶段。'
        : '前置位 AI 已发言，轮到你了。你可以回应他们的站边、质疑或保人逻辑。',
    };
  };

  const resetGame = () => {
    console.info('[Play] reset game');
    const nextGame = createInitialGame(game.mode, game.userRole || 'seer');
    setGame(nextGame);
    setSelectedTargetId('wenxin');
    setSelectedInspectId('gpt');
    setSelectedWolfTargetId(nextGame.players.find((player) => player.camp === 'good' && player.isAlive)?.id || '');
    setUseAntidote(false);
    setUsePoison(false);
    setSelectedPoisonTargetId(nextGame.players.find((player) => !player.isUser && player.isAlive)?.id || '');
    setRoleMarks({});
  };

  const enterDay = async () => {
    if (isAiLoading) {
      return;
    }

    if (userPlayer?.role === 'seer' && userPlayer.isAlive && !currentSeerCheck) {
      Taro.showToast({ title: '请先查验一名玩家', icon: 'none' });
      return;
    }

    if (userPlayer?.role === 'werewolf' && userPlayer.isAlive && !selectedWolfTarget) {
      Taro.showToast({ title: '请先选择今晚刀口', icon: 'none' });
      return;
    }

    if (userPlayer?.role === 'witch' && userPlayer.isAlive && usePoison && !selectedPoisonTarget) {
      Taro.showToast({ title: '请选择毒药目标', icon: 'none' });
      return;
    }

    setIsAiLoading(true);
    setGame((current) => ({
      ...current,
      coachTip: '正在结算夜晚行动。天亮后会随机选择一个存活座位，从它开始顺时针发言。',
    }));

    try {
      const nightResult = resolveNight(
        game,
        userPlayer?.role === 'werewolf' && userPlayer.isAlive ? selectedWolfTargetId : undefined,
        userPlayer?.role === 'witch' && userPlayer.isAlive
          ? {
              useAntidote,
              usePoison,
              poisonTargetId: usePoison ? selectedPoisonTargetId : undefined,
            }
          : undefined,
      );
      const aiSeerCheck = createAiSeerCheck({ ...game, players: nightResult.players });
      const speakingOrder = buildSpeakingOrder(nightResult.players);
      const nextStateForAi: GameState = {
        ...game,
        players: nightResult.players,
        speakingOrder,
        spokenPlayerIds: [],
        nightRecords: [
          ...game.nightRecords.filter((record) => record.day !== game.day),
          nightResult.nightRecord,
        ],
        seerChecks: aiSeerCheck ? [...game.seerChecks, aiSeerCheck] : game.seerChecks,
        winner: nightResult.winner,
        phase: 'day',
      };

      if (nightResult.winner) {
        setGame({
          ...nextStateForAi,
          phase: 'result',
          coachTip: `夜晚结算完成：${nightResult.nightRecord.announcement} 游戏已经结束。`,
        });
        return;
      }

      const nextVoteTarget = getAlivePlayers(nightResult.players).find((player) => !player.isUser)?.id;
      if (nextVoteTarget) {
        setSelectedTargetId(nextVoteTarget);
      }
      const nextWolfTarget = getAlivePlayers(nightResult.players).find((player) => player.camp === 'good')?.id;
      setSelectedWolfTargetId(nextWolfTarget || '');
      setUseAntidote(false);
      setUsePoison(false);
      setSelectedPoisonTargetId(getAlivePlayers(nightResult.players).find((player) => !player.isUser)?.id || '');

      const advancedState = await appendAiSpeechesUntilUser(nextStateForAi);
      setGame(advancedState);
    } catch (error) {
      console.error('[Play] enter day failed', error);
      const errorMessage = getErrorMessage(error);
      setGame((current) => ({
        ...current,
        coachTip: `Kimi 未接通，已停止生成 AI 发言。原因：${errorMessage}`,
      }));
      Taro.showToast({ title: 'Kimi 未接通', icon: 'none' });
    } finally {
      setIsAiLoading(false);
    }
  };

  const inspectPlayer = () => {
    if (!selectedInspectPlayer) {
      Taro.showToast({ title: '请选择查验对象', icon: 'none' });
      return;
    }

    console.info('[Play] seer inspect', { day: game.day, targetId: selectedInspectPlayer.id });
    setGame((current) => ({
      ...current,
      seerChecks: [
        ...current.seerChecks.filter((record) => record.day !== current.day),
        {
          day: current.day,
          targetId: selectedInspectPlayer.id,
          targetName: getSeatLabel(current, selectedInspectPlayer.id),
          targetRole: selectedInspectPlayer.role,
          targetCamp: selectedInspectPlayer.camp,
        },
      ],
      coachTip: `你查验了${getSeatLabel(current, selectedInspectPlayer.id)}，结果是${selectedInspectPlayer.camp === 'wolf' ? '狼人' : '好人'}。白天可以选择公开，也可以先观察其他 AI 发言。`,
    }));
  };

  const generateDraft = () => {
    const draft = generateUserSpeech(game);
    console.info('[Play] generate user draft', { day: game.day });
    setGame((current) => ({
      ...current,
      userSpeechDraft: draft,
      coachTip: '这是一版可直接使用的发言。你也可以改得更像自己的语气。',
    }));
  };

  const publishSpeech = async () => {
    if (isAiLoading) {
      return;
    }

    if (!game.userSpeechDraft.trim()) {
      Taro.showToast({ title: '先写一句发言', icon: 'none' });
      return;
    }

    const speech: Speech = {
      id: `${game.day}-user-${Date.now()}`,
      day: game.day,
      phase: 'day',
      playerId: 'you',
      playerName: getSeatLabel(game, 'you'),
      content: game.userSpeechDraft,
      tone: '新手视角',
      source: 'user',
    };

    const nextStateForAi: GameState = {
      ...game,
      speeches: [...game.speeches, speech],
      userSpeechDraft: '',
      spokenPlayerIds: [...game.spokenPlayerIds, 'you'],
    };

    setIsAiLoading(true);
    setGame((current) => ({
      ...current,
      speeches: [...current.speeches, speech],
      userSpeechDraft: '',
      coachTip: '你的发言已经进入记录。Kimi 正在让后置位 AI 根据你的发言继续发言。',
    }));

    try {
      const advancedState = await appendAiSpeechesUntilUser(nextStateForAi);
      setGame({
        ...advancedState,
        coachTip: advancedState.phase === 'vote'
          ? '本轮发言结束。现在选择一个你想放逐的目标，训练局会自动模拟其他 AI 的票型。'
          : advancedState.coachTip,
      });
    } catch (error) {
      console.error('[Play] publish speech failed', error);
      const errorMessage = getErrorMessage(error);
      setGame((current) => ({
        ...current,
        coachTip: `Kimi 未接通，后置位 AI 发言已停止。原因：${errorMessage}`,
      }));
      Taro.showToast({ title: 'Kimi 未接通', icon: 'none' });
    } finally {
      setIsAiLoading(false);
    }
  };

  const enterVoteAsObserver = () => {
    setGame((current) => ({
      ...current,
      phase: 'vote',
      coachTip: '你已经出局，不能继续发言和投票。现在旁观 AI 玩家完成本轮投票。',
    }));
  };

  const submitVote = () => {
    const votes: VoteRecord[] = buildVotes(game).map((vote) =>
      vote.voterId === 'you' ? { ...vote, targetId: selectedTargetId } : vote,
    );
    const resolved = resolveVote(game, votes);
    const votedOut = resolved.eliminatedPlayerId
      ? resolved.players.find((player) => player.id === resolved.eliminatedPlayerId)
      : undefined;
    const shot = votedOut?.role === 'hunter'
      ? resolveHunterShot({ ...game, players: resolved.players }, votedOut)
      : undefined;
    const playersAfterShot = shot?.players || resolved.players;
    const winner = decideWinner(playersAfterShot);
    const shotText = shot?.shotPlayer ? ` 猎人开枪带走了${getSeatLabel(game, shot.shotPlayer.id)}。` : '';
    const baseLastWords = votedOut ? createLastWords(votedOut, game.day, { ...game, players: playersAfterShot }) : undefined;
    const lastWords = baseLastWords && shot?.shotPlayer
      ? {
          ...baseLastWords,
          content: `${baseLastWords.content} 我开枪带走${getSeatLabel(game, shot.shotPlayer.id)}，这枪口我认。`,
        }
      : baseLastWords;

    console.info('[Play] submit vote', { selectedTargetId, winner });
    setGame((current) => ({
      ...current,
      votes,
      players: playersAfterShot,
      eliminatedPlayerId: resolved.eliminatedPlayerId,
      winner,
      lastWords: lastWords ? [...current.lastWords, lastWords] : current.lastWords,
      phase: winner ? 'result' : lastWords ? 'lastWords' : 'night',
      day: winner || lastWords ? current.day : current.day + 1,
      coachTip: winner
        ? `本局已经结束。${shotText}可以去复盘页看训练建议。`
        : lastWords
            ? `${lastWords.playerName} 被放逐，进入遗言阶段。${shotText}`
          : resolved.isTie
            ? '本轮平票无人出局，直接进入下一晚。'
            : '进入下一晚。留意上一轮谁投了谁，票型通常比单句发言更诚实。',
    }));

    const nextInspectTarget = resolved.players.find((player) => !player.isUser && player.isAlive)?.id;
    if (nextInspectTarget) {
      setSelectedInspectId(nextInspectTarget);
    }
    const nextWolfTarget = resolved.players.find((player) => player.camp === 'good' && player.isAlive)?.id;
    setSelectedWolfTargetId(nextWolfTarget || '');
    setUseAntidote(false);
    setUsePoison(false);
    setSelectedPoisonTargetId(playersAfterShot.find((player) => !player.isUser && player.isAlive)?.id || '');
  };

  const continueAfterLastWords = () => {
    const winner = decideWinner(game.players);
    const nextInspectTarget = game.players.find((player) => !player.isUser && player.isAlive)?.id;
    if (nextInspectTarget) {
      setSelectedInspectId(nextInspectTarget);
      setSelectedTargetId(nextInspectTarget);
    }
    const nextWolfTarget = game.players.find((player) => player.camp === 'good' && player.isAlive)?.id;
    setSelectedWolfTargetId(nextWolfTarget || '');
    setUseAntidote(false);
    setUsePoison(false);
    setSelectedPoisonTargetId(game.players.find((player) => !player.isUser && player.isAlive)?.id || '');

    setGame((current) => ({
      ...current,
      winner,
      phase: winner ? 'result' : 'night',
      day: winner ? current.day : current.day + 1,
      speakingOrder: [],
      spokenPlayerIds: [],
      votes: winner ? current.votes : [],
      eliminatedPlayerId: winner ? current.eliminatedPlayerId : undefined,
      coachTip: winner ? '本局已经结束，可以去复盘页看训练建议。' : '进入下一晚。系统会结算夜晚行动；如果你是预言家，需要先查验。',
    }));
  };

  const goReview = () => {
    Taro.switchTab({ url: '/pages/review/index' }).catch((error) => {
      console.error('[Play] switch to review failed', error);
    });
  };

  return (
    <ScrollView className={classnames(styles.page, phaseClassName)} scrollY>
      <View className={styles.sceneBackdrop}>
        <View className={styles.sunMoon} />
        <View className={styles.cloudOne} />
        <View className={styles.cloudTwo} />
        <View className={styles.starField} />
        <View className={styles.mountainLayer} />
        <View className={styles.grassLayer} />
      </View>
      <View className={styles.header}>
        <View>
          <Text className={styles.kicker}>{modeNames[game.mode]}</Text>
          <Text className={styles.title}>第 {game.day} 天 · {getPhaseLabel(game.phase)}</Text>
        </View>
        <View className={styles.statusPill}>
          <Text className={styles.statusText}>{alivePlayers.length} 人存活</Text>
        </View>
      </View>

      <View className={styles.sceneCard}>
        <View className={styles.sceneSky}>
          <View className={styles.sceneOrb} />
          <View className={styles.sceneCloudLarge} />
          <View className={styles.sceneCloudSmall} />
          <View className={styles.sceneTrees} />
          <View className={styles.scenePath} />
          <View className={styles.sceneKids}>
            <View className={styles.kidRed} />
            <View className={styles.kidBlue} />
            <View className={styles.kidGreen} />
            <View className={styles.kidYellow} />
          </View>
        </View>
        <View className={styles.sceneCaption}>
          <Text className={styles.sceneCaptionText}>{phaseSceneText}</Text>
        </View>
      </View>

      <View className={styles.coachBox}>
        <Text className={styles.coachLabel}>AI 法官提示</Text>
        <Text className={styles.coachText}>{game.coachTip}</Text>
      </View>

      {currentNightRecord && game.phase !== 'night' && (
        <View className={styles.judgeCard}>
          <Text className={styles.judgeLabel}>法官公告</Text>
          <Text className={styles.judgeText}>{currentNightRecord.announcement}</Text>
          {currentNightRecord.witchSaved && <Text className={styles.judgeMeta}>女巫使用了解药，昨晚刀口被救起。</Text>}
          {currentNightRecord.witchPoisonTargetName && (
            <Text className={styles.judgeMeta}>女巫使用了毒药：{currentNightRecord.witchPoisonTargetName}</Text>
          )}
        </View>
      )}

      {game.speakingOrder.length > 0 && game.phase !== 'night' && game.phase !== 'result' && (
        <View className={styles.orderCard}>
          <Text className={styles.orderLabel}>本轮发言顺序</Text>
          <Text className={styles.orderText}>
            {game.speakingOrder.map((id) => {
              const index = game.players.findIndex((player) => player.id === id);
              return `${index + 1}号`;
            }).join(' → ')}
          </Text>
          {nextSpeaker && (
            <Text className={styles.orderMeta}>
              当前轮到：{getSeatLabel(game, nextSpeaker.id)}
            </Text>
          )}
        </View>
      )}

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>座位与身份</Text>
        <View className={styles.playerGrid}>
          {game.players.map((player) => (
            <View
              key={player.id}
              className={classnames(styles.playerCard, !player.isAlive && styles.playerDead)}
              onClick={() => setSelectedTargetId(player.id)}
            >
              {!player.isUser && (
                <View
                  className={classnames(styles.markButton, roleMarks[player.id] && styles.markButtonActive)}
                  onClick={(event) => {
                    event.stopPropagation();
                    cycleRoleMark(player.id);
                  }}
                >
                  <Text className={styles.markButtonText}>
                    {roleMarkOptions.find((item) => item.value === (roleMarks[player.id] || ''))?.label || '标记'}
                  </Text>
                </View>
              )}
              <View
                className={styles.avatar}
                style={{ backgroundColor: player.profile?.color || '#3657D8' }}
              >
                <Text className={styles.avatarText}>{getSeatLabel(game, player.id)}</Text>
              </View>
              <Text className={styles.playerName}>{getSeatLabel(game, player.id)}</Text>
              <Text className={styles.playerMeta}>
                {player.isUser
                  ? roleNames[player.role]
                  : roleMarks[player.id]
                    ? `你标记：${roleNames[roleMarks[player.id] as Role]}`
                    : player.isAlive ? 'AI 玩家' : '已出局'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {game.phase === 'night' && userPlayer?.role === 'seer' && (
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>预言家查验</Text>
            <Text className={styles.sectionHint}>{currentSeerCheck ? '已查验' : '每晚一次'}</Text>
          </View>
          <View className={styles.nightActionCard}>
            <Text className={styles.nightActionText}>
              选择一名存活玩家查验身份。查验结果只有你能看到，白天是否公开由你决定。
            </Text>
            <View className={styles.inspectList}>
              {inspectablePlayers.map((player) => (
                <View
                  key={player.id}
                  className={classnames(styles.inspectItem, selectedInspectId === player.id && styles.inspectItemActive)}
                  onClick={() => setSelectedInspectId(player.id)}
                >
                  <Text className={styles.inspectName}>{getSeatLabel(game, player.id)}</Text>
                  <Text className={styles.inspectMeta}>{player.isAlive ? '存活' : '已出局'}</Text>
                </View>
              ))}
            </View>
            <View
              className={classnames(styles.primaryButtonSmallFull, currentSeerCheck && styles.actionDisabled)}
              onClick={currentSeerCheck ? undefined : inspectPlayer}
            >
              <Text className={styles.primaryButtonText}>{currentSeerCheck ? '已完成查验' : '确认查验'}</Text>
            </View>
            {currentSeerCheck && (
              <View className={styles.checkResultBox}>
                <Text className={styles.checkResultLabel}>查验结果</Text>
                <Text className={styles.checkResultText}>
                  {currentSeerCheck.targetName} 是{currentSeerCheck.targetCamp === 'wolf' ? '狼人' : '好人'}阵营
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {game.phase === 'night' && userPlayer?.role === 'werewolf' && userPlayer.isAlive && (
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>狼人夜晚刀人</Text>
            <Text className={styles.sectionHint}>{selectedWolfTarget ? '已选择刀口' : '请选择'}</Text>
          </View>
          <View className={styles.nightActionCard}>
            <Text className={styles.nightActionText}>
              你是狼人。狼队友：{wolfTeammates.length ? wolfTeammates.map((player) => getSeatLabel(game, player.id)).join('、') : '暂无存活队友'}。请选择今晚要击杀的一名好人玩家。
            </Text>
            <View className={styles.inspectList}>
              {wolfTargets.map((player) => (
                <View
                  key={player.id}
                  className={classnames(styles.inspectItem, selectedWolfTargetId === player.id && styles.inspectItemActive)}
                  onClick={() => setSelectedWolfTargetId(player.id)}
                >
                  <Text className={styles.inspectName}>{getSeatLabel(game, player.id)}</Text>
                  <Text className={styles.inspectMeta}>
                    {player.isUser ? '不能刀自己' : '可选刀口'}
                  </Text>
                </View>
              ))}
            </View>
            <View
              className={classnames(styles.primaryButtonSmallFull, !selectedWolfTarget && styles.actionDisabled)}
              onClick={() => selectedWolfTarget && Taro.showToast({ title: `今晚刀口：${getSeatLabel(game, selectedWolfTarget.id)}`, icon: 'none' })}
            >
              <Text className={styles.primaryButtonText}>{selectedWolfTarget ? `确认刀 ${getSeatLabel(game, selectedWolfTarget.id)}` : '请选择刀口'}</Text>
            </View>
          </View>
        </View>
      )}

      {game.phase === 'night' && userPlayer?.role === 'witch' && userPlayer.isAlive && (
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>女巫夜晚用药</Text>
            <Text className={styles.sectionHint}>解药和毒药分别确认</Text>
          </View>
          <View className={styles.nightActionCard}>
            <Text className={styles.nightActionText}>
              狼人今晚刀口：{visibleWolfTarget ? getSeatLabel(game, visibleWolfTarget.id) : '暂无'}。
              解药{hasWitchSaved(game) ? '已使用' : '未使用'}，毒药{hasWitchPoisoned(game) ? '已使用' : '未使用'}。
            </Text>

            <Text className={styles.potionLabel}>是否使用解药</Text>
            <View className={styles.potionRow}>
              <View
                className={classnames(styles.potionButton, !useAntidote && styles.potionButtonActive)}
                onClick={() => setUseAntidote(false)}
              >
                <Text className={styles.potionText}>不用解药</Text>
              </View>
              <View
                className={classnames(
                  styles.potionButton,
                  useAntidote && styles.potionButtonActive,
                  !canUseAntidote && styles.actionDisabled,
                )}
                onClick={() => canUseAntidote && setUseAntidote(true)}
              >
                <Text className={styles.potionText}>救刀口</Text>
              </View>
            </View>

            <Text className={styles.potionLabel}>是否使用毒药</Text>
            <View className={styles.potionRow}>
              <View
                className={classnames(styles.potionButton, !usePoison && styles.potionButtonActive)}
                onClick={() => setUsePoison(false)}
              >
                <Text className={styles.potionText}>不用毒药</Text>
              </View>
              <View
                className={classnames(
                  styles.potionButton,
                  usePoison && styles.potionButtonActive,
                  !canUsePoison && styles.actionDisabled,
                )}
                onClick={() => canUsePoison && setUsePoison(true)}
              >
                <Text className={styles.potionText}>使用毒药</Text>
              </View>
            </View>

            {useAntidote && visibleWolfTarget && (
              <View className={styles.checkResultBox}>
                <Text className={styles.checkResultLabel}>解药目标</Text>
                <Text className={styles.checkResultText}>今晚将救起 {getSeatLabel(game, visibleWolfTarget.id)}</Text>
              </View>
            )}

            {usePoison && (
              <View className={styles.inspectList}>
                {poisonTargets.map((player) => (
                  <View
                    key={player.id}
                    className={classnames(styles.inspectItem, selectedPoisonTargetId === player.id && styles.inspectItemActive)}
                    onClick={() => setSelectedPoisonTargetId(player.id)}
                  >
                    <Text className={styles.inspectName}>{getSeatLabel(game, player.id)}</Text>
                    <Text className={styles.inspectMeta}>可选毒口</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {game.phase === 'night' && userPlayer?.role !== 'seer' && userPlayer?.role !== 'werewolf' && userPlayer?.role !== 'witch' && (
        <View className={styles.section}>
          <View className={styles.nightActionCard}>
            <Text className={styles.nightActionText}>
              {game.mode === 'watch'
                ? '观战局会自动结算夜晚行动，并随机选择一个存活座位开始白天发言。'
                : `你本局是${userPlayer ? roleNames[userPlayer.role] : '旁观者'}。这一版会自动结算夜晚行动，天亮后按随机起点顺时针发言。`}
            </Text>
          </View>
        </View>
      )}

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>发言记录</Text>
          <Text className={styles.sectionHint}>{game.speeches.length} 条</Text>
        </View>
        {game.speeches.length === 0 ? (
          <View className={styles.emptyBox}>
            <Text className={styles.emptyText}>夜晚还没有公开发言。点击下方按钮进入白天。</Text>
          </View>
        ) : (
          <View className={styles.speechList}>
            {speechGroups.map((group) => (
              <View className={styles.speechDayGroup} key={`day-${group.day}`}>
                <View className={styles.dayDivider}>
                  <View className={styles.dayBadge}>
                    <Text className={styles.dayBadgeText}>DAY {group.day}</Text>
                  </View>
                  <Text className={styles.dayDividerText}>第 {group.day} 天白天发言</Text>
                </View>
                <View className={styles.speechDayList}>
                  {group.speeches.map((speech) => (
                    <View
                      key={speech.id}
                      className={classnames(styles.speechCard, speech.playerId === 'you' && styles.userSpeech)}
                    >
                      <View className={styles.speechHeader}>
                        <View className={styles.speechIdentity}>
                          <Text className={styles.speechSeat}>{getSeatLabel(game, speech.playerId)}</Text>
                          <Text className={styles.speechName}>{speech.playerId === 'you' ? '玩家' : 'AI 玩家'}</Text>
                        </View>
                        <View className={styles.speechMetaGroup}>
                          {speech.source && (
                            <Text
                              className={classnames(
                                styles.speechSource,
                                speech.source === 'kimi' && styles.speechSourceKimi,
                                speech.source === 'cloud_fallback' && styles.speechSourceCloud,
                                speech.source === 'local_fallback' && styles.speechSourceLocal,
                              )}
                            >
                              {speechSourceLabels[speech.source]}
                            </Text>
                          )}
                          <Text className={styles.speechTone}>{speech.tone}</Text>
                        </View>
                      </View>
                      <Text className={styles.speechContent}>{speech.content}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {game.phase === 'day' && userPlayer?.isAlive && (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>你的发言</Text>
          <Textarea
            className={styles.textarea}
            value={game.userSpeechDraft}
            placeholder="写下你的视角，或者先让 AI 帮你组织一版。"
            maxlength={260}
            onInput={(event) =>
              setGame((current) => ({ ...current, userSpeechDraft: event.detail.value }))
            }
          />
          <View className={styles.actionRow}>
            <View className={styles.secondaryButton} onClick={generateDraft}>
              <Text className={styles.secondaryButtonText}>帮我组织发言</Text>
            </View>
            <View className={styles.primaryButtonSmall} onClick={publishSpeech}>
              <Text className={styles.primaryButtonText}>发表</Text>
            </View>
          </View>
        </View>
      )}

      {game.phase === 'day' && userPlayer && !userPlayer.isAlive && (
        <View className={styles.lastWordsCard}>
          <Text className={styles.lastWordsLabel}>旁观状态</Text>
          <Text className={styles.lastWordsTitle}>你已出局</Text>
          <Text className={styles.lastWordsText}>真实局里死亡玩家不能继续发言和投票。你可以继续观察 AI 的发言和票型。</Text>
        </View>
      )}

      {game.phase === 'vote' && (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>{userPlayer?.isAlive ? '选择投票目标' : '你已出局，旁观 AI 投票'}</Text>
          {userPlayer?.isAlive && (
            <View className={styles.voteList}>
              {alivePlayers
                .filter((player) => !player.isUser)
                .map((player) => (
                  <View
                    key={player.id}
                    className={classnames(styles.voteItem, selectedTargetId === player.id && styles.voteItemActive)}
                    onClick={() => setSelectedTargetId(player.id)}
                  >
                    <Text className={styles.voteName}>{getSeatLabel(game, player.id)}</Text>
                    <Text className={styles.voteReason}>{player.profile?.playStyle || '暂无资料'}</Text>
                  </View>
                ))}
            </View>
          )}
        </View>
      )}

      {game.votes.length > 0 && (
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>投票结果</Text>
            <Text className={styles.sectionHint}>{game.votes.length} 票</Text>
          </View>
          <View className={styles.voteSummaryList}>
            {voteSummary.map((item) => (
              <View className={styles.voteSummaryItem} key={`${item.voterName}-${item.targetName}`}>
                <Text className={styles.voteSummaryText}>{item.voterName}</Text>
                <Text className={styles.voteArrow}>投给</Text>
                <Text className={styles.voteSummaryTarget}>{item.targetName}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {game.phase === 'lastWords' && latestLastWords && (
        <View className={styles.lastWordsCard}>
          <Text className={styles.lastWordsLabel}>遗言</Text>
          <Text className={styles.lastWordsTitle}>{latestLastWords.playerName}</Text>
          <Text className={styles.lastWordsText}>{latestLastWords.content}</Text>
        </View>
      )}

      {game.phase === 'result' && (
        <View className={styles.resultBox}>
          <Text className={styles.resultTitle}>{game.winner === 'good' ? '好人阵营胜利' : game.winner === 'wolf' ? '狼人阵营胜利' : '本局训练结束'}</Text>
          <Text className={styles.resultText}>
            {eliminatedPlayer ? `${getSeatLabel(game, eliminatedPlayer.id)} 被放逐。` : '没有玩家被放逐。'}
            这局重点可以复盘你的发言结构和投票理由。
          </Text>
        </View>
      )}

      <View className={styles.bottomSpace} />
      <View className={classnames(styles.bottomBar, process.env.TARO_ENV === 'h5' && styles.webRaised)}>
        {game.phase === 'night' && (
          <View className={styles.primaryButton} onClick={enterDay}>
            <Text className={styles.primaryButtonText}>
              {isAiLoading
                ? 'Kimi 生成中...'
                : userPlayer?.role === 'seer'
                  ? currentSeerCheck ? '完成查验，进入白天' : '先完成夜晚查验'
                  : userPlayer?.role === 'werewolf'
                    ? selectedWolfTarget ? '确认刀口，进入白天' : '先选择今晚刀口'
                  : userPlayer?.role === 'witch' && userPlayer.isAlive
                    ? usePoison && !selectedPoisonTarget ? '先选择毒药目标' : '确认用药，进入白天'
                  : '结算夜晚，进入白天'}
            </Text>
          </View>
        )}
        {game.phase === 'vote' && (
          <View className={styles.primaryButton} onClick={submitVote}>
            <Text className={styles.primaryButtonText}>{userPlayer?.isAlive ? '提交投票' : '查看 AI 投票'}</Text>
          </View>
        )}
        {game.phase === 'day' && userPlayer && !userPlayer.isAlive && (
          <View className={styles.primaryButton} onClick={enterVoteAsObserver}>
            <Text className={styles.primaryButtonText}>旁观投票</Text>
          </View>
        )}
        {game.phase === 'lastWords' && (
          <View className={styles.primaryButton} onClick={continueAfterLastWords}>
            <Text className={styles.primaryButtonText}>结束遗言，进入下一晚</Text>
          </View>
        )}
        {game.phase === 'result' && (
          <View className={styles.actionRowBottom}>
            <View className={styles.secondaryButtonBottom} onClick={resetGame}>
              <Text className={styles.secondaryButtonText}>再来一局</Text>
            </View>
            <View className={styles.primaryButtonBottom} onClick={goReview}>
              <Text className={styles.primaryButtonText}>查看复盘</Text>
            </View>
          </View>
        )}
        {game.phase === 'day' && userPlayer?.isAlive && (
          <Text className={styles.bottomHint}>你的身份：{roleNames[userPlayer.role]}。先表达视角，再给投票倾向。</Text>
        )}
      </View>
    </ScrollView>
  );
};

export default PlayPage;
