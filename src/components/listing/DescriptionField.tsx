import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { DESC_MAX } from './useListingForm';

// Description is always low-risk (never review-gated) — no locked variant.
type Props = {
  value: string;
  onChange: (description: string) => void;
};

export default function DescriptionField({ value, onChange }: Props) {
  return (
    <View>
      <View style={styles.descHeader}>
        <Text style={styles.charCount}>{value.length}/{DESC_MAX}</Text>
      </View>
      <TextInput
        style={styles.descInput}
        value={value}
        onChangeText={t => onChange(t.slice(0, DESC_MAX))}
        placeholder={
          'Barely used, comes with original box and charger. No scratches, screen protector on since day one. Cash or e-transfer.'
        }
        placeholderTextColor={COLORS.textMuted}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  descHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  charCount: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  descInput: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: SIZES.base,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    minHeight: 110,
    textAlignVertical: 'top',
  },
});
