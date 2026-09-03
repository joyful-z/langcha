import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import { roleNames } from '@/data/game';
import type { GameState, ReviewInsight } from '@/types/game';
import { createInitialGame, getVoteSummary } from '@/utils/gameEngine';
import styles from './index.module.scss';

const buildInsights = (game: GameState): ReviewInsight[] => {
  const wolfChecks = game.seerChecks.filter((record) => record.targetCamp === 'wolf');
  const userVotes = game.votes.filter((vote) => vote.voterId === 'you');
  const lastUserVote = userVotes[userVotes.length - 1];
  const userRole = game.players.find((player) => player.isUser)?.role;
  const roleTipMap = {
    seer: '建议继续练“报查验结果 + 给怀疑理由 + 明确归票方向”的三段式预言家发言。',
    villager: '建议继续练闭眼好人发言：先听矛盾，再给站边，不要只说感觉。',
    werewolf: '建议继续练狼人伪装：别急着保队友，用票型和发言矛盾制造抗推位。',
    witch: '建议继续练女巫视角：药品信息不要乱交，先看死亡收益和白天站边。',
    hunter: '建议继续练猎人视角：前期别急着拍身份，承压时用枪口威慑逼狼人露出冲票痕迹。',
  };

  return [
    {
      title: userRole === 'seer' ? '查验使用' : '身份目标',
      content: userRole === 'seer'
        ? wolfChecks.length
          ? `你查到过狼人：${wolfChecks.map((record) => getSeatLabel(game, record.targetId)).join('、')}。下一步重点是白天如何安全公开信息。`
          : game.seerChecks.length
            ? '你完成了查验，但暂时没有查到狼人。真实局里这时要用发言和票型补信息。'
            : '你还没有产生查验记录。预言家每晚都应该尽量查验一个高价值位置。'
        : roleTipMap[userRole || 'villager'],
      level: userRole === 'seer' && !game.seerChecks.length ? 'warning' : 'good',
    },
    {
      title: '投票一致性',
      content: lastUserVote
        ? '你完成了投票。复盘时重点看你的投票是否和查验结果、白天发言保持一致。'
        : '你还没有自己的投票记录。如果你已出局，这一点是正常的；否则后续需要补投票选择。',
      level: lastUserVote ? 'info' : 'warning',
    },
    {
      title: '下一局训练',
      content: roleTipMap[userRole || 'villager'],
      level: 'info',
    },
  ];
};

const getSeatLabel = (game: GameState, playerId?: string) => {
  const index = game.players.findIndex((player) => player.id === playerId);
  return `${index >= 0 ? index + 1 : '?'}号`;
};

const ReviewPage: React.FC = () => {
  const [game, setGame] = useState<GameState>(() => createInitialGame('play', 'seer'));

  useEffect(() => {
    try {
      const storedGame = Taro.getStorageSync<GameState>('latestGameState');
      if (storedGame) {
        setGame(storedGame);
      }
    } catch (error) {
      console.error('[Review] read latest game failed', error);
    }
  }, []);

  const insights = useMemo(() => buildInsights(game), [game]);
  const voteSummary = useMemo(() => getVoteSummary(game), [game]);
  const alivePlayers = game.players.filter((player) => player.isAlive);
  const deadPlayers = game.players.filter((player) => !player.isAlive);

  const startAgain = () => {
    Taro.navigateTo({ url: '/pages/play/index' }).catch((error) => {
      console.error('[Review] navigate to play failed', error);
    });
  };

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.summaryCard}>
        <Text className={styles.kicker}>本局真实复盘</Text>
        <Text className={styles.title}>{game.winner === 'good' ? '好人阵营胜利' : game.winner === 'wolf' ? '狼人阵营胜利' : '对局进行中'}</Text>
        <Text className={styles.desc}>
          当前第 {game.day} 天，存活 {alivePlayers.length} 人，出局 {deadPlayers.length} 人。复盘基于本局实际查验、夜晚、投票和遗言记录生成。
        </Text>
        <View className={styles.scoreRow}>
          <View className={styles.scoreItem}>
            <Text className={styles.scoreValue}>{game.seerChecks.length}</Text>
            <Text className={styles.scoreLabel}>查验次数</Text>
          </View>
          <View className={styles.scoreItem}>
            <Text className={styles.scoreValue}>{game.nightRecords.length}</Text>
            <Text className={styles.scoreLabel}>夜晚轮次</Text>
          </View>
          <View className={styles.scoreItem}>
            <Text className={styles.scoreValue}>{game.votes.length}</Text>
            <Text className={styles.scoreLabel}>投票记录</Text>
          </View>
        </View>
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>关键节点</Text>
        <View className={styles.timeline}>
          {game.nightRecords.map((record) => (
            <View className={styles.timelineItem} key={`night-${record.day}`}>
              <View className={styles.timePill}>
                <Text className={styles.timeText}>夜晚</Text>
              </View>
              <View className={styles.timelineContent}>
                <Text className={styles.timelineTitle}>第 {record.day} 晚结算</Text>
                <Text className={styles.timelineDesc}>{record.announcement}</Text>
              </View>
            </View>
          ))}
          {game.seerChecks.map((record) => (
            <View className={styles.timelineItem} key={`check-${record.day}-${record.targetId}`}>
              <View className={styles.timePill}>
                <Text className={styles.timeText}>查验</Text>
              </View>
              <View className={styles.timelineContent}>
                <Text className={styles.timelineTitle}>你查验了 {getSeatLabel(game, record.targetId)}</Text>
                <Text className={styles.timelineDesc}>结果：{record.targetCamp === 'wolf' ? '狼人阵营' : '好人阵营'}，真实身份为 {roleNames[record.targetRole]}。</Text>
              </View>
            </View>
          ))}
          {game.lastWords.map((record) => (
            <View className={styles.timelineItem} key={`last-${record.day}-${record.playerId}`}>
              <View className={styles.timePill}>
                <Text className={styles.timeText}>遗言</Text>
              </View>
              <View className={styles.timelineContent}>
                <Text className={styles.timelineTitle}>{getSeatLabel(game, record.playerId)}</Text>
                <Text className={styles.timelineDesc}>{record.content}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {voteSummary.length > 0 && (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>票型回看</Text>
          <View className={styles.insightList}>
            {voteSummary.map((item) => (
              <View className={styles.insightCard} key={`${item.voterName}-${item.targetName}`}>
                <Text className={styles.insightTitle}>{item.voterName} → {item.targetName}</Text>
                <Text className={styles.insightText}>这张票需要结合发言顺序和身份视角判断是好人跟票、狼人冲票还是倒钩。</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>训练建议</Text>
        <View className={styles.insightList}>
          {insights.map((insight) => (
            <View
              className={classnames(
                styles.insightCard,
                insight.level === 'good' && styles.insightGood,
                insight.level === 'warning' && styles.insightWarning,
                insight.level === 'info' && styles.insightInfo,
              )}
              key={insight.title}
            >
              <Text className={styles.insightTitle}>{insight.title}</Text>
              <Text className={styles.insightText}>{insight.content}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className={styles.practiceCard}>
        <Text className={styles.practiceTitle}>下一局推荐练习</Text>
        <Text className={styles.practiceText}>继续练一局相同身份：夜晚看行动结果，白天抓发言矛盾，投票后回看票型。</Text>
        <View className={styles.primaryButton} onClick={startAgain}>
          <Text className={styles.primaryButtonText}>开始下一局</Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default ReviewPage;
