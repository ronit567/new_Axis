// The Messages inbox after 0051: a thread is a (listing, person) pair, so each
// row is labelled with the LISTING, not the person. The partner's name is
// supporting information here and only becomes the headline inside the chat —
// which is exactly the distinction these tests pin, because it is the kind of
// thing a well-meaning refactor quietly reverts.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { NavigationProp } from '@react-navigation/native';
import type { Conversation, RootStackParamList } from '../../types';

// Avatar -> avatarUrls -> lib/supabase pulls in AsyncStorage's native module,
// which does not exist under Jest. Nothing here needs the client; the inbox
// data comes from the mocked hook below.
jest.mock('../../lib/supabase', () => ({ supabase: {} }));

const mockUseConversations = jest.fn();
const mockDeleteConversation = jest.fn();

jest.mock('../../hooks/useMessages', () => ({
  useConversations: () => mockUseConversations(),
  // The row's long-press / rotor delete action calls this. These tests are
  // about what a row says, not about deleting, so it only has to exist.
  useDeleteConversation: () => ({ mutate: mockDeleteConversation }),
}));

import MessagesScreen from '../MessagesScreen';

const navigate = jest.fn();
const navigation = { navigate } as unknown as NavigationProp<RootStackParamList>;

function conversation(over: Partial<Conversation> = {}): Conversation {
  return {
    partnerId: 'p1',
    partner: {
      id: 'p1',
      name: 'Ronit',
      initials: 'R',
      avatarColor: '#5C2D91',
      avatarUrl: null,
    },
    listingId: 'lst1',
    listingTitle: 'Organic Chem 2 textbook',
    listingPrice: 45,
    listingThumbUrl: null,
    listingImageColor: '#E8E0F5',
    lastMessage: 'Is this still available?',
    lastMessageAt: '2m ago',
    unreadCount: 0,
    type: 'Buying',
    ...over,
  };
}

function renderInbox(conversations: Conversation[]) {
  mockUseConversations.mockReturnValue({
    data: conversations,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  });
  return render(<MessagesScreen navigation={navigation} />);
}

beforeEach(() => {
  mockUseConversations.mockReset();
  navigate.mockReset();
});

describe('MessagesScreen rows', () => {
  it('labels a row with the listing, and shows the partner only as the second line', () => {
    renderInbox([conversation()]);

    expect(screen.getByText('Organic Chem 2 textbook')).toBeOnTheScreen();
    // The name is present, but it is no longer what the row is called.
    expect(screen.getByText('Ronit')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Organic Chem 2 textbook, with Ronit'),
    ).toBeOnTheScreen();
  });

  it('renders one row per listing when the same person is messaged about two things', () => {
    renderInbox([
      conversation({ listingId: 'lst1', listingTitle: 'Organic Chem 2 textbook' }),
      conversation({ listingId: 'lst2', listingTitle: 'Desk lamp', lastMessage: 'Still got it?' }),
    ]);

    expect(screen.getByText('Organic Chem 2 textbook')).toBeOnTheScreen();
    expect(screen.getByText('Desk lamp')).toBeOnTheScreen();
    // Two rows, one name — the name cannot be what distinguishes them.
    expect(screen.getAllByText('Ronit')).toHaveLength(2);
  });

  it('opens the chat for that exact thread, passing the listing that identifies it', () => {
    renderInbox([conversation({ listingId: 'lst2', listingTitle: 'Desk lamp' })]);

    fireEvent.press(screen.getByText('Desk lamp'));

    expect(navigate).toHaveBeenCalledWith(
      'Chat',
      expect.objectContaining({
        listingId: 'lst2',
        partnerId: 'p1',
        listingTitle: 'Desk lamp',
      }),
    );
  });

  it('falls back to the partner name when the thread has no listing at all', () => {
    renderInbox([
      conversation({
        listingId: null,
        listingTitle: null,
        listingPrice: null,
        listingImageColor: null,
      }),
    ]);

    expect(screen.getByText('Ronit')).toBeOnTheScreen();
    expect(screen.getByLabelText('Chat with Ronit')).toBeOnTheScreen();
  });

  it('says so when the thread had a listing that can no longer be read', () => {
    // 0051 nulls messages.listing_id when a listing is deleted, but a listing
    // that is merely RLS-hidden still leaves its id on the message — the row
    // must not silently pretend the thread was never about anything.
    renderInbox([conversation({ listingTitle: null, listingPrice: null })]);

    expect(screen.getByText('Listing unavailable')).toBeOnTheScreen();
    expect(screen.getByText('Ronit')).toBeOnTheScreen();
  });

  it('shows a per-thread unread badge', () => {
    renderInbox([
      conversation({ listingId: 'lst1', listingTitle: 'Organic Chem 2 textbook', unreadCount: 3 }),
      conversation({ listingId: 'lst2', listingTitle: 'Desk lamp', unreadCount: 0 }),
    ]);

    expect(screen.getByText('3')).toBeOnTheScreen();
  });
});
