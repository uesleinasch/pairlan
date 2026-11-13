import type { IceCandidate, MediaChannel, ShareRole, SignalPayload } from '../../shared/protocol'

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
    await this.pc.setLocalDescription(offer)
    this.send({ role: this.role, channel: this.channel, kind: 'offer', sdp: offer.sdp ?? '' })
  }

  async answer(): Promise<void> {
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    this.send({ role: this.role, channel: this.channel, kind: 'answer', sdp: answer.sdp ?? '' })
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
