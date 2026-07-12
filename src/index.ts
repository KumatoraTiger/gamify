import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from '../config'
import {
  countReleaseTags,
  detectRepoSlug,
  fetchRepo,
  readCommits,
  remoteDefaultRef,
} from './collectors/git'
import { countGhReleases, readMergedPRs } from './collectors/gh'
import { readQuests } from './collectors/projects'
import { buildQuestBoard } from './domain/quests'
import { type RawData, buildReport } from './domain/report'
import { renderHtml } from './render/html'
import { renderTerminal } from './render/terminal'

/** 設定の releaseSource に従ってリリース数を求める */
function resolveReleases(slug: string | undefined): number {
  switch (config.releaseSource ?? 'auto') {
    case 'none':
      return 0
    case 'tags':
      return countReleaseTags(config.repoPath)
    case 'gh':
      return slug ? countGhReleases(slug) : 0
    default: {
      // auto: gh Releases を優先し、無ければタグ数に fallback
      const gh = slug ? countGhReleases(slug) : 0
      return gh > 0 ? gh : countReleaseTags(config.repoPath)
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
    mergedPRDates: prs.map((p) => p.mergedAt),
    releases,
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
