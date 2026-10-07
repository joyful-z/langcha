import React from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { aiProfiles } from '@/data/game';
import styles from './index.module.scss';

const ModelsPage: React.FC = () => (
  <ScrollView className={styles.page} scrollY>
    <View className={styles.header}>
      <Text className={styles.kicker}>AI 参与者设计</Text>
      <Text className={styles.title}>每个模型都有不同打法</Text>
    </View>

    <View className={styles.modelList}>
      {aiProfiles.map((profile, index) => (
        <View className={styles.modelCard} key={profile.id}>
          <View className={styles.modelHeader}>
            <View className={styles.avatar} style={{ backgroundColor: profile.color }}>
              <Text className={styles.avatarText}>{index + 1}</Text>
            </View>
            <View className={styles.modelMeta}>
              <Text className={styles.modelName}>{index + 1}号玩家</Text>
            </View>
          </View>
          <View className={styles.detailGrid}>
            <View className={styles.detailItem}>
              <Text className={styles.detailLabel}>性格</Text>
              <Text className={styles.detailText}>{profile.temperament}</Text>
            </View>
            <View className={styles.detailItem}>
              <Text className={styles.detailLabel}>打法</Text>
              <Text className={styles.detailText}>{profile.playStyle}</Text>
            </View>
            <View className={styles.detailItem}>
              <Text className={styles.detailLabel}>强项</Text>
              <Text className={styles.detailText}>{profile.strength}</Text>
            </View>
            <View className={styles.detailItem}>
              <Text className={styles.detailLabel}>风险</Text>
              <Text className={styles.detailText}>{profile.risk}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  </ScrollView>
);

export default ModelsPage;
