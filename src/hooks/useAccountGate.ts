import { useCallback } from 'react'
import { Alert } from 'react-native'
import type { NavigationProp } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import { SUPPORT_EMAIL } from '../constants/contact'
import { RootStackParamList } from '../types'

// The account-based things a guest can reach for. Each has its own reason, so
// the prompt says why *this* needs an account instead of a generic "sign in".
export type GatedAction = 'save' | 'message' | 'sell' | 'seller' | 'report'

export const ACCOUNT_PROMPTS: Record<GatedAction, { title: string; message: string }> = {
  save: {
    title: 'Sign in to save listings',
    message: 'Saved listings are kept on your account, so you can come back to them later.',
  },
  message: {
    title: 'Sign in to message sellers',
    message:
      'Messages are only between verified Western students, so you always know who you are talking to.',
  },
  sell: {
    title: 'Sign in to sell',
    message: 'Only verified Western students can post listings. It takes a minute with your @uwo.ca email.',
  },
  seller: {
    title: 'Sign in to see sellers',
    message: 'Seller profiles are only shown to verified Western students.',
  },
  // A guest has no account to file a report from, so the published contact
  // address is offered as well (Guideline 1.2 asks for a way to report).
  report: {
    title: 'Sign in to report or block',
    message: `Reports and blocks are tied to your account. You can also email ${SUPPORT_EMAIL} about this listing.`,
  },
}

/**
 * Guideline 5.1.1(v): browsing is open to guests, account-based features are
 * not. Returns a guard to call before one of those features: `true` means go
 * ahead. For a guest it explains why the action needs an account, offers sign
 * in or sign up, and returns `false`.
 *
 * The guest navigator registers SignIn and CreateAccount, and signing in from
 * either swaps the whole stack to the signed-in app.
 */
export function useAccountGate(navigation: NavigationProp<RootStackParamList>) {
  const { isGuest } = useAuth()

  return useCallback(
    (action: GatedAction): boolean => {
      if (!isGuest) return true
      const { title, message } = ACCOUNT_PROMPTS[action]
      Alert.alert(title, message, [
        { text: 'Sign in', isPreferred: true, onPress: () => navigation.navigate('SignIn') },
        { text: 'Create account', onPress: () => navigation.navigate('CreateAccount') },
        { text: 'Not now', style: 'cancel' },
      ])
      return false
    },
    [isGuest, navigation],
  )
}
