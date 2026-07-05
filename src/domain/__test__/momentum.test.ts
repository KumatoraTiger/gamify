import { describe, expect, it } from 'vitest'
import { buildMomentum } from '../momentum'

const d = (iso: string) => new Date(iso)

describe('buildMomentum', () => {
  const today = d('2026-06-25T00:00:00Z')

  it('イベントが無ければ全て0で平坦', () => {
    const m = buildMomentum({ commitDates: [], prDates: [], perCommit: 5, perMergedPR: 25 }, today)
    expect(m.latestExp).toBe(0)
    expect(m.weekDelta).toBe(0)
    expect(m.points.every((p) => p.exp === 0)).toBe(true)
  })

  it('累計EXPは単調増加し、最終点が総EXPに一致する', () => {
    const m = buildMomentum(
      {
        commitDates: [d('2026-01-01'), d('2026-03-01'), d('2026-06-20')],
        prDates: [d('2026-06-22')],
        perCommit: 5,
        perMergedPR: 25,
      },
      today,
    )
    // 3コミット*5 + 1PR*25 = 40
    expect(m.latestExp).toBe(40)
    expect(m.points.at(-1)?.exp).toBe(40)
    for (let i = 1; i < m.points.length; i++) {
      expect(m.points[i]!.exp).toBeGreaterThanOrEqual(m.points[i - 1]!.exp)
    }
  })

  it('週次デルタは直近7日のEXPを合算する', () => {
    const m = buildMomentum(
      {
        commitDates: [d('2026-01-01'), d('2026-06-20T12:00:00Z')], // 6/20 は 7日以内
        prDates: [],
        perCommit: 5,
        perMergedPR: 25,
      },
      today,
    )
    expect(m.weekDelta).toBe(5) // 6/20 の 1コミットのみ
    // prev = 10-5 = 5 → 100%
    expect(m.weekPct).toBeCloseTo(100, 5)
  })

  it('月目盛りを範囲内で生成する', () => {
    const m = buildMomentum(
      { commitDates: [d('2026-04-10')], prDates: [], perCommit: 5, perMergedPR: 25 },
      today,
    )
    const labels = m.months.map((x) => x.label)
    expect(labels).toContain('5月')
    expect(labels).toContain('6月')
    // pos は 0〜1
    expect(m.months.every((x) => x.pos >= 0 && x.pos <= 1)).toBe(true)
  })
})
