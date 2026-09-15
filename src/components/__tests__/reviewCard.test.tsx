import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import ReviewCard from '../ReviewCard';
import type { Review } from '../../types';

// Reviews were the one piece of user-generated content with no individual
// report path. The behaviour worth pinning is that a card never offers an
// action the viewer cannot take: you report text you did not write, you delete
// text you did, and you are never shown both.

jest.mock('../../lib/haptics', () => ({
  haptics: { tap: jest.fn(), impact: jest.fn(), success: jest.fn() },
}));

// ReviewCard renders an Avatar, which reaches the Supabase client through
// avatarUrls and boots AsyncStorage on import. Nothing here exercises a signed
// URL, so stub the client rather than stand up native storage.
jest.mock('../../lib/supabase', () => ({ supabase: {} }));

const review: Review = {
  id: 'review-1',
  sellerId: 'seller-1',
  reviewer: {
    id: 'author-1',
    initials: 'RA',
    avatarColor: '#5C2D91',
    name: 'Review Author',
  },
  rating: 2,
  body: 'not a great experience',
  timeAgo: '2d ago',
};

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => alertSpy.mockRestore());

describe('ReviewCard actions', () => {
  it('offers nothing when the parent passes no handlers', () => {
    render(<ReviewCard review={review} />);
    expect(screen.queryByLabelText('Report this review')).toBeNull();
    expect(screen.queryByLabelText('Delete your review')).toBeNull();
  });

  it("offers a report action on someone else's review", () => {
    const onReport = jest.fn();
    render(<ReviewCard review={review} onReport={onReport} />);

    fireEvent.press(screen.getByLabelText('Report this review'));

    expect(onReport).toHaveBeenCalledTimes(1);
    // Reporting opens the report sheet, not an OS confirm.
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('confirms before deleting your own review', () => {
    const onDelete = jest.fn();
    render(<ReviewCard review={review} onDelete={onDelete} />);

    fireEvent.press(screen.getByLabelText('Delete your review'));

    // Destructive and irreversible, so it asks first rather than firing.
    expect(onDelete).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);

    const [, , buttons] = alertSpy.mock.calls[0];
    const confirm = buttons.find((b: { text: string }) => b.text === 'Delete');
    expect(confirm.style).toBe('destructive');
    confirm.onPress();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('prefers delete over report if a parent somehow passes both', () => {
    const onReport = jest.fn();
    const onDelete = jest.fn();
    render(<ReviewCard review={review} onReport={onReport} onDelete={onDelete} />);

    // Your own review is never reportable by you, so the delete path wins.
    fireEvent.press(screen.getByLabelText('Delete your review'));
    expect(onReport).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('still renders the review itself', () => {
    render(<ReviewCard review={review} onReport={jest.fn()} />);
    expect(screen.getByText('not a great experience')).toBeTruthy();
    expect(screen.getByText('Review Author')).toBeTruthy();
  });
});
