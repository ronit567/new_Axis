import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS, SIZES, FONTS } from '../../constants/theme';
import PressableScale from '../PressableScale';
import { haptics } from '../../lib/haptics';

const QUICK_SPOTS = ['Library', 'Student center', 'Dorm lobby', 'Campus cafe', 'Gym entrance'];

// Pickup is always low-risk (never review-gated) — no locked variant, same as
// PriceToggles/DescriptionField.
type Props = {
  value: string;
  onChange: (pickup: string) => void;
};

export default function PickupPicker({ value, onChange }: Props) {
  return (
    <View>
      <View style={styles.chipRow}>
        {QUICK_SPOTS.map(spot => (
          <PressableScale
            key={spot}
            style={[styles.chip, value === spot ? styles.chipActive : null]}
            onPress={() => {
              haptics.tap();
              onChange(spot);
            }}
            scaleTo={0.94}
            accessibilityRole="button"
            accessibilityState={{ selected: value === spot }}
          >
            <Text style={[styles.chipText, value === spot ? styles.chipTextActive : null]}>
              {spot}
            </Text>
          </PressableScale>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="Where on campus will you meet?"
        placeholderTextColor={COLORS.textMuted}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: SIZES.borderRadiusLg,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  chipActive: {
    backgroundColor: COLORS.primaryTint,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  chipTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadius,
    height: SIZES.inputHeight,
    paddingHorizontal: 16,
    fontSize: SIZES.base,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
});
