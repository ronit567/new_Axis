import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export type ReportTarget = 'listing' | 'user' | 'chat';

type ReportReason = 'spam' | 'prohibited_item' | 'harassment' | 'other';

const REASONS: { key: ReportReason; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'spam',           label: 'Spam',            icon: 'alert-circle-outline' },
  { key: 'prohibited_item', label: 'Prohibited item', icon: 'ban-outline' },
  { key: 'harassment',    label: 'Harassment',       icon: 'hand-left-outline' },
  { key: 'other',         label: 'Other',            icon: 'ellipsis-horizontal-circle-outline' },
];

type Props = {
  visible: boolean;
  target: ReportTarget;
  targetName?: string;
  onClose: () => void;
  onBlock?: () => void;
};

export default function ReportModal({ visible, target, targetName, onClose, onBlock }: Props) {
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!selected) return;
    setSubmitted(true);
  };

  const handleClose = () => {
    setSelected(null);
    setSubmitted(false);
    onClose();
  };

  const handleBlock = () => {
    setSelected(null);
    setSubmitted(false);
    Alert.alert(
      'User blocked',
      `${targetName ?? 'This user'} has been blocked. You will no longer see their content.`,
      [{ text: 'OK' }],
    );
    onBlock?.();
  };

  const targetLabel =
    target === 'listing' ? 'listing' : target === 'chat' ? 'conversation' : 'user';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {submitted ? (
          /* ── Confirmation state ── */
          <View style={styles.confirmSection}>
            <View style={styles.confirmIcon}>
              <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
            </View>
            <Text style={styles.confirmTitle}>Report submitted</Text>
            <Text style={styles.confirmBody}>
              Thanks for letting us know. Our team will review this {targetLabel}.
            </Text>
            {(target === 'user' || target === 'chat') && (
              <TouchableOpacity style={styles.blockBtn} onPress={handleBlock} activeOpacity={0.8}>
                <Ionicons name="hand-left-outline" size={16} color={COLORS.error} />
                <Text style={styles.blockBtnText}>Block {targetName ?? 'this user'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.doneBtn} onPress={handleClose} activeOpacity={0.85}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Reason picker state ── */
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Report {targetLabel}</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>Why are you reporting this {targetLabel}?</Text>

            <View style={styles.reasonList}>
              {REASONS.map(reason => {
                const active = selected === reason.key;
                return (
                  <TouchableOpacity
                    key={reason.key}
                    style={[styles.reasonRow, active && styles.reasonRowActive]}
                    onPress={() => setSelected(reason.key)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.reasonIcon, active && styles.reasonIconActive]}>
                      <Ionicons
                        name={reason.icon}
                        size={18}
                        color={active ? COLORS.primary : COLORS.textSecondary}
                      />
                    </View>
                    <Text style={[styles.reasonLabel, active && styles.reasonLabelActive]}>
                      {reason.label}
                    </Text>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, selected ? styles.submitBtnActive : styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!selected}
              activeOpacity={0.85}
            >
              <Text style={[styles.submitBtnText, !selected && styles.submitBtnTextDisabled]}>
                Submit report
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 20,
  },
  reasonList: {
    gap: 10,
    marginBottom: 24,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EBEBF0',
    backgroundColor: '#FAFAFA',
  },
  reasonRowActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F5F0FF',
  },
  reasonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0F0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonIconActive: {
    backgroundColor: '#EBE3FF',
  },
  reasonLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  reasonLabelActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#DDDDE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnActive: {
    backgroundColor: COLORS.primary,
  },
  submitBtnDisabled: {
    backgroundColor: '#EBEBF0',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  submitBtnTextDisabled: {
    color: COLORS.textMuted,
  },
  confirmSection: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  confirmIcon: {
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  confirmBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  blockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    marginBottom: 12,
    width: '100%',
    justifyContent: 'center',
  },
  blockBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.error,
  },
  doneBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
});
