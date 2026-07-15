import { describe, expect, it } from 'vitest'
import { MOMENTUM_PERIODS, buildMomentum, buildMomentumSeries } from '../momentum'

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

  it('期間ウィンドウを指定すると開始時点の累計がベースライン(minExp)になる', () => {
    // 古い活動(2024)＋窓内の活動(2026/06)
    const m = buildMomentum(
      {
        commitDates: [d('2024-01-01'), d('2024-06-01'), d('2026-06-20')],
        prDates: [],
        perCommit: 5,
        perMergedPR: 25,
      },
      today,
      60,
      30, // 直近30日窓
    )
    // 窓開始(=今から30日前)より前の 2コミット*5 = 10 がベースライン
    expect(m.minExp).toBe(10)
    // 現在の累計は全イベント込み 3*5 = 15
    expect(m.latestExp).toBe(15)
    expect(m.points.at(-1)?.exp).toBe(15)
    // 窓開始は「今-30日」あたり（最初のイベントより後）
    expect(m.startMs).toBeGreaterThan(d('2026-05-01').getTime())
  })

  it('窓が最初のイベントより長ければ全期間と同じ範囲になる', () => {
    const input = {
      commitDates: [d('2026-05-01'), d('2026-06-20')],
      prDates: [],
      perCommit: 5,
      perMergedPR: 25,
    }
    const all = buildMomentum(input, today)
    const y3 = buildMomentum(input, today, 60, 365 * 3)
    expect(y3.startMs).toBe(all.startMs)
    expect(y3.minExp).toBe(0)
  })

  it('buildMomentumSeries は全期間を含む5系列を既定ラベルで返す', () => {
    const series = buildMomentumSeries(
      { commitDates: [d('2026-06-20')], prDates: [], perCommit: 5, perMergedPR: 25 },
      today,
    )
    expect(series.map((s) => s.key)).toEqual(['all', '3y', '1y', '3m', '1m'])
    expect(series.map((s) => s.label)).toEqual(['全期間', '3年', '1年', '3ヶ月', '1ヶ月'])
    expect(series[0]?.key).toBe('all')
    // どの系列でも現在の累計は同じ
    expect(new Set(series.map((s) => s.momentum.latestExp)).size).toBe(1)
    expect(MOMENTUM_PERIODS).toHaveLength(5)
  })

  it('levelCurve 未指定なら lv は付かずレベル範囲は1で埋まる', () => {
    const m = buildMomentum(
      { commitDates: [d('2026-06-20')], prDates: [], perCommit: 5, perMergedPR: 25 },
      today,
    )
    expect(m.points.every((p) => p.lv === undefined)).toBe(true)
    expect(m.latestLv).toBe(1)
    expect(m.minLv).toBe(1)
  })

  it('levelCurve 指定時は各点に小数レベルが付き、単調増加で最新レベルに一致する', () => {
    const curve = { base: 150, step: 30 }
    // 100コミット*5 = 500 EXP。base=150,step=30 → Lv1→2:150, 2→3:180, 3→4:210
    // 累計 500 は Lv3 到達(330)後、Lv3内 170/210 進捗 → Lv3.x
    const m = buildMomentum(
      {
        commitDates: Array.from({ length: 100 }, (_, i) => d(`2026-0${(i % 5) + 1}-01`)),
        prDates: [],
        perCommit: 5,
        perMergedPR: 25,
        levelCurve: curve,
      },
      today,
    )
    expect(m.points.every((p) => typeof p.lv === 'number')).toBe(true)
    for (let i = 1; i < m.points.length; i++) {
      expect(m.points[i]!.lv!).toBeGreaterThanOrEqual(m.points[i - 1]!.lv!)
    }
    // 最終点の小数レベルは latestLv と一致し、整数部は 3
    expect(m.points.at(-1)?.lv).toBeCloseTo(m.latestLv, 5)
    expect(Math.floor(m.latestLv)).toBe(3)
  })

  it('baseExp（非活動EXPの下駄）は線全体に一律で足され、終点＝活動EXP+下駄になる', () => {
    const input = {
      commitDates: [d('2026-01-01'), d('2026-06-20')],
      prDates: [],
      perCommit: 5,
      perMergedPR: 25,
    }
    const plain = buildMomentum(input, today)
    const lifted = buildMomentum({ ...input, baseExp: 190 }, today)
    // 活動EXP 2*5=10。下駄190で終点は200
    expect(plain.latestExp).toBe(10)
    expect(lifted.latestExp).toBe(200)
    // 各点が一律 +190（＝線の形は不変）
    for (let i = 0; i < plain.points.length; i++) {
      expect(lifted.points[i]!.exp).toBe(plain.points[i]!.exp + 190)
    }
    expect(lifted.minExp).toBe(plain.minExp + 190)
    expect(lifted.maxExp).toBe(plain.maxExp + 190)
  })

  it('baseExp 指定時の最新レベルは 活動EXP+下駄 の総EXPから決まる', () => {
    const curve = { base: 150, step: 30 }
    // 活動EXP 5325（左上の総EXP 5515 との差 190 が下駄）→ 総5515 は Lv16（Lv16床=5400）
    const m = buildMomentum(
      {
        commitDates: Array.from({ length: 1065 }, () => d('2026-06-20')),
        prDates: [],
        perCommit: 5,
        perMergedPR: 25,
        baseExp: 190,
        levelCurve: curve,
      },
      today,
    )
    expect(m.latestExp).toBe(5325 + 190)
    expect(Math.floor(m.latestLv)).toBe(16)
    // 下駄が無ければ活動EXP 5325 は Lv15 に留まる
    const noBase = buildMomentum(
      {
        commitDates: Array.from({ length: 1065 }, () => d('2026-06-20')),
        prDates: [],
        perCommit: 5,
        perMergedPR: 25,
        levelCurve: curve,
      },
      today,
    )
    expect(Math.floor(noBase.latestLv)).toBe(15)
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
