/**
 * AES-256-GCM encryption for SSN storage.
 *
 * The full SSN must never be stored in plain text. It is encrypted here
 * using a dedicated key (SSN_ENCRYPTION_KEY, not the DB credentials),
 * stored in order_owners.ssn_encrypted, and deleted once the NWRA API
 * call succeeds. Only the last 4 digits (ssn_last4) are retained.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // GCM standard
const TAG_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.SSN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('SSN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a plaintext string.
 * Returns a base64 string: iv (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, encrypted, tag]).toString('base64')
}

/**
 * Decrypt a base64 string produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = getKey()
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(buf.length - TAG_LENGTH)
  const encrypted = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/** Extract and validate last-4 digits from a raw SSN string (digits only). */
export function ssnLast4(ssn: string): string {
  const digits = ssn.replace(/\D/g, '')
  if (digits.length !== 9) throw new Error('SSN must be 9 digits')
  return digits.slice(-4)
}
