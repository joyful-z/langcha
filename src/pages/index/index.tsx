import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import { modeNames, roleCards } from '@/data/game';
import type { GameMode, Role } from '@/types/game';
import styles from './index.module.scss';

const modes: Array<{ key: GameMode; title: string; desc: string }> = [
  {
    key: 'play',
    title: modeNames.play,
    desc: '你选择身份上桌，其他 8 位 AI 随机拿牌并和你正常对局。',
  },
  {
    key: 'watch',
    title: modeNames.watch,
    desc: '你不上桌，只看 AI 随机身份互相发言、投票和复盘。',
  },
];

const IndexPage: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('play');
  const [selectedRole, setSelectedRole] = useState<Role>('seer');

  const startGame = () => {
    console.info('[Home] start game', { selectedMode, selectedRole });
    Taro.setStorageSync('selectedMode', selectedMode);
    Taro.setStorageSync('selectedRole', selectedRole);
    Taro.navigateTo({ url: '/pages/play/index' }).catch((error) => {
      console.error('[Home] navigate to play failed', error);
    });
  };

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.hero}>
        <View className={styles.comicStage}>
          <View className={styles.spotlight} />
          <View className={styles.tableOval}>
            <View className={styles.wolfMask}>
              <View className={styles.maskEarLeft} />
              <View className={styles.maskEarRight} />
              <View className={styles.maskEyeLeft} />
              <View className={styles.maskEyeRight} />
              <View className={styles.maskNose} />
            </View>
          </View>
          <View className={styles.miniRoleA}><Text className={styles.miniRoleText}>预</Text></View>
          <View className={styles.miniRoleB}><Text className={styles.miniRoleText}>狼</Text></View>
          <View className={styles.miniRoleC}><Text className={styles.miniRoleText}>巫</Text></View>
        </View>
        <View className={styles.heroText}>
          <View className={styles.brandRow}>
            <View className={styles.brandSeal}>
              <Text className={styles.brandSealText}>狼</Text>
            </View>
            <Text className={styles.brandName}>WolfCha 狼茶</Text>
          </View>
          <Text className={styles.title}>WolfCha-AI陪你狼人杀</Text>
          <Text className={styles.subtitle}>
            你选身份，AI 抽牌上桌。练发言、站边、抗推和归票，像真实朋友局一样开麦推理。
          </Text>
        </View>
      </View>

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>选择模式</Text>
        </View>
        <View className={styles.modeList}>
          {modes.map((mode, index) => (
            <View
              key={mode.key}
              className={classnames(styles.modeCard, selectedMode === mode.key && styles.modeCardActive)}
              onClick={() => setSelectedMode(mode.key)}
            >
              <View className={classnames(styles.modeIcon, index === 1 && styles.modeIconWatch)}>
                <Text className={styles.modeIconText}>{index === 0 ? '玩' : '看'}</Text>
              </View>
              <View className={styles.modeBody}>
                <Text className={styles.modeTitle}>{mode.title}</Text>
                <Text className={styles.modeDesc}>{mode.desc}</Text>
              </View>
              <View className={styles.radio}>
                {selectedMode === mode.key && <View className={styles.radioDot} />}
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>选择你的身份</Text>
        </View>
        <View className={styles.roleGrid}>
          {roleCards.map((card) => (
            <View
              className={classnames(styles.roleCard, selectedRole === card.role && styles.roleCardActive)}
              key={card.role}
              onClick={() => setSelectedRole(card.role)}
            >
              <View className={styles.roleTop}>
                <View className={styles.roleBadge} style={{ backgroundColor: card.color }}>
                  <Text className={styles.roleBadgeText}>{card.badge}</Text>
                </View>
                <Text className={styles.roleTitle}>{card.title}</Text>
              </View>
              <View className={styles.roleLine}>
                <Text className={styles.roleLineLabel}>描述</Text>
                <Text className={styles.roleText}>{card.intro}</Text>
              </View>
              <View className={styles.roleLine}>
                <Text className={styles.roleLineLabel}>目标</Text>
                <Text className={styles.roleGoal}>{card.goal}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className={styles.ctaBar}>
        <View className={styles.primaryButton} onClick={startGame}>
          <Text className={styles.primaryButtonText}>{selectedMode === 'watch' ? '开始 AI 观战' : '开始本局游戏'}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default IndexPage;
