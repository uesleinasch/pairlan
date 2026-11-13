import { describe, expect, it } from 'vitest'
import { completeCommand, helpText, parseInput } from './commands'

describe('parseInput', () => {
  it('tells messages from commands', () => {
    expect(parseInput('oi')).toEqual({ kind: 'message', text: 'oi' })
    expect(parseInput('/tela')).toEqual({ kind: 'command', name: 'tela', arg: '' })
    expect(parseInput('  /Conectar  192.168.0.5 ')).toEqual({ kind: 'command', name: 'conectar', arg: '192.168.0.5' })
    expect(parseInput('/sudo rm')).toEqual({ kind: 'unknown', name: 'sudo' })
  })

  it('sends // as a literal slash message', () => {
    expect(parseInput('//etc/hosts')).toEqual({ kind: 'message', text: '/etc/hosts' })
  })

  it('keeps multi-line text as a message', () => {
    expect(parseInput('a\n/tela')).toEqual({ kind: 'message', text: 'a\n/tela' })
  })
})

describe('completeCommand', () => {
  it('lists commands for a prefix', () => {
    expect(completeCommand('/te')).toEqual(['/tela', '/tema'])
    expect(completeCommand('/co')).toEqual(['/controle', '/conectar', '/config'])
    expect(completeCommand('/ap')).toEqual(['/apagar'])
    expect(completeCommand('/tela x')).toEqual([])
    expect(completeCommand('oi')).toEqual([])
  })
})

describe('helpText', () => {
  it('lists every command', () => {
    const text = helpText()
    for (const c of ['/tela', '/conectar ip', '/tema', 'Ctrl+Espaço']) expect(text).toContain(c)
  })
})
