import { uid } from './utils'

const KEY = 'liubendou.sessions.v1'

export function makeSession() {
  return { id: uid(), title: '新的对话', createdAt: Date.now(), messages: [] }
}

export function loadSessions() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!Array.isArray(data) || !data.length) return null
    return data
  } catch {
    return null
  }
}

export function saveSessions(sessions) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sessions.slice(0, 40)))
  } catch {
    /* 忽略存储失败 */
  }
}
