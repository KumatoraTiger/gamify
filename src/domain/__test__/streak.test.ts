import { describe, expect, it } from 'vitest'
import { currentStreak, longestStreak, toDayKey, uniqueDayKeys } from '../streak'

const d = (s: string) => new Date(`${s}T12:00:00`)

describe('toDayKey', () => {
  it('ローカル日付を YYYY-MM-DD にする', () => {
    expect(toDayKey(d('2026-06-25'))).toBe('2026-06-25')
  })
})

describe('uniqueDayKeys', () => {
  it('同じ日のコミットはまとめ、昇順に並べる', () => {
    const dates = [d('2026-06-25'), d('2026-06-25'), d('2026-06-23')]
    expect(uniqueDayKeys(dates)).toEqual(['2026-06-23', '2026-06-25'])
  })
})

describe('currentStreak', () => {
  const today = d('2026-06-25')

  it('今日を含む連続日数を数える', () => {
    const keys = ['2026-06-23', '2026-06-24', '2026-06-25']
    expect(currentStreak(keys, today)).toBe(3)
  })

  it('今日が無くても昨日まで続いていれば継続扱い', () => {
    const keys = ['2026-06-23', '2026-06-24']
    expect(currentStreak(keys, today)).toBe(2)
  })

  it('間が空いていたらそこで止まる', () => {
    const keys = ['2026-06-21', '2026-06-24', '2026-06-25']
    expect(currentStreak(keys, today)).toBe(2)
  })

  it('一昨日までしか無ければ 0（途切れている）', () => {
    const keys = ['2026-06-22', '2026-06-23']
    expect(currentStreak(keys, today)).toBe(0)
  })

  it('空なら 0', () => {
    expect(currentStreak([], today)).toBe(0)
  })

  it('月をまたいでも連続を数える', () => {
    const keys = ['2026-05-31', '2026-06-01', '2026-06-02']
    expect(currentStreak(keys, d('2026-06-02'))).toBe(3)
  })
})

describe('longestStreak', () => {
  it('最長の連続区間を返す', () => {
    const keys = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-10', '2026-06-11']
    expect(longestStreak(keys)).toBe(3)
  })
  it('空なら 0', () => {
    expect(longestStreak([])).toBe(0)
  })
  it('全部バラバラなら 1', () => {
    expect(longestStreak(['2026-06-01', '2026-06-05', '2026-06-20'])).toBe(1)
  })
})
