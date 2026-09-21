// The Messages inbox after 0051: a thread is a (listing, person) pair, so each
// row is labelled with the LISTING, not the person. The partner's name is
// supporting information here and only becomes the headline inside the chat —
// which is exactly the distinction these tests pin, because it is the kind of
// thing a well-meaning refactor quietly reverts.

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { NavigationProp } from '@react-navigation/native';
import type { Conversation, RootStackParamList } from '../../types';

// Avatar -> avatarUrls -> lib/supabase pulls in AsyncStorage's native module,
// which does not exist under Jest. Nothing here needs the client; the inbox
// data comes from the mocked hook below.
jest.mock('../../lib/supabase', () => ({ supabase: {} }));

const mockUseConversations = jest.fn();
const mockDeleteConversation = jest.fn();

jest.mock('../../hooks/useMessages', () => ({
  useConversations: () => mockUseConversations(),
  // The row's swipe / rotor delete action calls this. The row tests are about
  // what a row says, not about deleting, so it only has to exist; the swipe
  // tests below assert what it is called with.
  useDeleteConversation: () => ({ mutate: mockDeleteConversation }),
}));

// The real hook reads the OS setting through a promise, which would resolve
// mid-test and set state outside act(). Pinned here so the swipe tests are
// racing nothing, and flipped by the one test that cares.
let mockReducedMotion = false;
jest.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

import MessagesScreen from '../MessagesScreen';

const navigate = jest.fn();
const navigation = { navigate } as unknown as NavigationProp<RootStackParamList>;

function conversation(over: Partial<Conversation> = {}): Conversation {
  return {
    partnerId: 'p1',
    partner: {
      id: 'p1',
      name: 'Ronit',
      initials: 'R',
      avatarColor: '#5C2D91',
      avatarUrl: null,
    },
    listingId: 'lst1',
    listingTitle: 'Organic Chem 2 textbook',
    listingPrice: 45,
    listingThumbUrl: null,
    listingImageColor: '#E8E0F5',
    lastMessage: 'Is this still available?',
    lastMessageAt: '2m ago',
    unreadCount: 0,
    type: 'Buying',
    ...over,
  };
}

function renderInbox(conversations: Conversation[]) {
  mockUseConversations.mockReturnValue({
    data: conversations,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  });
  return render(<MessagesScreen navigation={navigation} />);
}

beforeEach(() => {
  mockUseConversations.mockReset();
  navigate.mockReset();
});

describe('MessagesScreen rows', () => {
  it('labels a row with the listing, and shows the partner only as the second line', () => {
    renderInbox([conversation()]);

    expect(screen.getByText('Organic Chem 2 textbook')).toBeOnTheScreen();
    // The name is present, but it is no longer what the row is called.
    expect(screen.getByText('Ronit')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Organic Chem 2 textbook, with Ronit'),
    ).toBeOnTheScreen();
  });

  it('renders one row per listing when the same person is messaged about two things', () => {
    renderInbox([
      conversation({ listingId: 'lst1', listingTitle: 'Organic Chem 2 textbook' }),
      conversation({ listingId: 'lst2', listingTitle: 'Desk lamp', lastMessage: 'Still got it?' }),
    ]);

    expect(screen.getByText('Organic Chem 2 textbook')).toBeOnTheScreen();
    expect(screen.getByText('Desk lamp')).toBeOnTheScreen();
    // Two rows, one name — the name cannot be what distinguishes them.
    expect(screen.getAllByText('Ronit')).toHaveLength(2);
  });

  it('opens the chat for that exact thread, passing the listing that identifies it', () => {
    renderInbox([conversation({ listingId: 'lst2', listingTitle: 'Desk lamp' })]);

    fireEvent.press(screen.getByText('Desk lamp'));

    expect(navigate).toHaveBeenCalledWith(
      'Chat',
      expect.objectContaining({
        listingId: 'lst2',
        partnerId: 'p1',
        listingTitle: 'Desk lamp',
      }),
    );
  });

  it('falls back to the partner name when the thread has no listing at all', () => {
    renderInbox([
      conversation({
        listingId: null,
        listingTitle: null,
        listingPrice: null,
        listingImageColor: null,
      }),
    ]);

    expect(screen.getByText('Ronit')).toBeOnTheScreen();
    expect(screen.getByLabelText('Chat with Ronit')).toBeOnTheScreen();
  });

  it('says so when the thread had a listing that can no longer be read', () => {
    // 0051 nulls messages.listing_id when a listing is deleted, but a listing
    // that is merely RLS-hidden still leaves its id on the message — the row
    // must not silently pretend the thread was never about anything.
    renderInbox([conversation({ listingTitle: null, listingPrice: null })]);

    expect(screen.getByText('Listing unavailable')).toBeOnTheScreen();
    expect(screen.getByText('Ronit')).toBeOnTheScreen();
  });

  it('shows a per-thread unread badge', () => {
    renderInbox([
      conversation({ listingId: 'lst1', listingTitle: 'Organic Chem 2 textbook', unreadCount: 3 }),
      conversation({ listingId: 'lst2', listingTitle: 'Desk lamp', unreadCount: 0 }),
    ]);

    expect(screen.getByText('3')).toBeOnTheScreen();
  });
});

