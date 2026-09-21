// Base64 -> bytes, for handing image data to Supabase Storage.
//
// expo-image-manipulator can return the encoded JPEG as base64 directly, which
// is how StorageRepository gets photo bytes. The alternative — `fetch()` on the
// saved file:// URI — routes a local file read through Expo's native fetch,
// where it intermittently hangs and eventually rejects with "The request timed
// out" from ExpoModulesCore. Decoding here keeps the bytes in JS and never
// touches the network stack.
//
// Hand-rolled rather than `atob` + charCodeAt: atob returns a binary string,
// and every byte then costs a string index plus a charCodeAt. This writes
// straight into the output buffer, and is small enough to be worth not
// carrying a dependency for.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Reverse lookup, indexed by char code. -1 marks "not a base64 digit", which
// covers the padding '=' and any whitespace the encoder may have inserted.
const LOOKUP = (() => {
  const table = new Int8Array(128).fill(-1)
  for (let i = 0; i < ALPHABET.length; i += 1) {
    table[ALPHABET.charCodeAt(i)] = i
  }
  return table
})()

/**
 * Decode a standard base64 string to its bytes.
 *
 * Whitespace and padding are ignored, so output length is derived from the
 * count of real base64 digits rather than from `input.length`. Throws on a
 * character outside the alphabet, and on a length that cannot be a whole
 * number of bytes (a single leftover digit encodes only 6 bits).
 */
export function decodeBase64(input: string): Uint8Array {
  // First pass: count real digits so the output can be sized exactly, rather
  // than allocating for the padded length and slicing afterwards.
  let digits = 0
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    if (code === 61 /* '=' */) break
    if (code === 32 || code === 9 || code === 10 || code === 13) continue
    if (code > 127 || LOOKUP[code] === -1) {
      throw new Error(`decodeBase64: invalid character at index ${i}`)
    }
    digits += 1
  }

  if (digits % 4 === 1) {
    throw new Error('decodeBase64: truncated input')
  }

  const bytes = new Uint8Array(Math.floor((digits * 3) / 4))

  let out = 0
  let buffer = 0
  let bits = 0
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    if (code === 61) break
    if (code === 32 || code === 9 || code === 10 || code === 13) continue

    buffer = (buffer << 6) | LOOKUP[code]
    bits += 6

    // Every time 8 bits have accumulated, the top 8 are a finished byte. The
    // leftover 0-5 bits at the end are padding and are discarded.
    if (bits >= 8) {
      bits -= 8
      bytes[out] = (buffer >> bits) & 0xff
      out += 1
    }
  }

  return bytes
}
