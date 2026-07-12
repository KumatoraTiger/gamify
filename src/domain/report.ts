/**
 * 収集した生データと設定から、表示用のレポートを組み立てる純粋関数。
 * 収集（git/gh）と描画（HTML/ターミナル）の間に挟まり、ここがテストの中心になる。
 */

import { type BadgeStatus, evaluateBadges } from './badges'
import { type Character, buildCharacter } from './character'
import { type CityState, buildCity } from './city'
import type { ExpRules, GamifyConfig } from './config-types'
import { type JourneyState, buildJourney } from './journey'
import { type LevelInfo, levelFromExp } from './level'
import { type MomentumSeries, buildMomentumSeries } from './momentum'
import type { QuestBoard } from './quests'
import { countWithin, dailyCounts } from './stats'
import { currentStreak, longestStreak, uniqueDayKeys } from './streak'

export interface RawData {
  commitDates: Date[]
  mergedPRDates: Date[]
  releases: number
  users?: number
  coverage?: number
  questBoard?: QuestBoard
  today: Date
}

export interface DevReport {
  generatedAt: Date
  daysSinceStart?: number
  totalCommits: number
  totalExp: number
  weekExp: number
  level: LevelInfo
  currentStreak: number
  longestStreak: number
  weekCommits: number
  weekPRs: number
  dailyCommitCounts: number[]
  releases: number
  mergedPRs: number
  /** クリア済みクエストから加算された EXP */
  questExp: number
  badges: BadgeStatus[]
  questBoard?: QuestBoard
  /** RPG 演出: キャラ・装備・ジョブ */
  character: Character
  /** RPG 演出: 冒険マップ（ステージ進行） */
  journey: JourneyState
  /** RPG 演出: 街（バッジ解放の建物） */
  city: CityState
  /** RPG 演出: 勢い（活動EXP推移）。期間ごとの系列（全期間/3年/1年/3ヶ月/1ヶ月） */
  momentums: MomentumSeries[]
}

export function computeTotalExp(
  rules: ExpRules,
  totals: { commits: number; mergedPRs: number; releases: number },
): number {
  return (
    totals.commits * rules.perCommit +
    totals.mergedPRs * rules.perMergedPR +
    totals.releases * rules.perRelease
  )
}

export function buildReport(config: GamifyConfig, raw: RawData): DevReport {
  const totalCommits = raw.commitDates.length
  const mergedPRs = raw.mergedPRDates.length

  const addQuestExp = config.quests?.addClearedExpToTotal ?? true
  const questExp = addQuestExp ? (raw.questBoard?.clearedExp ?? 0) : 0

  const totalExp =
    computeTotalExp(config.exp, {
      commits: totalCommits,
      mergedPRs,
      releases: raw.releases,
    }) + questExp

  const dayKeys = uniqueDayKeys(raw.commitDates)
  const weekCommits = countWithin(raw.commitDates, raw.today, 7)
  const weekPRs = countWithin(raw.mergedPRDates, raw.today, 7)
  const weekExp = computeTotalExp(config.exp, {
    commits: weekCommits,
    mergedPRs: weekPRs,
    releases: 0,
  })

  const badges = evaluateBadges(config.badges, {
    totalCommits,
    currentStreak: currentStreak(dayKeys, raw.today),
    longestStreak: longestStreak(dayKeys),
    releases: raw.releases,
    mergedPRs,
    users: raw.users,
    coverage: raw.coverage,
  })

  let daysSinceStart: number | undefined
  if (config.startDate) {
    const start = new Date(config.startDate)
    daysSinceStart = Math.max(0, Math.floor((raw.today.getTime() - start.getTime()) / 86_400_000))
  }

  const level = levelFromExp(totalExp, config.levelCurve)
  const longest = longestStreak(dayKeys)

  const character = buildCharacter({
    level: level.level,
    totalCommits,
    mergedPRs,
    releases: raw.releases,
    longestStreak: longest,
    clearedQuests: raw.questBoard?.done.length ?? 0,
  })
  const journey = buildJourney(level.level, level.progress)
  const city = buildCity(badges)
  const momentums = buildMomentumSeries(
    {
      commitDates: raw.commitDates,
      prDates: raw.mergedPRDates,
      perCommit: config.exp.perCommit,
      perMergedPR: config.exp.perMergedPR,
    },
    raw.today,
  )

  return {
    generatedAt: raw.today,
    daysSinceStart,
    totalCommits,
    totalExp,
    weekExp,
    level,
    currentStreak: currentStreak(dayKeys, raw.today),
    longestStreak: longest,
    weekCommits,
    weekPRs,
    dailyCommitCounts: dailyCounts(raw.commitDates, raw.today, 7),
    releases: raw.releases,
    mergedPRs,
    questExp,
    badges,
    questBoard: raw.questBoard,
    character,
    journey,
    city,
    momentums,
  }
}
