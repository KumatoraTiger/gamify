import { describe, expect, it } from 'vitest'
import { type CharacterMetrics, buildCharacter, deriveJob, deriveTitle } from '../character'

const base: CharacterMetrics = {
  level: 1,
  totalCommits: 0,
  mergedPRs: 0,
  releases: 0,
  longestStreak: 0,
}

describe('deriveJob', () => {
  it('コミットが支配的なら剣士', () => {
    expect(deriveJob({ ...base, totalCommits: 421, mergedPRs: 121 }).job).toBe('コードソードマン')
  })

  it('PR が重み付きで上回れば魔導士', () => {
    // pr*3 > commits
    expect(deriveJob({ ...base, totalCommits: 10, mergedPRs: 50 }).job).toBe('統合の魔導士')
  })

  it('リリースが重み付きで突出すれば召喚士', () => {
    expect(deriveJob({ ...base, totalCommits: 5, releases: 10 }).job).toBe('出荷の召喚士')
  })

  it('連続稼働が突出すれば旅人', () => {
    expect(deriveJob({ ...base, totalCommits: 3, longestStreak: 30 }).job).toBe('継続の旅人')
  })
})

describe('deriveTitle', () => {
  it('レベル帯で称号が変わる', () => {
    expect(deriveTitle(1)).toBe('見習い')
    expect(deriveTitle(5)).toBe('駆け出し')
    expect(deriveTitle(15)).toBe('一人前')
    expect(deriveTitle(20)).toBe('熟練')
    expect(deriveTitle(35)).toBe('達人')
    expect(deriveTitle(50)).toBe('伝説の')
  })
})

describe('buildCharacter', () => {
  it('称号とジョブを連結する', () => {
    const c = buildCharacter({ ...base, level: 15, totalCommits: 421 })
    expect(c.fullName).toBe('一人前のコードソードマン')
  })

  it('伝説帯（称号が「の」で終わる）は「のの」にならない', () => {
    const c = buildCharacter({ ...base, level: 55, totalCommits: 100 })
    expect(c.fullName).toBe('伝説のコードソードマン')
    expect(c.fullName.includes('のの')).toBe(false)
  })

  it('装備3スロットをメトリクスで段階化する', () => {
    const c = buildCharacter({
      ...base,
      level: 15,
      totalCommits: 421,
      mergedPRs: 121,
      longestStreak: 9,
    })
    const bySlot = Object.fromEntries(c.equipment.map((e) => [e.slot, e]))
    expect(bySlot.weapon?.name).toBe('騎士の長剣') // 350<=421<700
    expect(bySlot.armor?.name).toBe('板金鎧') // 60<=121<150
    expect(bySlot.accessory?.name).toBe('炎の護符') // 7<=9<21
    expect(c.equipment).toHaveLength(3)
  })

  it('活動ゼロでも最低段階の装備が付く', () => {
    const c = buildCharacter(base)
    expect(c.equipment.every((e) => e.tier === 0)).toBe(true)
    expect(c.equipment.map((e) => e.name)).toEqual(['木の枝', '布の服', '旅の指輪'])
  })
})
