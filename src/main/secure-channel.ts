import { createCipheriv, createDecipheriv, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync } from 'node:crypto'
import { rawPublicKey, verifySignature, type Identity } from './identity'

const VERSION = 'pairlan-e2e-v1'
const TAG_BYTES = 16

type Hello = { e: string; sig: string }

function parseHello(raw: string): Hello | null {
  try {
    const v = JSON.parse(raw)
    return typeof v?.e === 'string' && typeof v.sig === 'string' ? { e: v.e, sig: v.sig } : null
  } catch {
    return null
  }
}

export const isHandshakeFrame = (raw: string): boolean => parseHello(raw) !== null

const nonce = (n: bigint): Buffer => {
  const b = Buffer.alloc(12)
  b.writeBigUInt64BE(n, 4)
  return b
}

export class FrameCipher {
  private sent = 0n
  private received = 0n

  constructor(
    private readonly sendKey: Buffer,
    private readonly receiveKey: Buffer
  ) {}

  seal(text: string): string {
    const n = this.sent++
    const cipher = createCipheriv('aes-256-gcm', this.sendKey, nonce(n))
    const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final(), cipher.getAuthTag()])
    return JSON.stringify({ n: n.toString(), c: body.toString('base64') })
  }

  open(raw: string): string | null {
    try {
      const v = JSON.parse(raw)
      if (typeof v?.n !== 'string' || typeof v.c !== 'string' || BigInt(v.n) !== this.received) return null
      const body = Buffer.from(v.c, 'base64')
      if (body.length < TAG_BYTES) return null
      const decipher = createDecipheriv('aes-256-gcm', this.receiveKey, nonce(this.received))
      decipher.setAuthTag(body.subarray(body.length - TAG_BYTES))
      const text = Buffer.concat([decipher.update(body.subarray(0, body.length - TAG_BYTES)), decipher.final()])
      this.received++
      return text.toString('utf8')
    } catch {
      return null
    }
  }
}

export type Handshake = { hello: string; accept(raw: string): FrameCipher | null }

export function createHandshake(identity: Identity, me: string, peer: string, peerPublicKey: string): Handshake {
  const eph = generateKeyPairSync('x25519')
  const mine = rawPublicKey(eph.publicKey)
  return {
    hello: JSON.stringify({ e: mine, sig: identity.sign(`${VERSION}|${me}|${peer}|${mine}`) }),
    accept(raw) {
      const hello = parseHello(raw)
      if (!hello || !verifySignature(peerPublicKey, `${VERSION}|${peer}|${me}|${hello.e}`, hello.sig)) return null
      try {
        const theirs = createPublicKey({ key: { kty: 'OKP', crv: 'X25519', x: hello.e }, format: 'jwk' })
        const shared = diffieHellman({ privateKey: eph.privateKey, publicKey: theirs })
        const salt = Buffer.from([mine, hello.e].sort().join('|'))
        const key = (from: string, to: string) =>
          Buffer.from(hkdfSync('sha256', shared, salt, `${VERSION}|${from}>${to}`, 32))
        return new FrameCipher(key(me, peer), key(peer, me))
      } catch {
        return null
      }
    }
  }
}
