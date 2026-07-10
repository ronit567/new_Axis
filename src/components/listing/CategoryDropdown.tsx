import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../../constants/theme';
import { LISTING_CATEGORIES } from '../../constants/categories';
import RotatingChevron from '../RotatingChevron';
import PressableScale from '../PressableScale';
import LockedHint from './LockedHint';
import { haptics } from '../../lib/haptics';

type Props = {
  value: string;
  onChange: (category: string) => void;
  // EditListingScreen: category is a scam-vector field — locked once the
  // listing is engaged, tapping surfaces the "requires review" affordance
  // instead of opening the picker.
  locked?: boolean;
  onLockedPress?: () => void;
};

export default function CategoryDropdown({ value, onChange, locked, onLockedPress }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <PressableScale
        style={styles.dropdown}
        onPress={() => {
          haptics.tap();
          if (locked) {
            onLockedPress?.();
            return;
          }
          setOpen(!open);
        }}
        scaleTo={0.98}
        accessibilityRole="button"
      >
        <Text style={styles.dropdownText}>{value}</Text>
        {locked ? (
          <Ionicons name="lock-closed-outline" size={16} color={COLORS.textMuted} />
        ) : (
          <RotatingChevron open={open} size={16} color={COLORS.textMuted} />
        )}
      </PressableScale>
      {open && !locked && (
        <View style={styles.dropdownList}>
          {LISTING_CATEGORIES.map(c => (
            <PressableScale
              key={c}
              style={[styles.dropdownItem, c === value ? styles.dropdownItemActive : null]}
              scaleTo={0.98}
              onPress={() => {
                haptics.tap();
                onChange(c);
                setOpen(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownItemText,
                  c === value ? styles.dropdownItemTextActive : null,
                ]}
              >
                {c}
              </Text>
              {c === value && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
            </PressableScale>
          ))}
        </View>
      )}
      {locked && <LockedHint label="Category requires review to change" />}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadius,
    height: SIZES.inputHeight,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
  },
  dropdownText: {
    fontSize: SIZES.base,
    color: COLORS.text,
  },
  dropdownList: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadius,
    backgroundColor: COLORS.white,
    marginTop: 8,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.primaryTint,
  },
  dropdownItemText: {
    fontSize: SIZES.base,
    color: COLORS.text,
  },
  dropdownItemTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.semibold,
  },
});
