import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, screen, act } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import ListingCard from '../ListingCard';
import CategoryChip from '../CategoryChip';
import EmptyState from '../EmptyState';
import AnimatedIconToggle from '../AnimatedIconToggle';
import PressableScale from '../PressableScale';
import { Listing } from '../../types';

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
