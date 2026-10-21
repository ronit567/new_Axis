// Guest browsing, screen by screen (App Review Guideline 5.1.1(v)): products
// are open to anyone, account-based features are not. These pin the parts a
// reviewer actually taps — and one trap: a guest has no user id and a guest
// listing has no seller, so a naive `user?.id === listing.seller?.id` is
// `undefined === undefined` and would hand every guest the owner controls.

import React from 'react';
import { AccessibilityInfo, Alert } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Listing } from '../../types';

// Avatar -> avatarUrls -> lib/supabase pulls in native modules that don't exist
// under Jest; every screen's data comes from the mocked hooks below.
jest.mock('../../lib/supabase', () => ({ supabase: {} }));

const mockAuth = {
  isGuest: true,
  isSignedIn: false,
  canBrowse: true,
  user: null as { id: string } | null,
  browseAsGuest: jest.fn(),
};
jest.mock('../../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const mockUseListing = jest.fn();
const mockToggleSaved = jest.fn();
const mockIdleMutation = { mutate: jest.fn(), mutateAsync: jest.fn() };
jest.mock('../../hooks/useListings', () => ({
  useListing: () => mockUseListing(),
  useMarkListingSold: () => mockIdleMutation,
  useRelistListing: () => mockIdleMutation,
  useDeleteListing: () => mockIdleMutation,
}));
jest.mock('../../hooks/useSavedListings', () => ({
  useToggleSaved: () => ({ mutate: mockToggleSaved }),
}));
jest.mock('../../hooks/useListingEdits', () => ({
  usePendingEditRequest: () => ({ data: null }),
}));
jest.mock('../../hooks/useProfile', () => ({ useProfile: () => ({ data: undefined }) }));
jest.mock('../../hooks/useReports', () => ({ useCreateReport: () => mockIdleMutation }));
jest.mock('../../hooks/useBlocks', () => ({ useBlockUser: () => mockIdleMutation }));

// MainScreen's session-wide hooks need a user and do nothing for a guest; the
// tabs themselves are stubbed so the test is about which one a guest gets.
jest.mock('../../hooks/useMessages', () => ({
  useMessagesRealtime: () => {},
  useUnreadConversationCount: () => 0,
}));
jest.mock('../../hooks/useNotifications', () => ({ useNotificationsRealtime: () => {} }));
jest.mock('../../hooks/useCatchUp', () => ({ useForegroundCatchUp: () => {} }));
jest.mock('../../context/NotificationBannerContext', () => ({
  useNotificationBanner: () => ({ show: jest.fn() }),
}));
function mockTab(label: string) {
  const { createElement } = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return () => createElement(Text, null, label);
}
jest.mock('../HomeScreen', () => () => null);
jest.mock('../SavedScreen', () => mockTab('signed-in saved list'));
jest.mock('../MessagesScreen', () => mockTab('signed-in inbox'));
jest.mock('../ProfileScreen', () => mockTab('signed-in profile'));

import ListingDetailScreen from '../ListingDetailScreen';
import MainScreen from '../MainScreen';
import WelcomeScreen from '../WelcomeScreen';

const navigate = jest.fn();
const navigation = { navigate, goBack: jest.fn() } as never;

const seller = {
  id: 'seller-1',
  name: 'Aria K.',
  year: 2 as const,
  location: 'Elgin Hall',
  program: 'BMOS',
  dotColor: '#9E9EAE',
  avatarUrl: null,
};

function listing(over: Partial<Listing> = {}): Listing {
  return {
    id: 'l1',
    title: 'Organic Chem 2 textbook',
    price: 45,
    condition: 'Good',
    category: 'Textbooks',
    seller: null,
    saved: false,
    imageColor: '#E8E0F5',
    imageUrls: [],
    thumbUrls: [],
    badge: null,
    description: 'Great condition.',
    views: 3,
    postedAgo: '2d ago',
    pickup: 'UCC',
    isFree: false,
    isTrade: false,
    status: 'active',
    ...over,
  };
}

function renderWithInsets(ui: React.ReactElement) {
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

function renderDetail(data: Listing) {
  mockUseListing.mockReturnValue({ data, isLoading: false, isError: false, refetch: jest.fn() });
  return renderWithInsets(
    <ListingDetailScreen
      navigation={navigation}
      route={{ key: 'ListingDetail', name: 'ListingDetail', params: { listingId: data.id } }}
    />,
  );
}

function lastAlertTitle(): string | undefined {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  return calls[calls.length - 1]?.[0];
}

function becomeGuest() {
  Object.assign(mockAuth, { isGuest: true, isSignedIn: false, user: null });
}

function signInAs(id: string) {
  Object.assign(mockAuth, { isGuest: false, isSignedIn: true, user: { id } });
}

beforeEach(() => {
  navigate.mockReset();
  mockToggleSaved.mockReset();
  mockAuth.browseAsGuest.mockReset();
  becomeGuest();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ListingDetail for a guest', () => {
  it('shows the product, but not who is selling it and not the owner controls', () => {
    renderDetail(listing());

    // Twice: the body title and the scroll-in top bar's.
    expect(screen.getAllByText('Organic Chem 2 textbook').length).toBeGreaterThan(0);
    expect(screen.getByText('$45')).toBeOnTheScreen();
    expect(screen.getByText('Great condition.')).toBeOnTheScreen();
    expect(screen.getByText('Sign in to see the seller')).toBeOnTheScreen();
    expect(screen.getByLabelText('Message seller')).toBeOnTheScreen();
    expect(screen.queryByText('This is your listing')).toBeNull();
    expect(screen.queryByLabelText('Edit listing')).toBeNull();
    expect(screen.queryByLabelText('Delete listing')).toBeNull();
  });

  it('asks the guest to sign in instead of opening a chat', () => {
    renderDetail(listing());

    fireEvent.press(screen.getByLabelText('Message seller'));

    expect(lastAlertTitle()).toBe('Sign in to message sellers');
    expect(navigate).not.toHaveBeenCalledWith('Chat', expect.anything());
  });

  it('asks the guest to sign in instead of saving', () => {
    renderDetail(listing());

    fireEvent.press(screen.getByLabelText('Save listing'));

    expect(lastAlertTitle()).toBe('Sign in to save listings');
    expect(mockToggleSaved).not.toHaveBeenCalled();
  });

  it('asks the guest to sign in to see the seller or to report', () => {
    renderDetail(listing());

    fireEvent.press(screen.getByLabelText('Sign in to see the seller'));
    expect(lastAlertTitle()).toBe('Sign in to see sellers');

    fireEvent.press(screen.getByLabelText('Report or block'));
    expect(lastAlertTitle()).toBe('Sign in to report or block');
  });
});

describe('ListingDetail signed in (unchanged by guest mode)', () => {
  it('opens the chat with the seller, no prompt', () => {
    signInAs('buyer-1');
    renderDetail(listing({ seller }));

    fireEvent.press(screen.getByLabelText('Message seller'));

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(
      'Chat',
      expect.objectContaining({ partnerId: 'seller-1', listingId: 'l1' }),
    );
  });

  it("still gives the seller their owner controls on their own listing", () => {
    signInAs('seller-1');
    renderDetail(listing({ seller }));

    expect(screen.getByText('This is your listing')).toBeOnTheScreen();
    expect(screen.getByLabelText('Edit listing')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Message seller')).toBeNull();
  });
});

describe('MainScreen for a guest', () => {
  const renderMain = () =>
    renderWithInsets(<MainScreen navigation={navigation} route={{} as never} />);

  it.each([
    ['Saved', 'Keep the things you like', 'signed-in saved list'],
    ['Messages', 'Talk to sellers', 'signed-in inbox'],
    ['Profile', "You're browsing as a guest", 'signed-in profile'],
  ])('replaces the %s tab with a way to sign in', (tab, heading, realTab) => {
    renderMain();

    fireEvent.press(screen.getByLabelText(tab));

    expect(screen.getByText(heading)).toBeOnTheScreen();
    expect(screen.queryByText(realTab)).toBeNull();
    fireEvent.press(screen.getByLabelText('Sign in'));
    expect(navigate).toHaveBeenLastCalledWith('SignIn');
  });

  it('keeps the legal documents reachable from the guest Profile tab', () => {
    renderMain();
    fireEvent.press(screen.getByLabelText('Profile'));

    fireEvent.press(screen.getByText('Privacy policy'));

    expect(navigate).toHaveBeenLastCalledWith('PrivacyPolicy');
  });

  it('asks a guest to sign in instead of opening Create listing', () => {
    renderMain();

    fireEvent.press(screen.getByLabelText('Create listing'));

    expect(lastAlertTitle()).toBe('Sign in to sell');
    expect(navigate).not.toHaveBeenCalledWith('CreateListing');
  });

  it('gives a signed-in user the real tabs', () => {
    signInAs('u1');
    renderMain();

    fireEvent.press(screen.getByLabelText('Saved'));

    expect(screen.getByText('signed-in saved list')).toBeOnTheScreen();
  });
});

describe('Welcome', () => {
  it('offers browsing without an account', async () => {
    mockAuth.isGuest = false;
    // Reduce Motion takes the single-fade path, and settling the promise in
    // act() keeps its setState inside the test.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    renderWithInsets(<WelcomeScreen navigation={navigation} route={{} as never} />);
    await act(async () => {});

    fireEvent.press(screen.getByText('Browse without an account'));

    expect(mockAuth.browseAsGuest).toHaveBeenCalledTimes(1);
  });
});
