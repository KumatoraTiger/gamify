/**
 * コミット日からストリーク（連続稼働日数）を求める。
 *
 * 日付の隣接判定は「UTC基準の通し日番号」で行い、月またぎ・DST の影響を受けないようにする。
 * ローカルのどの日に属するかは toDayKey で決める。
 */

/** Date を `YYYY-MM-DD`（ローカルタイム）に変換する */
export function toDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** `YYYY-MM-DD` を、隣接判定用の通し日番号に変換する */
function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Math.floor(Date.UTC(y as number, (m as number) - 1, d as number) / 86_400_000)
}

/** 日付配列を重複排除し、昇順の dayKey 配列にする */
export function uniqueDayKeys(dates: Date[]): string[] {
  return [...new Set(dates.map(toDayKey))].sort()
}

/**
 * 現在のストリーク。今日コミットがあれば今日から、無くても昨日まであれば昨日から、
 * 連続している日数を遡って数える。どちらも無ければ 0。
 */
export function currentStreak(dayKeys: string[], today: Date): number {
  if (dayKeys.length === 0) return 0
  const set = new Set(dayKeys.map(dayNumber))
  const todayNum = dayNumber(toDayKey(today))

  let cursor: number
  if (set.has(todayNum)) {
    cursor = todayNum
  } else if (set.has(todayNum - 1)) {
    cursor = todayNum - 1
  } else {
    return 0
  }

  let streak = 0
  while (set.has(cursor)) {
    streak++
    cursor--
  }
  return streak
}

/** 過去最長のストリーク */
export function longestStreak(dayKeys: string[]): number {
  if (dayKeys.length === 0) return 0
  const nums = [...new Set(dayKeys.map(dayNumber))].sort((a, b) => a - b)
  let longest = 1
  let run = 1
  for (let i = 1; i < nums.length; i++) {
    if ((nums[i] as number) === (nums[i - 1] as number) + 1) {
      run++
    } else {
      run = 1
    }
    if (run > longest) longest = run
  }
  return longest
}
