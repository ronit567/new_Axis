// The guard every account-based action goes through (Guideline 5.1.1(v)).
// Signed in it must be invisible; for a guest it must block the action, say
// why, and offer both ways in.

import { renderHook } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../types';

let mockIsGuest = false;
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isGuest: mockIsGuest }),
}));

import { useAccountGate, ACCOUNT_PROMPTS, type GatedAction } from '../useAccountGate';
import { SUPPORT_EMAIL } from '../../constants/contact';

const navigate = jest.fn();
const navigation = { navigate } as unknown as NavigationProp<RootStackParamList>;

function gate() {
  return renderHook(() => useAccountGate(navigation)).result.current;
}

function alertButtons(): AlertButton[] {
  const call = (Alert.alert as jest.Mock).mock.calls[0];
  return call[2] as AlertButton[];
}

beforeEach(() => {
  navigate.mockReset();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useAccountGate', () => {
  it('lets a signed-in user straight through, with no prompt', () => {
    mockIsGuest = false;
    expect(gate()('message')).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  describe('for a guest', () => {
    beforeEach(() => {
      mockIsGuest = true;
    });

    it.each<GatedAction>(['save', 'message', 'sell', 'seller', 'report'])(
      'blocks "%s" and explains why',
      (action) => {
        expect(gate()(action)).toBe(false);
        expect(Alert.alert).toHaveBeenCalledWith(
          ACCOUNT_PROMPTS[action].title,
          ACCOUNT_PROMPTS[action].message,
          expect.any(Array),
        );
      },
    );

    it('offers Sign in, Create account and a way to dismiss', () => {
      gate()('save');
      const buttons = alertButtons();
      expect(buttons.map((b) => b.text)).toEqual(['Sign in', 'Create account', 'Not now']);
      expect(buttons[2].style).toBe('cancel');

      buttons[0].onPress?.();
      expect(navigate).toHaveBeenLastCalledWith('SignIn');
      buttons[1].onPress?.();
      expect(navigate).toHaveBeenLastCalledWith('CreateAccount');
    });

    it('gives a guest who wants to report a way to do it without an account', () => {
      gate()('report');
      expect((Alert.alert as jest.Mock).mock.calls[0][1]).toContain(SUPPORT_EMAIL);
    });
  });
});
