/**
 * 活動プロファイルから RPG のキャラクター像を導出する純粋ロジック。
 *
 * - ジョブ（専門）: コミット / PR / リリース / 連続稼働 のうち最も重みの大きい活動で決まる
 * - 称号: レベル帯で決まる接頭辞（見習い〜伝説）
 * - 装備: 各スロット（武器/防具/装飾）を対応メトリクスのしきい値で段階化する
 *
 * すべて手入力ゼロ・既存の集計値だけで決まる。
 */

export interface CharacterMetrics {
  level: number
  totalCommits: number
  mergedPRs: number
  releases: number
  longestStreak: number
}

export type EquipSlot = 'weapon' | 'armor' | 'accessory'

export interface EquipmentPiece {
  slot: EquipSlot
  /** スロットの日本語名 */
  slotLabel: string
  icon: string
  name: string
  /** 0 始まりの段階。大きいほど強い */
  tier: number
  /** 何で強化されるかの説明 */
  source: string
}

export interface Character {
  /** ジョブ名（専門） */
  job: string
  jobIcon: string
  /** レベル帯の称号（例: 一人前） */
  title: string
  /** 称号 + ジョブ（例: 一人前のコードソードマン） */
  fullName: string
  equipment: EquipmentPiece[]
}

interface Tier {
  min: number
  name: string
  icon: string
}

/** value 以下で最大の min を持つ段階を選び、その index を tier とする */
function pickTier(value: number, tiers: Tier[]): { tier: number; def: Tier } {
  let idx = 0
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i]
    if (t && value >= t.min) idx = i
  }
  // tiers は必ず min:0 を含む前提なので idx は常に有効
  return { tier: idx, def: tiers[idx] as Tier }
}

interface JobDef {
  job: string
  icon: string
  score: (m: CharacterMetrics) => number
}

// PR やリリースはコミットより希少なので重み付けして比較する。
const JOBS: JobDef[] = [
  { job: 'コードソードマン', icon: '⚔️', score: (m) => m.totalCommits },
  { job: '統合の魔導士', icon: '🪄', score: (m) => m.mergedPRs * 3 },
  { job: '出荷の召喚士', icon: '🚀', score: (m) => m.releases * 20 },
  { job: '継続の旅人', icon: '🧭', score: (m) => m.longestStreak * 5 },
]

interface TitleBand {
  min: number
  title: string
}

// レベル帯の称号。降順に評価する。
const TITLE_BANDS: TitleBand[] = [
  { min: 50, title: '伝説の' },
  { min: 35, title: '達人' },
  { min: 20, title: '熟練' },
  { min: 10, title: '一人前' },
  { min: 5, title: '駆け出し' },
  { min: 1, title: '見習い' },
]

const WEAPON_TIERS: Tier[] = [
  { min: 0, name: '木の枝', icon: '🪵' },
  { min: 30, name: '銅の短剣', icon: '🗡️' },
  { min: 120, name: '鋼の剣', icon: '⚔️' },
  { min: 350, name: '騎士の長剣', icon: '🤺' },
  { min: 700, name: '業物の太刀', icon: '🌟' },
  { min: 1200, name: '伝説の聖剣', icon: '✨' },
]

const ARMOR_TIERS: Tier[] = [
  { min: 0, name: '布の服', icon: '👕' },
  { min: 5, name: '革の鎧', icon: '🧥' },
  { min: 20, name: '鎖帷子', icon: '🦺' },
  { min: 60, name: '板金鎧', icon: '🛡️' },
  { min: 150, name: '竜鱗の鎧', icon: '🐲' },
]

const ACCESSORY_TIERS: Tier[] = [
  { min: 0, name: '旅の指輪', icon: '💍' },
  { min: 3, name: '集中の数珠', icon: '📿' },
  { min: 7, name: '炎の護符', icon: '🔥' },
  { min: 21, name: '不屈の紋章', icon: '🎖️' },
  { min: 60, name: '賢者の宝珠', icon: '🔮' },
]

export function deriveJob(m: CharacterMetrics): { job: string; icon: string } {
  let best = JOBS[0] as JobDef
  let bestScore = best.score(m)
  for (const j of JOBS) {
    const s = j.score(m)
    if (s > bestScore) {
      best = j
      bestScore = s
    }
  }
  return { job: best.job, icon: best.icon }
}

export function deriveTitle(level: number): string {
  for (const b of TITLE_BANDS) {
    if (level >= b.min) return b.title
  }
  return '見習い'
}

export function buildCharacter(m: CharacterMetrics): Character {
  const { job, icon } = deriveJob(m)
  const title = deriveTitle(m.level)

  const weapon = pickTier(m.totalCommits, WEAPON_TIERS)
  const armor = pickTier(m.mergedPRs, ARMOR_TIERS)
  const accessory = pickTier(m.longestStreak, ACCESSORY_TIERS)

  const equipment: EquipmentPiece[] = [
    {
      slot: 'weapon',
      slotLabel: '武器',
      icon: weapon.def.icon,
      name: weapon.def.name,
      tier: weapon.tier,
      source: '総コミット数で強化',
    },
    {
      slot: 'armor',
      slotLabel: '防具',
      icon: armor.def.icon,
      name: armor.def.name,
      tier: armor.tier,
      source: 'マージPR数で強化',
    },
    {
      slot: 'accessory',
      slotLabel: '装飾',
      icon: accessory.def.icon,
      name: accessory.def.name,
      tier: accessory.tier,
      source: '最長連続稼働で強化',
    },
  ]

  // 称号が「の」で終わる場合（例: 伝説の）は連結の「の」を重ねない
  const joiner = title.endsWith('の') ? '' : 'の'

  return {
    job,
    jobIcon: icon,
    title,
    fullName: `${title}${joiner}${job}`,
    equipment,
  }
}
