import { describe, expect, it } from 'vitest'
import { type BadgeDef, type BadgeMetrics, countUnlocked, evaluateBadges } from '../badges'

const defs: BadgeDef[] = [
  { id: 'first-release', name: '初リリース', icon: '🚀', test: (m) => m.releases >= 1 },
  { id: 'streak-7', name: '7日連続稼働', icon: '🔥', test: (m) => m.longestStreak >= 7 },
  { id: 'coverage-80', name: 'カバレッジ80%', icon: '🧪', test: (m) => (m.coverage ?? 0) >= 80 },
]

const base: BadgeMetrics = {
  totalCommits: 100,
  currentStreak: 3,
  longestStreak: 7,
  releases: 1,
  mergedPRs: 10,
}

describe('evaluateBadges', () => {
  it('述語を満たすバッジを解放扱いにする', () => {
    const statuses = evaluateBadges(defs, base)
    expect(statuses.find((s) => s.def.id === 'first-release')?.unlocked).toBe(true)
    expect(statuses.find((s) => s.def.id === 'streak-7')?.unlocked).toBe(true)
  })

  it('条件未達やデータ欠損は未解放', () => {
    const statuses = evaluateBadges(defs, base)
    // coverage 未指定 → 0 扱い → 未解放
    expect(statuses.find((s) => s.def.id === 'coverage-80')?.unlocked).toBe(false)
  })

  it('countUnlocked は解放数を数える', () => {
    expect(countUnlocked(evaluateBadges(defs, base))).toBe(2)
  })
})
