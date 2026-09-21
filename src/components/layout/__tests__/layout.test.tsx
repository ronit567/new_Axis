import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import Screen from '../Screen';
import ScreenHeader from '../ScreenHeader';
import Card, { SectionLabel, CardDivider } from '../Card';
import HeaderIconButton from '../HeaderIconButton';

// These three components sit under all 23 screens, so a regression here is a
// regression everywhere. The assertions target the contracts the screens
// actually rely on — that a title renders, that back/trailing actions fire,
// that children survive the wrapper — rather than exact styling, which should
// stay free to change.

describe('Screen', () => {
  it('renders children', () => {
    render(
      <Screen>
        <Text>Body</Text>
      </Screen>,
    );
    expect(screen.getByText('Body')).toBeOnTheScreen();
  });

  it('accepts every background and edge configuration without crashing', () => {
    // `none` + no edges is the full-bleed case (Listing Detail's hero running
    // behind the status bar), which takes a different container branch than
    // the default and would otherwise go untested.
    expect(() =>
      render(
        <Screen background="none" statusBar="light" edges={[]}>
          <Text>Bleed</Text>
        </Screen>,
      ),
    ).not.toThrow();
    expect(screen.getByText('Bleed')).toBeOnTheScreen();
  });

  // KeyboardAvoidingView reads its own position from onLayout, relative to its
  // PARENT, and compares it with the keyboard's position, relative to the
  // WINDOW. That only lines up when the parent starts at the window's top.
  // The iPad reading column (#101) was first added as a View nested *inside*
  // the safe-area container; that parent started below the top inset, so every
  // keyboard screen in the app fell short by the inset and the keyboard clipped
  // the field being typed into. Jest computes no layout, so no test could see
  // the clipping itself — this pins the structure that prevents it.
  it.each([
    ['a constrained screen', false],
    ['a full-width screen', true],
  ])('puts the content of %s directly inside the safe-area container', (_label, fullWidth) => {
    render(
      <Screen fullWidth={fullWidth}>
        <Text testID="content">Body</Text>
      </Screen>,
    );

    expect(nearestHostAncestorType(screen.getByTestId('content'))).toBe('RNCSafeAreaView');
  });
});

// The first native (host) element above `node`: the one layout actually
// positions it within, skipping React components that render nothing
// themselves.
function nearestHostAncestorType(node: { parent: unknown }): string | undefined {
  let current = node.parent as { type: unknown; parent: unknown } | null;
  while (current && typeof current.type !== 'string') {
    current = current.parent as { type: unknown; parent: unknown } | null;
  }
  return current?.type as string | undefined;
}

describe('ScreenHeader', () => {
  it('renders a compact title and fires the back action', () => {
    const onBack = jest.fn();
    render(<ScreenHeader title="Settings" onBack={onBack} bordered />);

    expect(screen.getByText('Settings')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('can present its leading button as a close, for a screen that is a task', () => {
    const onBack = jest.fn();
    render(
      <ScreenHeader
        title="New listing"
        onBack={onBack}
        backIcon="close"
        backAccessibilityLabel="Close"
        bordered
      />,
    );

    // The label is what a screen reader announces, so it has to follow the
    // icon rather than stay "Go back".
    expect(screen.queryByLabelText('Go back')).toBeNull();
    fireEvent.press(screen.getByLabelText('Close'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders a large title', () => {
    render(<ScreenHeader variant="large" title="Messages" />);
    expect(screen.getByText('Messages')).toBeOnTheScreen();
  });

  it('omits the title entirely when none is given', () => {
    // Profile and Seller Profile rely on this: they want the shared bar
    // geometry and buttons, but their heading is the avatar below.
    render(
      <ScreenHeader
        trailing={
          <HeaderIconButton icon="settings-outline" accessibilityLabel="Settings" onPress={jest.fn()} />
        }
      />,
    );
    expect(screen.getByLabelText('Settings')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Go back')).toBeNull();
  });

  it('renders custom title content in place of a title', () => {
    render(<ScreenHeader titleContent={<Text>Avery</Text>} onBack={jest.fn()} />);
    expect(screen.getByText('Avery')).toBeOnTheScreen();
  });
});

describe('Card', () => {
  it('renders grouped content with a label and divider', () => {
    render(
      <>
        <SectionLabel title="ACCOUNT" />
        <Card>
          <Text>Edit profile</Text>
          <CardDivider />
          <Text>Change password</Text>
        </Card>
      </>,
    );
    expect(screen.getByText('ACCOUNT')).toBeOnTheScreen();
    expect(screen.getByText('Edit profile')).toBeOnTheScreen();
    expect(screen.getByText('Change password')).toBeOnTheScreen();
  });
});

describe('HeaderIconButton', () => {
  it('fires onPress and exposes its label', () => {
    const onPress = jest.fn();
    render(<HeaderIconButton icon="add" accessibilityLabel="Create new listing" onPress={onPress} />);

    fireEvent.press(screen.getByLabelText('Create new listing'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
