import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { CURVE, DURATION, SPRING, timing } from '../constants/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { haptics } from '../lib/haptics';

// A list row that drags left to reveal a single destructive action, built on
// PanResponder + the core Animated API rather than gesture-handler/reanimated.
// That is a deliberate constraint, not an oversight: those two are native
// modules, and adding them days after an SDK 54→57 upgrade would mean a fresh
// native build and new risk on every screen, to buy behaviour one row needs.
// The tradeoffs of staying in core are real and called out where they bite —
// chiefly that the collapse-on-delete has to run off the native driver.

// How far the row travels to fully expose the action. 88pt clears the 44pt
// minimum touch target with room for the icon + label stack, and leaves enough
// of the row on screen that you can still read which conversation you opened.
const ACTION_WIDTH = 88;

// Release past half the action width and the row settles open; short of it,
// it settles closed. Half is the point at which the user has clearly asked for
// the action rather than merely nudged the row.
const OPEN_FRACTION = 0.5;

// A flick decides the outcome regardless of distance. 0.35 px/ms is fast
// enough that a scroll that drifts sideways won't reach it, slow enough that a
// deliberate flick always lands.
const FLICK_VELOCITY = 0.35;

// The two numbers that keep a swipe from fighting the vertical FlatList.
//
// The list's own scroll is a native gesture recognizer; ours is the JS
// responder system, and whichever claims the touch first wins it outright. So
// the row must not claim anything it isn't sure about:
//
//  * DIRECTION_LOCK_DX — 12pt of horizontal travel before we even ask for the
//    gesture. Under that, a touch is still ambiguous (fingers are never
//    perfectly vertical), and claiming it would make the list feel like it
//    refuses to scroll.
//  * HORIZONTAL_BIAS — the drag must also be 1.6× more horizontal than
//    vertical. A diagonal is a scroll that wandered, and this is what resolves
//    it in the list's favour: at 45° the ratio is 1.0 and we decline.
//
// Deliberately stricter than the 1.5× used for the chat bubbles' time-reveal
// (ChatScreen), because there the wrong outcome is a harmless peek and here it
// is a row hiding a delete button.
const DIRECTION_LOCK_DX = 12;
const HORIZONTAL_BIAS = 1.6;

// Past the open position the row gets heavy: it keeps following the finger, at
// a quarter speed, and always springs back to exactly -ACTION_WIDTH. This is
// also the interaction's safety rail — see the note on `handleAction` below.
const OVERDRAG_RESISTANCE = 0.25;

type Props = {
  children: React.ReactNode;
  /**
   * Runs after the row has finished animating out, so the list never shows a
   * gap where the row used to be before the delete is actually issued.
   *
   * `restore` puts the row back, for the case where the write fails: the
   * caller's `onError` should call it alongside whatever it tells the user.
   * Without it a failed delete would leave a collapsed, invisible row sitting
   * in a list whose data still contains it.
   */
  onAction: (restore: () => void) => void;
  /** Label on the revealed button, and its accessibility label. */
  actionLabel?: string;
  /**
   * Called with this row's closer when it starts to open. The parent keeps the
   * last one and calls it, which is how "only one row open at a time" is
   * enforced without any shared state re-rendering the list.
   */
  onOpen?: (close: () => void) => void;
  /**
   * The row's own background. It has to be opaque, because the action sits
   * *behind* the row and would otherwise show through it. Defaults to the
   * surface white; screens on the page tint must pass that instead.
   */
  background?: string;
};

