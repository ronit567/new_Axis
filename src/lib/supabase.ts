import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import * as aesjs from 'aes-js'
import { createClient } from '@supabase/supabase-js'

// expo-secure-store caps a stored value at 2048 bytes, but a Supabase session
// (access JWT + refresh token + user object) routinely runs several KB and
// overflows that limit — silently breaking session persistence.
//
// LargeSecureStore keeps tokens encrypted at rest without hitting the cap: the
// bulky session ciphertext lives in AsyncStorage, while only a per-key AES-256
// key — which is tiny — is held in SecureStore (the device keychain/keystore).
class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = Crypto.getRandomBytes(256 / 8)
    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1),
    )
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value))

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey))

    return aesjs.utils.hex.fromBytes(encryptedBytes)
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key)
    if (!encryptionKeyHex) return null

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    )
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value))

    return aesjs.utils.utf8.fromBytes(decryptedBytes)
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key)
    if (!encrypted) return null

    return this.decrypt(key, encrypted)
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value)
    await AsyncStorage.setItem(key, encrypted)
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key)
    await SecureStore.deleteItemAsync(key)
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

// EXPO_PUBLIC_* vars are inlined at bundle time, so a missing value would
// otherwise surface as a cryptic "supabaseUrl is required" crash on the first
// import. Fail loudly with a fix instead.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and set ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart the Expo dev server.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
