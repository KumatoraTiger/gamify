import { describe, expect, it } from 'vitest'
import { DEFAULT_STAGES, buildJourney } from '../journey'

describe('buildJourney', () => {
  it('Lv.15 は港町ハーバーにいて次は霧の峠', () => {
    const j = buildJourney(15, 0)
    expect(j.current.name).toBe('港町ハーバー')
    expect(j.next?.name).toBe('霧の峠')
    expect(j.stages[j.currentIndex]?.current).toBe(true)
  })

  it('区間進捗はレベル内進捗も加味する', () => {
    // 港町(10)→霧の峠(18) span=8。Lv15 + 0.5 → (5.5)/8
    const j = buildJourney(15, 0.5)
    expect(j.progressInStage).toBeCloseTo(5.5 / 8, 5)
  })

  it('到達済みステージは reached=true、未到達は false', () => {
    const j = buildJourney(15, 0)
    const byName = Object.fromEntries(j.stages.map((s) => [s.name, s.reached]))
    expect(byName['はじまりの村']).toBe(true)
    expect(byName['港町ハーバー']).toBe(true)
    expect(byName['霧の峠']).toBe(false)
  })

  it('ステージ内マップの waypoint は現ステージ〜次ステージのレベル分', () => {
    const j = buildJourney(15, 0)
    // 10..18 の 9 地点
    expect(j.waypoints).toHaveLength(9)
    expect(j.waypoints[0]?.level).toBe(10)
    expect(j.waypoints.at(-1)?.level).toBe(18)
    // Lv15 まで到達、ここが here
    const here = j.waypoints.find((w) => w.here)
    expect(here?.level).toBe(15)
    expect(j.waypoints.filter((w) => w.reached).map((w) => w.level)).toEqual([
      10, 11, 12, 13, 14, 15,
    ])
  })

  it('Lv.1 ははじまりの村（最初のステージ）', () => {
    const j = buildJourney(1, 0)
    expect(j.currentIndex).toBe(0)
    expect(j.current.name).toBe('はじまりの村')
  })

  it('最終ステージ到達後は progressInStage=1 で next なし', () => {
    const last = DEFAULT_STAGES.at(-1)!
    const j = buildJourney(last.requiredLevel + 5, 0)
    expect(j.next).toBeUndefined()
    expect(j.progressInStage).toBe(1)
    expect(j.current.name).toBe(last.name)
  })
})
