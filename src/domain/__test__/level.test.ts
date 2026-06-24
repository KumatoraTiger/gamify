import { describe, expect, it } from 'vitest'
import { type LevelCurve, cumExpForLevel, expToAdvance, levelFromExp } from '../level'

const curve: LevelCurve = { base: 100, step: 20 }

describe('expToAdvance', () => {
  it('レベルが上がるほど必要EXPが増える', () => {
    expect(expToAdvance(1, curve)).toBe(100)
    expect(expToAdvance(2, curve)).toBe(120)
    expect(expToAdvance(3, curve)).toBe(140)
  })
})

describe('cumExpForLevel', () => {
  it('Lv1 到達は 0 EXP', () => {
    expect(cumExpForLevel(1, curve)).toBe(0)
  })
  it('累積はしきい値の合計', () => {
    expect(cumExpForLevel(2, curve)).toBe(100)
    expect(cumExpForLevel(3, curve)).toBe(220) // 100 + 120
    expect(cumExpForLevel(4, curve)).toBe(360) // + 140
  })
})

describe('levelFromExp', () => {
  it('0 EXP は Lv1', () => {
    const info = levelFromExp(0, curve)
    expect(info.level).toBe(1)
    expect(info.toNext).toBe(100)
    expect(info.progress).toBe(0)
  })

  it('しきい値ちょうどで次レベルに上がる', () => {
    expect(levelFromExp(99, curve).level).toBe(1)
    expect(levelFromExp(100, curve).level).toBe(2)
    expect(levelFromExp(220, curve).level).toBe(3)
  })

  it('レベル内の進捗を返す', () => {
    // Lv2 は 100〜220 の幅120。160 なら 60/120 = 0.5
    const info = levelFromExp(160, curve)
    expect(info.level).toBe(2)
    expect(info.expIntoLevel).toBe(60)
    expect(info.expForLevel).toBe(120)
    expect(info.toNext).toBe(60)
    expect(info.progress).toBeCloseTo(0.5)
  })

  it('負の EXP は 0 として扱う', () => {
    expect(levelFromExp(-50, curve).level).toBe(1)
    expect(levelFromExp(-50, curve).totalExp).toBe(0)
  })
})
