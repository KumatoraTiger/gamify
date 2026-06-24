/**
 * 期間集計。直近 N 日のコミット数や日別カウント（スパークライン用）を求める。
 */

import { toDayKey } from './streak'

/** today を含む直近 days 日の dayKey を、古い順に返す */
export function recentDayKeys(today: Date, days: number): string[] {
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    keys.push(toDayKey(d))
  }
  return keys
}

/** today を含む直近 days 日の、日別コミット数（古い順） */
export function dailyCounts(dates: Date[], today: Date, days: number): number[] {
  const buckets = new Map<string, number>()
  for (const d of dates) {
    const k = toDayKey(d)
    buckets.set(k, (buckets.get(k) ?? 0) + 1)
  }
  return recentDayKeys(today, days).map((k) => buckets.get(k) ?? 0)
}

/** today を含む直近 days 日の合計コミット数 */
export function countWithin(dates: Date[], today: Date, days: number): number {
  return dailyCounts(dates, today, days).reduce((a, b) => a + b, 0)
}
