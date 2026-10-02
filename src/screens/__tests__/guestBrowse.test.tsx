// Signed-out browsing (0053): a guest can open a listing, but sees no seller
// and is offered an account wherever one is needed. These pin the gate itself,
// because the failure mode is silent: a control that quietly navigates a guest
// into a signed-in screen that isn't registered for them, or one that does
// nothing at all when tapped.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Listing, Seller } from '../../types';

jest.mock('../../lib/supabase', () => ({ supabase: {} }));

let mockUser: { id: string } | null = null;
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isSignedIn: !!mockUser }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

let mockListing: Listing | null = null;
const mockToggleSaved = jest.fn();
jest.mock('../../hooks/useListings', () => ({
  useListing: () => ({ data: mockListing, isLoading: false, isError: false, refetch: jest.fn() }),
  useMarkListingSold: () => ({ mutate: jest.fn() }),
  useRelistListing: () => ({ mutate: jest.fn() }),
  useDeleteListing: () => ({ mutate: jest.fn() }),
}));
jest.mock('../../hooks/useSavedListings', () => ({
  useToggleSaved: () => ({ mutate: mockToggleSaved }),
}));
jest.mock('../../hooks/useListingEdits', () => ({
  usePendingEditRequest: () => ({ data: null }),
}));
jest.mock('../../hooks/useProfile', () => ({
  useProfile: () => ({ data: undefined }),
}));
jest.mock('../../hooks/useReports', () => ({
  useCreateReport: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('../../hooks/useBlocks', () => ({
  useBlockUser: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

import ListingDetailScreen from '../ListingDetailScreen';
import ListingCard from '../../components/ListingCard';
import WelcomeScreen from '../WelcomeScreen';

const seller: Seller = {
  id: 'seller-1',
  name: 'Aria K.',
  year: 2,
  location: 'Elgin Hall',
  program: 'BMOS',
  dotColor: '#5C2D91',
  avatarUrl: null,
};

function listing(over: Partial<Listing> = {}): Listing {
  return {
    id: 'l1',
    title: 'Desk lamp',
    price: 15,
    condition: 'Good',
    category: 'Furniture',
    seller: null,
    saved: false,
    imageColor: '#E8E0F5',
    imageUrls: [],
    thumbUrls: [],
    badge: null,
    description: 'Works fine.',
    views: 0,
    postedAgo: '2h ago',
    pickup: '',
    isFree: false,
    isTrade: false,
    status: 'active',
    ...over,
  };
}

const navigation = { navigate: mockNavigate, goBack: jest.fn() };

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

function renderDetail() {
  return renderScreen(
    <ListingDetailScreen
      navigation={navigation as never}
      route={{ key: 'k', name: 'ListingDetail', params: { listingId: 'l1' } } as never}
    />,
  );
}

type AlertButton = { text?: string; onPress?: () => void };
function lastAlert() {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const [title, , buttons] = calls[calls.length - 1] as [string, string, AlertButton[]];
  return { title, buttons };
}

beforeEach(() => {
  mockUser = null;
  mockListing = listing();
  mockNavigate.mockReset();
  mockToggleSaved.mockReset();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('welcome screen', () => {
  it('lets a visitor browse listings without an account', () => {
    renderScreen(<WelcomeScreen navigation={navigation as never} route={{} as never} />);

    fireEvent.press(screen.getByText('Browse listings'));

    expect(mockNavigate).toHaveBeenCalledWith('Main');
  });
});

describe('listing detail as a signed-out guest', () => {
  it('shows the listing but no seller, pickup or view count', () => {
    renderDetail();

    expect(screen.getAllByText('Desk lamp').length).toBeGreaterThan(0);
    expect(screen.getByText('Works fine.')).toBeOnTheScreen();
    expect(screen.getByText('Posted by a verified Western student')).toBeOnTheScreen();
    expect(screen.queryByText(/views/)).toBeNull();
    expect(screen.queryByText('Campus pickup')).toBeNull();
  });

  it('offers an account instead of opening a chat', () => {
    renderDetail();

    fireEvent.press(screen.getByLabelText('Message seller'));

    expect(mockNavigate).not.toHaveBeenCalled();
    const { title, buttons } = lastAlert();
    expect(title).toBe('Sign in to continue');
    expect(buttons.map((b) => b.text)).toEqual(['Not now', 'Sign in', 'Create account']);

    buttons[1].onPress?.();
    expect(mockNavigate).toHaveBeenLastCalledWith('SignIn');
    buttons[2].onPress?.();
    expect(mockNavigate).toHaveBeenLastCalledWith('CreateAccount');
  });

  it('offers an account instead of saving', () => {
    renderDetail();

    fireEvent.press(screen.getByLabelText('Save listing'));

    expect(mockToggleSaved).not.toHaveBeenCalled();
    expect(lastAlert().title).toBe('Sign in to continue');
  });

  it('lets a guest report the listing by email, naming the listing', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderDetail();

    fireEvent.press(screen.getByLabelText('Report or block'));

    const { title, buttons } = lastAlert();
    expect(title).toBe('Report this listing');
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Sign in', 'Email our team']);

    buttons[2].onPress?.();
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('mailto:axis.app@outlook.com'));
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('l1'));
  });
});

describe('listing detail signed in', () => {
  beforeEach(() => {
    mockUser = { id: 'viewer-1' };
    mockListing = listing({ seller, views: 12, pickup: 'UCC, Room 110' });
  });

  it('still shows the seller, pickup and view count', () => {
    renderDetail();

    expect(screen.getByText('Aria K.')).toBeOnTheScreen();
    expect(screen.getByText('UCC, Room 110')).toBeOnTheScreen();
    expect(screen.getByText(/12 views/)).toBeOnTheScreen();
    expect(screen.queryByText('Posted by a verified Western student')).toBeNull();
  });

  it('opens the chat and saves without asking for an account', () => {
    renderDetail();

    fireEvent.press(screen.getByLabelText('Message seller'));
    expect(mockNavigate).toHaveBeenCalledWith(
      'Chat',
      expect.objectContaining({ listingId: 'l1', partnerId: 'seller-1' }),
    );

    fireEvent.press(screen.getByLabelText('Save listing'));
    expect(mockToggleSaved).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('listing card', () => {
  it('renders a guest listing without a seller line', () => {
    render(<ListingCard item={listing()} onPress={jest.fn()} onSave={jest.fn()} />);

    expect(screen.getByText('Desk lamp')).toBeOnTheScreen();
    expect(screen.queryByText(/Elgin Hall/)).toBeNull();
  });

  it('renders the seller line when there is a seller', () => {
    render(<ListingCard item={listing({ seller })} onPress={jest.fn()} onSave={jest.fn()} />);

    expect(screen.getByText('Aria K. · Elgin Hall')).toBeOnTheScreen();
  });
});
