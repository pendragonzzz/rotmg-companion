import { expect, test } from 'claude-code/testing'

import { mergeBoard, sortQueue, themeAt, THEMES } from '../hooks/register.tsx'

test('a partial update keeps the fields it leaves out', async () => {
  const first = mergeBoard(null, { summary: 'v0.3.1 shipped', ideas: ['tray icon'] }, 't1')
  const second = mergeBoard(first, { needsYou: [{ text: 'Test location detection on your PC' }] }, 't2')

  expect(second.summary).toBe('v0.3.1 shipped')
  expect(second.ideas).toEqual(['tray icon'])
  expect(second.needsYou.length).toBe(1)
  expect(second.updated).toBe('t2')
})

test('the queue sorts building first, later last', async () => {
  const sorted = sortQueue([
    { text: 'c', status: 'later' },
    { text: 'b', status: 'next' },
    { text: 'a', status: 'building' },
  ])

  expect(sorted.map(q => q.text)).toEqual(['a', 'b', 'c'])
})

test('theme cycling wraps around', async () => {
  expect(themeAt(THEMES.length).name).toBe(THEMES[0]!.name)
  expect(themeAt(-1).name).toBe(THEMES[THEMES.length - 1]!.name)
})

test('the board tool is served without a refusal', async ($, on) => {
  on('session.cwd', () => '/tmp')
  const ran = await $.tool.call({ tool: 'mcp__mission-control__board', summary: 'testing' } as never)

  expect(ran.deny).toBeUndefined()
  expect(ran.isError).not.toBe(true)
})
