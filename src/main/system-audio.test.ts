import { describe, expect, it } from 'vitest'
import { loopbackArgs } from './system-audio'

describe('loopbackArgs', () => {
  it('captures the sink monitor into a low-priority virtual source', () => {
    const [capture, playback] = loopbackArgs('pairlan_system_audio_1', 'PairLAN - audio do sistema 1')
    expect(capture).toContain('stream.capture.sink=true')
    expect(playback).toContain('media.class=Audio/Source')
    expect(playback).toContain('node.name=pairlan_system_audio_1')
    expect(playback).toContain('node.description="PairLAN - audio do sistema 1"')
    expect(playback).toContain('priority.session=0')
  })
})
