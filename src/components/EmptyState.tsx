import React, { ComponentProps } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon: IoniconsName;
  title: string;
  message: string;
  ctaLabel?: string;
  onPressCta?: () => void;
  style?: ViewStyle;
};

export default function EmptyState({
  icon,
  title,
  message,
  ctaLabel,
  onPressCta,
  style,
}: Props) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={40} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {ctaLabel && onPressCta ? (
        <TouchableOpacity
          style={styles.button}
          onPress={onPressCta}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EEE8F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: SIZES.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: 28,
    height: 48,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: SIZES.base,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