// --- Swipe to delete -------------------------------------------------------
//
// The delete gesture is PanResponder + Animated from RN core (no
// gesture-handler / reanimated), so it is drivable from Jest: the responder
// system is plain props. `drag` below plays the same sequence the real system
// does — a probe move that asks for the gesture, then, once granted, the rest
// of the travel and a release — which is what lets these tests pin the
// thresholds that decide whether a touch belongs to the row or to the list.

const START = { x: 320, y: 200 };
let clock = 0;

function touchEvent(
  x: number,
  y: number,
  prevX: number,
  prevY: number,
  stepMs: number,
) {
  clock += stepMs;
  return {
    nativeEvent: {
      touches: [{ identifier: 1, pageX: x, pageY: y }],
      changedTouches: [],
      pageX: x,
      pageY: y,
      timestamp: clock,
    },
    touchHistory: {
      touchBank: [
        {
          touchActive: true,
          startPageX: prevX,
          startPageY: prevY,
          startTimeStamp: clock - stepMs,
          currentPageX: x,
          currentPageY: y,
          currentTimeStamp: clock,
          previousPageX: prevX,
          previousPageY: prevY,
          previousTimeStamp: clock - stepMs,
        },
      ],
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: clock,
    },
  };
}

// The swipeable surface is the first ancestor of the row that carries pan
// handlers. Found by walking up rather than by a testID, so production code
// doesn't grow a hook that exists only for tests.
//
// Its handlers are invoked directly instead of through `fireEvent`: the
// negotiation props (`onMoveShouldSetResponder*`) are decisions rather than
// notifications, and fireEvent swallows their return value — which is the one
// thing these tests need to read. `act` still wraps anything that can set
// state.
type Surface = { props: Record<string, (event: unknown) => unknown> };

function surfaceFor(label: string): Surface {
  let node = screen.getByLabelText(label) as unknown as
    | (Surface & { parent: unknown })
    | null;
  while (node && typeof node.props.onMoveShouldSetResponder !== 'function') {
    node = node.parent as typeof node;
  }
  if (!node) throw new Error(`no pan responder above "${label}"`);
  return node;
}

/**
 * Returns whether the row claimed the touch. That is the interesting half of
 * the assertion: claiming it is exactly what stops the FlatList scrolling, so
 * "did not claim" is the guarantee that a scroll still scrolls.
 *
 * `stepMs` is deliberately slow (120ms per step ≈ 0.17px/ms) so no drag here
 * trips the flick-velocity shortcut — these tests are about distance and
 * direction, and a fast flick would decide the outcome before either mattered.
 */
function drag(
  label: string,
  { dx, dy = 0, steps = 6, stepMs = 120 }: { dx: number; dy?: number; steps?: number; stepMs?: number },
) {
  const node = surfaceFor(label);
  let x = START.x;
  let y = START.y;
  let claimed = false;

  node.props.onStartShouldSetResponderCapture(touchEvent(x, y, x, y, stepMs));

  for (let i = 0; i < steps; i += 1) {
    const prevX = x;
    const prevY = y;
    x += dx / steps;
    y += dy / steps;
    const event = touchEvent(x, y, prevX, prevY, stepMs);
    if (claimed) {
      act(() => {
        node.props.onResponderMove(event);
      });
    } else {
      // The capture pass is what folds the move into gestureState; the bubble
      // pass then reads it and answers.
      node.props.onMoveShouldSetResponderCapture(event);
      claimed = node.props.onMoveShouldSetResponder(event) === true;
      if (claimed) {
        act(() => {
          node.props.onResponderGrant(event);
        });
      }
    }
  }

  if (claimed) {
    act(() => {
      node.props.onResponderRelease(touchEvent(x, y, x, y, stepMs));
    });
  }
  return claimed;
}

const ROW = 'Organic Chem 2 textbook, with Ronit';

