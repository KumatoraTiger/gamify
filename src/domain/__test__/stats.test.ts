import { describe, expect, it } from 'vitest'
import { countWithin, dailyCounts, recentDayKeys } from '../stats'

const d = (s: string) => new Date(`${s}T12:00:00`)
const today = d('2026-06-25')

describe('recentDayKeys', () => {
  it('today を含む直近 N 日を古い順で返す', () => {
    expect(recentDayKeys(today, 3)).toEqual(['2026-06-23', '2026-06-24', '2026-06-25'])
  })
})

describe('dailyCounts', () => {
  it('日別のコミット数を古い順に並べる', () => {
    const dates = [d('2026-06-25'), d('2026-06-25'), d('2026-06-23')]
    expect(dailyCounts(dates, today, 3)).toEqual([1, 0, 2])
  })

  it('期間外のコミットは無視する', () => {
    const dates = [d('2026-06-10'), d('2026-06-25')]
    expect(dailyCounts(dates, today, 3)).toEqual([0, 0, 1])
  })
})

describe('countWithin', () => {
  it('直近 N 日の合計を返す', () => {
    const dates = [d('2026-06-25'), d('2026-06-24'), d('2026-06-10')]
    expect(countWithin(dates, today, 7)).toBe(2)
  })
})
