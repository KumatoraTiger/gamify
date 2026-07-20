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

/**
 * origin のデフォルトブランチ ref（例 `origin/develop`）を返す。
 * これを読めばチェックアウト中のブランチや作業ツリーの状態に左右されない。
 * origin が無い/origin/HEAD 未設定のローカル専用リポジトリでは undefined を返し、
 * 呼び出し側はチェックアウト中の HEAD にフォールバックする。
 */
export function remoteDefaultRef(repoPath: string): string | undefined {
  try {
    const ref = git(repoPath, ['rev-parse', '--abbrev-ref', 'origin/HEAD']).trim()
    return ref || undefined
  } catch {
    return undefined
  }
}

/**
 * origin を fetch して追跡ブランチを最新化する（opt-in）。
 * ネットワーク往復が発生する。オフライン等で失敗しても集計は続行する。
 */
export function fetchRepo(repoPath: string): boolean {
  try {
    git(repoPath, ['fetch', '--quiet', 'origin'])
    return true
  } catch {
    return false
  }
}

function parseCommitLog(out: string): CommitInfo[] {
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

/** コミットを読む。ref 指定時はその ref から辿る（未指定ならチェックアウト中の HEAD） */
export function readCommits(repoPath: string, author?: string, ref?: string): CommitInfo[] {
  const args = ['log', `--pretty=format:%H${UNIT}%cI${UNIT}%an${UNIT}%s`, '--no-merges']
  if (author) args.push(`--author=${author}`)
  if (ref) args.push(ref)
  return parseCommitLog(git(repoPath, args))
}

/**
 * 全ブランチ（リモート追跡ブランチ含む）から author のコミットを読む。
 * デフォルトブランチに未着地の「作業中」コミットまで拾うので、着地ベースの
 * readCommits と違い「今どれだけ手を動かしているか（稼働）」の可視化に使う。
 * --all はコミットグラフを辿るので同一コミットの重複はない（ただし squash/rebase
 * 後はブランチ側と着地側が別コミットとして両方現れる＝作業の実回数として数える）。
 * author 未指定だと全員のコミットになる点に注意（本来は個人の稼働を見る用途）。
 */
export function readWorkCommits(repoPath: string, author?: string): CommitInfo[] {
  const args = ['log', `--pretty=format:%H${UNIT}%cI${UNIT}%an${UNIT}%s`, '--no-merges', '--all']
  if (author) args.push(`--author=${author}`)
  return parseCommitLog(git(repoPath, args))
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

/** `v*` 形式のリリースタグの作成日時を返す（勢いの折れ線にリリースを載せる用） */
export function readReleaseTagDates(repoPath: string): Date[] {
  try {
    const out = git(repoPath, [
      'for-each-ref',
      '--sort=creatordate',
      '--format=%(creatordate:iso-strict)',
      'refs/tags/v*',
    ])
    return out
      .split('\n')
      .filter(Boolean)
      .map((s) => new Date(s.trim()))
      .filter((d) => !Number.isNaN(d.getTime()))
  } catch {
    return []
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
