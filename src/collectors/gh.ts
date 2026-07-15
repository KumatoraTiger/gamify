/**
 * gh CLI からマージ済み PR を収集する。
 * gh が未インストール／未認証でも落とさず、空配列で graceful に縮退する。
 */

import { execFileSync } from 'node:child_process'

export interface PRInfo {
  number: number
  title: string
  mergedAt: Date
}

export function readMergedPRs(repoSlug: string, author?: string, limit = 300): PRInfo[] {
  try {
    const args = [
      'pr',
      'list',
      '--repo',
      repoSlug,
      '--state',
      'merged',
      '--json',
      'number,title,mergedAt',
      '--limit',
      String(limit),
    ]
    if (author) {
      args.push('--author', author)
    }
    const out = execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    const arr = JSON.parse(out) as Array<{ number: number; title: string; mergedAt: string }>
    return arr
      .filter((p) => p.mergedAt)
      .map((p) => ({ number: p.number, title: p.title, mergedAt: new Date(p.mergedAt) }))
  } catch {
    return []
  }
}

/** GitHub Releases の数（repo スコープで取得） */
export function countGhReleases(repoSlug: string): number {
  try {
    const out = execFileSync('gh', ['api', `repos/${repoSlug}/releases`, '--jq', 'length'], {
      encoding: 'utf8',
    })
    return Number.parseInt(out.trim(), 10) || 0
  } catch {
    return 0
  }
}

/**
 * GitHub Releases の公開日時を返す（勢いの折れ線にリリースを載せる用）。
 * draft 等で published_at が無いものは created_at にフォールバックする。
 */
export function readGhReleaseDates(repoSlug: string): Date[] {
  try {
    const out = execFileSync(
      'gh',
      ['api', `repos/${repoSlug}/releases`, '--jq', '.[].published_at // .created_at'],
      { encoding: 'utf8' },
    )
    return out
      .split('\n')
      .filter(Boolean)
      .map((s) => new Date(s.trim()))
      .filter((d) => !Number.isNaN(d.getTime()))
  } catch {
    return []
  }
}
