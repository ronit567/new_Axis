import { decodeBase64 } from '../base64';

// Node's Buffer is the reference implementation here: the decoder has to agree
// with it byte for byte, because what it decodes is a JPEG on its way to
// storage and a single wrong byte is a corrupt image.
function reference(input: string): number[] {
  return Array.from(Buffer.from(input, 'base64'));
}

function encode(bytes: number[]): string {
  return Buffer.from(bytes).toString('base64');
}

describe('decodeBase64', () => {
  it('decodes the empty string to no bytes', () => {
    expect(decodeBase64('')).toEqual(new Uint8Array(0));
  });

  it('matches Buffer for each padding case', () => {
    // Lengths 1, 2 and 3 exercise the '==', '=' and unpadded endings.
    for (const bytes of [[0x41], [0x41, 0x42], [0x41, 0x42, 0x43]]) {
      const encoded = encode(bytes);
      expect(Array.from(decodeBase64(encoded))).toEqual(reference(encoded));
    }
  });

  it('round-trips every byte value', () => {
    const all = Array.from({ length: 256 }, (_, i) => i);
    const encoded = encode(all);
    expect(Array.from(decodeBase64(encoded))).toEqual(all);
  });

  it('handles the full alphabet including + and /', () => {
    // 0xFB 0xFF 0xBF encodes to '+/+/', covering both non-alphanumeric digits.
    const encoded = '+/+/';
    expect(Array.from(decodeBase64(encoded))).toEqual(reference(encoded));
  });

  it('ignores whitespace an encoder may have wrapped lines with', () => {
    const bytes = Array.from({ length: 120 }, (_, i) => (i * 7) % 256);
    const encoded = encode(bytes);
    const wrapped = encoded.replace(/(.{16})/g, '$1\n');
    expect(Array.from(decodeBase64(wrapped))).toEqual(bytes);
  });

  it('sizes the output from real digits, not the padded length', () => {
    // 'QUJD' is 4 digits -> exactly 3 bytes, no padding involved.
    expect(decodeBase64('QUJD')).toHaveLength(3);
    // 'QUI=' is 3 digits + padding -> 2 bytes, not 3.
    expect(decodeBase64('QUI=')).toHaveLength(2);
  });

  it('rejects a character outside the alphabet', () => {
    expect(() => decodeBase64('AB*D')).toThrow(/invalid character/);
  });

  it('rejects input that cannot be a whole number of bytes', () => {
    // A single leftover digit carries only 6 bits and cannot complete a byte.
    expect(() => decodeBase64('QUJDQ')).toThrow(/truncated/);
  });

  it('decodes a realistic JPEG header unchanged', () => {
    // The first bytes of any JPEG: SOI marker followed by JFIF APP0.
    const header = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];
    const encoded = encode(header);
    expect(Array.from(decodeBase64(encoded))).toEqual(header);
  });
});
