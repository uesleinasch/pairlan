import { describe, expect, it } from 'vitest'
import { stereoOpus } from './sdp'

const base = ['v=0', 'm=audio 9 UDP/TLS/RTP/SAVPF 111 63', 'a=rtpmap:111 opus/48000/2', 'a=rtpmap:63 red/48000/2']

describe('stereoOpus', () => {
  it('extends the existing opus fmtp line', () => {
    const sdp = [...base, 'a=fmtp:111 minptime=10;useinbandfec=1', ''].join('\r\n')
    expect(stereoOpus(sdp)).toContain('a=fmtp:111 minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1;maxaveragebitrate=128000')
  })

  it('adds a fmtp line when missing', () => {
    const out = stereoOpus([...base, ''].join('\r\n')).split('\r\n')
    expect(out[3]).toBe('a=fmtp:111 stereo=1;sprop-stereo=1;maxaveragebitrate=128000')
  })

  it('leaves sdp without opus untouched', () => {
    const sdp = 'v=0\r\nm=video 9 UDP 96\r\n'
    expect(stereoOpus(sdp)).toBe(sdp)
  })
})
