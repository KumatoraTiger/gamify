/**
 * レポートを ANSI カラーのターミナル要約に整形する。
 */

import type { DevReport } from '../domain/report'

const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  gold: '\x1b[38;5;179m',
  coral: '\x1b[38;5;209m',
  teal: '\x1b[38;5;79m',
  gray: '\x1b[38;5;245m',
}

const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

function sparkline(values: number[]): string {
  const max = Math.max(1, ...values)
  return values
    .map((v) => SPARK[Math.min(SPARK.length - 1, Math.round((v / max) * (SPARK.length - 1)))])
    .join('')
}

function bar(progress: number, width = 24): string {
  const filled = Math.round(Math.max(0, Math.min(1, progress)) * width)
  return '█'.repeat(filled) + c.dim + '░'.repeat(width - filled) + c.reset
}

export function renderTerminal(projectName: string, r: DevReport): string {
  const lv = r.level
  const unlocked = r.badges.filter((b) => b.unlocked).length
  const lines: string[] = []

  const ch = r.character
  lines.push('')
  lines.push(`  ${c.gold}${c.bold}${projectName}${c.reset}  ${c.dim}/ dev cockpit${c.reset}`)
  lines.push(
    `  ${ch.jobIcon} ${c.bold}${ch.fullName}${c.reset}  ` +
      `${c.dim}${ch.equipment.map((e) => `${e.icon}${e.name}`).join(' · ')}${c.reset}`,
  )
  lines.push(
    `  ${c.gold}Lv.${lv.level}${c.reset}  ${c.gold}${bar(lv.progress)}${c.reset}  ` +
      `${c.dim}EXP ${lv.totalExp} / ${lv.nextLevelAt}（次まで ${lv.toNext}）${c.reset}`,
  )
  lines.push('')
  lines.push(
    `  ${c.coral}🔥 ${r.currentStreak}日連続${c.reset}` +
      `${c.dim}（最長 ${r.longestStreak}）${c.reset}` +
      `   コミット/週 ${c.bold}${r.weekCommits}${c.reset} ${c.teal}${sparkline(r.dailyCommitCounts)}${c.reset}`,
  )
  lines.push(
    `  マージPR/週 ${c.bold}${r.weekPRs}${c.reset}` +
      `   獲得EXP/週 ${c.gold}+${r.weekExp}${c.reset}` +
      `   実績 ${c.bold}${unlocked}/${r.badges.length}${c.reset}`,
  )
  if (r.questBoard) {
    const q = r.questBoard
    lines.push(
      `  ${c.teal}🗺 クエスト${c.reset} Todo ${c.bold}${q.todo.length}${c.reset} · ` +
        `進行中 ${c.bold}${q.doing.length}${c.reset} · ` +
        `完了 ${c.bold}${q.done.length}${c.reset}` +
        `${c.dim}（クリアEXP +${q.clearedExp}）${c.reset}`,
    )
  }
  const j = r.journey
  const legText = j.next
    ? `${bar(j.progressInStage, 16)} ${c.dim}→ ${j.next.icon}${j.next.name}${c.reset}`
    : `${c.gold}最終地点に到達！${c.reset}`
  lines.push(
    `  ${c.teal}🗺 冒険${c.reset} ${j.current.icon}${c.bold}${j.current.name}${c.reset}  ${legText}`,
  )
  lines.push(
    `  ${c.teal}🏙 街${c.reset} ${r.city.built}/${r.city.total} 棟  ` +
      `${c.dim}${r.city.buildings.map((b) => (b.built ? b.icon : '🚧')).join(' ')}${c.reset}`,
  )
  lines.push(
    `  ${c.dim}総コミット ${r.totalCommits} · マージPR ${r.mergedPRs} · リリース ${r.releases}` +
      (r.daysSinceStart != null ? ` · 開始から ${r.daysSinceStart}日` : '') +
      c.reset,
  )
  lines.push('')
  return lines.join('\n')
}

/** statusline 等で使う 1 行版 */
export function renderStatusline(projectName: string, r: DevReport): string {
  return (
    `${projectName} Lv.${r.level.level} ` +
    `${bar(r.level.progress, 8)} 🔥${r.currentStreak} ⚡+${r.weekExp}EXP/wk`
  )
}
