const STEREO_PARAMS = { stereo: '1', 'sprop-stereo': '1', maxaveragebitrate: '128000' }

export function stereoOpus(sdp: string): string {
  const pt = /a=rtpmap:(\d+) opus\/48000\/2/i.exec(sdp)?.[1]
  if (!pt) return sdp
  const lines = sdp.split('\r\n')
  const fmtpIndex = lines.findIndex((l) => l.startsWith(`a=fmtp:${pt} `))
  if (fmtpIndex === -1) {
    const rtpmapIndex = lines.findIndex((l) => l.startsWith(`a=rtpmap:${pt} `))
    const params = Object.entries(STEREO_PARAMS).map(([k, v]) => `${k}=${v}`)
    lines.splice(rtpmapIndex + 1, 0, `a=fmtp:${pt} ${params.join(';')}`)
    return lines.join('\r\n')
  }
  const [head, rawParams = ''] = lines[fmtpIndex].split(' ', 2)
  const params = new Map(
    rawParams
      .split(';')
      .filter(Boolean)
      .map((p) => p.split('=') as [string, string])
  )
  for (const [k, v] of Object.entries(STEREO_PARAMS)) params.set(k, v)
  lines[fmtpIndex] = `${head} ${[...params].map(([k, v]) => `${k}=${v}`).join(';')}`
  return lines.join('\r\n')
}
