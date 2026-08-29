import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../../constants/theme';

// The page tint behind scrolling content, vs. an opaque sheet that content
// sits directly on. Two names, because the app only ever needs two — the old
// COLORS.background (#F8F8F8) and COLORS.surfaceAlt (#F5F5FA) were a
// distinction nobody could see and everybody had to guess between.
type Background = 'page' | 'surface' | 'none';

type Props = {
  children: React.ReactNode;
  background?: Background;
  // Light content (white glyphs) is for screens whose top is a dark or
  // gradient header; every other screen wants dark.
  statusBar?: 'dark' | 'light';
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
};

const BACKGROUNDS: Record<Background, string | undefined> = {
  page: COLORS.surfaceAlt,
  surface: COLORS.white,
  none: undefined,
};

// The root of every screen. It exists mainly so a screen cannot *forget* the
// things that used to be forgotten: five screens shipped with no <StatusBar>
// at all, and because MainScreen unmounts tabs on switch, Home's `light` style
// leaked into Saved/Messages/Profile and left the clock invisible on a white
// background. Declaring the status bar here makes that failure unrepresentable
// — there is no "didn't say" state, only a default.
//
// `edges` defaults to the top inset only: the bottom is either owned by the
// floating tab bar's clearance or by a screen's own footer, and letting
// SafeAreaView pad it too would double the gap.
export default function Screen({
  children,
  background = 'page',
  statusBar = 'dark',
  edges = ['top'],
  style,
}: Props) {
  const backgroundColor = BACKGROUNDS[background];

  // `none` is for screens that paint their own top (Home and Search run a
  // gradient up under the status bar), where a SafeAreaView top inset would
  // cut the gradient off short.
  const Container = edges.length === 0 ? View : SafeAreaView;

  return (
    <Container
      style={[styles.root, backgroundColor ? { backgroundColor } : null, style]}
      {...(edges.length === 0 ? {} : { edges })}
    >
      <StatusBar style={statusBar} />
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
