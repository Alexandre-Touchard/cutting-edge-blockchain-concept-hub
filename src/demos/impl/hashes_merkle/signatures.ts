// Digital signatures with the browser's built-in Web Crypto: ECDSA on the P-256 curve with SHA-256.
// Keys are generated in memory for the demo only; nothing is stored or sent anywhere.
// (Bitcoin and Ethereum use ECDSA on another curve, secp256k1, which Web Crypto doesn't offer.)
import { bytesToHex, hexToBytes, utf8 } from './sha256';

const ALGO = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN = { name: 'ECDSA', hash: 'SHA-256' } as const;

export type KeyPair = {
  privateKey: CryptoKey;
  /** Uncompressed public point (04 ‖ x ‖ y), 65 bytes as hex. */
  publicHex: string;
  /** Private scalar d, 32 bytes as hex (shown masked in the UI). */
  privateHex: string;
};

const subtle = () => (typeof globalThis !== 'undefined' ? globalThis.crypto?.subtle : undefined);

/** Web Crypto needs a secure context (https or localhost). */
export const cryptoAvailable = () => !!subtle();

function base64UrlToHex(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  let hex = '';
  for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, '0');
  return hex;
}

export async function generateKeyPair(): Promise<KeyPair> {
  const s = subtle()!;
  const pair = (await s.generateKey(ALGO, true, ['sign', 'verify'])) as CryptoKeyPair;
  const raw = new Uint8Array(await s.exportKey('raw', pair.publicKey));
  const jwk = await s.exportKey('jwk', pair.privateKey);
  return { privateKey: pair.privateKey, publicHex: bytesToHex(raw), privateHex: base64UrlToHex(jwk.d ?? '') };
}

/** Signature as hex (r ‖ s, 64 bytes). ECDSA is randomised: signing twice gives different signatures. */
export async function signMessage(privateKey: CryptoKey, message: string): Promise<string> {
  const sig = await subtle()!.sign(SIGN, privateKey, utf8(message));
  return bytesToHex(new Uint8Array(sig));
}

/** True only if `sigHex` is a valid signature of exactly `message` by the owner of `publicHex`. */
export async function verifyMessage(publicHex: string, message: string, sigHex: string): Promise<boolean> {
  try {
    const key = await subtle()!.importKey('raw', hexToBytes(publicHex) as BufferSource, ALGO, false, ['verify']);
    return await subtle()!.verify(SIGN, key, hexToBytes(sigHex) as BufferSource, utf8(message));
  } catch {
    return false; // malformed key or signature
  }
}

/** Change one hex character (used by the "tamper" buttons). */
export function flipHexChar(hex: string, position = Math.floor(hex.length / 2)): string {
  if (!hex) return hex;
  const i = Math.min(Math.max(position, 0), hex.length - 1);
  const v = parseInt(hex[i], 16);
  const swapped = Number.isNaN(v) ? '0' : ((v + 1) % 16).toString(16);
  return hex.slice(0, i) + swapped + hex.slice(i + 1);
}
