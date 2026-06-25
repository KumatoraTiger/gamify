import { describe, expect, it } from 'vitest'
import type { BadgeStatus } from '../badges'
import { buildCity } from '../city'

function badge(name: string, unlocks: string | undefined, unlocked: boolean): BadgeStatus {
  return {
    def: { id: name, name, icon: '🎖️', unlocks, test: () => unlocked },
    unlocked,
  }
}

describe('buildCity', () => {
  it('拠点（開発者の家）は常に建っている', () => {
    const city = buildCity([])
    expect(city.buildings[0]?.name).toBe('開発者の家')
    expect(city.built).toBe(1)
    expect(city.total).toBe(1)
  })

  it('解放済みバッジは建設済み、未解放は工事予定', () => {
    const city = buildCity([
      badge('初リリース', '⛪ チャペル', true),
      badge('コミット500', '🌆 区画拡張', false),
    ])
    const byName = Object.fromEntries(city.buildings.map((b) => [b.name, b]))
    expect(byName['チャペル']?.built).toBe(true)
    expect(byName['チャペル']?.icon).toBe('⛪')
    expect(byName['区画拡張']?.built).toBe(false)
    // 拠点 + チャペル = 2 built、合計 3
    expect(city.built).toBe(2)
    expect(city.total).toBe(3)
  })

  it('unlocks の無いバッジは建物を生まない', () => {
    const city = buildCity([badge('名もなき実績', undefined, true)])
    expect(city.total).toBe(1) // 拠点のみ
  })

  it('from に解放元バッジ名が入る', () => {
    const city = buildCity([badge('初リリース', '⛪ チャペル', true)])
    const chapel = city.buildings.find((b) => b.name === 'チャペル')
    expect(chapel?.from).toBe('初リリース')
  })
})
