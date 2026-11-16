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
      { t: 'laser-off' },
      { t: 'control-state', allowed: true },
      { t: 'control-request' },
      { t: 'input', input: { kind: 'move', x: 0, y: 0.5 } },
      { t: 'input', input: { kind: 'button', button: 2, down: true } },
      { t: 'input', input: { kind: 'scroll', dx: 0, dy: -3 } },
      { t: 'input', input: { kind: 'key', code: 'KeyA', down: false } },
      { t: 'p2p-hello', addr: 'fc:b3:aa:bc:44:ff' },
      { t: 'p2p-start' },
      { t: 'p2p-stop' },
      { t: 'alert', level: 'yellow' },
      { t: 'alert', level: 'red' },
      { t: 'shake' },
      { t: 'alert-seen' },
      { t: 'chat', msg: { id: '2', from: 'a', fromName: 'Ana', text: 'oi', ts: 1, topic: 't1' } },
      { t: 'topic', topic: { id: 't1', title: 'deploy sexta', createdBy: 'a', createdAt: 1, updatedAt: 2, expiresAt: null } },
      { t: 'topic', topic: { ...{ id: 't1', title: 'deploy sexta', createdBy: 'a', createdAt: 1, updatedAt: 2, expiresAt: null }, expiresAt: 99 } },
      { t: 'topic-delete', id: 't1' },
      { t: 'topics', topics: [{ id: 't1', title: 'deploy sexta', createdBy: 'a', createdAt: 1, updatedAt: 2, expiresAt: null }], deleted: ['t2'] }
    ]
    for (const m of messages) expect(parseWire(encodeWire(m))).toEqual(m)
  })

  it('rejects malformed input', () => {
    expect(parseWire('not json')).toBeNull()
    expect(parseWire('{"t":"chat","msg":{"id":"1","from":"a","fromName":"A","text":"x","ts":1,"topic":"../x"}}')).toBeNull()
    expect(parseWire('{"t":"topic","topic":{"id":"t","title":"  ","createdBy":"a","createdAt":1,"updatedAt":1,"expiresAt":null}}')).toBeNull()
    expect(parseWire('{"t":"topic-delete","id":""}')).toBeNull()
    expect(parseWire('{"t":"topics","topics":[{"id":"bad id"}],"deleted":["ok",3]}')).toEqual({ t: 'topics', topics: [], deleted: ['ok'] })
    expect(parseWire('null')).toBeNull()
    expect(parseWire('{"t":"nope"}')).toBeNull()
    expect(parseWire('{"t":"p2p-hello","addr":"FC:B3:AA:BC:44:FF"}')).toBeNull()
    expect(parseWire('{"t":"p2p-hello","addr":"fc:b3:aa:bc:44"}')).toBeNull()
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
    expect(parseWire('{"t":"control-state"}')).toBeNull()
    expect(parseWire('{"t":"alert","level":"green"}')).toBeNull()
    expect(parseWire('{"t":"alert"}')).toBeNull()
    expect(parseWire('{"t":"input","input":{"kind":"move","x":-1,"y":0}}')).toBeNull()
    expect(parseWire('{"t":"input","input":{"kind":"scroll","dx":0,"dy":500}}')).toBeNull()
    expect(parseWire('{"t":"input","input":{"kind":"key","code":"KeyA"}}')).toBeNull()
    expect(parseWire('{"t":"input","input":{"kind":"exec"}}')).toBeNull()
  })
})

describe('channelOf', () => {
  it('defaults to screen for old peers', () => {
    expect(channelOf({ role: 'sharer', kind: 'stop' })).toBe('screen')
    expect(channelOf({ role: 'sharer', channel: 'voice', kind: 'stop' })).toBe('voice')
  })
})
