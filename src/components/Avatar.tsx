import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../constants/theme';

type Props = {
  // Public storage URL of the profile photo. Absent/null renders the
  // initials + color fallback alone (the pre-AX-403 look).
  url?: string | null;
  initials: string;
  color: string;
  size: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

// The one avatar renderer (AX-403). Same layering idiom as ListingCard's
// photo-over-imageColor: the colored initials circle always renders, and the
// photo sits on top once it decodes — so a slow or missing image degrades to
// exactly the old initials look instead of an empty circle.
export default function Avatar({ url, initials, color, size, style, textStyle }: Props) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }, textStyle]}>{initials}</Text>
      {url ? (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={150}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    // Clips the square Image fill to the circle.
    overflow: 'hidden',
  },
  initials: {
    color: COLORS.white,
    fontWeight: '700',
  },
});
