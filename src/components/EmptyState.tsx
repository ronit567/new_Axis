import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import PrimaryButton from './PrimaryButton';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon: IoniconsName;
  iconColor?: string;
  iconBg?: string;
  title: string;
  ctaLabel: string;
  onCta: () => void;
};

export default function EmptyState({
  icon,
  iconColor = COLORS.primary,
  iconBg = COLORS.primarySoft,
  title,
  ctaLabel,
  onCta,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={40} color={iconColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <PrimaryButton title={ctaLabel} onPress={onCta} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: 40,
    paddingBottom: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...SHADOWS.card,
  },
  title: {
    fontSize: SIZES.base,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    minWidth: 180,
    width: undefined,
  },
});
