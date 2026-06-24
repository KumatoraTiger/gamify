/**
 * GitHub Projects v2 からクエスト（issue アイテム）を収集する。
 * `gh project item-list` を使う（要 `gh auth refresh -s project,read:project`）。
 * スコープ不足や未設定でも落とさず空配列で縮退する。
 */

import { execFileSync } from 'node:child_process'
import type { RawQuest } from '../domain/quests'

interface GhProjectItem {
  content?: { number?: number; title?: string; url?: string; type?: string }
  status?: string
  size?: string
  title?: string
}

export function readQuests(owner: string, projectNumber: number): RawQuest[] {
  try {
    const out = execFileSync(
      'gh',
      [
        'project',
        'item-list',
        String(projectNumber),
        '--owner',
        owner,
        '--format',
        'json',
        '--limit',
        '500',
      ],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    )
    const parsed = JSON.parse(out) as { items?: GhProjectItem[] }
    const items = parsed.items ?? []
    return (
      items
        // Issue のみ（Draft や PR は除外）
        .filter((it) => it.content?.type === 'Issue' && typeof it.content.number === 'number')
        .map((it) => ({
          number: it.content?.number as number,
          title: it.content?.title ?? it.title ?? `#${it.content?.number}`,
          status: it.status ?? 'Backlog',
          size: it.size,
          url: it.content?.url,
        }))
    )
  } catch {
    return []
  }
}
