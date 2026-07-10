import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import PressableScale from './PressableScale';
import { haptics } from '../lib/haptics';

const MAX_BODY_LENGTH = 500; // mirrors the reviews.body check constraint (0020)

type Props = {
  visible: boolean;
  sellerName: string;
  // Present when the user already reviewed this seller — seeds an edit of
  // that review (one review per reviewer per seller, enforced by 0020).
  initialRating?: number;
  initialBody?: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (rating: number, body: string) => void;
};

// Star picker + written review, patterned on SettingsScreen's confirm modal
// (fade + blur overlay, white card).
export default function WriteReviewModal({
  visible,
  sellerName,
  initialRating,
  initialBody,
  submitting,
  onClose,
  onSubmit,
}: Props) {
  const [rating, setRating] = useState(initialRating ?? 0);
  const [body, setBody] = useState(initialBody ?? '');

  // Re-seed whenever the modal opens: the previous open's draft (or a review
  // freshly written elsewhere) must not leak into this one.
  useEffect(() => {
    if (visible) {
      setRating(initialRating ?? 0);
      setBody(initialBody ?? '');
    }
  }, [visible, initialRating, initialBody]);

  const canSubmit = rating >= 1 && body.trim().length > 0 && !submitting;
  const isEdit = initialRating != null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.card}>
          <Text style={styles.title}>{isEdit ? 'Edit your review' : 'Write a review'}</Text>
          <Text style={styles.subtitle}>
            How was your experience with {sellerName}?
          </Text>

          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <PressableScale
                key={i}
                onPress={() => {
                  haptics.tap();
                  setRating(i + 1);
                }}
                scaleTo={0.85}
                hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1} star${i === 0 ? '' : 's'}`}
              >
                <Ionicons
                  name={i < rating ? 'star' : 'star-outline'}
                  size={32}
                  color={COLORS.warning}
                />
              </PressableScale>
            ))}
          </View>

          <TextInput
            style={styles.input}
            value={body}
            onChangeText={setBody}
            placeholder="Share what buying or selling with them was like…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={MAX_BODY_LENGTH}
            textAlignVertical="top"
          />

          <PressableScale
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            disabled={!canSubmit}
            onPress={() => {
              haptics.impact();
              onSubmit(rating, body.trim());
            }}
            scaleTo={0.97}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Submitting…' : isEdit ? 'Update review' : 'Submit review'}
            </Text>
          </PressableScale>

          <PressableScale
            style={styles.cancelButton}
            onPress={() => {
              haptics.tap();
              onClose();
            }}
            scaleTo={0.97}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadiusLg,
    padding: 20,
  },
  title: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: SIZES.base,
    color: COLORS.text,
    backgroundColor: COLORS.inputBackground,
    marginBottom: 18,
  },
  submitButton: {
    height: SIZES.buttonHeight,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
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
