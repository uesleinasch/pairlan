import { spawn } from 'node:child_process'
import electron from 'electron'

const launch = (profile, offset) =>
  spawn(electron, ['.', '--no-sandbox', '--ozone-platform=x11'], {
    stdio: 'inherit',
    env: { ...process.env, PAIRLAN_PROFILE: profile, PAIRLAN_PORT_OFFSET: String(offset) }
  })

const children = [launch('a', 0), launch('b', 1)]
const stopAll = () => children.forEach((c) => c.exitCode === null && c.kill())

process.on('SIGINT', stopAll)
process.on('SIGTERM', stopAll)
children.forEach((c) => c.on('exit', stopAll))
