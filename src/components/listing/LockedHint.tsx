import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../../constants/theme';

type Props = {
  label: string;
};

// Shared "requires review" affordance for the scam-vector field components
// (PhotoPicker/TitleField/CategoryDropdown/ConditionSelector) — a soft
// warning-tinted pill with the lock icon in a primarySoft circle, rather than
// each field re-implementing its own flat gray hint row.
export default function LockedHint({ label }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconTile}>
        <Ionicons name="lock-closed" size={11} color={COLORS.primary} />
      </View>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 10,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FBF1E1',
  },
  iconTile: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.medium,
    color: '#A9700F',
  },
});
