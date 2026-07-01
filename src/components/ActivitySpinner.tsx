import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

type Props = {
  label?: string;
  size?: 'small' | 'large';
  style?: ViewStyle | ViewStyle[];
};

export default function ActivitySpinner({ label, size = 'small', style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={COLORS.primary} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
  },
  label: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
});
