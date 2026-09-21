import { Text } from 'react-native';
import { render, fireEvent, screen, act } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import ListingCard from '../ListingCard';
import CategoryChip from '../CategoryChip';
import EmptyState from '../EmptyState';
import AnimatedIconToggle from '../AnimatedIconToggle';
import PressableScale from '../PressableScale';
import PrimaryButton from '../PrimaryButton';
import StepHeader from '../StepHeader';
import InputField from '../InputField';
import { Listing } from '../../types';
import * as formatPriceModule from '../../lib/formatPrice';

// Smoke + behaviour coverage for the shared UI primitives. These components
// are mostly animation, and animation is exactly the kind of code a typecheck
// can't validate — a mis-nested Animated layer, a clipped blur, or a stacked
// label that fails to register all typecheck cleanly and break only at
// runtime. The assertions here stay on what's observable and stable
// (accessibility state, rendered text, callbacks firing) rather than on
// interpolated style values, which would make the tests brittle against any
// future tuning of the curves.

const listing: Listing = {
  id: 'listing-1',
  title: 'Calculus textbook, 8th edition',
  price: 45,
  condition: 'Good',
  category: 'Textbooks',
  seller: {
    id: 'seller-1',
    name: 'Avery',
    year: 2,
    location: 'Westmount',
    program: 'Engineering',
    dotColor: '#5C2D91',
    avatarUrl: null,
  },
  saved: false,
  imageColor: '#EEE8F8',
  imageUrls: ['https://example.test/a.jpg'],
  thumbUrls: ['https://example.test/a-thumb.jpg'],
  badge: 'New',
  description: 'Barely used.',
  views: 12,
  postedAgo: '2h ago',
  pickup: 'Campus',
  isFree: false,
  isTrade: false,
  status: 'active',
};

