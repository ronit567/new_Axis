import { Alert, AlertButton } from 'react-native';
import { act, render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import ReportModal from '../ReportModal';

// ReportModal is the whole of the Guideline 1.2 report/block surface, and it is
// reached from three screens with three different target types. The behaviour
// worth pinning is where the Block affordance appears, who it names, that it
// is confirmed, and that it never requires filing a report first.

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});

jest.mock('../../lib/haptics', () => ({
  haptics: { tap: jest.fn(), impact: jest.fn(), success: jest.fn() },
}));

// Alerts are captured, not rendered. Buttons are pressed through pressAlert.
let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alertSpy.mockRestore();
});

function lastAlert(): { title: string; message?: string; buttons: AlertButton[] } {
  const call = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  return { title: call[0], message: call[1], buttons: call[2] ?? [] };
}

// Press a button on the most recent alert, as the user would.
async function pressAlert(text: string) {
  const button = lastAlert().buttons.find((b) => b.text === text);
  if (!button) throw new Error(`No "${text}" button on alert "${lastAlert().title}"`);
  await act(async () => {
    await button.onPress?.();
  });
}

async function reportAndReachConfirmation(reason = 'Spam') {
  fireEvent.press(screen.getByText(reason));
  fireEvent.press(screen.getByText('Submit report'));
  await waitFor(() => expect(screen.getByText('Report submitted')).toBeOnTheScreen());
}

describe('ReportModal blocking without a report', () => {
  it('offers Block on the reason picker, before anything is reported', () => {
    render(
      <ReportModal
        visible
        target="chat"
        targetName="Priya"
        onClose={jest.fn()}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onBlock={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Submit report')).toBeOnTheScreen();
    expect(screen.getByText('Block Priya')).toBeOnTheScreen();
  });

  it('confirms, then blocks without filing a report', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onBlock = jest.fn().mockResolvedValue(undefined);
    render(
      <ReportModal
        visible
        target="user"
        targetName="Priya"
        onClose={jest.fn()}
        onSubmit={onSubmit}
        onBlock={onBlock}
      />,
    );

    fireEvent.press(screen.getByText('Block Priya'));

    // Asks first, naming the person and saying it can be undone.
    expect(onBlock).not.toHaveBeenCalled();
    expect(lastAlert().title).toBe('Block Priya?');
    expect(lastAlert().message).toContain('Settings > Blocked users');

    await pressAlert('Block');

    expect(onBlock).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => expect(lastAlert().title).toBe('User blocked'));
  });

  it('does nothing when the confirmation is cancelled', async () => {
    const onBlock = jest.fn().mockResolvedValue(undefined);
    render(
      <ReportModal
        visible
        target="user"
        targetName="Priya"
        onClose={jest.fn()}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onBlock={onBlock}
      />,
    );

    fireEvent.press(screen.getByText('Block Priya'));
    await pressAlert('Cancel');

    expect(onBlock).not.toHaveBeenCalled();
  });

  it('closes and hands control back to the screen once the block is acknowledged', async () => {
    const onClose = jest.fn();
    const onBlocked = jest.fn();
    render(
      <ReportModal
        visible
        target="chat"
        targetName="Priya"
        onClose={onClose}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onBlock={jest.fn().mockResolvedValue(undefined)}
        onBlocked={onBlocked}
      />,
    );

    fireEvent.press(screen.getByText('Block Priya'));
    await pressAlert('Block');
    await waitFor(() => expect(lastAlert().title).toBe('User blocked'));
    expect(onBlocked).not.toHaveBeenCalled();

    await pressAlert('OK');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });
});

describe('ReportModal block affordance', () => {
  it('offers to block the seller when reporting a listing', async () => {
    render(
      <ReportModal
        visible
        target="listing"
        targetName="Calculus textbook, 8th edition"
        blockName="Avery"
        onClose={jest.fn()}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onBlock={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    // Names the person, not the listing — the whole reason blockName exists.
    expect(screen.getByText('Block Avery')).toBeOnTheScreen();
    expect(screen.queryByText('Block Calculus textbook, 8th edition')).toBeNull();

    // Still offered after reporting, too.
    await reportAndReachConfirmation();
    expect(screen.getByText('Block Avery')).toBeOnTheScreen();
  });

  it('blocks and confirms when the post-report affordance is used', async () => {
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
    await pressAlert('Block');

    await waitFor(() => expect(onBlock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(lastAlert().title).toBe('User blocked'));
    expect(lastAlert().message).toContain('Daniel');
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

    // This is how ListingDetailScreen hides blocking on your own listing:
    // blocks_no_self (0001) would reject it at the database anyway.
    expect(screen.queryByText(/^Block /)).toBeNull();
    expect(screen.queryByText('or')).toBeNull();

    await reportAndReachConfirmation();

    expect(screen.queryByText(/^Block /)).toBeNull();
    expect(screen.getByText('Done')).toBeOnTheScreen();
  });

  it('falls back to targetName when blockName is omitted', () => {
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

    // user/chat reports already name the person in targetName, so those call
    // sites keep working without passing blockName.
    expect(screen.getByText('Block Priya')).toBeOnTheScreen();
  });

  it('surfaces a failure without claiming the block succeeded', async () => {
    const onBlocked = jest.fn();
    render(
      <ReportModal
        visible
        target="user"
        targetName="Priya"
        onClose={jest.fn()}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onBlock={jest.fn().mockRejectedValue(new Error('offline'))}
        onBlocked={onBlocked}
      />,
    );

    fireEvent.press(screen.getByText('Block Priya'));
    await pressAlert('Block');

    await waitFor(() => expect(lastAlert().title).toBe('Something went wrong'));
    expect(onBlocked).not.toHaveBeenCalled();
  });
});
