import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { COLORS } from '../../constants/theme';
import PressableScale from '../PressableScale';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon: IoniconsName;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

// The circular tinted control that sits in screen headers (back, gear, share,
// search). Settings, Profile, ManageListings and Messages had each declared
// their own 38×38 / radius-19 / surfaceAlt copy — identical by luck rather
// than by contract, which is exactly the kind of agreement that silently
// drifts the next time one of them is touched.
export default function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = COLORS.textSecondary,
  size = 18,
  style,
}: Props) {
  return (
    <PressableScale
      style={[styles.button, style]}
      onPress={onPress}
      scaleTo={0.9}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={size} color={color} />
    </PressableScale>
  );
}

export const HEADER_ICON_SIZE = 38;

const styles = StyleSheet.create({
  button: {
    width: HEADER_ICON_SIZE,
    height: HEADER_ICON_SIZE,
    borderRadius: HEADER_ICON_SIZE / 2,
    borderCurve: 'continuous',
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
