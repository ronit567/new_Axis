import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS, SIZES, FONTS } from '../../constants/theme';
import PressableScale from '../PressableScale';

// Price/Free/Trade are always low-risk (never review-gated), so this
// component has no locked variant — unlike the scam-vector field components.
type Props = {
  price: string;
  onPriceChange: (price: string) => void;
  isFree: boolean;
  onToggleFree: () => void;
  isTrade: boolean;
  onToggleTrade: () => void;
};

export default function PriceToggles({
  price,
  onPriceChange,
  isFree,
  onToggleFree,
  isTrade,
  onToggleTrade,
}: Props) {
  return (
    <View style={styles.priceRow}>
      <View style={[styles.priceInputWrap, isFree ? styles.priceInputDisabled : null]}>
        <Text style={styles.priceDollar}>$</Text>
        <TextInput
          style={styles.priceInput}
          value={price}
          onChangeText={onPriceChange}
          placeholder="0"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
          editable={!isFree}
        />
      </View>
      <PressableScale
        style={[styles.toggleBtn, isFree ? styles.toggleBtnActive : null]}
        onPress={onToggleFree}
        scaleTo={0.94}
        accessibilityRole="button"
        accessibilityState={{ selected: isFree }}
      >
        <Text style={[styles.toggleText, isFree ? styles.toggleTextActive : null]}>Free</Text>
      </PressableScale>
      <PressableScale
        style={[styles.toggleBtn, isTrade ? styles.toggleBtnActive : null]}
        onPress={onToggleTrade}
        scaleTo={0.94}
        accessibilityRole="button"
        accessibilityState={{ selected: isTrade }}
      >
        <Text style={[styles.toggleText, isTrade ? styles.toggleTextActive : null]}>Trade</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  priceRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  priceInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadius,
    height: SIZES.inputHeight,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
  },
  priceInputDisabled: {
    backgroundColor: COLORS.surfaceAlt,
  },
  priceDollar: {
    fontSize: SIZES.base,
    color: COLORS.text,
    marginRight: 4,
    fontFamily: FONTS.semibold,
  },
  priceInput: {
    flex: 1,
    fontSize: SIZES.base,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  toggleBtn: {
    paddingHorizontal: 18,
    height: SIZES.inputHeight,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusLg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primaryTint,
    borderColor: COLORS.primary,
  },
  toggleText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  toggleTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
});
