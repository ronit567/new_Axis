import React from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RootStackParamList, BlockedUser } from '../types';
import Screen from '../components/layout/Screen';
import ScreenHeader from '../components/layout/ScreenHeader';
import Avatar from '../components/Avatar';
import PressableScale from '../components/PressableScale';
import ActivitySpinner from '../components/ActivitySpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { useBlockedUsers, useUnblockUser } from '../hooks/useBlocks';
import { haptics } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'BlockedUsers'>;

// Settings → Blocked users. Blocking itself lives in ReportModal; this is the
// management surface — see who you've blocked, and undo it. Unblocking
// un-hides both sides again via is_blocked() RLS (0002), so it goes through a
// confirm first.
export default function BlockedUsersScreen({ navigation }: Props) {
  const { data: blocked, isLoading, isError, refetch } = useBlockedUsers();
  const unblock = useUnblockUser();

  const handleUnblock = (user: BlockedUser) => {
    haptics.tap();
    Alert.alert(
      `Unblock ${user.name}?`,
      'They will be able to see your listings and message you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: () =>
            unblock.mutate(user.id, {
              onError: () =>
                Alert.alert('Something went wrong', "We couldn't unblock this user. Please try again."),
            }),
        },
      ],
    );
  };

  const renderRow = ({ item }: { item: BlockedUser }) => (
    <View style={styles.row}>
      <Avatar
        url={item.avatarUrl}
        initials={item.initials}
        color={item.avatarColor}
        size={44}
      />
      <Text style={styles.name} numberOfLines={1}>
        {item.name}
      </Text>
      <PressableScale
        style={styles.unblockBtn}
        onPress={() => handleUnblock(item)}
        disabled={unblock.isPending}
        scaleTo={0.95}
        accessibilityRole="button"
        accessibilityLabel={`Unblock ${item.name}`}
      >
        <Text style={styles.unblockText}>Unblock</Text>
      </PressableScale>
    </View>
  );

  return (
    <Screen>
      <ScreenHeader title="Blocked users" onBack={() => navigation.goBack()} bordered />

      {isLoading ? (
        <ActivitySpinner size="large" style={{ flex: 1 }} />
      ) : isError ? (
        <ErrorState
          message="Couldn't load your blocked users. Check your connection and try again."
          onRetry={() => refetch()}
        />
      ) : (blocked ?? []).length === 0 ? (
        <EmptyState
          icon="ban-outline"
          title="You haven't blocked anyone"
          ctaLabel="Done"
          onCta={() => navigation.goBack()}
        />
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={item => item.id}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  name: {
    flex: 1,
    fontSize: SIZES.base,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
  },
  unblockBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: SIZES.borderRadiusSm,
    borderWidth: 1.5,
    borderColor: COLORS.error,
  },
  unblockText: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.error,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
});
