import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Board, GitInfo, Live, NeedItem, QueueItem, QueueStatus } from '../types'

const PANE = 'mission-control'
const TOOL = 'mcp__mission-control__board'
const BOARD_FILE = '.claude/mission.json'

const board = atom({ plugin: 'mission-control', key: 'board' } as const, null)
const git = atom({ plugin: 'mission-control', key: 'git' } as const, null)
const theme = atom({ plugin: 'mission-control', key: 'theme' } as const, 0)
const live = atom({ plugin: 'mission-control', key: 'live' } as const, {
  activity: 'idle',
  tools: 0,
  turnStartedAt: 0,
  isWorking: false,
  recent: [],
})

type Theme = {
  name: string
  title: string
  accent: string
  needs: string
  queue: string
  done: string
  idea: string
  border: string
}

export const THEMES: Theme[] = [
  { name: 'Arcade', title: '#ff4fd8', accent: '#00e5ff', needs: '#ffd400', queue: '#7cff4f', done: '#8a8a8a', idea: '#b98cff', border: '#ff4fd8' },
  { name: 'Ember', title: '#ff7a1a', accent: '#ffc857', needs: '#ff3b3b', queue: '#ffa552', done: '#8a7a6a', idea: '#ffd6a5', border: '#ff7a1a' },
  { name: 'Frost', title: '#7fdbff', accent: '#c6f1ff', needs: '#ffffff', queue: '#5fb4ff', done: '#7a8a99', idea: '#a0e7e5', border: '#7fdbff' },
  { name: 'Theme-follow', title: 'claude', accent: 'suggestion', needs: 'warning', queue: 'success', done: 'inactive', idea: 'merged', border: 'promptBorder' },
]

export function themeAt(i: number): Theme {
  return THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length] ?? THEMES[0]!
}

const STATUS_ICON: Record<QueueStatus, string> = {
  building: '🔨',
  next: '⏭ ',
  later: '🕒',
  blocked: '⛔',
}
const STATUS_ORDER: QueueStatus[] = ['building', 'next', 'blocked', 'later']

export function sortQueue(queue: QueueItem[]): QueueItem[] {
  return [...queue].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  )
}

/** Merges a model's partial update into the board; fields left out are kept. */
export function mergeBoard(old: Board | null, patch: Partial<Board>, now: string): Board {
  const base: Board = old ?? { updated: now, summary: '', needsYou: [], queue: [], done: [], ideas: [] }
  return {
    updated: now,
    summary: patch.summary ?? base.summary,
    needsYou: patch.needsYou ?? base.needsYou,
    queue: patch.queue ?? base.queue,
    done: (patch.done ?? base.done).slice(0, 15),
    ideas: patch.ideas ?? base.ideas,
  }
}

function since(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

function describeTool(e: Record<string, unknown>): string {
  const tool = String(e.tool)
  const pick = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '')
  const detail =
    pick('description') || pick('file_path').split('/').pop() || pick('pattern') || pick('command')
  return detail ? `${tool} · ${detail.slice(0, 48)}` : tool
}

async function boardPath($: EngineInterface): Promise<string> {
  return `${await $.session.cwd()}/${BOARD_FILE}`
}

async function loadBoard($: EngineInterface): Promise<void> {
  try {
    const path = await boardPath($)
    if (!(await $.fs.exists(path))) return
    const parsed = JSON.parse(String(await $.fs.read(path))) as Board
    await update($, board, () => parsed)
  } catch {
    // A malformed board file leaves the last good one showing.
  }
}