describe('MessagesScreen swipe to delete', () => {
  beforeEach(() => {
    clock = 0;
    mockReducedMotion = false;
    mockDeleteConversation.mockReset();
  });

  it('leaves a mostly-vertical drag to the list, so scrolling still scrolls', () => {
    renderInbox([conversation()]);

    // 40pt across while travelling 100pt down: a scroll that wandered.
    expect(drag(ROW, { dx: -40, dy: -100 })).toBe(false);
    expect(screen.queryByLabelText('Delete')).toBeNull();
  });

  it('ignores a sideways nudge too small to be a swipe', () => {
    renderInbox([conversation()]);

    expect(drag(ROW, { dx: -10 })).toBe(false);
    expect(screen.queryByLabelText('Delete')).toBeNull();
  });

  it('claims a decisively leftward drag and reveals Delete', () => {
    renderInbox([conversation()]);

    expect(drag(ROW, { dx: -120, dy: -20 })).toBe(true);
    expect(screen.getByLabelText('Delete')).toBeOnTheScreen();
  });

  it('snaps back — and stays closed — when the drag stops short', () => {
    renderInbox([conversation()]);

    // Claimed (it is clearly horizontal), but released well short of the
    // halfway point, so the row settles closed and exposes nothing.
    expect(drag(ROW, { dx: -30 })).toBe(true);
    expect(screen.queryByLabelText('Delete')).toBeNull();
  });

  it('does not delete on the swipe alone — the revealed button must be tapped', () => {
    jest.useFakeTimers();
    try {
      renderInbox([conversation()]);

      // A full-length swipe, released well past the open point. Nothing is
      // deleted by it: the gesture only ever reveals.
      drag(ROW, { dx: -200 });
      expect(mockDeleteConversation).not.toHaveBeenCalled();

      fireEvent.press(screen.getByLabelText('Delete'));
      // Still nothing — the write waits for the row to finish animating out,
      // so the list never shows a gap before the delete has even been issued.
      expect(mockDeleteConversation).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(mockDeleteConversation).toHaveBeenCalledWith(
        { partnerId: 'p1', listingId: 'lst1' },
        expect.anything(),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('will not open the chat while the row is open, and does again once it is closed', () => {
    renderInbox([conversation()]);

    drag(ROW, { dx: -120 });
    fireEvent.press(screen.getByLabelText(ROW));
    expect(navigate).not.toHaveBeenCalled();

    // Pulling an open row back to the right closes it — and the same tap then
    // does what it always did.
    expect(drag(ROW, { dx: 120 })).toBe(true);
    fireEvent.press(screen.getByLabelText(ROW));
    expect(navigate).toHaveBeenCalledWith('Chat', expect.objectContaining({ listingId: 'lst1' }));
  });

  it('still deletes under Reduce Motion, where the row fades instead of sliding', () => {
    // The exit takes a different shape with Reduce Motion on (no travel, just
    // a cross-fade and the collapse), and that branch has to end in the same
    // place — an easy thing to leave half-wired.
    mockReducedMotion = true;
    jest.useFakeTimers();
    try {
      renderInbox([conversation()]);

      drag(ROW, { dx: -120 });
      fireEvent.press(screen.getByLabelText('Delete'));
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockDeleteConversation).toHaveBeenCalledWith(
        { partnerId: 'p1', listingId: 'lst1' },
        expect.anything(),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('closes the row that was open when another one is swiped', () => {
    renderInbox([
      conversation({ listingId: 'lst1', listingTitle: 'Organic Chem 2 textbook' }),
      conversation({ listingId: 'lst2', listingTitle: 'Desk lamp' }),
    ]);

    drag(ROW, { dx: -120 });
    expect(screen.getAllByLabelText('Delete')).toHaveLength(1);

    drag('Desk lamp, with Ronit', { dx: -120 });
    // Still one — the first row closed as soon as the second was pulled.
    expect(screen.getAllByLabelText('Delete')).toHaveLength(1);
  });

  it('still reaches delete from the VoiceOver rotor, behind a confirmation', () => {
    // A swipe is invisible to a screen reader, so the named action is the only
    // way in — and with no reveal step to serve as the confirmation the way
    // the exposed button does, this path keeps the alert the swipe dropped.
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      renderInbox([conversation()]);

      const row = screen.getByLabelText(ROW);
      expect(row.props.accessibilityActions).toEqual([
        { name: 'delete', label: 'Delete conversation' },
      ]);

      fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
      expect(mockDeleteConversation).not.toHaveBeenCalled();

      const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
      buttons.find((b) => b.text === 'Delete')?.onPress?.();

      expect(mockDeleteConversation).toHaveBeenCalledWith(
        { partnerId: 'p1', listingId: 'lst1' },
        expect.anything(),
      );
    } finally {
      alert.mockRestore();
    }
  });
});
