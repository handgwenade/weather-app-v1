import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type HomeIconName = ComponentProps<typeof Ionicons>['name'];

type Tone = 'good' | 'neutral' | 'warning' | 'alert';

export type HomeMetric = {
  label: string;
  value: string;
};

export type HomeOutlookItem = {
  id: string;
  time: string;
  temperature: string;
  condition: string;
};

export type HomeBullet = {
  id: string;
  text: string;
};

export type HomeStatusBanner = {
  title: string;
  subtitle: string;
  statusLabel: string;
  statusTone: Tone;
  actionLabel: string;
};

export type HomeMonitoringCard = {
  title: string;
  body: string;
};

export type HomeLocationCard = {
  title: string;
  bullets: HomeBullet[];
  statusLabel: string;
  statusTone: Tone;
  impactLabel: string;
};

type HomeScreenV2Props = {
  topTitle: string;
  updatedLabel: string;
  statusBanner: HomeStatusBanner;
  metrics: HomeMetric[];
  outlookItems: HomeOutlookItem[];
  monitoringCard: HomeMonitoringCard;
  monitoredLocationCard: HomeLocationCard;
  onPressSettings: () => void;
  onPressSwitchLocation: () => void;
  onPressPrimaryAction: () => void;
  onPressSecondaryAction: () => void;
};

function getStatusChipStyle(tone: Tone) {
  switch (tone) {
    case 'alert':
      return {
        backgroundColor: '#FEE2E2',
        borderColor: '#FCA5A5',
        textColor: '#991B1B',
      };
    case 'warning':
      return {
        backgroundColor: '#FEF3C7',
        borderColor: '#FCD34D',
        textColor: '#92400E',
      };
    case 'neutral':
      return {
        backgroundColor: '#E2E8F0',
        borderColor: '#CBD5E1',
        textColor: '#334155',
      };
    default:
      return {
        backgroundColor: '#DCFCE7',
        borderColor: '#86EFAC',
        textColor: '#166534',
      };
  }
}

