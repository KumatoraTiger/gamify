/**
 * 街。バッジの解放状況から「建てられた建物」を導出する純粋ロジック。
 *
 * 各バッジの `unlocks`（例: "⛪ チャペル"）を建物に対応させ、
 * バッジが解放済みなら建設済み・未解放なら工事予定として扱う。
 * unlocks 未設定のバッジは建物を生まない。
 */

import type { BadgeStatus } from './badges'

export interface CityBuilding {
  icon: string
  name: string
  built: boolean
  /** この建物を解放するバッジ名 */
  from: string
}

export interface CityState {
  buildings: CityBuilding[]
  built: number
  total: number
}

// 常設の拠点。バッジが何も無くても街の中心として最初から建っている。
const BASE_BUILDINGS: CityBuilding[] = [
  { icon: '🏠', name: '開発者の家', built: true, from: '拠点' },
]

/** "⛪ チャペル" のような unlocks 文字列を icon と name に分解する */
function parseUnlocks(unlocks: string): { icon: string; name: string } {
  const trimmed = unlocks.trim()
  const sp = trimmed.indexOf(' ')
  if (sp === -1) return { icon: '🏗️', name: trimmed }
  return { icon: trimmed.slice(0, sp), name: trimmed.slice(sp + 1).trim() }
}

export function buildCity(badges: BadgeStatus[]): CityState {
  const fromBadges: CityBuilding[] = badges
    .filter((b) => b.def.unlocks)
    .map((b) => {
      const { icon, name } = parseUnlocks(b.def.unlocks as string)
      return { icon, name, built: b.unlocked, from: b.def.name }
    })

  const buildings = [...BASE_BUILDINGS, ...fromBadges]
  const built = buildings.filter((b) => b.built).length
  return { buildings, built, total: buildings.length }
}