export default function SwipeableRow({
  children,
  onAction,
  actionLabel = 'Delete',
  onOpen,
  background = COLORS.surface,
}: Props) {
  const reducedMotion = useReducedMotion();

  // translateX and opacity run on the native driver; `collapse` cannot, since
  // height is a layout prop the native driver refuses. They are kept on two
  // separate views rather than one so that no single view mixes drivers — the
  // container owns the (JS-driven) height, everything visible inside it is
  // native. Splitting them is the whole reason for the extra wrapper.
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const collapse = useRef(new Animated.Value(1)).current;

  // `open` drives things React has to re-render (the tap-shield, and whether
  // the action button is exposed to the screen reader); `openRef` is what the
  // gesture reads, because a PanResponder created once must not close over a
  // stale render's state.
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  // Where the row sat when the finger went down, so a second drag continues
  // from the open position instead of jumping back to zero.
  const startOffset = useRef(0);

  // Measured once and reused for the exit: the row has to be told its own
  // height to animate away from `auto`, and its own width to know how far left
  // "off screen" is.
  const size = useRef({ width: 0, height: 0 });
  const [exiting, setExiting] = useState(false);
  // Same split as `open`/`openRef`, and for the same reason: the gesture and
  // the action handler both need to know the row is on its way out, and
  // neither of them re-reads render state.
  const exitingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Springs while the finger is involved, because an interrupted spring
  // carries its velocity forward — grabbing a half-open row and flicking it
  // shut stays continuous instead of restarting. Reduce Motion swaps in a
  // short timing: same destination, no overshoot to watch.
  const settle = useCallback(
    (toValue: number) => {
      const animation = reducedMotion
        ? Animated.timing(translateX, { toValue, ...timing(DURATION.fast, CURVE.standard) })
        : Animated.spring(translateX, { toValue, ...SPRING.snap, useNativeDriver: true });
      animation.start();
    },
    [reducedMotion, translateX],
  );

  const close = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    settle(0);
  }, [settle]);

  const openRow = useCallback(() => {
    if (!openRef.current) haptics.tap();
    openRef.current = true;
    setOpen(true);
    settle(-ACTION_WIDTH);
  }, [settle]);

  const restore = useCallback(() => {
    if (!mounted.current) return;
    // The row is currently collapsed and invisible, so there is nothing to
    // animate *from* — snap the layout back and fade the content in, which
    // reads as the row returning rather than as a new row arriving.
    collapse.setValue(1);
    translateX.setValue(0);
    openRef.current = false;
    exitingRef.current = false;
    setOpen(false);
    setExiting(false);
    Animated.timing(opacity, { toValue: 1, ...timing(DURATION.fast, CURVE.enter) }).start();
  }, [collapse, opacity, translateX]);

  // Tapping the revealed button is the *only* way a swipe deletes anything.
  // A full-swipe-to-delete was considered and rejected: this replaces an Alert
  // confirmation, so a single uninterrupted drag would become the entire
  // destructive path — and an overshot drag is exactly the accident this list
  // invites, sitting under a vertical scroll. Requiring the tap keeps two
  // deliberate acts between the user and a deleted thread, with the revealed
  // button itself serving as the confirmation step the Alert used to be.
  // OVERDRAG_RESISTANCE enforces it physically: there is no distance at which
  // the row leaves the screen under the finger.
  const handleAction = useCallback(() => {
    // The button stays mounted for the length of the exit; a second tap on it
    // must not queue a second delete.
    if (exitingRef.current) return;
    exitingRef.current = true;
    haptics.impact();
    setExiting(true);

    const fadeOut = reducedMotion
      ? // Reduce Motion keeps the cross-fade (safe) and drops the travel
        // (what the setting exists to suppress). The height still collapses —
        // a list cannot hold a gap open — but nothing slides sideways.
        [Animated.timing(opacity, { toValue: 0, ...timing(DURATION.fast, CURVE.standard) })]
      : [
          Animated.timing(translateX, {
            toValue: -size.current.width,
            ...timing(DURATION.fast, CURVE.exit),
          }),
          Animated.timing(opacity, { toValue: 0, ...timing(DURATION.fast, CURVE.exit) }),
        ];

    Animated.sequence([
      Animated.parallel(fadeOut),
      Animated.timing(collapse, {
        toValue: 0,
        duration: DURATION.fast,
        easing: CURVE.standard,
        // Height is a layout property: the native driver cannot touch it, so
        // this one step runs on the JS thread. It is short, it animates a
        // single number, and it only starts once the row is already invisible
        // — so a dropped frame here costs the neighbours a jump, not the user
        // the whole gesture.
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      // An interrupted exit (unmount mid-animation) must not fire the write.
      if (finished) onAction(restore);
    });
  }, [collapse, onAction, opacity, reducedMotion, restore, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Never claim on touch-down. The row underneath is a button, and a tap
        // has to reach it — claiming the start would swallow every press.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, g) => {
          // A row that is leaving has nothing left to reveal, and grabbing the
          // touch would only stop the list scrolling for no reason.
          if (exitingRef.current) return false;
          if (Math.abs(g.dx) <= Math.abs(g.dy) * HORIZONTAL_BIAS) return false;
          // Closed, only leftward means anything; open, only rightward does.
          // Asking for a gesture we would then ignore is worse than declining
          // it, because claiming it stops the list scrolling.
          return openRef.current ? g.dx > DIRECTION_LOCK_DX : g.dx < -DIRECTION_LOCK_DX;
        },
        onPanResponderGrant: () => {
          startOffset.current = openRef.current ? -ACTION_WIDTH : 0;
          // Announce at grant, not at open: iOS closes the previously open row
          // the moment you start pulling on another one, which keeps a single
          // "Delete" button on screen throughout.
          onOpen?.(close);
        },
        onPanResponderMove: (_evt, g) => {
          const next = startOffset.current + g.dx;
          if (next > 0) {
            // There is no action on the right-hand side, so there is nothing
            // to reveal by pulling that way.
            translateX.setValue(0);
          } else if (next < -ACTION_WIDTH) {
            translateX.setValue(
              -ACTION_WIDTH + (next + ACTION_WIDTH) * OVERDRAG_RESISTANCE,
            );
          } else {
            translateX.setValue(next);
          }
        },
        onPanResponderRelease: (_evt, g) => {
          const offset = startOffset.current + g.dx;
          const shouldOpen =
            g.vx < -FLICK_VELOCITY
              ? true
              : g.vx > FLICK_VELOCITY
                ? false
                : offset < -ACTION_WIDTH * OPEN_FRACTION;
          if (shouldOpen) openRow();
          else close();
        },
        // The row is mid-drag and following the finger; letting the scroll
        // view take the touch back now would strand it part-open.
        onPanResponderTerminationRequest: () => false,
        // Terminated anyway (an incoming call, a parent navigating away):
        // settle somewhere legible rather than wherever the finger stopped.
        onPanResponderTerminate: () => close(),
      }),
    [close, onOpen, openRow, translateX],
  );

  // The action fades in over the first third of the drag rather than being
  // painted from the first pixel, so a nudge that never becomes a swipe shows
  // a hint of red instead of a fully-formed button the user didn't ask for.
  const actionOpacity = translateX.interpolate({
    inputRange: [-ACTION_WIDTH, -ACTION_WIDTH * 0.35, 0],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  // Revealed *and* still actionable. Once the row is leaving, the button is
  // only an image of itself: tapping it again would queue a second delete, and
  // announcing it to VoiceOver would offer an action on a row that is gone.
  const actionExposed = open && !exiting;

  return (
    <Animated.View
      style={[
        styles.container,
        // Height is left to `auto` until the row is actually leaving. Pinning
        // it to the measured value permanently would freeze the row at its
        // first layout and break anything that reflows it later (a longer
        // preview, an unread badge appearing).
        exiting
          ? {
              height: collapse.interpolate({
                inputRange: [0, 1],
                outputRange: [0, size.current.height],
              }),
            }
          : null,
      ]}
      onLayout={(e) => {
        // Ignore layouts produced by our own collapse, which would otherwise
        // overwrite the height we are animating away from.
        if (!exiting) size.current = e.nativeEvent.layout;
      }}
      // The pan handlers live on the outermost view, not on the part that
      // moves, so that every touch inside the row — the content, the shield,
      // the exposed Delete button — bubbles to the same responder. Put them on
      // the sliding layer instead and a drag begun on the revealed button, or
      // on the shield, would have no way to reach the gesture.
      {...panResponder.panHandlers}
    >
      {/* The action layer spans the full row, not just the revealed strip, so
          the row sliding clear on delete uncovers red rather than the page
          behind it. Its button stays pinned to the right edge. */}
      <Animated.View
        style={[styles.actionLayer, { opacity }]}
        pointerEvents={actionExposed ? 'box-none' : 'none'}
        // Closed, the button is hidden behind the row where nobody can see it;
        // publishing it to VoiceOver anyway would put a second "Delete" in the
        // reading order of every row in the inbox. Screen-reader users reach
        // the same action through the row's own rotor action instead.
        accessibilityElementsHidden={!actionExposed}
        importantForAccessibility={actionExposed ? 'auto' : 'no-hide-descendants'}
      >
        <Animated.View style={[styles.actionButtonWrap, { opacity: actionOpacity }]}>
          <Pressable
            style={styles.actionButton}
            onPress={handleAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.white} />
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[styles.sliding, { backgroundColor: background, opacity, transform: [{ translateX }] }]}
        // While the row is open, its content must not be tappable: a tap there
        // belongs to closing the row, not to opening the chat. `box-only`
        // states that in the platform's own terms — the layer still takes the
        // touch (so the drag keeps working) but nothing inside it does — which
        // is stronger than relying on the shield below to win hit-testing.
        pointerEvents={open ? 'box-only' : 'auto'}
      >
        {children}
      </Animated.View>

      {actionExposed && (
        // The tap that closes the row. It covers the part of the row still on
        // screen and stops short of the revealed button, so the two taps can
        // never be confused for one another. A sibling of the sliding layer
        // rather than a child of it, so `box-only` above doesn't swallow it.
        <Pressable
          style={styles.tapShield}
          onPress={close}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Clips the row as it slides out and as the height collapses; without it
    // the departing row would draw over its neighbours.
    overflow: 'hidden',
  },
  actionLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.error,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  // The layer that actually moves under the finger. It carries the row's
  // opaque background, which is what hides the action sitting behind it.
  sliding: {
    position: 'relative',
  },
  tapShield: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    // Stops exactly where the revealed button starts.
    right: ACTION_WIDTH,
  },
  actionButtonWrap: {
    width: ACTION_WIDTH,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  actionText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
