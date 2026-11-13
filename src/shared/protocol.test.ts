import { describe, expect, it } from 'vitest'
import { channelOf, encodeWire, parseWire, PROTOCOL_VERSION, type WireMessage } from './protocol'

describe('parseWire', () => {
  it('round-trips valid messages', () => {
    const messages: WireMessage[] = [
      { t: 'hello', v: PROTOCOL_VERSION, peer: { id: 'a', name: 'Ana' } },
      { t: 'chat', msg: { id: '1', from: 'a', fromName: 'Ana', text: 'oi', ts: 1 } },
      { t: 'signal', payload: { role: 'sharer', kind: 'offer', sdp: 'v=0' } },
      { t: 'signal', payload: { role: 'viewer', kind: 'ice', candidate: { candidate: 'c', sdpMid: '0' } } },
      { t: 'signal', payload: { role: 'sharer', kind: 'stop' } },
      { t: 'signal', payload: { role: 'viewer', channel: 'voice', kind: 'answer', sdp: 'v=0' } },
      { t: 'presence', liveAudio: false },
      { t: 'signal', payload: { role: 'sharer', channel: 'audio', kind: 'offer', sdp: 'v=0' } },
      { t: 'share-state', sharing: true },
      { t: 'typing' },
      {
        t: 'file-start',
        msg: { id: 'f', from: 'a', fromName: 'Ana', text: '', ts: 2, attachment: { name: 'a.png', size: 3, mime: 'image/png' } }
      },
      { t: 'file-chunk', id: 'f', data: 'AAAA' },
      { t: 'file-end', id: 'f' },
      { t: 'laser', x: 0.25, y: 1, click: false },
      { t: 'laser-off' }
    ]
    for (const m of messages) expect(parseWire(encodeWire(m))).toEqual(m)
  })

  it('rejects malformed input', () => {
    expect(parseWire('not json')).toBeNull()
    expect(parseWire('null')).toBeNull()
    expect(parseWire('{"t":"nope"}')).toBeNull()
    expect(parseWire('{"t":"hello","v":1,"peer":{"id":"","name":"x"}}')).toBeNull()
    expect(parseWire('{"t":"chat","msg":{"id":"1","text":"x"}}')).toBeNull()
    expect(parseWire('{"t":"signal","payload":{"role":"boss","kind":"stop"}}')).toBeNull()
    expect(parseWire('{"t":"signal","payload":{"role":"sharer","kind":"offer"}}')).toBeNull()
    expect(parseWire('{"t":"share-state","sharing":"yes"}')).toBeNull()
    expect(parseWire('{"t":"file-start","msg":{"id":"f","from":"a","fromName":"A","text":"","ts":1}}')).toBeNull()
    expect(
      parseWire(
        '{"t":"file-start","msg":{"id":"f","from":"a","fromName":"A","text":"","ts":1,"attachment":{"name":"x","size":-1,"mime":""}}}'
      )
    ).toBeNull()
    expect(parseWire('{"t":"file-chunk","id":"f"}')).toBeNull()
    expect(parseWire('{"t":"signal","payload":{"role":"sharer","channel":"radio","kind":"stop"}}')).toBeNull()
    expect(parseWire('{"t":"presence","liveAudio":"sim"}')).toBeNull()
    expect(parseWire('{"t":"laser","x":1.2,"y":0,"click":false}')).toBeNull()
    expect(parseWire('{"t":"laser","x":0.5,"y":0.5}')).toBeNull()
  })
})

describe('channelOf', () => {
  it('defaults to screen for old peers', () => {
    expect(channelOf({ role: 'sharer', kind: 'stop' })).toBe('screen')
    expect(channelOf({ role: 'sharer', channel: 'voice', kind: 'stop' })).toBe('voice')
  })
})
