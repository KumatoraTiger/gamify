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
  @media(max-width:760px){.hero{grid-template-columns:1fr;justify-items:center;text-align:center}.pulse{grid-template-columns:repeat(2,1fr)}.badges{grid-template-columns:repeat(3,1fr)}.board{grid-template-columns:1fr}}
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
      <p class="rank">コードウィザード <span style="font-family:var(--mono);font-size:13px;font-weight:500;color:var(--muted)">/ Lv.${lv.level}</span></p>
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

  <div class="note">🧭 <b>冒険マップ / キャラ・装備 / 街</b> は次段階。クエスト（GitHub Projects）はレベルに反映済み。Size を設定すると EXP が増えます（XS=10〜XL=200、未設定は30）。</div>
</div>
</body>
</html>
`
}
