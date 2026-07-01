import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SIZES } from '../constants/theme';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

function SectionLabel({ title, highlight }: { title: string; highlight?: boolean }) {
  if (highlight) {
    return (
      <View style={styles.sectionLabelWrap}>
        <View style={styles.sectionLabelPill}>
          <Text style={[styles.sectionLabelText, styles.sectionLabelHighlighted]}>
            {title}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.sectionLabelWrap}>
      <Text style={styles.sectionLabelText}>{title}</Text>
    </View>
  );
}

function RowItem({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value != null && <Text style={styles.rowValue}>{value}</Text>}
        <Text style={styles.rowChevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E0E0E0', true: COLORS.primary }}
        thumbColor={COLORS.white}
        ios_backgroundColor="#E0E0E0"
      />
    </View>
  );
}

function RowDivider() {
  return <View style={styles.rowDivider} />;
}

export default function SettingsScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [pushNotif, setPushNotif] = useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const canDelete = confirmText === 'DELETE';

  const closeDeleteModal = () => {
    setDeleteModalVisible(false);
    setConfirmText('');
  };

  const handleDeleteAccount = () => {
    if (!canDelete) return;
    closeDeleteModal();
    signOut();
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── ACCOUNT ── */}
        <SectionLabel title="ACCOUNT" />
        <View style={styles.card}>
          <RowItem label="Edit profile" onPress={() => navigation.navigate('EditProfile')} />
          <RowDivider />
          <RowItem label="Change password" />
          <RowDivider />
          <RowItem label="Payment & payouts" />
        </View>

        {/* ── PREFERENCES ── */}
        <SectionLabel title="PREFERENCES" highlight />
        <View style={styles.card}>
          <ToggleRow
            label="Push notifications"
            value={pushNotif}
            onValueChange={setPushNotif}
          />
          <RowDivider />
          <RowItem label="Default pickup area" value="UCC" />
        </View>

        {/* ── PRIVACY & SAFETY ── */}
        <SectionLabel title="PRIVACY & SAFETY" />
        <View style={styles.card}>
          <RowItem label="Blocked users" />
        </View>

        {/* ── LEGAL ── */}
        <SectionLabel title="LEGAL" />
        <View style={styles.card}>
          <RowItem
            label="Privacy policy"
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
          <RowDivider />
          <RowItem
            label="Terms of service"
            onPress={() => navigation.navigate('TermsOfService')}
          />
          <RowDivider />
          <RowItem
            label="Community guidelines"
            onPress={() => navigation.navigate('CommunityGuidelines')}
          />
        </View>

        {/* ── Log out ── */}
        <TouchableOpacity
          style={styles.logoutCard}
          activeOpacity={0.8}
          onPress={signOut}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        {/* ── DANGER ZONE ── */}
        <SectionLabel title="DANGER ZONE" />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => setDeleteModalVisible(true)}
          >
            <Text style={styles.dangerRowLabel}>Delete account</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Delete account confirmation modal ── */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
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

            <TouchableOpacity
              style={[styles.deleteButton, !canDelete && styles.deleteButtonDisabled]}
              activeOpacity={0.8}
              disabled={!canDelete}
              onPress={handleDeleteAccount}
            >
              <Text style={styles.deleteButtonText}>Permanently delete account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              activeOpacity={0.7}
              onPress={closeDeleteModal}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backBtn: {
    marginRight: 6,
  },
  backArrow: {
    fontSize: 28,
    color: COLORS.text,
    lineHeight: 32,
    marginTop: -2,
  },
  headerTitle: {
    fontSize: SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },

  /* scroll */
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  /* section labels */
  sectionLabelWrap: {
    marginBottom: 8,
  },
  sectionLabelText: {
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  sectionLabelPill: {
    backgroundColor: '#EDE8FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  sectionLabelHighlighted: {
    color: COLORS.primary,
    letterSpacing: 0.8,
  },

  /* card */
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },

  /* rows */
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
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
  rowChevron: {
    fontSize: 20,
    color: COLORS.textMuted,
    lineHeight: 22,
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },

  /* logout */
  logoutCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  logoutText: {
    fontSize: SIZES.base,
    fontWeight: '600',
    color: COLORS.error,
  },

  /* danger zone */
  dangerRowLabel: {
    fontSize: SIZES.base,
    fontWeight: '600',
    color: COLORS.error,
    flex: 1,
  },

  /* delete modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    padding: 20,
  },
  modalTitle: {
    fontSize: SIZES.lg,
    fontWeight: '700',
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
    borderRadius: SIZES.borderRadiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.4,
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
