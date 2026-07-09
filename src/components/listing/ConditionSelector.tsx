import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../../constants/theme';
import PressableScale from '../PressableScale';
import { haptics } from '../../lib/haptics';

const CONDITIONS = ['Like new', 'Good', 'Fair'];

type Props = {
  value: string;
  onChange: (condition: string) => void;
  // EditListingScreen: condition is a scam-vector field — locked once the
  // listing is engaged.
  locked?: boolean;
  onLockedPress?: () => void;
};

export default function ConditionSelector({ value, onChange, locked, onLockedPress }: Props) {
  return (
    <View>
      <View style={styles.conditionRow}>
        {CONDITIONS.map(c => (
          <PressableScale
            key={c}
            style={[styles.condBtn, value === c ? styles.condBtnActive : null]}
            onPress={() => {
              if (locked) {
                onLockedPress?.();
                return;
              }
              haptics.tap();
              onChange(c);
            }}
            scaleTo={0.94}
            accessibilityRole="button"
            accessibilityState={{ selected: value === c }}
          >
            <Text style={[styles.condText, value === c ? styles.condTextActive : null]}>{c}</Text>
          </PressableScale>
        ))}
      </View>
      {locked && (
        <View style={styles.lockedHint}>
          <Ionicons name="lock-closed-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.lockedHintText}>Condition requires review to change</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  conditionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  condBtn: {
    flex: 1,
    height: 46,
    borderRadius: SIZES.borderRadiusLg,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  condBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    ...SHADOWS.brand,
  },
  condText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  condTextActive: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
  },
  lockedHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  lockedHintText: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
  },
});
