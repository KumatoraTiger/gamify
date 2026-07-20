import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from '../config'
import { countGhReleases, readGhReleaseDates, readMergedPRs } from './collectors/gh'
import {
  countReleaseTags,
  detectRepoSlug,
  fetchRepo,
  readCommits,
  readReleaseTagDates,
  readWorkCommits,
  remoteDefaultRef,
} from './collectors/git'
import { readQuests } from './collectors/projects'
import { buildQuestBoard } from './domain/quests'
import { type RawData, buildReport } from './domain/report'
import { renderHtml } from './render/html'
import { renderTerminal } from './render/terminal'

/**
 * 設定の releaseSource に従ってリリース数と日時を求める。
 * count と dates は同じソースから取るので基本一致する（日時の取れないぶんは
 * report 側で下駄 baseExp に回る）。
 */
function resolveReleases(slug: string | undefined): { count: number; dates: Date[] } {
  switch (config.releaseSource ?? 'auto') {
    case 'none':
      return { count: 0, dates: [] }
    case 'tags': {
      const dates = readReleaseTagDates(config.repoPath)
      return { count: countReleaseTags(config.repoPath), dates }
    }
    case 'gh': {
      const dates = slug ? readGhReleaseDates(slug) : []
      return { count: slug ? countGhReleases(slug) : 0, dates }
    }
    default: {
      // auto: gh Releases を優先し、無ければタグに fallback
      const ghCount = slug ? countGhReleases(slug) : 0
      if (ghCount > 0) return { count: ghCount, dates: slug ? readGhReleaseDates(slug) : [] }
      return {
        count: countReleaseTags(config.repoPath),
        dates: readReleaseTagDates(config.repoPath),
      }
    }
  }
}

function main(): void {
  const slug = config.repoSlug ?? detectRepoSlug(config.repoPath)

  // 既定で origin を fetch して追跡ブランチを最新化してから読む（config で無効化可能）
  if ((config.fetchBeforeRead ?? true) && !fetchRepo(config.repoPath)) {
    console.log('  ⚠ git fetch に失敗（オフライン等）。取り込み済みの origin で集計します')
  }

  // origin のデフォルトブランチを読む。無ければチェックアウト中の HEAD にフォールバック
  const ref = remoteDefaultRef(config.repoPath)
  const commits = readCommits(config.repoPath, config.author, ref)
  // ストリーク・今週のコミット用に、全ブランチから個人の「稼働」コミットも集める
  const workCommits = readWorkCommits(config.repoPath, config.author)
  const releases = resolveReleases(slug)
  const prs = slug ? readMergedPRs(slug, config.ghAuthor) : []

  const questBoard = config.quests
    ? buildQuestBoard(
        readQuests(config.quests.owner, config.quests.projectNumber),
        config.quests.rules,
      )
    : undefined

  const commitDates = commits.map((c) => c.date)

  // startDate 未指定なら、最初のコミット日を冒険の開始日とみなす
  const effectiveConfig = { ...config }
  if (!effectiveConfig.startDate && commitDates.length > 0) {
    const earliest = commitDates.reduce((a, b) => (a < b ? a : b))
    effectiveConfig.startDate = earliest.toISOString()
  }

  const raw: RawData = {
    commitDates,
    workCommitDates: workCommits.map((c) => c.date),
    mergedPRDates: prs.map((p) => p.mergedAt),
    releases: releases.count,
    releaseDates: releases.dates,
    questBoard,
    today: new Date(),
  }

  const report = buildReport(effectiveConfig, raw)

  // ターミナル要約
  console.log(renderTerminal(config.projectName, report))

  // HTML 出力
  const html = renderHtml(config.projectName, report)
  mkdirSync(dirname(config.htmlOut), { recursive: true })
  writeFileSync(config.htmlOut, html, 'utf8')
  console.log(`  → HTML: ${config.htmlOut}`)
  if (!slug) {
    console.log('  ⚠ git remote(origin) を検出できず、PR は集計していません')
  }
  console.log('')
}

main()
