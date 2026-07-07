import React, { useEffect, useRef, useState } from 'react';
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
import { BlurView } from 'expo-blur';
import { COLORS, FONTS } from '../constants/theme';
import { haptics } from '../lib/haptics';
import { ReportReason, ReportTarget } from '../types';

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
  onSubmit: (reason: ReportReason) => Promise<void>;
  onBlock?: () => Promise<void>;
};

export default function ReportModal({ visible, target, targetName, onClose, onSubmit, onBlock }: Props) {
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [blocking, setBlocking] = useState(false);

  // RN's Modal keeps this component mounted while visible={false}, so an
  // onSubmit/onBlock promise that resolves *after* the user dismisses the sheet
  // would otherwise write stale state (flip `submitted` to true and show the
  // "Report submitted" confirmation the next time it opens). This ref tracks
  // whether the sheet is still open; handleClose flips it synchronously (a
  // setState here would lag the resolving promise).
  const openRef = useRef(visible);
  useEffect(() => {
    openRef.current = visible;
  }, [visible]);

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    haptics.impact();
    setSubmitting(true);
    try {
      await onSubmit(selected);
      if (openRef.current) setSubmitted(true);
    } catch {
      if (openRef.current) {
        Alert.alert('Something went wrong', "We couldn't submit your report. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    openRef.current = false;
    setSelected(null);
    setSubmitted(false);
    // Also clear the in-flight flags: RN's Modal keeps this component mounted
    // while visible={false}, so without this, closing mid-request and
    // reopening before the request settles would show a stuck "Submitting…"/
    // "Blocking…" button until the background call finishes.
    setSubmitting(false);
    setBlocking(false);
    onClose();
  };

  const handleBlock = async () => {
    if (blocking) return;
    setBlocking(true);
    try {
      await onBlock?.();
      if (openRef.current) {
        Alert.alert(
          'User blocked',
          `${targetName ?? 'This user'} has been blocked. You will no longer see their content.`,
          // Close (rather than fall back to the reason-picker view) once the
          // user has acknowledged the block.
          [{ text: 'OK', onPress: handleClose }],
        );
      }
    } catch {
      if (openRef.current) {
        Alert.alert('Something went wrong', "We couldn't block this user. Please try again.");
      }
    } finally {
      setBlocking(false);
    }
  };

  const targetLabel =
    target === 'listing' ? 'listing' : target === 'chat' ? 'conversation' : 'user';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>
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
              <TouchableOpacity
                style={[styles.blockBtn, blocking && styles.blockBtnDisabled]}
                onPress={handleBlock}
                disabled={blocking}
                activeOpacity={0.8}
              >
                <Ionicons name="hand-left-outline" size={16} color={COLORS.error} />
                <Text style={styles.blockBtnText}>
                  {blocking ? 'Blocking…' : `Block ${targetName ?? 'this user'}`}
                </Text>
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
                    onPress={() => {
                      haptics.tap();
                      setSelected(reason.key);
                    }}
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
              style={[styles.submitBtn, selected && !submitting ? styles.submitBtnActive : styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!selected || submitting}
              activeOpacity={0.85}
            >
              <Text style={[styles.submitBtnText, (!selected || submitting) && styles.submitBtnTextDisabled]}>
                {submitting ? 'Submitting…' : 'Submit report'}
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
    backgroundColor: COLORS.stepInactive,
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
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
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
    borderRadius: 24, // concentric: icon radius (10) + row padding (14)
    borderWidth: 1.5,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.background,
  },
  reasonRowActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryTint,
  },
  reasonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonIconActive: {
    backgroundColor: COLORS.primarySoft,
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
    borderColor: COLORS.stepInactive,
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
    backgroundColor: COLORS.divider,
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
    fontFamily: FONTS.bold,
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
  blockBtnDisabled: {
    opacity: 0.5,
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
