/**
 * 勢い（Momentum）。全期間の「活動EXPの積み上がり」を時系列で表す純粋ロジック。
 *
 * コミットとマージPRを EXP イベントとして時刻順に並べ、累計EXPの推移を
 * 一定間隔でサンプリングする。株価チャート風の折れ線を描くためのデータになる。
 * リリース/クエストEXPは日付を持たないためこの推移線には含めない（活動EXPのみ）。
 */

export interface MomentumInput {
  commitDates: Date[]
  prDates: Date[]
  perCommit: number
  perMergedPR: number
}

export interface MomentumPoint {
  tMs: number
  /** その時点までの累計活動EXP */
  exp: number
}

export interface MonthTick {
  label: string
  /** タイムライン上の位置（0〜1） */
  pos: number
  /** リリース等の目印があれば（今は未使用） */
  flag?: string
}

export interface Momentum {
  points: MomentumPoint[]
  startMs: number
  endMs: number
  minExp: number
  maxExp: number
  /** 最新（=今）の累計活動EXP */
  latestExp: number
  /** 直近7日で増えたEXP */
  weekDelta: number
  /** 直近7日の増加率（%） */
  weekPct: number
  months: MonthTick[]
}

const DAY_MS = 86_400_000

export function buildMomentum(input: MomentumInput, today: Date, samples = 60): Momentum {
  const events: { t: number; v: number }[] = []
  for (const d of input.commitDates) events.push({ t: d.getTime(), v: input.perCommit })
  for (const d of input.prDates) events.push({ t: d.getTime(), v: input.perMergedPR })
  events.sort((a, b) => a.t - b.t)

  const endMs = today.getTime()
  const total = events.reduce((s, e) => s + e.v, 0)

  if (events.length === 0) {
    return {
      points: [
        { tMs: endMs - DAY_MS, exp: 0 },
        { tMs: endMs, exp: 0 },
      ],
      startMs: endMs - DAY_MS,
      endMs,
      minExp: 0,
      maxExp: 0,
      latestExp: 0,
      weekDelta: 0,
      weekPct: 0,
      months: [],
    }
  }

  let startMs = events[0]?.t ?? endMs - DAY_MS
  if (startMs >= endMs) startMs = endMs - DAY_MS

  // 累計をサンプリング（境界時刻ごとに、それ以前のイベントEXPを合算）
  const points: MomentumPoint[] = []
  let idx = 0
  let acc = 0
  for (let i = 0; i <= samples; i++) {
    const boundary = startMs + ((endMs - startMs) * i) / samples
    while (idx < events.length && (events[idx]?.t ?? Number.POSITIVE_INFINITY) <= boundary) {
      acc += events[idx]?.v ?? 0
      idx++
    }
    points.push({ tMs: Math.round(boundary), exp: acc })
  }
  // 端数で取りこぼした分を最終点に反映
  const last = points[points.length - 1]
  if (last) last.exp = total

  const weekCut = endMs - 7 * DAY_MS
  const weekDelta = events.filter((e) => e.t > weekCut).reduce((s, e) => s + e.v, 0)
  const prev = total - weekDelta
  const weekPct = prev > 0 ? (weekDelta / prev) * 100 : weekDelta > 0 ? 100 : 0

  // 月目盛り（各月初のタイムライン上の位置）
  const months: MonthTick[] = []
  const span = endMs - startMs
  const cur = new Date(startMs)
  cur.setDate(1)
  cur.setHours(0, 0, 0, 0)
  // 開始月が範囲外なら次の月から
  if (cur.getTime() < startMs) cur.setMonth(cur.getMonth() + 1)
  while (cur.getTime() <= endMs) {
    months.push({
      label: `${cur.getMonth() + 1}月`,
      pos: span > 0 ? (cur.getTime() - startMs) / span : 0,
    })
    cur.setMonth(cur.getMonth() + 1)
  }

  return {
    points,
    startMs,
    endMs,
    minExp: 0,
    maxExp: total,
    latestExp: total,
    weekDelta,
    weekPct,
    months,
  }
}