export default function HomeScreenV2({
  topTitle,
  updatedLabel,
  statusBanner,
  metrics,
  outlookItems,
  monitoringCard,
  monitoredLocationCard,
  onPressSettings,
  onPressSwitchLocation,
  onPressPrimaryAction,
  onPressSecondaryAction,
}: HomeScreenV2Props) {
  const bannerChipStyle = getStatusChipStyle(statusBanner.statusTone);
  const locationChipStyle = getStatusChipStyle(monitoredLocationCard.statusTone);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          <Pressable style={styles.titleButton} onPress={onPressSwitchLocation}>
            <Text style={styles.topTitle} numberOfLines={1}>
              {topTitle}
            </Text>
            <Ionicons name="chevron-down-outline" size={18} color="#0F172B" />
          </Pressable>

          <Pressable style={styles.settingsButton} onPress={onPressSettings}>
            <Ionicons name="settings-outline" size={24} color="#2F5DA8" />
          </Pressable>
        </View>

        <Text style={styles.updatedText}>Updated {updatedLabel}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <View style={styles.card}>
          <Text style={styles.bannerTitle}>{statusBanner.title}</Text>
          <Text style={styles.bannerSubtitle}>{statusBanner.subtitle}</Text>

          <View style={styles.bannerActions}>
            <View
              style={[
                styles.statusChip,
                {
                  backgroundColor: bannerChipStyle.backgroundColor,
                  borderColor: bannerChipStyle.borderColor,
                },
              ]}>
              <Text style={[styles.statusChipText, { color: bannerChipStyle.textColor }]}>
                {statusBanner.statusLabel}
              </Text>
            </View>

            <View style={styles.darkChip}>
              <Text style={styles.darkChipText}>{statusBanner.actionLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.metricsCard}>
          <View style={styles.metricsGrid}>
            {metrics.map((metric) => (
              <View key={metric.label} style={styles.metricCell}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{metric.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionCardTitle}>12-Hour Outlook</Text>

          <View style={styles.outlookRow}>
            {outlookItems.map((item) => (
              <View key={item.id} style={styles.outlookItem}>
                <Text style={styles.outlookTime}>{item.time}</Text>
                <Text style={styles.outlookTemp}>{item.temperature}</Text>
                <Text style={styles.outlookCondition} numberOfLines={1}>
                  {item.condition}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>What we&apos;re monitoring</Text>

          <View style={styles.monitoringCard}>
            <Text style={styles.monitoringTitle}>{monitoringCard.title}</Text>
            <Text style={styles.monitoringBody}>{monitoringCard.body}</Text>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Monitored locations</Text>

          <View style={styles.locationCard}>
            <View style={styles.locationCardHeader}>
              <Text style={styles.locationCardTitle}>{monitoredLocationCard.title}</Text>
              <Ionicons name="arrow-forward-outline" size={20} color="#3B82F6" />
            </View>

            <View style={styles.bulletsList}>
              {monitoredLocationCard.bullets.map((bullet) => (
                <View key={bullet.id} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{bullet.text}</Text>
                </View>
              ))}
            </View>

            <View style={styles.locationFooter}>
              <View
                style={[
                  styles.locationStatusChip,
                  {
                    backgroundColor: locationChipStyle.backgroundColor,
                    borderColor: locationChipStyle.borderColor,
                  },
                ]}>
                <Text style={[styles.locationStatusText, { color: locationChipStyle.textColor }]}>
                  {monitoredLocationCard.statusLabel}
                </Text>
              </View>

              <Text style={styles.impactText}>{monitoredLocationCard.impactLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <Pressable style={styles.primaryButton} onPress={onPressPrimaryAction}>
            <Text style={styles.primaryButtonText}>Open Conditions</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={onPressSecondaryAction}>
            <Text style={styles.secondaryButtonText}>Open Road</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#CAD5E2',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 13,
    gap: 4,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  titleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '82%',
  },
  topTitle: {
    color: '#0F172B',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.44,
  },
  settingsButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updatedText: {
    color: '#62748E',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(202, 213, 226, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  bannerTitle: {
    color: '#0F172B',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.45,
  },
  bannerSubtitle: {
    color: '#45556C',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.31,
    marginTop: 4,
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statusChip: {
    minHeight: 32,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  statusChipText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: -0.15,
  },
  darkChip: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#1D293D',
    justifyContent: 'center',
  },
  darkChipText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: -0.15,
  },
  metricsCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(202, 213, 226, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
    columnGap: 12,
  },
  metricCell: {
    width: '47%',
    minHeight: 40,
  },
  metricLabel: {
    color: '#62748E',
    fontSize: 12,
    lineHeight: 16,
  },
  metricValue: {
    color: '#0F172B',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.31,
    marginTop: 1,
  },
  sectionCardTitle: {
    color: '#0F172B',
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: -0.44,
    marginBottom: 12,
  },
  outlookRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  outlookItem: {
    width: 48,
    alignItems: 'center',
  },
  outlookTime: {
    color: '#62748E',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  outlookTemp: {
    color: '#0F172B',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.31,
    textAlign: 'center',
    marginTop: 4,
  },
  outlookCondition: {
    color: '#45556C',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionHeading: {
    color: '#0F172B',
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: -0.44,
  },
  monitoringCard: {
    backgroundColor: '#E3F4EA',
    borderWidth: 1,
    borderColor: 'rgba(202, 213, 226, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 92,
  },
  monitoringTitle: {
    color: '#0F172B',
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: -0.44,
  },
  monitoringBody: {
    color: '#314158',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
    marginTop: 4,
    maxWidth: '88%',
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(212, 212, 212, 0.4)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  locationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationCardTitle: {
    color: '#1C304F',
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: -0.44,
  },
  bulletsList: {
    gap: 6,
    marginBottom: 14,
    paddingRight: 18,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    color: '#A1A1A1',
    fontSize: 14,
    lineHeight: 20,
    marginTop: -1,
  },
  bulletText: {
    flex: 1,
    color: 'rgba(28, 48, 79, 0.7)',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  locationFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  locationStatusChip: {
    minHeight: 28,
    paddingHorizontal: 14,
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
  },
  locationStatusText: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: -0.15,
  },
  impactText: {
    color: '#59595B',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 30,
    backgroundColor: '#2F7FD8',
    borderWidth: 1,
    borderColor: '#CAD5E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: -0.15,
  },
  secondaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 27,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CAD5E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#0F172B',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: -0.15,
  },
});
