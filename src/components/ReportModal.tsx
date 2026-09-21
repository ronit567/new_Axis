import { useEffect, useRef, useState } from 'react';
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
import { COLORS, FONTS, SIZES } from '../constants/theme';
import { haptics } from '../lib/haptics';
import { SHEET_MAX_WIDTH } from '../lib/layout';
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
  // Who gets blocked, when that isn't the thing being reported. A 'listing'
  // report names the listing in `targetName` but blocks its seller, so the
  // button would otherwise offer to "Block Vintage Desk Lamp". Defaults to
  // targetName, which is already the person for 'user' and 'chat'.
  blockName?: string;
  // Called after a block succeeds and the user dismisses the confirmation.
  // Screens use it to leave: the blocked person's listings, profile and
  // conversation are hidden by RLS from that moment, so staying put would show
  // content that is no longer theirs to see.
  onBlocked?: () => void;
};

export default function ReportModal({
  visible,
  target,
  targetName,
  onClose,
  onSubmit,
  onBlock,
  blockName,
  onBlocked,
}: Props) {
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [blocking, setBlocking] = useState(false);

  // RN's Modal keeps this component mounted while visible={false}, so an
  // onSubmit/onBlock promise that resolves after the sheet is dismissed would
  // otherwise write stale state (flip `submitted` to true and show the "Report
  // submitted" confirmation the next time it opens). A plain "is open" boolean
  // isn't enough: it re-arms to true on reopen, so a promise from a *previous*
  // open would still write into the freshly reopened sheet. Instead we tag each
  // open/close with a monotonic session id; a handler captures the session it
  // started in and only applies its result if the sheet is still in that
  // session. Bumped both here (parent-driven visibility changes) and
  // synchronously in handleClose (so a promise resolving in the gap before the
  // effect runs is still invalidated).
  const sessionRef = useRef(0);
  useEffect(() => {
    sessionRef.current += 1;
  }, [visible]);

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    haptics.impact();
    const session = sessionRef.current;
    setSubmitting(true);
    try {
      await onSubmit(selected);
      if (sessionRef.current === session) setSubmitted(true);
    } catch {
      if (sessionRef.current === session) {
        Alert.alert('Something went wrong', "We couldn't submit your report. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    sessionRef.current += 1;
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

  const blockTarget = blockName ?? targetName ?? 'This user';

  const handleBlock = async () => {
    if (blocking) return;
    const session = sessionRef.current;
    setBlocking(true);
    try {
      await onBlock?.();
      if (sessionRef.current === session) {
        Alert.alert(
          'User blocked',
          `${blockTarget} has been blocked. You will no longer see their content.`,
          // Close (rather than fall back to the reason-picker view) once the
          // user has acknowledged the block, then let the screen move on.
          [
            {
              text: 'OK',
              onPress: () => {
                handleClose();
                onBlocked?.();
              },
            },
          ],
        );
      }
    } catch {
      if (sessionRef.current === session) {
        Alert.alert('Something went wrong', "We couldn't block this user. Please try again.");
      }
    } finally {
      setBlocking(false);
    }
  };

  // Blocking is reversible but not trivial — it hides both people from each
  // other everywhere — so it is confirmed from either place it is offered.
  const confirmBlock = () => {
    if (blocking) return;
    haptics.tap();
    Alert.alert(
      `Block ${blockTarget}?`,
      "They won't be able to message you, and neither of you will see the other's " +
        'profile or listings. You can unblock them any time in Settings > Blocked users.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: handleBlock },
      ],
    );
  };

  const blockButton = onBlock ? (
    <TouchableOpacity
      style={[styles.blockBtn, blocking && styles.blockBtnDisabled]}
      onPress={confirmBlock}
      disabled={blocking}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Block ${blockTarget}`}
    >
      <Ionicons name="hand-left-outline" size={16} color={COLORS.error} />
      <Text style={styles.blockBtnText}>
        {blocking ? 'Blocking…' : `Block ${blockTarget}`}
      </Text>
    </TouchableOpacity>
  ) : null;

  const targetLabel =
    target === 'listing' ? 'listing' : target === 'chat' ? 'conversation' : 'user';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        style={styles.backdrop}
        onPress={handleClose}
        accessible={false}
      >
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
              Thanks for letting us know. Our team will review this {targetLabel}, and
              we'll email you a confirmation.
            </Text>
            {blockButton}
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={handleClose}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Reason picker state ── */
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Report {targetLabel}</Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
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
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
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
              accessibilityRole="button"
              accessibilityState={{ disabled: !selected || submitting, busy: submitting }}
            >
              <Text style={[styles.submitBtnText, (!selected || submitting) && styles.submitBtnTextDisabled]}>
                {submitting ? 'Submitting…' : 'Submit report'}
              </Text>
            </TouchableOpacity>

            {/* Blocking must not require filing a report first (Guideline 1.2):
                someone may just want a person gone without accusing them. */}
            {blockButton && (
              <>
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or</Text>
                  <View style={styles.orLine} />
                </View>
                {blockButton}
              </>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    // Absolute, not `flex: 1`. As a flex child the backdrop only filled the
    // space *above* the sheet — invisible on a phone, where the sheet spans the
    // width, but on iPad the sheet is capped and centred, and the strips beside
    // it would have shown the live screen undimmed. Covering the whole window
    // means the sheet is positioned by its own `marginTop: 'auto'` instead.
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    // A Modal renders at the window level, outside Screen's reading column, so
    // the sheet caps and centres itself or it spans a whole iPad
    // (src/lib/layout.ts). A phone is narrower than the cap and unchanged.
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    alignSelf: 'center',
    // Pinned to the bottom now that the backdrop no longer pushes it there.
    marginTop: 'auto',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.borderRadiusXl,
    borderTopRightRadius: SIZES.borderRadiusXl,
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
    backgroundColor: COLORS.surfaceAlt,
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
    borderRadius: SIZES.borderRadius,
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
    borderRadius: SIZES.borderRadius,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    marginBottom: 12,
    width: '100%',
    justifyContent: 'center',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 14,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },
  orText: {
    fontSize: 13,
    color: COLORS.textMuted,
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
    borderRadius: SIZES.borderRadius,
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