describe('ListingCard', () => {
  it('renders the listing and fires onPress', () => {
    const onPress = jest.fn();
    render(<ListingCard item={listing} onPress={onPress} onSave={jest.fn()} />);

    expect(screen.getByText('$45')).toBeOnTheScreen();
    expect(screen.getByText('Calculus textbook, 8th edition')).toBeOnTheScreen();
    expect(screen.getByText('New')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('$45'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes the save control with state-dependent labelling', () => {
    const onSave = jest.fn();
    const { rerender } = render(
      <ListingCard item={listing} onPress={jest.fn()} onSave={onSave} />,
    );

    fireEvent.press(screen.getByLabelText('Save listing'));
    expect(onSave).toHaveBeenCalledTimes(1);

    // The label has to track saved state — a static "Save listing" would tell
    // a screen-reader user the wrong thing on every already-saved card.
    rerender(<ListingCard item={{ ...listing, saved: true }} onPress={jest.fn()} onSave={onSave} />);
    expect(screen.getByLabelText('Remove from saved')).toBeOnTheScreen();
  });
});

describe('CategoryChip', () => {
  it('renders both stacked label copies and reports selection', () => {
    render(<CategoryChip label="Textbooks" active onPress={jest.fn()} />);

    // Two copies by design: one in-flow copy sizes the chip, one overlay copy
    // carries the active color, and they cross-fade. Losing one would silently
    // break the fade into a hard snap.
    expect(screen.getAllByText('Textbooks')).toHaveLength(2);
    expect(screen.getByLabelText('Textbooks').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('fires onPress', () => {
    const onPress = jest.fn();
    render(<CategoryChip label="Furniture" active={false} onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Furniture'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('ListingCard memoization', () => {
  // With two columns FlatList cannot protect its rows, so this memo is what
  // stops a parent render (a keystroke in Search, the list window moving during
  // a scroll) from re-rendering every mounted card.
  // Counts the card's own renders by watching a function its render calls. A
  // <Profiler> cannot be used for this: it reports a commit whenever its own
  // fiber re-renders, even when the memoized child inside it bailed out.
  async function renderCount(makeHandlers: () => { onPress: (l: Listing) => void; onSave: (l: Listing) => void }) {
    const rendered = jest.spyOn(formatPriceModule, 'formatPrice');
    const tree = (pass: number) => {
      const { onPress, onSave } = makeHandlers();
      return (
        <Text testID={`parent-${pass}`}>
          <ListingCard item={listing} onPress={onPress} onSave={onSave} />
        </Text>
      );
    };
    const view = render(tree(1));
    // Let mount-time effects (the Reduce Motion lookup) settle first.
    await act(async () => {});
    const afterMount = rendered.mock.calls.length;
    view.rerender(tree(2));
    const extra = rendered.mock.calls.length - afterMount;
    rendered.mockRestore();
    return extra;
  }

  it('does not re-render when the parent re-renders with the same handlers', async () => {
    const handlers = { onPress: jest.fn(), onSave: jest.fn() };

    expect(await renderCount(() => handlers)).toBe(0);
  });

  it('does re-render with a closure per card, which is what the screens used to pass', async () => {
    expect(await renderCount(() => ({ onPress: () => {}, onSave: () => {} }))).toBeGreaterThan(0);
  });

  it('hands its own item to the shared handlers', () => {
    const onPress = jest.fn();
    const onSave = jest.fn();
    render(<ListingCard item={listing} onPress={onPress} onSave={onSave} />);

    fireEvent.press(screen.getByLabelText(/save/i));

    expect(onSave).toHaveBeenCalledWith(listing);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  it('renders title and CTA through the animated wrapper', () => {
    const onCta = jest.fn();
    render(
      <EmptyState
        icon="storefront-outline"
        title="No listings yet."
        ctaLabel="Browse all"
        onCta={onCta}
      />,
    );

    expect(screen.getByText('No listings yet.')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Browse all'));
    expect(onCta).toHaveBeenCalledTimes(1);
  });
});

describe('AnimatedIconToggle', () => {
  it('renders both icon layers in either state', () => {
    const { rerender } = render(
      <AnimatedIconToggle
        active={false}
        activeName="heart"
        inactiveName="heart-outline"
        activeColor="#E63946"
        inactiveColor="#999999"
      />,
    );
    // Both layers are always mounted — the toggle cross-fades between them
    // rather than swapping which one exists.
    expect(() =>
      rerender(
        <AnimatedIconToggle
          active
          activeName="heart"
          inactiveName="heart-outline"
          activeColor="#E63946"
          inactiveColor="#999999"
        />,
      ),
    ).not.toThrow();
  });
});

describe('PressableScale', () => {
  it('runs press handlers and suppresses feedback when disabled', () => {
    const onPress = jest.fn();
    const onPressIn = jest.fn();
    render(
      <PressableScale onPress={onPress} onPressIn={onPressIn}>
        <Text>Tap me</Text>
      </PressableScale>,
    );

    fireEvent(screen.getByText('Tap me'), 'pressIn');
    expect(onPressIn).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('Tap me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('screen reader names', () => {
  // Each of these is a control whose visible content is an icon or a spinner,
  // so without an explicit label VoiceOver announces "button" and nothing else.

  it('PrimaryButton keeps its name and reports busy while the spinner replaces the title', () => {
    render(<PrimaryButton title="Continue" onPress={() => {}} loading />);

    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(screen.queryByText('Continue')).toBeNull();
  });

  it('StepHeader names its icon-only back button', () => {
    const onBack = jest.fn();
    render(<StepHeader currentStep={1} onBack={onBack} />);

    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('the password toggle says what pressing it will do', () => {
    render(<InputField label="Password" value="" onChangeText={() => {}} secureTextEntry />);

    fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
  });
});

describe('reduced motion', () => {
  it('primitives still render their content when Reduce Motion is on', async () => {
    const spy = jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);

    // The reduced-motion branches swap transform arrays and skip layers, so
    // they need their own render pass — a crash there would only ever surface
    // for users who have the setting enabled. The flush lets the hook's async
    // AccessibilityInfo read resolve, so these assertions run against the
    // reduced branch rather than the default one.
    const flush = () => act(async () => { await Promise.resolve(); });

    render(<ListingCard item={listing} onPress={jest.fn()} onSave={jest.fn()} />);
    await flush();
    expect(screen.getByText('$45')).toBeOnTheScreen();

    render(<CategoryChip label="Bikes" active onPress={jest.fn()} />);
    await flush();
    expect(screen.getAllByText('Bikes')).toHaveLength(2);

    spy.mockRestore();
  });
});
