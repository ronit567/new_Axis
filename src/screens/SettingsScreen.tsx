import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { BlurView } from 'expo-blur';
import { COLORS, SIZES, SHADOWS, FONTS } from '../constants/theme';
import { RootStackParamList } from '../types';
import PressableScale from '../components/PressableScale';
import Screen from '../components/layout/Screen';
import ScreenHeader from '../components/layout/ScreenHeader';
import Card, { SectionLabel } from '../components/layout/Card';
import { useAuth } from '../context/AuthContext';
import { useDeleteAccount } from '../hooks/useProfile';
import { haptics } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

function RowItem({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IoniconsName;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.rowLeft}>
        <View style={styles.rowIconBox}>
          <Ionicons name={icon} size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {value != null && <Text style={styles.rowValue}>{value}</Text>}
        {onPress && <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <PressableScale
      style={styles.row}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      scaleTo={0.98}
    >
      {content}
    </PressableScale>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
}: {
  icon: IoniconsName;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIconBox}>
          <Ionicons name={icon} size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={v => {
          haptics.tap();
          onValueChange(v);
        }}
        trackColor={{ false: COLORS.inputBorder, true: COLORS.primary }}
        thumbColor={COLORS.white}
        ios_backgroundColor={COLORS.inputBorder}
      />
    </View>
  );
}

function RowDivider() {
  return <View style={styles.rowDivider} />;
}

export default function SettingsScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const deleteAccount = useDeleteAccount();
  const [pushNotif, setPushNotif] = useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const canDelete = confirmText === 'DELETE' && !deleteAccount.isPending;

  const closeDeleteModal = () => {
    setDeleteModalVisible(false);
    setConfirmText('');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      Alert.alert(
        'Sign out failed',
        e instanceof Error ? e.message : 'Please try again.',
      );
    }
  };

  const handleDeleteAccount = async () => {
    if (!canDelete) return;
    try {
      // Deletes the auth user + cascades through their owned data server-side
      // (migration 0010), then signs the now-gone session out locally.
      // RootNavigator reacts to the session change; no manual navigation.
      await deleteAccount.mutateAsync();
      closeDeleteModal();
    } catch (e) {
      Alert.alert(
        'Delete account failed',
        e instanceof Error ? e.message : 'Please try again.',
      );
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} bordered />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── ACCOUNT ── */}
        <SectionLabel title="ACCOUNT" />
        <Card style={styles.card}>
          <RowItem icon="create-outline" label="Edit profile" onPress={() => navigation.navigate('EditProfile')} />
          <RowDivider />
          <RowItem icon="key-outline" label="Change password" />
          <RowDivider />
          <RowItem icon="card-outline" label="Payment & payouts" />
        </Card>

        {/* ── PREFERENCES ── */}
        <SectionLabel title="PREFERENCES" />
        <Card style={styles.card}>
          <ToggleRow
            icon="notifications-outline"
            label="Push notifications"
            value={pushNotif}
            onValueChange={setPushNotif}
          />
          <RowDivider />
          <RowItem icon="location-outline" label="Default pickup area" value="UCC" />
        </Card>

        {/* ── PRIVACY & SAFETY ── */}
        <SectionLabel title="PRIVACY & SAFETY" />
        <Card style={styles.card}>
          <RowItem icon="ban-outline" label="Blocked users" />
        </Card>

        {/* ── SUPPORT ── */}
        <SectionLabel title="SUPPORT" />
        <Card style={styles.card}>
          <RowItem icon="help-circle-outline" label="Help & support" />
          <RowDivider />
          <RowItem icon="flag-outline" label="Report a problem" />
        </Card>

        {/* ── LEGAL ── */}
        <SectionLabel title="LEGAL" />
        <Card style={styles.card}>
          <RowItem
            icon="document-text-outline"
            label="Privacy policy"
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
          <RowDivider />
          <RowItem
            icon="reader-outline"
            label="Terms of service"
            onPress={() => navigation.navigate('TermsOfService')}
          />
          <RowDivider />
          <RowItem
            icon="people-outline"
            label="Community guidelines"
            onPress={() => navigation.navigate('CommunityGuidelines')}
          />
        </Card>

        {/* ── Log out ── */}
        <PressableScale
          style={styles.logoutCard}
          onPress={() => {
            haptics.impact();
            handleSignOut();
          }}
          scaleTo={0.98}
        >
          <View style={styles.logoutIconBox}>
            <Ionicons name="log-out-outline" size={16} color={COLORS.error} />
          </View>
          <Text style={styles.logoutText}>Log out</Text>
        </PressableScale>

        {/* ── DANGER ZONE ── */}
        <SectionLabel title="DANGER ZONE" />
        <Card style={styles.card}>
          <PressableScale
            style={styles.row}
            onPress={() => {
              haptics.tap();
              setDeleteModalVisible(true);
            }}
            scaleTo={0.98}
          >
            <View style={styles.rowLeft}>
              <View style={styles.dangerIconBox}>
                <Ionicons name="trash-outline" size={16} color={COLORS.error} />
              </View>
              <Text style={styles.dangerRowLabel}>Delete account</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.error} />
          </PressableScale>
        </Card>
      </ScrollView>

      {/* ── Delete account confirmation modal ── */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete account</Text>
            <Text style={styles.modalBody}>
              Your listings, messages, and profile will be permanently removed.
              This cannot be undone.
            </Text>

            <Text style={styles.modalInputLabel}>Type DELETE to confirm</Text>
            <TextInput
              style={styles.modalInput}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="DELETE"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <PressableScale
              style={[styles.deleteButton, !canDelete && styles.deleteButtonDisabled]}
              disabled={!canDelete}
              onPress={() => {
                haptics.impact();
                handleDeleteAccount();
              }}
              scaleTo={0.97}
            >
              <Text style={styles.deleteButtonText}>
                {deleteAccount.isPending ? 'Deleting…' : 'Permanently delete account'}
              </Text>
            </PressableScale>

            <PressableScale
              style={styles.cancelButton}
              onPress={() => {
                haptics.tap();
                closeDeleteModal();
              }}
              scaleTo={0.97}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* scroll */
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },

  /* card — the surface itself (background, radius, shadow) comes from
     <Card>; only the inner padding and group spacing are local. */
  card: {
    paddingHorizontal: 16,
  },

  /* rows */
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: SIZES.base,
    color: COLORS.text,
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },

  /* logout */
  logoutCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    // Group spacing now comes from SectionLabel's top margin, but Log out has
    // no label above it — so it carries its own matching gap.
    marginTop: 22,
    marginBottom: 4,
    ...SHADOWS.card,
  },
  logoutIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,59,48,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: SIZES.base,
    fontWeight: '600',
    color: COLORS.error,
  },

  /* danger zone */
  dangerIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,59,48,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerRowLabel: {
    fontSize: SIZES.base,
    fontWeight: '600',
    color: COLORS.error,
    flex: 1,
  },

  /* delete modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadiusLg,
    padding: 20,
  },
  modalTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 10,
  },
  modalBody: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
  },
  modalInputLabel: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  modalInput: {
    height: SIZES.inputHeight,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    paddingHorizontal: 14,
    fontSize: SIZES.base,
    color: COLORS.text,
    backgroundColor: COLORS.inputBackground,
    marginBottom: 18,
  },
  deleteButton: {
    height: SIZES.buttonHeight,
    backgroundColor: COLORS.error,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.white,
  },
  cancelButton: {
    height: SIZES.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelButtonText: {
    fontSize: SIZES.base,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
