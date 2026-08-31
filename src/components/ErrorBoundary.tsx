import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS, FONTS } from '../constants/theme';
import PrimaryButton from './PrimaryButton';
import { captureError } from '../lib/sentry';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Catches render-phase throws anywhere below it and shows a recoverable screen
 * instead of the white void React leaves behind.
 *
 * Sits ABOVE NavigationContainer (App.tsx) on purpose: a throw inside a screen
 * unmounts the whole tree, so a boundary nested under the navigator would be
 * torn down alongside the thing it was meant to catch. The cost is that "Try
 * again" returns to the root of the navigation state rather than the screen
 * that failed — the right trade, since the failed screen is what just crashed.
 *
 * Note this only catches *render* errors. Async rejections in event handlers
 * and queries never reach a boundary; those go through React Query's error
 * states and the repositories' own handling.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // componentStack is the React tree at the throw — the one piece of context
    // a bare stack trace lacks, and non-identifying (component names only).
    captureError(error, {
      boundary: 'root',
      componentStack: info.componentStack ?? 'unavailable',
    });
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.iconCircle}>
            <Ionicons name="warning-outline" size={52} color={COLORS.error} />
          </View>

          <Text style={styles.title}>Axis ran into a problem</Text>
          <Text style={styles.message}>
            Something went wrong while loading this screen. Your account and your
            listings are safe — restarting usually clears it.
          </Text>

          <PrimaryButton title="Restart Axis" onPress={this.reset} style={styles.button} />
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.lg,
    ...SHADOWS.card,
  },
  title: {
    fontSize: SIZES.xl,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SIZES.sm,
  },
  message: {
    fontSize: SIZES.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SIZES.xl,
  },
  button: {
    minWidth: 180,
    width: undefined,
  },
});
