/**
 * 実績バッジ。設定で定義した述語を、集計済みメトリクスに対して評価する。
 */

export interface BadgeMetrics {
  totalCommits: number
  currentStreak: number
  longestStreak: number
  releases: number
  mergedPRs: number
  /** 利用者数など、外部から取れたら入れる（無ければ 0 扱い） */
  users?: number
  /** テストカバレッジ（%）。取れたら入れる */
  coverage?: number
}

export interface BadgeDef {
  id: string
  name: string
  icon: string
  /** 解放される街の建物など（演出用ラベル。任意） */
  unlocks?: string
  test: (m: BadgeMetrics) => boolean
}

export interface BadgeStatus {
  def: BadgeDef
  unlocked: boolean
}

export function evaluateBadges(defs: BadgeDef[], metrics: BadgeMetrics): BadgeStatus[] {
  return defs.map((def) => ({ def, unlocked: def.test(metrics) }))
}

export function countUnlocked(statuses: BadgeStatus[]): number {
  return statuses.filter((s) => s.unlocked).length
}
