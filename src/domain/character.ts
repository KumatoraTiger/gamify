/**
 * 活動プロファイルから RPG のキャラクター像を導出する純粋ロジック。
 *
 * - ジョブ（専門）＋アバター: コミット/PR/リリース/連続稼働のうち最も重い活動で決まる
 * - 称号: レベル帯で決まる接頭辞（見習い〜伝説）。次の称号（転職）も出す
 * - ステータス: こうげき/ぼうぎょ/すばやさ/まりょく を各メトリクスから算出
 * - 装備: 武器/防具/アクセサリ/称号 の4枠。tier からレアリティを決める
 *
 * すべて手入力ゼロ・既存の集計値だけで決まる。
 */

export interface CharacterMetrics {
  level: number
  totalCommits: number
  mergedPRs: number
  releases: number
  longestStreak: number
  /** クリア済みクエスト数（まりょくに反映。無ければ0） */
  clearedQuests?: number
}

export type EquipSlot = 'weapon' | 'armor' | 'accessory' | 'title'
export type Rarity = 'R' | 'SR' | 'SSR'

export interface EquipmentPiece {
  slot: EquipSlot
  /** スロットの日本語名 */
  slotLabel: string
  /** スロット種別アイコン（⚔ 🛡 📿 👑） */
  typeIcon: string
  icon: string
  name: string
  /** 0 始まりの段階。大きいほど強い */
  tier: number
  /** +N 表示（tier と同値。0 のときは非表示にする） */
  plus: number
  rarity: Rarity
  /** フレーバーテキスト */
  flavor: string
  /** 何で強化されるかの説明 */
  source: string
}

export type StatKey = 'atk' | 'def' | 'spd' | 'mag'

export interface CharStat {
  key: StatKey
  label: string
  value: number
  /** バー表示用の割合（0〜100） */
  pct: number
}

export interface Character {
  job: string
  jobIcon: string
  avatar: string
  title: string
  fullName: string
  /** 次の称号（転職）。最高帯なら undefined */
  nextTitle?: { title: string; atLevel: number }
  stats: CharStat[]
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
  return { tier: idx, def: tiers[idx] as Tier }
}

interface JobDef {
  job: string
  icon: string
  avatar: string
  score: (m: CharacterMetrics) => number
}

// PR やリリースはコミットより希少なので重み付けして比較する。
const JOBS: JobDef[] = [
  { job: 'コードソードマン', icon: '⚔️', avatar: '🗡️', score: (m) => m.totalCommits },
  { job: '統合の魔導士', icon: '🪄', avatar: '🧙', score: (m) => m.mergedPRs * 3 },
  { job: '出荷の召喚士', icon: '🚀', avatar: '🛸', score: (m) => m.releases * 20 },
  { job: '継続の旅人', icon: '🧭', avatar: '🧗', score: (m) => m.longestStreak * 5 },
]

interface TitleBand {
  min: number
  title: string
}

// レベル帯の称号。昇順（index が大きいほど上位）。
const TITLE_BANDS: TitleBand[] = [
  { min: 1, title: '見習い' },
  { min: 5, title: '駆け出し' },
  { min: 10, title: '一人前' },
  { min: 20, title: '熟練' },
  { min: 35, title: '達人' },
  { min: 50, title: '伝説の' },
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

export function deriveJob(m: CharacterMetrics): { job: string; icon: string; avatar: string } {
  let best = JOBS[0] as JobDef
  let bestScore = best.score(m)
  for (const j of JOBS) {
    const s = j.score(m)
    if (s > bestScore) {
      best = j
      bestScore = s
    }
  }
  return { job: best.job, icon: best.icon, avatar: best.avatar }
}

/** レベル帯の称号（index）を返す。0=見習い 〜 5=伝説の */
function titleIndex(level: number): number {
  let idx = 0
  for (let i = 0; i < TITLE_BANDS.length; i++) {
    const b = TITLE_BANDS[i]
    if (b && level >= b.min) idx = i
  }
  return idx
}

export function deriveTitle(level: number): string {
  return TITLE_BANDS[titleIndex(level)]?.title ?? '見習い'
}

/** 次の称号（転職）。最高帯なら undefined */
export function nextTitle(level: number): { title: string; atLevel: number } | undefined {
  for (const b of TITLE_BANDS) {
    if (b.min > level) return { title: b.title, atLevel: b.min }
  }
  return undefined
}

function rarityOfTier(tier: number): Rarity {
  if (tier >= 4) return 'SSR'
  if (tier >= 2) return 'SR'
  return 'R'
}

const clampPct = (v: number, cap: number): number =>
  Math.max(0, Math.min(100, Math.round((v / cap) * 100)))

function buildStats(m: CharacterMetrics): CharStat[] {
  const mag = (m.clearedQuests ?? 0) + m.releases
  return [
    { key: 'atk', label: 'こうげき', value: m.totalCommits, pct: clampPct(m.totalCommits, 600) },
    { key: 'def', label: 'ぼうぎょ', value: m.mergedPRs, pct: clampPct(m.mergedPRs, 200) },
    { key: 'spd', label: 'すばやさ', value: m.longestStreak, pct: clampPct(m.longestStreak, 30) },
    { key: 'mag', label: 'まりょく', value: mag, pct: clampPct(mag, 20) },
  ]
}

export function buildCharacter(m: CharacterMetrics): Character {
  const { job, icon, avatar } = deriveJob(m)
  const tIdx = titleIndex(m.level)
  const title = TITLE_BANDS[tIdx]?.title ?? '見習い'

  const weapon = pickTier(m.totalCommits, WEAPON_TIERS)
  const armor = pickTier(m.mergedPRs, ARMOR_TIERS)
  const accessory = pickTier(m.longestStreak, ACCESSORY_TIERS)

  const equipment: EquipmentPiece[] = [
    {
      slot: 'weapon',
      slotLabel: '武器',
      typeIcon: '⚔️',
      icon: weapon.def.icon,
      name: weapon.def.name,
      tier: weapon.tier,
      plus: weapon.tier,
      rarity: rarityOfTier(weapon.tier),
      flavor: 'コードを刻むほど鋭くなる相棒',
      source: '総コミット数で強化',
    },
    {
      slot: 'armor',
      slotLabel: '防具',
      typeIcon: '🛡️',
      icon: armor.def.icon,
      name: armor.def.name,
      tier: armor.tier,
      plus: armor.tier,
      rarity: rarityOfTier(armor.tier),
      flavor: 'レビューをくぐるほど頼もしい守り',
      source: 'マージPR数で強化',
    },
    {
      slot: 'accessory',
      slotLabel: 'アクセサリ',
      typeIcon: '📿',
      icon: accessory.def.icon,
      name: accessory.def.name,
      tier: accessory.tier,
      plus: accessory.tier,
      rarity: rarityOfTier(accessory.tier),
      flavor: '連続稼働が続くほど淡く光る',
      source: '最長連続稼働で強化',
    },
    {
      slot: 'title',
      slotLabel: '称号',
      typeIcon: '👑',
      icon: '👑',
      name: title.replace(/の$/, ''),
      tier: tIdx,
      plus: 0,
      rarity: rarityOfTier(tIdx),
      flavor: '積み重ねた者だけが名乗れる誇り',
      source: 'レベル帯で昇格',
    },
  ]

  const joiner = title.endsWith('の') ? '' : 'の'

  return {
    job,
    jobIcon: icon,
    avatar,
    title,
    fullName: `${title}${joiner}${job}`,
    nextTitle: nextTitle(m.level),
    stats: buildStats(m),
    equipment,
  }
}
