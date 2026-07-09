import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { COLORS, FONTS, SHADOWS, SIZES } from '../constants/theme';
import { RootStackParamList, SellerProfile } from '../types';
import PressableScale from '../components/PressableScale';
import EmptyState from '../components/EmptyState';
import ActivitySpinner from '../components/ActivitySpinner';
import { useFollowing, useToggleFollow } from '../hooks/useFollows';
import { formatYearOfStudy } from '../lib/formatYear';
import { haptics } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Following'>;

// The people the current user follows (0019). Rows tap through to the
// SellerProfile page; the pill unfollows in place.
export default function FollowingScreen({ navigation }: Props) {
  const { data: following, isPending } = useFollowing();
  const toggleFollow = useToggleFollow();

  const renderRow = ({ item }: { item: SellerProfile }) => (
    <PressableScale
      style={styles.row}
      onPress={() => navigation.navigate('SellerProfile', { seller: item })}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.name}'s profile`}
    >
      <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
        <Text style={styles.avatarText}>{item.initials}</Text>
      </View>
      <View style={styles.rowInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.verified && (
            <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
          )}
        </View>
        <Text style={styles.program} numberOfLines={1}>
          {item.program} · {formatYearOfStudy(item.year)}
        </Text>
      </View>
      <PressableScale
        style={styles.unfollowBtn}
        onPress={() => {
          haptics.tap();
          toggleFollow.mutate({ sellerId: item.id, next: false });
        }}
        scaleTo={0.94}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={`Unfollow ${item.name}`}
      >
        <Text style={styles.unfollowText}>Saved</Text>
      </PressableScale>
    </PressableScale>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {/* ── Header (SettingsScreen pattern) ── */}
      <View style={styles.header}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.headerTitle}>Saved profiles</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isPending ? (
        <ActivitySpinner style={styles.spinner} />
      ) : (following ?? []).length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No saved profiles yet. Bookmark sellers to find them again quickly."
          ctaLabel="Browse listings"
          onCta={() => navigation.goBack()}
        />
      ) : (
        <FlatList
          data={following}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 38,
  },
  headerTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  spinner: {
    marginTop: 48,
  },
  list: {
    padding: 20,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    padding: 12,
    ...SHADOWS.card,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  rowInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  name: {
    fontSize: SIZES.base,
    fontWeight: '600',
    color: COLORS.text,
    flexShrink: 1,
  },
  program: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  unfollowBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
  },
  unfollowText: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
