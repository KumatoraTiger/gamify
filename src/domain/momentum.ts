/**
 * 勢い（Momentum）。全期間の「活動EXPの積み上がり」を時系列で表す純粋ロジック。
 *
 * コミットとマージPRを EXP イベントとして時刻順に並べ、累計EXPの推移を
 * 一定間隔でサンプリングする。株価チャート風の折れ線を描くためのデータになる。
 * リリース/クエストEXPは日付を持たないためこの推移線には含めない（活動EXPのみ）。
 */

import { type LevelCurve, levelFromExp } from './level'

export interface MomentumInput {
  commitDates: Date[]
  prDates: Date[]
  perCommit: number
  perMergedPR: number
  /**
   * 日付を持たない非活動EXP（リリース/クエスト）の合計。折れ線全体に一律で足す
   * 「下駄」として扱う。これにより線の終点＝総EXPになり、見出しの Lv が左上の Lv と一致する。
   */
  baseExp?: number
  /** 指定するとレベル推移も算出する（レベル表示タブ用） */
  levelCurve?: LevelCurve
}

export interface MomentumPoint {
  tMs: number
  /** その時点までの累計活動EXP */
  exp: number
  /** その時点のレベル（進捗込みの小数。levelCurve 指定時のみ） */
  lv?: number
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
  /** 表示範囲の下端。全期間は0、期間窓では「窓開始時点の累計EXP」 */
  minExp: number
  maxExp: number
  /** 最新（=今）の累計活動EXP */
  latestExp: number
  /** レベル表示範囲の下端/上端/最新（levelCurve 指定時のみ。小数レベル） */
  minLv: number
  maxLv: number
  latestLv: number
  /** 直近7日で増えたEXP */
  weekDelta: number
  /** 直近7日の増加率（%） */
  weekPct: number
  months: MonthTick[]
}

const DAY_MS = 86_400_000

/** 累計EXPを「進捗込みの小数レベル」に変換する（Lv内の進捗を小数部に乗せる） */
function lvFloat(exp: number, curve: LevelCurve): number {
  const li = levelFromExp(exp, curve)
  return li.level + li.progress
}

/** 表示期間の種類 */
export type PeriodKey = 'all' | '3y' | '1y' | '3m' | '1m'

export interface Period {
  key: PeriodKey
  label: string
  /** さかのぼる日数。null は全期間 */
  days: number | null
}

/** 選択できる期間（先頭がデフォルト） */
export const MOMENTUM_PERIODS: Period[] = [
  { key: 'all', label: '全期間', days: null },
  { key: '3y', label: '3年', days: 365 * 3 },
  { key: '1y', label: '1年', days: 365 },
  { key: '3m', label: '3ヶ月', days: 90 },
  { key: '1m', label: '1ヶ月', days: 30 },
]

export interface MomentumSeries {
  key: PeriodKey
  label: string
  momentum: Momentum
}

/**
 * 全期間の入力から、各表示期間ぶんの Momentum をまとめて構築する。
 * 大きな数字（現在の累計）や今週デルタは期間非依存で共通、折れ線だけ窓ごとにズームする。
 */
export function buildMomentumSeries(
  input: MomentumInput,
  today: Date,
  samples = 60,
): MomentumSeries[] {
  return MOMENTUM_PERIODS.map((p) => ({
    key: p.key,
    label: p.label,
    momentum: buildMomentum(input, today, samples, p.days),
  }))
}

/**
 * @param windowDays 直近この日数だけを表示範囲にする（null=全期間）。
 *   窓開始より前の活動EXPはベースライン(minExp)として折れ線の下端になる。
 */
export function buildMomentum(
  input: MomentumInput,
  today: Date,
  samples = 60,
  windowDays: number | null = null,
): Momentum {
  const events: { t: number; v: number }[] = []
  for (const d of input.commitDates) events.push({ t: d.getTime(), v: input.perCommit })
  for (const d of input.prDates) events.push({ t: d.getTime(), v: input.perMergedPR })
  events.sort((a, b) => a.t - b.t)

  const endMs = today.getTime()
  const total = events.reduce((s, e) => s + e.v, 0)
  // 非活動EXP（日付なし）の下駄。折れ線の全ポイントに一律で加算する。
  const base = input.baseExp ?? 0
  const curve = input.levelCurve

  if (events.length === 0) {
    return {
      points: [
        { tMs: endMs - DAY_MS, exp: base },
        { tMs: endMs, exp: base },
      ],
      startMs: endMs - DAY_MS,
      endMs,
      minExp: base,
      maxExp: base,
      latestExp: base,
      minLv: curve ? lvFloat(base, curve) : 1,
      maxLv: curve ? lvFloat(base, curve) : 1,
      latestLv: curve ? lvFloat(base, curve) : 1,
      weekDelta: 0,
      weekPct: 0,
      months: [],
    }
  }

  const firstMs = events[0]?.t ?? endMs - DAY_MS
  // 窓指定があれば「今からwindowDays前」まで、ただし最初のイベントより前には遡らない
  let startMs = firstMs
  if (windowDays != null) startMs = Math.max(firstMs, endMs - windowDays * DAY_MS)
  if (startMs >= endMs) startMs = endMs - DAY_MS

  // 窓開始より前のEXPはベースライン（折れ線の下端＝minExp）
  let idx = 0
  let acc = 0
  while (idx < events.length && (events[idx]?.t ?? Number.POSITIVE_INFINITY) < startMs) {
    acc += events[idx]?.v ?? 0
    idx++
  }
  const baseline = acc

  // 累計をサンプリング（境界時刻ごとに、それ以前のイベントEXPを合算）
  const points: MomentumPoint[] = []
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

  // 非活動EXPの下駄を全ポイントに足す（線の形は不変、終点＝総EXPになる）
  if (base) for (const p of points) p.exp += base

  // レベル推移（curve 指定時のみ）。下駄込みの累計EXPを小数レベルに変換する。
  if (curve) for (const p of points) p.lv = lvFloat(p.exp, curve)

  const weekCut = endMs - 7 * DAY_MS
  const weekDelta = events.filter((e) => e.t > weekCut).reduce((s, e) => s + e.v, 0)
  // 増加率は「今の総EXP（下駄込み）に対する今週ぶん」で見る
  const prev = total + base - weekDelta
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
    minExp: baseline + base,
    maxExp: total + base,
    latestExp: total + base,
    minLv: curve ? lvFloat(baseline + base, curve) : 1,
    maxLv: curve ? lvFloat(total + base, curve) : 1,
    latestLv: curve ? lvFloat(total + base, curve) : 1,
    weekDelta,
    weekPct,
    months,
  }
}
