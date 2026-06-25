/**
 * レポートを単体で開ける HTML ダッシュボード（cockpit）に整形する。
 * v1 はデータ中心コア（Lv/EXP・週次・バッジ）。キャラ/装備/冒険マップ/街は次段階。
 */

import type { DevReport } from '../domain/report'

const esc = (s: string): string =>
  s.replace(
    /[&<>"]/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch,
  )

function sparkBars(values: number[]): string {
  const max = Math.max(1, ...values)
  return values
    .map((v) => `<i style="height:${Math.max(6, Math.round((v / max) * 100))}%"></i>`)
    .join('')
}

function badgeCells(badges: DevReport['badges']): string {
  return badges
    .map((b) => {
      const cls = b.unlocked ? 'badge' : 'badge locked'
      const sub = b.unlocked ? (b.def.unlocks ? `→ ${esc(b.def.unlocks)}` : '解放') : '未解放'
      return `<div class="${cls}"><div class="ico">${b.def.icon}</div><div class="bn">${esc(
        b.def.name,
      )}</div><div class="bw">${esc(sub)}</div></div>`
    })
    .join('')
}

function questColumn(
  title: string,
  cls: string,
  quests: NonNullable<DevReport['questBoard']>['todo'],
): string {
  const cards =
    quests
      .map(
        (q) =>
          `<div class="qcard"><div class="qh"><span class="chip ${q.type}">${
            q.type === 'main' ? 'Main' : 'Sub'
          }</span><span class="qx">+${q.exp}</span></div><div class="qt"><span class="qn">#${
            q.number
          }</span> ${esc(q.title)}</div></div>`,
      )
      .join('') || '<div class="empty">なし</div>'
  return `<div class="col ${cls}"><div class="colh"><span class="ct">${title}</span><span class="cn">${quests.length}</span></div>${cards}</div>`
}

function questBoardSection(r: DevReport): string {
  const b = r.questBoard
  if (!b) return ''
  return `
  <div class="sh"><h2>クエストボード</h2><span class="line"></span><span class="hint">GitHub Projects · クリアEXP +${b.clearedExp}</span></div>
  <div class="board">
    ${questColumn('Todo', 'todo', b.todo)}
    ${questColumn('In Progress', 'prog', b.doing)}
    ${questColumn('Done', 'done', b.done)}
  </div>`
}

function equipmentRow(eq: DevReport['character']['equipment']): string {
  return eq
    .map(
      (e) =>
        `<div class="eq"><span class="eqi">${e.icon}</span><div class="eqm"><div class="eqs">${esc(
          e.slotLabel,
        )}</div><div class="eqn">${esc(e.name)} <span class="eqt">+${e.tier}</span></div></div></div>`,
    )
    .join('')
}

function stageTrack(j: DevReport['journey']): string {
  return j.stages
    .map((s) => {
      const cls = s.current ? 'st current' : s.reached ? 'st reached' : 'st'
      return `<div class="${cls}"><span class="sti">${s.icon}</span><span class="stn">${esc(
        s.name,
      )}</span><span class="stl">Lv.${s.requiredLevel}</span></div>`
    })
    .join('<span class="stsep"></span>')
}

function climbMap(j: DevReport['journey']): string {
  if (!j.next)
    return '<div class="climb-done">🏁 最終ステージ「' + esc(j.current.name) + '」到達！</div>'
  const pct = (j.progressInStage * 100).toFixed(1)
  const dots = j.waypoints
    .map((w) => {
      const cls = w.here ? 'wp here' : w.reached ? 'wp reached' : 'wp'
      return `<i class="${cls}" style="left:${(w.pos * 100).toFixed(2)}%" title="Lv.${w.level}"></i>`
    })
    .join('')
  return `
  <div class="climb">
    <div class="climb-ends"><span>${j.current.icon} ${esc(j.current.name)}</span><span class="nx">${
      j.next.icon
    } ${esc(j.next.name)}</span></div>
    <div class="track"><span class="fill" style="width:${pct}%"></span>${dots}<span class="hiker" style="left:${pct}%">🧗</span></div>
    <div class="climb-foot"><span>Lv.${j.current.requiredLevel}</span><span class="mid">この区間 ${pct}%</span><span>Lv.${j.next.requiredLevel}</span></div>
  </div>`
}

function cityGrid(city: DevReport['city']): string {
  return city.buildings
    .map((b) => {
      const cls = b.built ? 'bd' : 'bd locked'
      const ic = b.built ? b.icon : '🚧'
      const sub = b.built ? esc(b.from) : `${esc(b.from)}で解放`
      return `<div class="${cls}"><div class="bdi">${ic}</div><div class="bdn">${esc(
        b.name,
      )}</div><div class="bdf">${sub}</div></div>`
    })
    .join('')
}

export function renderHtml(projectName: string, r: DevReport): string {
  const lv = r.level
  const pct = (lv.progress * 100).toFixed(1)
  const unlocked = r.badges.filter((b) => b.unlocked).length
  const gen = r.generatedAt
  const genStr = `${gen.getFullYear()}-${String(gen.getMonth() + 1).padStart(2, '0')}-${String(
    gen.getDate(),
  ).padStart(2, '0')}`

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(projectName)} / DEV COCKPIT</title>
<style>
  :root{--ink:#15171E;--panel:#1D202A;--raised:#242837;--border:#2E3342;--text:#ECEAE3;--muted:#8B8E9B;--faint:#5A5E6C;--gold:#E6B450;--gold-dim:#8A6E32;--coral:#E8794A;--teal:#57B894;--mono:ui-monospace,"SF Mono",Menlo,monospace;--sans:ui-sans-serif,system-ui,"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif}
  *{box-sizing:border-box}
  body{margin:0;color:var(--text);font-family:var(--sans);line-height:1.5;-webkit-font-smoothing:antialiased;background:radial-gradient(1100px 520px at 85% -10%,rgba(230,180,80,.06),transparent 60%),var(--ink)}
  .wrap{max-width:1000px;margin:0 auto;padding:38px 24px 64px}
  .topbar{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:24px}
  .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold)}
  .topbar h1{font-family:var(--mono);font-size:18px;font-weight:600;margin:6px 0 0}
  .topbar .date{font-family:var(--mono);font-size:12px;color:var(--muted)}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:14px}
  .hero{display:grid;grid-template-columns:auto 1fr;gap:26px;align-items:center;padding:28px 30px;margin-bottom:16px}
  .lvl{display:flex;flex-direction:column;align-items:center;justify-content:center;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at 50% 35%,#2c3043,#1a1d27);border:2px solid var(--gold);box-shadow:0 0 0 7px rgba(230,180,80,.08)}
  .lvl .t{font-family:var(--mono);font-size:11px;letter-spacing:.2em;color:var(--gold)}
  .lvl .n{font-family:var(--mono);font-size:52px;font-weight:700;line-height:1}
  .rank{font-size:22px;font-weight:700;margin:0 0 3px}
  .since{font-family:var(--mono);font-size:12px;color:var(--faint);margin-bottom:16px}
  .exprow{display:flex;justify-content:space-between;font-family:var(--mono);font-size:13px;color:var(--muted);margin-bottom:7px}
  .exprow .now{color:var(--gold)}.exprow b{color:var(--text)}
  .bar{height:13px;border-radius:7px;background:#11131a;border:1px solid var(--border);overflow:hidden}
  .bar>span{display:block;height:100%;background:linear-gradient(90deg,var(--gold-dim),var(--gold));box-shadow:0 0 10px rgba(230,180,80,.4)}
  .breakdown{display:flex;gap:20px;margin-top:16px}
  .breakdown .bn{font-family:var(--mono);font-size:16px;font-weight:700}
  .breakdown .bl{font-family:var(--mono);font-size:11px;color:var(--faint)}
  .sh{display:flex;align-items:baseline;gap:12px;margin:28px 2px 14px}
  .sh h2{font-family:var(--mono);font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;margin:0}
  .sh .line{flex:1;height:1px;background:var(--border)}
  .sh .hint{font-family:var(--mono);font-size:11px;color:var(--faint)}
  .pulse{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  .pulse .s{background:var(--panel);border:1px solid var(--border);border-radius:13px;padding:16px 17px}
  .pulse .s .k{font-family:var(--mono);font-size:11px;color:var(--muted)}
  .pulse .s .v{font-family:var(--mono);font-size:32px;font-weight:700;margin-top:8px;line-height:1}
  .pulse .s .v span{font-size:13px;color:var(--muted);font-weight:500}
  .pulse .s.fire .v{color:var(--coral)}.pulse .s.xp .v{color:var(--gold)}
  .spark{display:flex;align-items:flex-end;gap:3px;height:30px;margin-top:12px}
  .spark i{flex:1;border-radius:2px;min-height:3px;background:rgba(230,180,80,.5)}
  .badges{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
  .badge{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px 8px 13px;text-align:center}
  .badge .ico{font-size:26px;line-height:1}
  .badge .bn{font-family:var(--mono);font-size:11px;margin-top:9px}
  .badge .bw{font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:3px}
  .badge.locked{opacity:.4}.badge.locked .ico{filter:grayscale(1) brightness(.7)}
  .note{font-family:var(--mono);font-size:11.5px;color:var(--muted);background:var(--panel);border:1px dashed var(--border);border-radius:12px;padding:14px 16px;margin-top:14px}
  .note b{color:var(--text)}
  .board{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .col{background:var(--panel);border:1px solid var(--border);border-radius:13px;padding:14px}
  .colh{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}
  .colh .ct{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase}
  .col.todo .ct{color:var(--muted)}.col.prog .ct{color:var(--gold)}.col.done .ct{color:var(--teal)}
  .colh .cn{font-family:var(--mono);font-size:12px;color:var(--faint)}
  .qcard{background:var(--raised);border:1px solid var(--border);border-radius:9px;padding:10px 12px;margin-bottom:9px}
  .qcard:last-child{margin-bottom:0}
  .qh{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
  .chip{font-family:var(--mono);font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;text-transform:uppercase}
  .chip.main{color:var(--gold);background:rgba(230,180,80,.12);border:1px solid var(--gold-dim)}
  .chip.sub{color:var(--muted);background:rgba(139,142,155,.1);border:1px solid var(--border)}
  .qx{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--gold)}
  .col.done .qx{color:var(--teal)}
  .qt{font-size:13px;line-height:1.4}
  .qn{font-family:var(--mono);font-size:11px;color:var(--faint)}
  .col.done .qt{text-decoration:line-through;text-decoration-color:var(--faint)}
  .empty{font-family:var(--mono);font-size:11px;color:var(--faint);padding:6px 2px}
  /* 装備 */
  .equip{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}
  .eq{display:flex;align-items:center;gap:11px;background:var(--raised);border:1px solid var(--border);border-radius:11px;padding:11px 13px}
  .eqi{font-size:24px;line-height:1}
  .eqs{font-family:var(--mono);font-size:10px;color:var(--faint);letter-spacing:.1em}
  .eqn{font-size:13px;font-weight:600;margin-top:2px}
  .eqt{font-family:var(--mono);font-size:11px;color:var(--gold);font-weight:700}
  /* 冒険マップ */
  .journey{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px 22px}
  .stages{display:flex;align-items:stretch;gap:0;overflow-x:auto;padding-bottom:6px}
  .st{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:74px;opacity:.4}
  .st.reached{opacity:.75}
  .st.current{opacity:1}
  .sti{font-size:24px;line-height:1;filter:grayscale(1) brightness(.8)}
  .st.reached .sti,.st.current .sti{filter:none}
  .st.current .sti{transform:scale(1.25)}
  .stn{font-size:11px;text-align:center;line-height:1.25}
  .st.current .stn{color:var(--gold);font-weight:700}
  .stl{font-family:var(--mono);font-size:10px;color:var(--faint)}
  .stsep{flex:1;min-width:14px;height:2px;align-self:flex-start;margin-top:13px;background:var(--border)}
  .climb{margin-top:20px;padding-top:18px;border-top:1px dashed var(--border)}
  .climb-ends{display:flex;justify-content:space-between;font-family:var(--mono);font-size:12px;color:var(--muted);margin-bottom:10px}
  .climb-ends .nx{color:var(--gold)}
  .track{position:relative;height:14px;border-radius:8px;background:#11131a;border:1px solid var(--border);margin:14px 0 12px}
  .track .fill{position:absolute;left:0;top:0;bottom:0;border-radius:8px;background:linear-gradient(90deg,var(--gold-dim),var(--gold));box-shadow:0 0 10px rgba(230,180,80,.4)}
  .track .wp{position:absolute;top:50%;width:7px;height:7px;border-radius:50%;background:#11131a;border:1px solid var(--faint);transform:translate(-50%,-50%)}
  .track .wp.reached{background:var(--gold);border-color:var(--gold)}
  .track .wp.here{width:0;height:0;border:0}
  .track .hiker{position:absolute;top:50%;transform:translate(-50%,-58%);font-size:18px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}
  .climb-foot{display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px;color:var(--faint)}
  .climb-foot .mid{color:var(--gold)}
  .climb-done{font-family:var(--mono);font-size:13px;color:var(--gold);text-align:center;padding:8px}
  /* 街 */
  .city{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .bd{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px 8px 12px;text-align:center}
  .bdi{font-size:30px;line-height:1}
  .bdn{font-size:12px;font-weight:600;margin-top:8px}
  .bdf{font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:3px}
  .bd.locked{opacity:.45;border-style:dashed}
  @media(max-width:760px){.hero{grid-template-columns:1fr;justify-items:center;text-align:center}.pulse{grid-template-columns:repeat(2,1fr)}.badges{grid-template-columns:repeat(3,1fr)}.board{grid-template-columns:1fr}.equip{grid-template-columns:1fr}.city{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <div><span class="eyebrow">Dev Cockpit</span><h1>${esc(projectName)}</h1></div>
    <span class="date">${genStr} 集計</span>
  </div>

  <div class="card hero">
    <div class="lvl"><span class="t">LV</span><span class="n">${lv.level}</span></div>
    <div>
      <p class="rank">${r.character.jobIcon} ${esc(r.character.fullName)} <span style="font-family:var(--mono);font-size:13px;font-weight:500;color:var(--muted)">/ Lv.${lv.level}</span></p>
      <div class="since">${r.daysSinceStart != null ? `冒険開始から ${r.daysSinceStart} 日 · ` : ''}累計 ${lv.totalExp} EXP</div>
      <div class="exprow"><span class="now">EXP <b>${lv.totalExp}</b> / ${lv.nextLevelAt}</span><span>次のレベルまで <b>${lv.toNext}</b></span></div>
      <div class="bar"><span style="width:${pct}%"></span></div>
      <div class="breakdown">
        <div><div class="bn">${r.totalCommits}</div><div class="bl">総コミット</div></div>
        <div><div class="bn">${r.mergedPRs}</div><div class="bl">マージPR</div></div>
        <div><div class="bn">${r.releases}</div><div class="bl">リリース</div></div>
        <div><div class="bn">${unlocked} / ${r.badges.length}</div><div class="bl">実績解除</div></div>
      </div>
    </div>
  </div>

  <div class="sh"><h2>装備</h2><span class="line"></span><span class="hint">活動量で自動強化</span></div>
  <div class="equip">${equipmentRow(r.character.equipment)}</div>

  <div class="sh"><h2>冒険マップ</h2><span class="line"></span><span class="hint">レベルで次の地へ進む</span></div>
  <div class="journey">
    <div class="stages">${stageTrack(r.journey)}</div>
    ${climbMap(r.journey)}
  </div>

  <div class="sh"><h2>今週のアクティビティ</h2><span class="line"></span><span class="hint">git + gh から自動集計</span></div>
  <div class="pulse">
    <div class="s fire"><div class="k">🔥 ストリーク</div><div class="v">${r.currentStreak}<span> 日</span></div></div>
    <div class="s"><div class="k">コミット / 週</div><div class="v">${r.weekCommits}</div><div class="spark">${sparkBars(r.dailyCommitCounts)}</div></div>
    <div class="s"><div class="k">マージPR / 週</div><div class="v">${r.weekPRs}</div></div>
    <div class="s xp"><div class="k">獲得EXP / 週</div><div class="v">+${r.weekExp}</div></div>
  </div>

${questBoardSection(r)}

  <div class="sh"><h2>実績バッジ</h2><span class="line"></span><span class="hint">${unlocked} / ${r.badges.length} 解除 · 街の建物が増える</span></div>
  <div class="badges">${badgeCells(r.badges)}</div>

  <div class="sh"><h2>街</h2><span class="line"></span><span class="hint">${r.city.built} / ${r.city.total} 棟 · バッジ解放で発展</span></div>
  <div class="city">${cityGrid(r.city)}</div>

  <div class="note">🧭 すべて git / gh / GitHub Projects から自動集計。クエストの Size を設定すると EXP が増えます（XS=10〜XL=200、未設定は30）。装備・街・冒険マップは活動量とバッジで自動的に育ちます。</div>
</div>
</body>
</html>
`
}
