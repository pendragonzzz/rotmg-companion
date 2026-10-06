export type QueueStatus = 'building' | 'next' | 'later' | 'blocked'
export type QueueItem = { text: string; status: QueueStatus }
export type NeedItem = { text: string; why?: string }
export type Board = {
  updated: string
  summary: string
  needsYou: NeedItem[]
  queue: QueueItem[]
  done: string[]
  ideas: string[]
}
export type GitInfo = {
  branch: string
  version: string
  lastCommit: string
  dirty: number
  ahead: number
}
export type Live = {
  activity: string
  tools: number
  turnStartedAt: number
  isWorking: boolean
  recent: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'mission-control': {
      board: Board | null
      git: GitInfo | null
      live: Live
      theme: number
    }
  }
}
