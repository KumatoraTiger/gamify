import type { BadgeDef } from './badges'
import type { LevelCurve } from './level'
import type { QuestRules } from './quests'

/** EXP の配点ルール（活動量から算出。クエストEXPは Size から別途加算） */
export interface ExpRules {
  perCommit: number
  perMergedPR: number
  perRelease: number
}

/** GitHub Projects v2 連携の設定 */
export interface QuestsConfig {
  /** Project のオーナー（user/org ログイン名） */
  owner: string
  /** Project 番号 */
  projectNumber: number
  rules: QuestRules
  /** クリア済みクエストの EXP を総EXPに加算するか（既定 true） */
  addClearedExpToTotal?: boolean
}

export interface GamifyConfig {
  /** 対象リポジトリのローカルパス */
  repoPath: string
  /** 表示名 */
  projectName: string
  /** gh 用の owner/repo。未指定なら git remote から自動検出 */
  repoSlug?: string
  /** 集計対象の作者（git の author 名/メール。未指定なら全員）。メール指定が最も確実 */
  author?: string
  /** PR 集計の作者（gh のログイン名 or '@me'。未指定なら全PR） */
  ghAuthor?: string
  /** リリース数の取得元。'auto' は gh Releases 優先・タグ fallback（既定） */
  releaseSource?: 'auto' | 'gh' | 'tags' | 'none'
  /** 開発開始日（ISO。日数表示用） */
  startDate?: string
  /**
   * 集計前に origin を fetch して追跡ブランチを最新化するか（既定 true）。
   * fetch は差分転送なので最新時はほぼコストゼロで、常に真の最新を反映できる。
   * false にすると fetch を省き、origin/HEAD（前回 fetch 済みの内容）を読む。
   * どちらでもローカルのチェックアウト状態には左右されない。
   */
  fetchBeforeRead?: boolean
  levelCurve: LevelCurve
  exp: ExpRules
  badges: BadgeDef[]
  /** GitHub Projects v2 連携（未指定ならクエストは集計しない） */
  quests?: QuestsConfig
  /** 出力する HTML のパス */
  htmlOut: string
}
