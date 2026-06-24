/**
 * git からコミット・リリースタグを収集する。execFileSync で git を直接叩く。
 */

import { execFileSync } from 'node:child_process'

const UNIT = '\x1f' // フィールド区切り（本文に出ない制御文字）

function git(repoPath: string, args: string[]): string {
  return execFileSync('git', ['-C', repoPath, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

export interface CommitInfo {
  hash: string
  date: Date
  author: string
  subject: string
}

export function readCommits(repoPath: string, author?: string): CommitInfo[] {
  const args = ['log', `--pretty=format:%H${UNIT}%cI${UNIT}%an${UNIT}%s`, '--no-merges']
  if (author) args.push(`--author=${author}`)
  const out = git(repoPath, args)
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, iso, name, subject] = line.split(UNIT)
      return {
        hash: hash ?? '',
        date: new Date(iso ?? ''),
        author: name ?? '',
        subject: subject ?? '',
      }
    })
}

/** `v*` 形式のリリースタグ数を返す */
export function countReleaseTags(repoPath: string): number {
  try {
    const out = git(repoPath, ['tag', '--list', 'v*'])
    return out.split('\n').filter(Boolean).length
  } catch {
    return 0
  }
}

/** origin の URL から owner/repo を取り出す */
export function detectRepoSlug(repoPath: string): string | undefined {
  try {
    const url = git(repoPath, ['remote', 'get-url', 'origin']).trim()
    const m = url.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/)
    return m?.[1]
  } catch {
    return undefined
  }
}
