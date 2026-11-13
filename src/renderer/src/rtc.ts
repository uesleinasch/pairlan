import type { IceCandidate, MediaChannel, ShareRole, SignalPayload } from '../../shared/protocol'
import { stereoOpus } from './sdp'

const MAX_BITRATE = 8_000_000

export class RtcSession {
  readonly pc = new RTCPeerConnection({ iceServers: [] })
  private queue: IceCandidate[] = []

  constructor(
    private readonly role: ShareRole,
    private readonly send: (payload: SignalPayload) => void,
    private readonly channel: MediaChannel = 'screen'
  ) {
    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.send({ role, channel, kind: 'ice', candidate: e.candidate.toJSON() as IceCandidate })
    }
  }

  async addIce(candidate: IceCandidate): Promise<void> {
    if (this.pc.remoteDescription) await this.pc.addIceCandidate(candidate)
    else this.queue.push(candidate)
  }

  async setRemote(type: 'offer' | 'answer', sdp: string): Promise<void> {
    await this.pc.setRemoteDescription({ type, sdp })
    for (const c of this.queue.splice(0)) await this.pc.addIceCandidate(c)
  }

  async offer(): Promise<void> {
    const offer = await this.pc.createOffer()
    const sdp = this.tune(offer.sdp ?? '')
    await this.pc.setLocalDescription({ type: 'offer', sdp })
    this.send({ role: this.role, channel: this.channel, kind: 'offer', sdp })
  }

  async answer(): Promise<void> {
    const answer = await this.pc.createAnswer()
    const sdp = this.tune(answer.sdp ?? '')
    await this.pc.setLocalDescription({ type: 'answer', sdp })
    this.send({ role: this.role, channel: this.channel, kind: 'answer', sdp })
  }

  private tune(sdp: string): string {
    return this.channel === 'audio' ? stereoOpus(sdp) : sdp
  }

  async tuneSenders(): Promise<void> {
    for (const sender of this.pc.getSenders()) {
      const params = sender.getParameters()
      if (!params.encodings?.length) continue
      params.encodings[0].maxBitrate = MAX_BITRATE
      await sender.setParameters(params).catch(() => undefined)
    }
  }

  close(): void {
    this.pc.close()
  }
}
