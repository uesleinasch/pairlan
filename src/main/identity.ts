import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject
} from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

export type Identity = { publicKey: string; sign(message: string): string }

export const rawPublicKey = (key: KeyObject): string => key.export({ format: 'jwk' }).x as string

const ed25519Key = (raw: string): KeyObject =>
  createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: raw }, format: 'jwk' })

export function verifySignature(publicKey: string, message: string, signature: string): boolean {
  try {
    return verify(null, Buffer.from(message), ed25519Key(publicKey), Buffer.from(signature, 'base64url'))
  } catch {
    return false
  }
}

function identityFrom(privateKey: KeyObject): Identity {
  return {
    publicKey: rawPublicKey(createPublicKey(privateKey)),
    sign: (message) => sign(null, Buffer.from(message), privateKey).toString('base64url')
  }
}

export const generateIdentity = (): Identity => identityFrom(generateKeyPairSync('ed25519').privateKey)

export function loadIdentity(file: string): Identity {
  if (existsSync(file)) {
    try {
      return identityFrom(createPrivateKey(JSON.parse(readFileSync(file, 'utf8')).privateKey))
    } catch {
      renameSync(file, `${file}.bak`)
    }
  }
  const { privateKey } = generateKeyPairSync('ed25519')
  writeFileSync(file, JSON.stringify({ privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }) }), {
    mode: 0o600
  })
  return identityFrom(privateKey)
}

export function fingerprint(publicKey: string): string {
  const hash = createHash('sha256').update(Buffer.from(publicKey, 'base64url')).digest()
  return Array.from({ length: 6 }, (_, i) => String(hash.readUInt32BE(i * 4) % 10000).padStart(4, '0')).join(' ')
}
