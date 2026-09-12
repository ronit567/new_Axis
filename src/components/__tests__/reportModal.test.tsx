import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import ReportModal from '../ReportModal';

// ReportModal is the whole of the Guideline 1.2 report/block surface, and it is
// reached from three screens with three different target types. The behaviour
// worth pinning is which of those get a Block affordance and who it names —
// that used to be inferred from the target type, which silently withheld the
// button from listing reports even when the caller passed a handler.

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});

jest.mock('../../lib/haptics', () => ({
  haptics: { tap: jest.fn(), impact: jest.fn(), success: jest.fn() },
}));

// The block flow confirms through an OS alert; capture it rather than render it.
let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alertSpy.mockRestore();
});

// Reporting has to succeed before the block affordance is reachable — it lives
// on the post-submit confirmation step, not the reason picker.
async function reportAndReachConfirmation(reason = 'Spam') {
  fireEvent.press(screen.getByText(reason));
  fireEvent.press(screen.getByText('Submit report'));
  await waitFor(() => expect(screen.getByText('Report submitted')).toBeOnTheScreen());
}

describe('ReportModal block affordance', () => {
  it('offers to block the seller when reporting a listing', async () => {
    const onBlock = jest.fn().mockResolvedValue(undefined);
    render(
      <ReportModal
        visible
        target="listing"
        targetName="Calculus textbook, 8th edition"
        blockName="Avery"
        onClose={jest.fn()}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onBlock={onBlock}
      />,
    );

    await reportAndReachConfirmation();

    // Names the person, not the listing — the whole reason blockName exists.
    expect(screen.getByText('Block Avery')).toBeOnTheScreen();
    expect(screen.queryByText('Block Calculus textbook, 8th edition')).toBeNull();
  });

  it('blocks and confirms when the affordance is used', async () => {
    const onBlock = jest.fn().mockResolvedValue(undefined);
    render(
      <ReportModal
        visible
        target="listing"
        targetName="Mini fridge"
        blockName="Daniel"
        onClose={jest.fn()}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onBlock={onBlock}
      />,
    );

    await reportAndReachConfirmation();
    fireEvent.press(screen.getByText('Block Daniel'));

    await waitFor(() => expect(onBlock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][1]).toContain('Daniel');
  });

  it('withholds the affordance entirely when no handler is given', async () => {
    render(
      <ReportModal
        visible
        target="listing"
        targetName="Your own desk lamp"
        onClose={jest.fn()}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    await reportAndReachConfirmation();

    // This is how ListingDetailScreen hides blocking on your own listing:
    // blocks_no_self (0001) would reject it at the database anyway.
    expect(screen.queryByText(/^Block /)).toBeNull();
    expect(screen.getByText('Done')).toBeOnTheScreen();
  });

  it('falls back to targetName when blockName is omitted', async () => {
    render(
      <ReportModal
        visible
        target="user"
        targetName="Priya"
        onClose={jest.fn()}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onBlock={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    await reportAndReachConfirmation();

    // user/chat reports already name the person in targetName, so the two
    // existing call sites keep working without passing blockName.
    expect(screen.getByText('Block Priya')).toBeOnTheScreen();
  });

  it('surfaces a failure without claiming the block succeeded', async () => {
    render(
      <ReportModal
        visible
        target="user"
        targetName="Priya"
        onClose={jest.fn()}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onBlock={jest.fn().mockRejectedValue(new Error('offline'))}
      />,
    );

    await reportAndReachConfirmation();
    fireEvent.press(screen.getByText('Block Priya'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Something went wrong');
  });
});
