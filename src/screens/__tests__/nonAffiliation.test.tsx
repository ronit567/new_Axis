import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import WelcomeScreen from '../WelcomeScreen';
import TermsOfServiceScreen from '../TermsOfServiceScreen';

// Axis names Western University throughout sign-up. App Review (Guidelines
// 4.1(c), 5.2.1) reads that as a claim of affiliation unless the app says
// otherwise, so both places a reviewer meets it first carry the disclaimer.

const navigation = { navigate: jest.fn(), goBack: jest.fn() } as never;

function renderScreen(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {ui}
    </SafeAreaProvider>,
  );
}

describe('Western non-affiliation', () => {
  it('is stated on the Welcome screen', () => {
    renderScreen(<WelcomeScreen navigation={navigation} route={{} as never} />);
    expect(screen.getByText('Not affiliated with Western University')).toBeOnTheScreen();
  });

  it('is stated in the Terms of Service', () => {
    renderScreen(<TermsOfServiceScreen navigation={navigation} route={{} as never} />);
    expect(screen.getByText('About Axis')).toBeOnTheScreen();
    expect(
      screen.getByText(/not affiliated with, endorsed by,\s+sponsored by, or operated by Western University/),
    ).toBeOnTheScreen();
  });
});
