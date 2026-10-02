import { useCallback } from 'react'
import { Alert } from 'react-native'
import { NavigationProp, useNavigation } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import { RootStackParamList } from '../types'

// A signed-out guest can browse listings (0053) but everything else belongs to
// an account. Wrap any such action in the function this returns: signed in, it
// just runs; signed out, it offers the way to an account instead.
//
// Stable across renders for as long as the session is, so it can be passed to
// the memoized ListingCard without defeating the memo.
export function useRequireAccount() {
  const { isSignedIn } = useAuth()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()

  return useCallback(
    (action: () => void) => {
      if (isSignedIn) {
        action()
        return
      }
      Alert.alert(
        'Sign in to continue',
        'Saving, messaging and posting need an Axis account. Accounts are for verified Western students.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Sign in', onPress: () => navigation.navigate('SignIn') },
          { text: 'Create account', onPress: () => navigation.navigate('CreateAccount') },
        ],
      )
    },
    [isSignedIn, navigation],
  )
}
