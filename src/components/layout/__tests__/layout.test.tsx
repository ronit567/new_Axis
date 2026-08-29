import React from 'react';
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
});

describe('ScreenHeader', () => {
  it('renders a compact title and fires the back action', () => {
    const onBack = jest.fn();
    render(<ScreenHeader title="Settings" onBack={onBack} bordered />);

    expect(screen.getByText('Settings')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Go back'));
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