async function sh($: EngineInterface, argv: string[]): Promise<string> {
  try {
    const r = await $.process.run(argv, { timeoutMs: 5000 })
    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
}

async function refreshGit($: EngineInterface): Promise<void> {
  const [branch, lastCommit, status, ahead, pkg] = await Promise.all([
    sh($, ['git', 'rev-parse', '--abbrev-ref', 'HEAD']),
    sh($, ['git', 'log', '-1', '--format=%s (%cr)']),
    sh($, ['git', 'status', '--porcelain']),
    sh($, ['git', 'rev-list', '--count', '@{u}..HEAD']),
    sh($, ['node', '-p', "require('./package.json').version"]),
  ])
  if (!branch) return
  const info: GitInfo = {
    branch,
    lastCommit,
    dirty: status ? status.split('\n').length : 0,
    ahead: Number(ahead) || 0,
    version: pkg || '?',
  }
  await update($, git, () => info)
}

export function boardMarkdown(b: Board | null, g: GitInfo | null): string {
  const lines: string[] = ['## 🛰 Mission Control']
  if (g) lines.push(`**⎇ ${g.branch}** · v${g.version} · ${g.dirty ? `${g.dirty} unsaved changes` : 'clean'}${g.ahead ? ` · ${g.ahead} unpushed` : ''}`)
  if (!b) return [...lines, '', '_No board yet — ask Claude to fill in Mission Control._'].join('\n')
  lines.push('', '### 📍 Where we\'re at', b.summary || '—')
  lines.push('', `### 🙋 Needs you (${b.needsYou.length})`)
  if (b.needsYou.length === 0) lines.push('_Nothing — go farm some pots._')
  for (const n of b.needsYou) lines.push(`- **${n.text}**${n.why ? ` — _${n.why}_` : ''}`)
  lines.push('', `### 🏗 Build queue (${b.queue.length})`)
  for (const q of sortQueue(b.queue)) lines.push(`- ${STATUS_ICON[q.status]} ${q.status === 'building' ? `**${q.text}**` : q.text}`)
  if (b.done.length) lines.push('', '### ✅ Recently done', ...b.done.slice(0, 4).map(d => `- ${d}`))
  if (b.ideas.length) lines.push('', '### 💡 Ideas', ...b.ideas.map(i => `- ${i}`))
  return lines.join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'mission',
      description: 'Open Mission Control: status, what Claude needs from you, build queue',
      argumentHint: '[theme]',
    })
    await $.tool.register({
      name: 'board',
      description:
        'Update the Mission Control board the user watches. Pass only the fields that changed; each replaces its list whole. ' +
        'summary: 1-2 sentences on where the project stands. needsYou: decisions/actions only the user can do. ' +
        'queue: planned work with status building|next|later|blocked. done: recent wins, newest first. ideas: smart suggestions.',
      inputSchema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          needsYou: {
            type: 'array',
            items: { type: 'object', properties: { text: { type: 'string' }, why: { type: 'string' } }, required: ['text'] },
          },
          queue: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                status: { type: 'string', enum: ['building', 'next', 'later', 'blocked'] },
              },
              required: ['text', 'status'],
            },
          },
          done: { type: 'array', items: { type: 'string' } },
          ideas: { type: 'array', items: { type: 'string' } },
        },
      },
    })

    const saved = await $.store.get('theme')
    if (typeof saved === 'number') await update($, theme, () => saved)

    await loadBoard($)
    await refreshGit($)
    $.clock.every(60_000, () => refreshGit($))
    $.clock.every(1_000, async () => {
      if ((await read($, live)).isWorking) await update($, live, l => ({ ...l }))
    })

    void $.ui.open({ id: PANE, title: '🛰  Mission Control' })
    return next(e)
  })

  on('command.run', { command: 'mission' }, async ($, e) => {
    if (e.args.trim() === 'theme') {
      const n = ((await read($, theme)) + 1) % THEMES.length
      await update($, theme, () => n)
      await $.store.set('theme', n)
      return { text: `Mission Control theme: ${themeAt(n).name}` }
    }
    await loadBoard($)
    await refreshGit($)
    const opened = await $.ui.open({ id: PANE, title: '🛰  Mission Control' })
    const note = opened.isPlaced ? '' : `\n\n_(Side pane can't dock here: ${opened.reason})_`
    return { text: boardMarkdown(await read($, board), await read($, git)) + note }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const patch = e as unknown as Partial<Board>
    const merged = mergeBoard(await read($, board), patch, new Date().toISOString())
    await update($, board, () => merged)
    try {
      await $.fs.write(await boardPath($), JSON.stringify(merged, null, 2) + '\n')
    } catch {
      // The pane still shows it; the file just isn't saved.
    }
    $.ui.toast('🛰 Mission Control updated')
    return { result: { content: [{ type: 'text', text: 'Board updated and saved to .claude/mission.json.' }] } as any }
  })

  on('prompt.submit', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, live, l => ({ ...l, isWorking: true, tools: 0, turnStartedAt: now, activity: 'thinking…' }))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (String(e.tool) === TOOL) return next(e)
    const label = describeTool(e as unknown as Record<string, unknown>)
    await update($, live, l => ({ ...l, activity: label, tools: l.tools + 1 }))
    const ran = await next(e)
    await update($, live, l => ({ ...l, activity: 'thinking…', recent: [label, ...l.recent].slice(0, 6) }))
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    await update($, live, l => ({ ...l, isWorking: false, activity: 'waiting on you' }))
    await loadBoard($)
    void refreshGit($)
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const out = await next(e)
    const b = await read($, board)
    const text =
      'The user watches a "Mission Control" pane. Keep it current with the mcp__mission-control__board tool: ' +
      'call it when the plan changes, when you start or finish a queued item, and whenever you need a decision or action from the user ' +
      '(put that in needsYou). Pass only changed fields.' +
      (b ? `\nCurrent board: ${JSON.stringify({ summary: b.summary, needsYou: b.needsYou, queue: b.queue })}` : '')
    return { sections: [...out.sections, { id: 'mission-control:board', text, scope: 'session' as const }] }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const b = await read($, board)
    if (!b || e.props.hasSurvey) return next(e)
    const t = themeAt(await read($, theme))
    const { Box, Text, Button } = $.ui.resolve(e)
    const building = b.queue.filter(q => q.status === 'building').length
    return (
      <Box>
        <Text color={t.title} bold>🛰 </Text>
        <Text color={t.needs} bold={b.needsYou.length > 0}>🙋 {b.needsYou.length} need you</Text>
        <Text dimColor> · </Text>
        <Text color={t.queue}>🔨 {building} building, {b.queue.length} queued</Text>
        <Text dimColor>  </Text>
        <Button key="open" label="Board" plain onPress={() => $.ui.open({ id: PANE, title: '🛰  Mission Control' })} />
      </Box>
    )
  })

  on('ui.render', { component: 'CommandOutput', props: { command: 'mission' } }, async ($, e, next) => {
    if (String(e.props.text ?? '').startsWith('Mission Control theme')) return next(e)
    const { Markdown } = $.ui.resolve(e)
    return <Markdown key="board" text={String(e.props.text)} />
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const [b, g, l, ti] = await Promise.all([read($, board), read($, git), read($, live), read($, theme)])
    const t = themeAt(ti)
    const now = await $.clock.now()

    const header = (icon: string, label: string, color: string, count?: number) => (
      <Box marginTop={1}>
        <Text color={color} bold underline>{icon} {label}</Text>
        {count !== undefined && <Text dimColor> ({count})</Text>}
      </Box>
    )

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box borderStyle="round" borderColor={t.border} paddingX={1} flexDirection="column">
          <Text color={t.title} bold>M I S S I O N   C O N T R O L</Text>
          {g ? (
            <Text>
              <Text color={t.accent}>⎇ {g.branch}</Text>
              <Text dimColor> · v{g.version} · </Text>
              <Text color={g.dirty ? t.needs : t.queue}>{g.dirty ? `${g.dirty} unsaved changes` : 'clean'}</Text>
              {g.ahead > 0 && <Text color={t.needs}> · {g.ahead} unpushed</Text>}
            </Text>
          ) : (
            <Text dimColor>no git repo here</Text>
          )}
          {g?.lastCommit && <Text dimColor wrap="truncate-end">last: {g.lastCommit}</Text>}
        </Box>

        {header("⚡", "RIGHT NOW", t.accent)}
        <Text color={l.isWorking ? t.queue : t.done} bold={l.isWorking}>
          {l.isWorking ? '● ' : '○ '}{l.activity}
          {l.isWorking && l.turnStartedAt > 0 ? `  (${since(l.turnStartedAt, now)}, ${l.tools} actions)` : ''}
        </Text>
        {l.recent.slice(0, 3).map(r => (
          <Text dimColor wrap="truncate-end">  ↳ {r}</Text>
        ))}

        {!b && (
          <Box marginTop={1} flexDirection="column">
            <Text color={t.needs}>No board yet.</Text>
            <Text dimColor italic>Ask Claude to "fill in Mission Control" and it will write .claude/mission.json.</Text>
          </Box>
        )}

        {b && (
          <Box flexDirection="column">
            {header("📍", "WHERE WE'RE AT", t.title)}
            <Text>{b.summary || '—'}</Text>

            {header("🙋", "NEEDS YOU", t.needs, b.needsYou.length)}
            {b.needsYou.length === 0 && <Text dimColor italic>Nothing — you're free. Go farm some pots.</Text>}
            {b.needsYou.map((n: NeedItem) => (
              <Box flexDirection="column">
                <Text color={t.needs} bold>▸ {n.text}</Text>
                {n.why && <Text dimColor italic>    {n.why}</Text>}
              </Box>
            ))}

            {header("🏗", "BUILD QUEUE", t.queue, b.queue.length)}
            {b.queue.length === 0 && <Text dimColor italic>Queue's empty. Suspicious.</Text>}
            {sortQueue(b.queue).map(q => (
              <Text color={q.status === 'building' ? t.queue : undefined} bold={q.status === 'building'} dimColor={q.status === 'later'}>
                {STATUS_ICON[q.status]} {q.text}
              </Text>
            ))}

            {b.done.length > 0 && header("✅", "RECENTLY DONE", t.done)}
            {b.done.slice(0, 4).map(d => (
              <Text color={t.done} strikethrough={false}>✓ {d}</Text>
            ))}

            {b.ideas.length > 0 && header("💡", "IDEAS", t.idea)}
            {b.ideas.map(i => (
              <Text color={t.idea}>✦ {i}</Text>
            ))}

            <Box marginTop={1}>
              <Text dimColor>updated {since(Date.parse(b.updated), now)} ago  </Text>
            </Box>
          </Box>
        )}

        <Box marginTop={1}>
          <Button
            key="theme"
            label={`🎨 ${t.name}`}
            hotkey="t"
            onPress={async () => {
              const n = ((await read($, theme)) + 1) % THEMES.length
              await update($, theme, () => n)
              await $.store.set('theme', n)
            }}
          />
          <Text> </Text>
          <Button
            key="refresh"
            label="↻ Refresh"
            hotkey="r"
            onPress={async () => {
              await loadBoard($)
              await refreshGit($)
            }}
          />
        </Box>
      </Box>
    )
  })
}
