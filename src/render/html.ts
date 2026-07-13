/**
 * レポートを単体で開ける HTML ダッシュボード（cockpit）に整形する。
 * レベル/キャラ・ステータス・装備・勢い(EXP/レベル推移)・冒険マップ(登山)・街(スカイライン)・
 * 週次アクティビティ・クエスト・バッジを描画する。すべて実データ駆動。
 */

import type { Character } from '../domain/character'
import type { CityState } from '../domain/city'
import type { JourneyState, Terrain } from '../domain/journey'
import type { LevelInfo } from '../domain/level'
import type { MomentumSeries, PeriodKey } from '../domain/momentum'
import type { DevReport } from '../domain/report'

const esc = (s: string): string =>
  s.replace(
    /[&<>"]/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch,
  )

const nf = (n: number): string => n.toLocaleString('en-US')

function sparkBars(values: number[]): string {
  const max = Math.max(1, ...values)
  return values
    .map((v) => `<i style="height:${Math.max(6, Math.round((v / max) * 100))}%"></i>`)
    .join('')
}

/* ===== キャラクター ===== */
function statBars(stats: Character['stats']): string {
  return stats
    .map(
      (s) =>
        `<div class="st ${s.key}"><span class="sl">${esc(s.label)}</span><span class="strack"><i style="width:${s.pct}%"></i></span><span class="sv">${s.value}</span></div>`,
    )
    .join('')
}

function characterCard(ch: Character): string {
  const titleShort = ch.title.replace(/の$/, '')
  const next = ch.nextTitle
    ? `次の称号まで Lv.${ch.nextTitle.atLevel}（→ ${esc(ch.nextTitle.title.replace(/の$/, ''))}）`
    : '最高位に到達'
  return `
    <div class="card charcard">
      <div class="avatar">${ch.avatar}</div>
      <div class="charinfo">
        <div class="cls">あなた <span class="jobtag">ジョブ: ${esc(ch.job)}</span></div>
        <div class="ctit">称号「${esc(titleShort)}」</div>
        <div class="job-next">${next}</div>
        <div class="stats">${statBars(ch.stats)}</div>
      </div>
    </div>`
}

/* ===== 装備 ===== */
function equipmentSlots(eq: Character['equipment']): string {
  return eq
    .map((e) => {
      const plus = e.plus > 0 ? ` <span class="splus">+${e.plus}</span>` : ''
      const rar = e.rarity.toLowerCase()
      return `
    <div class="slot">
      <div class="stype">${e.typeIcon} ${esc(e.slotLabel)}</div>
      <div class="srow"><span class="sico">${e.icon}</span><div><div class="sname">${esc(
        e.name,
      )}${plus}</div><span class="rar ${rar}">${e.rarity}</span></div></div>
      <div class="src">${esc(e.flavor)}</div>
    </div>`
    })
    .join('')
}

/* ===== 勢い（Momentum）===== */
const MOM_W = 800
const MOM_H = 170
const MOM_BASE = 140
const MOM_TOP = 18

/** 勢いチャートの指標（EXP累計 / レベル推移）。先頭がデフォルト表示 */
type MetricKey = 'exp' | 'lv'
const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'exp', label: 'EXP', color: '#E6B450' },
  { key: 'lv', label: 'レベル', color: '#5FA8D8' },
]
/** 期間タブの初期選択（勢いは直近1ヶ月をデフォルト表示にする） */
const DEFAULT_PERIOD: PeriodKey = '1m'

// y軸の「きりのいい」XP目盛りを ~3 区切りで求める。
function niceYTicks(min: number, max: number): number[] {
  const range = max - min
  if (range <= 0) return [max]
  const rough = range / 3
  const mag = 10 ** Math.floor(Math.log10(rough))
  const norm = rough / mag
  const stepUnit = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  const step = stepUnit * mag
  const ticks: number[] = []
  const start = Math.ceil(min / step) * step
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v))
  return ticks
}

// y軸の整数レベル目盛りを ~4 区切りで求める（レベル表示用）。
function niceLevelTicks(min: number, max: number): number[] {
  const lo = Math.floor(min)
  const hi = Math.ceil(max)
  const range = hi - lo
  if (range <= 0) return [Math.round(min)]
  const step = Math.max(1, Math.round(range / 4))
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)
  return ticks
}

// 1期間×1指標ぶんの折れ線チャート（mview divごと）を描く。
// 折れ線は指標の下端〜上端（期間開始時点〜今）の範囲を縦幅いっぱいに使う。
// y軸目盛り(HTML)とホバー用オーバーレイ(cross/dot/tip)、ホバー用の座標データを持たせる。
function momentumChart(s: MomentumSeries, metric: MetricKey): string {
  const m = s.momentum
  const isLv = metric === 'lv'
  const color = isLv ? '#5FA8D8' : '#E6B450'
  const W = MOM_W
  const base = MOM_BASE
  const top = MOM_TOP
  const mid = (base + top) / 2
  const gid = `mg-${s.key}-${metric}`
  const span = m.endMs - m.startMs || 1
  const minV = isLv ? m.minLv : m.minExp
  const maxV = isLv ? m.maxLv : m.maxExp
  const rng = maxV - minV
  const valOf = (p: (typeof m.points)[number]): number => (isLv ? (p.lv ?? 1) : p.exp)
  const yOf = (v: number): number => (rng > 0 ? base - ((v - minV) / rng) * (base - top) : mid)
  const xy = m.points.map((p) => [((p.tMs - m.startMs) / span) * W, yOf(valOf(p))] as const)
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const first = xy[0] ?? [0, base]
  const lastP = xy[xy.length - 1] ?? [W, base]
  const area = `${first[0].toFixed(1)},${base} ${line} ${lastP[0].toFixed(1)},${base}`

  // y軸: きりのいい値で水平グリッド＋ラベル（EXP は数値、レベルは Lv.N）
  let hGrid = ''
  let yLabels = ''
  const ticks = isLv ? niceLevelTicks(minV, maxV) : niceYTicks(minV, maxV)
  for (const t of ticks) {
    const ty = rng > 0 ? base - ((t - minV) / rng) * (base - top) : mid
    if (ty < top - 1 || ty > base + 1) continue
    hGrid += `<line x1="0" y1="${ty.toFixed(1)}" x2="${W}" y2="${ty.toFixed(1)}" stroke="#2E3342" stroke-dasharray="3 6"/>`
    yLabels += `<span class="ytick" style="top:${ty.toFixed(1)}px">${isLv ? `Lv.${t}` : nf(t)}</span>`
  }

  const vGrid = m.months
    .map((mo) => {
      const x = (mo.pos * W).toFixed(1)
      return `<line x1="${x}" y1="${top}" x2="${x}" y2="${base}" stroke="#2E3342" stroke-dasharray="2 7" opacity="0.6"/>`
    })
    .join('')

  // x軸ラベル（月が多い場合は間引き）
  const step = Math.max(1, Math.ceil(m.months.length / 6))
  const picked = m.months.filter((_, i) => i % step === 0)
  const axis = `<span>開始</span>${picked.map((mo) => `<span>${esc(mo.label)}</span>`).join('')}<span>今</span>`

  // ホバー用: [viewBox x, viewBox y, 表示値, 時刻ms] の並び。JS が最近傍点を引く。
  // 表示値は EXP は累計EXP、レベルは整数レベル（小数を切り捨て）。
  const dp = m.points.map((p, i) => [
    Number(xy[i]![0].toFixed(1)),
    Number(xy[i]![1].toFixed(1)),
    isLv ? Math.floor(valOf(p)) : p.exp,
    p.tMs,
  ])

  return `
  <div class="mview mv-${s.key} met-${metric}" data-metric="${metric}" data-points='${JSON.stringify(dp)}'>
    <div class="yaxis">${yLabels}</div>
    <span class="mcross"></span><span class="mdot"></span><span class="mtip"></span>
    <svg viewBox="0 0 ${W} ${MOM_H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity="0.32"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="#2E3342"/>
      ${hGrid}
      ${vGrid}
      <polygon points="${area}" fill="url(#${gid})"/>
      <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.6"/>
      <circle cx="${lastP[0].toFixed(1)}" cy="${lastP[1].toFixed(1)}" r="4.5" fill="${color}"/>
    </svg>
    <div class="xaxis">${axis}</div>
  </div>`
}

// 期間タブ＋指標タブ付きの勢いカード。全期間×全指標を事前描画し、CSSラジオで切り替える。
// 折れ線ホバーのツールチップだけ末尾のインラインJS（momentumHoverScript）が担当する。
function momentumCard(series: MomentumSeries[], level: LevelInfo): string {
  if (series.length === 0) return ''
  // 大きな数字（現在の累計）と今週デルタは期間非依存なので先頭系列から取る
  const head = series[0]!.momentum
  const up = head.weekDelta >= 0
  const chg = `${up ? '▲' : '▼'} ${up ? '+' : ''}${head.weekDelta} XP (${up ? '+' : ''}${head.weekPct.toFixed(1)}%) 今週`

  const pRadios = series
    .map(
      (s) =>
        `<input class="mr" type="radio" name="mrange" id="mr-${s.key}"${s.key === DEFAULT_PERIOD ? ' checked' : ''}>`,
    )
    .join('')
  const mRadios = METRICS.map(
    (mt, i) =>
      `<input class="mr" type="radio" name="mmetric" id="mm-${mt.key}"${i === 0 ? ' checked' : ''}>`,
  ).join('')
  const pLabels = series
    .map((s) => `<label for="mr-${s.key}" class="r-${s.key}">${esc(s.label)}</label>`)
    .join('')
  const mLabels = METRICS.map(
    (mt) => `<label for="mm-${mt.key}" class="rm-${mt.key}">${esc(mt.label)}</label>`,
  ).join('')
  const views = series.flatMap((s) => METRICS.map((mt) => momentumChart(s, mt.key))).join('')

  return `
  <div class="card momentum">
    ${pRadios}${mRadios}
    <div class="pxrow">
      <span class="head head-exp"><span class="px">${nf(head.latestExp)}</span><span class="chg">${chg}</span></span>
      <span class="head head-lv"><span class="px">Lv.${level.level}</span><span class="chg">次のLvまで ${nf(level.toNext)} XP</span></span>
      <span class="metrics">${mLabels}</span>
      <span class="ranges">${pLabels}</span>
    </div>
    ${views}
  </div>`
}

// 折れ線ホバー用のインラインJS。カーソル位置に最も近いサンプル点を求め、
// 縦カーソル線・点・ツールチップ（日付＋値）を表示する。CSPの無いローカルHTMLで動く。
// data-metric に応じて値の単位（XP / Lv.）を切り替える。
function momentumHoverScript(): string {
  return `<script>
(function(){
  var nf=function(n){return n.toLocaleString('en-US')};
  var fd=function(ms){var d=new Date(ms);return (d.getMonth()+1)+'/'+d.getDate()+' '+d.getFullYear()};
  var views=document.querySelectorAll('.momentum .mview');
  for(var v=0;v<views.length;v++){(function(view){
    var svg=view.querySelector('svg');
    var isLv=view.getAttribute('data-metric')==='lv';
    var pts;try{pts=JSON.parse(view.getAttribute('data-points')||'[]')}catch(e){pts=[]}
    if(!svg||!pts.length)return;
    var cross=view.querySelector('.mcross'),dot=view.querySelector('.mdot'),tip=view.querySelector('.mtip');
    view.addEventListener('mousemove',function(e){
      var r=svg.getBoundingClientRect();
      var frac=(e.clientX-r.left)/r.width;
      if(frac<0)frac=0;if(frac>1)frac=1;
      var vbx=frac*${MOM_W},bi=0,bd=1e9;
      for(var i=0;i<pts.length;i++){var d=Math.abs(pts[i][0]-vbx);if(d<bd){bd=d;bi=i}}
      var p=pts[bi];
      var px=(p[0]/${MOM_W})*r.width,py=(p[1]/${MOM_H})*r.height;
      cross.style.left=px+'px';
      dot.style.left=px+'px';dot.style.top=py+'px';
      tip.style.left=px+'px';tip.style.top=py+'px';
      tip.innerHTML=fd(p[3])+'<br>'+(isLv?('Lv.'+p[2]):(nf(p[2])+' XP'));
      view.classList.add('hovering');
    });
    view.addEventListener('mouseleave',function(){view.classList.remove('hovering')});
  })(views[v])}
})();
</script>`
}

/* ===== 冒険マップ（オーバーワールド + 登山）===== */
const STAGE_THEMES = ['s-grass', 's-forest', 's-temple', 's-mtn', 's-castle']

function overworld(j: JourneyState): string {
  const nodes = j.stages
    .map((s, i) => {
      const theme = STAGE_THEMES[i % STAGE_THEMES.length]
      const status = s.current ? 'you' : s.reached ? 'done' : 'locked'
      const goal = i === j.stages.length - 1 ? ' castle-goal' : ''
      const nameSuffix = s.current ? ' ← 今ここ' : ''
      const stat = s.current
        ? `到達中<br>Lv.${s.requiredLevel} 〜`
        : s.reached
          ? `突破<br>Lv.${s.requiredLevel}`
          : `未到達<br>Lv.${s.requiredLevel}`
      return `<div class="stage ${theme} ${status}${goal}"><div class="node">${s.icon}</div><div class="sname">${esc(
        s.name,
      )}${nameSuffix}</div><div class="sstat">${stat}</div></div>`
    })
    .join('')
  return `<div class="routewrap"><div class="route">${nodes}</div></div>`
}

/* --- ステージ内マップ: 地形テーマ（背景シーン＋道の形）--- */
type Pt = readonly [number, number]
interface MapTheme {
  /** 道のアンカー（左→ゴール手前）。線形補間で YOU/チェックポイントを配置 */
  path: readonly Pt[]
  /** 背景シーン（道より奥に描く SVG） */
  bg: string
}

// 松の木（2段の三角＋幹）
const pine = (x: number, y: number, h: number, w: number, fill: string): string =>
  `<polygon points="${x},${y - h} ${x - w},${y} ${x + w},${y}" fill="${fill}"/>` +
  `<polygon points="${x},${y - h * 1.5} ${x - w * 0.66},${y - h * 0.5} ${x + w * 0.66},${y - h * 0.5}" fill="${fill}"/>` +
  `<rect x="${x - 1.5}" y="${y}" width="3" height="7" fill="#4a3a24"/>`

const FOREST_PINES: ReadonlyArray<readonly [number, number, number, number, string]> = [
  [70, 178, 34, 20, '#25452f'],
  [150, 186, 46, 26, '#2f5a3a'],
  [250, 176, 30, 18, '#22402c'],
  [360, 190, 52, 30, '#356b45'],
  [455, 180, 38, 22, '#2a5236'],
  [545, 186, 48, 28, '#2f5a3a'],
  [200, 168, 24, 15, '#1f3a29'],
  [420, 166, 22, 14, '#1f3a29'],
]

const MAP_THEMES: Record<Terrain, MapTheme> = {
  village: {
    path: [
      [30, 188],
      [130, 180],
      [235, 186],
      [335, 172],
      [430, 178],
      [510, 164],
      [562, 156],
    ],
    bg: `
      <defs><linearGradient id="tg-village" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#33502f"/><stop offset="1" stop-color="#1d2a1b"/></linearGradient></defs>
      <circle cx="72" cy="46" r="20" fill="#E6B450" opacity="0.16"/>
      <path d="M0,230 L0,168 Q170,148 340,164 T620,158 L620,230 Z" fill="url(#tg-village)"/>
      <rect x="70" y="130" width="42" height="36" fill="#3c3a52"/><polygon points="65,130 91,108 117,130" fill="#b5613f"/>
      <rect x="86" y="146" width="11" height="20" fill="#25233a"/>
      <rect x="122" y="140" width="30" height="26" fill="#34324a"/><polygon points="118,140 137,122 156,140" fill="#a3543a"/>
      <g stroke="#5a4530" stroke-width="2"><line x1="28" y1="172" x2="28" y2="160"/><line x1="40" y1="173" x2="40" y2="161"/><line x1="52" y1="174" x2="52" y2="162"/><line x1="26" y1="166" x2="54" y2="167"/></g>
      ${pine(516, 168, 30, 18, '#2f5a3a')}${pine(560, 172, 26, 16, '#356b45')}`,
  },
  forest: {
    path: [
      [30, 196],
      [120, 172],
      [215, 190],
      [315, 166],
      [410, 186],
      [495, 162],
      [562, 150],
    ],
    bg: `
      <defs><linearGradient id="tg-forest" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#243d2b"/><stop offset="1" stop-color="#152018"/></linearGradient></defs>
      <path d="M0,230 L0,172 Q310,158 620,174 L620,230 Z" fill="url(#tg-forest)"/>
      ${FOREST_PINES.map((p) => pine(p[0], p[1], p[2], p[3], p[4])).join('')}`,
  },
  harbor: {
    path: [
      [30, 164],
      [125, 158],
      [225, 150],
      [330, 140],
      [430, 128],
      [512, 116],
      [562, 106],
    ],
    bg: `
      <defs><linearGradient id="tg-harbor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2a5670"/><stop offset="1" stop-color="#12293a"/></linearGradient></defs>
      <polygon points="430,178 495,120 560,178" fill="#2c3a4a"/><polygon points="510,178 570,132 620,178" fill="#26333f"/>
      <rect x="0" y="178" width="620" height="52" fill="url(#tg-harbor)"/>
      <g stroke="#4a7f9a" stroke-width="1.4" opacity="0.45" fill="none">
        <path d="M30,196 q14,-6 28,0 t28,0 t28,0"/><path d="M330,208 q14,-6 28,0 t28,0 t28,0"/><path d="M150,214 q14,-6 28,0 t28,0"/></g>
      <rect x="34" y="172" width="150" height="6" fill="#6b4f30"/>
      <g fill="#4a3720"><rect x="48" y="178" width="5" height="22"/><rect x="108" y="178" width="5" height="22"/><rect x="170" y="178" width="5" height="22"/></g>
      <path d="M244,182 q30,20 60,0 Z" fill="#7a4a2a"/><rect x="272" y="150" width="3" height="32" fill="#5a4530"/><polygon points="275,152 275,178 300,166" fill="#d8d2c4"/>
      <rect x="454" y="146" width="13" height="32" fill="#c9c2d8"/><rect x="452" y="140" width="17" height="7" fill="#b5613f"/><circle cx="460.5" cy="136" r="4" fill="#E6B450" opacity="0.85"/>`,
  },
  pass: {
    path: [
      [30, 196],
      [120, 176],
      [220, 184],
      [320, 150],
      [412, 158],
      [492, 118],
      [560, 98],
    ],
    bg: `
      <defs><linearGradient id="tg-pass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3a4152"/><stop offset="1" stop-color="#20242f"/></linearGradient></defs>
      <polygon points="0,230 90,120 195,178 305,88 435,150 545,66 620,138 620,230" fill="url(#tg-pass)"/>
      <polygon points="305,88 289,116 321,116" fill="#dfe6ee" opacity="0.7"/><polygon points="545,66 531,92 559,92" fill="#dfe6ee" opacity="0.7"/>
      <g fill="#c9d2dc">
        <ellipse cx="180" cy="164" rx="130" ry="15" opacity="0.10"/>
        <ellipse cx="470" cy="132" rx="140" ry="13" opacity="0.09"/>
        <rect x="0" y="150" width="620" height="12" opacity="0.07"/></g>`,
  },
  mountain: {
    path: [
      [40, 205],
      [140, 176],
      [240, 150],
      [320, 128],
      [400, 100],
      [470, 72],
      [545, 42],
    ],
    bg: `
      <defs><linearGradient id="tg-mtn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3a4256"/><stop offset="1" stop-color="#222838"/></linearGradient></defs>
      <polygon points="0,230 150,150 320,108 470,62 545,38 620,230" fill="url(#tg-mtn)"/>
      <polygon points="545,38 522,70 575,70" fill="#e8edf5" opacity="0.85"/>`,
  },
  castle: {
    path: [
      [30, 190],
      [122, 168],
      [220, 152],
      [320, 136],
      [412, 112],
      [492, 86],
      [556, 62],
    ],
    bg: `
      <defs><linearGradient id="tg-castle" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2a2b52"/><stop offset="1" stop-color="#171826"/></linearGradient></defs>
      <rect x="0" y="0" width="620" height="230" fill="url(#tg-castle)" opacity="0.55"/>
      <g fill="#E6B450" opacity="0.5"><circle cx="80" cy="40" r="1.4"/><circle cx="210" cy="28" r="1.1"/><circle cx="330" cy="50" r="1.4"/><circle cx="460" cy="32" r="1.1"/></g>
      <g fill="#3a3d5c" opacity="0.6"><ellipse cx="120" cy="122" rx="62" ry="16"/><ellipse cx="360" cy="150" rx="82" ry="18"/><ellipse cx="520" cy="112" rx="58" ry="15"/></g>
      <g fill="#2f3450"><ellipse cx="130" cy="192" rx="48" ry="12"/><ellipse cx="330" cy="152" rx="44" ry="11"/></g>
      <g fill="#454a72"><rect x="520" y="42" width="62" height="38"/><rect x="514" y="30" width="10" height="14"/><rect x="536" y="26" width="10" height="18"/><rect x="558" y="30" width="10" height="14"/><rect x="578" y="30" width="8" height="14"/></g>
      <polygon points="536,26 541,14 546,26" fill="#E6B450"/>`,
  },
  peak: {
    // 竜の頂は最終ステージ。next が無いためマップは描かれない（フォールバック用に mountain を流用）
    path: [
      [40, 205],
      [140, 176],
      [240, 150],
      [320, 128],
      [400, 100],
      [470, 72],
      [545, 42],
    ],
    bg: `
      <defs><linearGradient id="tg-peak" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#4a3a4a"/><stop offset="1" stop-color="#241a24"/></linearGradient></defs>
      <polygon points="0,230 150,150 320,108 470,62 545,38 620,230" fill="url(#tg-peak)"/>
      <polygon points="545,38 522,70 575,70" fill="#e8edf5" opacity="0.85"/>`,
  },
}

function pointAt(path: readonly Pt[], f: number): [number, number] {
  const t = Math.max(0, Math.min(1, f)) * (path.length - 1)
  const i = Math.min(path.length - 2, Math.floor(t))
  const a = path[i] as Pt
  const b = path[i + 1] as Pt
  const r = t - i
  return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]
}

export function inStageMap(j: JourneyState, r: DevReport): string {
  if (!j.next) {
    return `<div class="instage"><div class="ih"><span class="it">🏁 最終ステージ <b>${esc(
      j.current.name,
    )}</b> に到達！</span></div></div>`
  }
  const theme = MAP_THEMES[j.current.terrain] ?? MAP_THEMES.mountain
  const path = theme.path
  const prog = j.progressInStage
  const qb = r.questBoard
  const done = qb?.done ?? []
  const upcoming = [...(qb?.doing ?? []), ...(qb?.todo ?? [])]

  // チェックポイント: 完了はYOUの手前、未着手はYOUの先に配置
  type CP = { f: number; state: 'done' | 'todo'; num?: number; label: string }
  const cps: CP[] = []
  const behind = done.slice(-2)
  behind.forEach((q, i) => {
    const f = prog * ((i + 1) / (behind.length + 1))
    cps.push({ f, state: 'done', num: q.number, label: q.title })
  })
  const ahead = upcoming.slice(0, 2)
  ahead.forEach((q, i) => {
    const f = prog + (1 - prog) * ((i + 1) / (ahead.length + 1))
    cps.push({ f, state: 'todo', num: q.number, label: q.title })
  })

  const cpSvg = cps
    .map((cp) => {
      const [x, y] = pointAt(path, cp.f)
      const short = cp.label.length > 8 ? `${cp.label.slice(0, 8)}…` : cp.label
      if (cp.state === 'done') {
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="#57B894"/>
        <text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="#15171e" font-weight="700">✓</text>
        <text x="${x.toFixed(1)}" y="${(y + 22).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="#8B8E9B">#${cp.num} ${esc(short)}</text>`
      }
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="#1b1e29" stroke="#5A5E6C" stroke-width="2"/>
        <text x="${x.toFixed(1)}" y="${(y - 14).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="#8B8E9B">#${cp.num} ${esc(short)}</text>`
    })
    .join('')

  // 道の折れ線（アンカーを M/L でつなぐ）
  const route = path.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')

  const [yx, yy] = pointAt(path, prog)
  const [sx, sy] = path[path.length - 1] as Pt
  const pctTxt = (prog * 100).toFixed(0)

  return `
    <div class="instage">
      <div class="ih">
        <span class="it">現在のステージ ${j.current.icon} <b>${esc(j.current.name)}</b></span>
        <span class="ip">この区間 <b>${pctTxt}%</b> — 次は ${j.next.icon} ${esc(j.next.name)}</span>
      </div>
      <div class="imapwrap">
        <svg class="imap" viewBox="0 0 620 230" role="img" aria-label="${esc(j.current.name)} ステージ内マップ">
          ${theme.bg}
          <path d="${route}" fill="none" stroke="#E8794A" stroke-width="2.4" stroke-dasharray="6 6"/>
          ${cpSvg}
          <circle class="youring" cx="${yx.toFixed(1)}" cy="${yy.toFixed(1)}" r="9" fill="#E8794A"/>
          <circle cx="${yx.toFixed(1)}" cy="${yy.toFixed(1)}" r="9" fill="#E8794A" stroke="#15171e" stroke-width="2"/>
          <text x="${yx.toFixed(1)}" y="${(yy - 16).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#E8794A" font-weight="700">YOU</text>
          <circle cx="${sx}" cy="${sy}" r="13" fill="#1b1e29" stroke="#E6B450" stroke-width="2"/>
          <text x="${sx}" y="${(sy + 6).toFixed(1)}" text-anchor="middle" font-size="15">${j.next.icon}</text>
          <text x="${sx}" y="${(sy + 27).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="#E6B450" font-weight="700">→ ${esc(j.next.name)}</text>
        </svg>
      </div>
    </div>`
}

/* ===== 街（スカイライン）===== */
function citySkyline(city: CityState): string {
  const builtSet = new Set(city.buildings.filter((b) => b.built).map((b) => b.name))
  const has = (kw: string): boolean => [...builtSet].some((n) => n.includes(kw))
  const WIN = 'url(#win)'

  const chapel = has('チャペル')
    ? `<polygon points="150,130 168,104 186,130" fill="#c9c2d8"/>
       <rect x="166" y="88" width="4" height="16" fill="#c9c2d8"/><rect x="162" y="93" width="12" height="4" fill="#c9c2d8"/>
       <rect x="150" y="130" width="36" height="62" fill="#3c3a52"/>
       <path d="M162,192 L162,168 Q168,158 174,168 L174,192 Z" fill="#E6B450" opacity="0.5"/>`
    : `<rect x="150" y="150" width="36" height="42" fill="none" stroke="#5A5E6C" stroke-dasharray="4 4"/><text x="168" y="176" text-anchor="middle" font-size="16">🚧</text>`

  const clock = has('時計塔')
    ? `<rect x="266" y="58" width="40" height="134" fill="#41506a"/><rect x="266" y="58" width="40" height="134" fill="${WIN}"/>
       <circle cx="286" cy="80" r="11" fill="#15171e"/><circle cx="286" cy="80" r="11" fill="none" stroke="#E6B450" stroke-width="1.5"/>
       <line x1="286" y1="80" x2="286" y2="73" stroke="#E6B450" stroke-width="1.5"/><line x1="286" y1="80" x2="291" y2="82" stroke="#E6B450" stroke-width="1.5"/>`
    : `<rect x="266" y="120" width="40" height="72" fill="none" stroke="#5A5E6C" stroke-dasharray="4 4"/><text x="286" y="164" text-anchor="middle" font-size="16">🚧</text>`

  const tower = has('高層ビル')
    ? `<rect x="200" y="70" width="54" height="122" fill="#2f3850"/><rect x="200" y="70" width="54" height="122" fill="${WIN}"/>`
    : `<rect x="200" y="130" width="54" height="62" fill="none" stroke="#5A5E6C" stroke-dasharray="4 4"/><text x="227" y="166" text-anchor="middle" font-size="16">🚧</text>`

  const hall = has('役場')
    ? `<rect x="318" y="98" width="50" height="94" fill="#2b3242"/><rect x="318" y="98" width="50" height="94" fill="${WIN}"/>
       <polygon points="318,98 343,84 368,98" fill="#5a4a2a"/>`
    : `<rect x="318" y="140" width="50" height="52" fill="none" stroke="#5A5E6C" stroke-dasharray="4 4"/><text x="343" y="170" text-anchor="middle" font-size="16">🚧</text>`

  // リリース記念の塔（初リリース＝チャペルと同時に立つ）
  const landmark = has('チャペル')
    ? `<rect x="382" y="34" width="46" height="158" fill="#3a4256"/><rect x="382" y="34" width="46" height="158" fill="${WIN}"/>
       <polygon points="382,34 405,16 428,34" fill="#5a4a2a"/>
       <rect x="403" y="6" width="4" height="12" fill="#E8794A"/><polygon points="407,7 407,14 418,10.5" fill="#E8794A"/>`
    : ''

  const district = has('区画拡張')
    ? `<rect x="440" y="112" width="48" height="80" fill="#2f3850"/><rect x="440" y="112" width="48" height="80" fill="${WIN}"/>`
    : `<rect x="440" y="150" width="48" height="42" fill="none" stroke="#5A5E6C" stroke-dasharray="4 4"/><text x="464" y="176" text-anchor="middle" font-size="15">🚧</text>`

  const hospital = has('病院')
    ? `<rect x="500" y="120" width="44" height="72" fill="#33405a"/><rect x="500" y="120" width="44" height="72" fill="${WIN}"/>
       <rect x="518" y="128" width="8" height="3" fill="#E8794A"/><rect x="520.5" y="125.5" width="3" height="8" fill="#E8794A"/>`
    : `<polygon points="500,150 522,133 544,150" fill="#b5613f"/><rect x="504" y="150" width="40" height="42" fill="#3a4256"/><rect x="504" y="150" width="40" height="42" fill="${WIN}"/>`

  return `
    <svg viewBox="0 0 600 210" role="img" aria-label="街並み">
      <defs>
        <pattern id="win" width="11" height="13" patternUnits="userSpaceOnUse">
          <rect width="11" height="13" fill="none"/>
          <rect x="3" y="4" width="4" height="5" rx="0.5" fill="#E6B450" opacity="0.85"/>
        </pattern>
        <linearGradient id="ny" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1b2030"/><stop offset="1" stop-color="#171a24"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="600" height="210" fill="url(#ny)"/>
      <circle cx="535" cy="42" r="20" fill="#E6B450" opacity="0.25"/><circle cx="535" cy="42" r="13" fill="#E6B450" opacity="0.4"/>
      <rect x="8" y="186" width="56" height="6" rx="3" fill="#2c7a4a" opacity="0.5"/>
      <g fill="#3a7a55"><circle cx="22" cy="178" r="11"/><circle cx="40" cy="180" r="9"/></g>
      <rect x="20" y="183" width="3" height="8" fill="#5a4530"/><rect x="38" y="184" width="3" height="7" fill="#5a4530"/>
      <polygon points="78,150 102,132 126,150" fill="#b5613f"/><rect x="82" y="150" width="40" height="42" fill="#3a4256"/><rect x="82" y="150" width="40" height="42" fill="${WIN}"/>
      ${chapel}
      ${tower}
      ${clock}
      ${hall}
      ${landmark}
      ${district}
      ${hospital}
      <g fill="#3a7a55"><circle cx="566" cy="176" r="12"/></g><rect x="564" y="182" width="3" height="10" fill="#5a4530"/>
      <rect x="0" y="192" width="600" height="18" fill="#242837"/>
    </svg>`
}

function unlockList(city: CityState): string {
  return city.buildings
    .filter((b) => b.from !== '拠点')
    .map((b) => {
      const cls = b.built ? '' : ' locked'
      const stat = b.built
        ? '<span class="ustat ok">解放</span>'
        : '<span class="ustat lock">未解放</span>'
      return `<div class="ub${cls}"><span class="uico">${b.built ? b.icon : '🚧'}</span><div class="un">${esc(
        b.name,
      )}<small>実績「${esc(b.from)}」</small></div>${stat}</div>`
    })
    .join('')
}

/* ===== クエスト ===== */
function questColumn(
  title: string,
  cls: string,
  quests: NonNullable<DevReport['questBoard']>['todo'],
): string {
  const cards =
    quests
      .map(
        (q) =>
          `<div class="qcard"><div class="qhead"><span class="chip ${q.type}">${
            q.type === 'main' ? 'Main' : 'Sub'
          }</span><span class="qx">+${q.exp}</span></div><div class="qt"><span class="qnum">#${
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
  :root{--ink:#15171E;--panel:#1D202A;--raised:#242837;--border:#2E3342;--text:#ECEAE3;--muted:#8B8E9B;--faint:#5A5E6C;--gold:#E6B450;--gold-dim:#8A6E32;--coral:#E8794A;--teal:#57B894;--sky:#5FA8D8;--purple:#B06BFF;--mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;--sans:ui-sans-serif,system-ui,"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif}
  *{box-sizing:border-box}
  body{margin:0;color:var(--text);font-family:var(--sans);line-height:1.5;-webkit-font-smoothing:antialiased;background:radial-gradient(1100px 520px at 85% -10%,rgba(230,180,80,.06),transparent 60%),radial-gradient(800px 460px at -8% 108%,rgba(95,168,216,.05),transparent 55%),var(--ink)}
  .wrap{max-width:1080px;margin:0 auto;padding:38px 24px 72px}
  .topbar{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:22px}
  .topbar .b{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
  .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold)}
  .topbar h1{font-family:var(--mono);font-size:19px;font-weight:600;margin:0}
  .topbar .date{font-family:var(--mono);font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
  .sh{display:flex;align-items:baseline;gap:12px;margin:30px 2px 14px}
  .sh h2{font-family:var(--mono);font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;margin:0}
  .sh .line{flex:1;height:1px;background:var(--border)}
  .sh .hint{font-family:var(--mono);font-size:11px;color:var(--faint)}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:14px}
  .hero{display:grid;grid-template-columns:1.45fr 1fr;gap:16px}
  .lvlcard{display:grid;grid-template-columns:auto 1fr;gap:26px;align-items:center;padding:28px 30px}
  .lvl{display:flex;flex-direction:column;align-items:center;justify-content:center;width:124px;height:124px;border-radius:50%;flex-shrink:0;background:radial-gradient(circle at 50% 35%,#2c3043,#1a1d27);border:2px solid var(--gold);box-shadow:0 0 0 7px rgba(230,180,80,.08),inset 0 2px 14px rgba(0,0,0,.4)}
  .lvl .t{font-family:var(--mono);font-size:11px;letter-spacing:.2em;color:var(--gold)}
  .lvl .n{font-family:var(--mono);font-size:54px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}
  .hmeta{min-width:0}
  .hmeta .rank{font-size:22px;font-weight:700;margin:0 0 3px}
  .hmeta .rank small{font-family:var(--mono);font-size:13px;font-weight:500;color:var(--muted)}
  .hmeta .since{font-family:var(--mono);font-size:12px;color:var(--faint);margin-bottom:16px}
  .exprow{display:flex;justify-content:space-between;font-family:var(--mono);font-size:13px;color:var(--muted);margin-bottom:7px}
  .exprow .now{color:var(--gold)}.exprow b{color:var(--text);font-variant-numeric:tabular-nums}
  .bar{height:13px;border-radius:7px;background:#11131a;border:1px solid var(--border);overflow:hidden}
  .bar>span{display:block;height:100%;background:linear-gradient(90deg,var(--gold-dim),var(--gold));border-radius:7px;box-shadow:0 0 10px rgba(230,180,80,.4)}
  .breakdown{display:flex;gap:18px;margin-top:16px}
  .breakdown .bn{font-family:var(--mono);font-size:16px;font-weight:700}
  .breakdown .bl{font-family:var(--mono);font-size:11px;color:var(--faint)}
  .charcard{padding:22px 24px;display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center}
  .avatar{width:92px;height:92px;border-radius:16px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:50px;background:radial-gradient(circle at 50% 30%,#2f3447,#1b1e29);border:1px solid var(--border);box-shadow:inset 0 2px 12px rgba(0,0,0,.4)}
  .charinfo .cls{font-size:16px;font-weight:700;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
  .charinfo .jobtag{font-family:var(--mono);font-size:10.5px;font-weight:600;color:var(--purple);background:rgba(176,107,255,.12);border:1px solid rgba(176,107,255,.35);border-radius:5px;padding:2px 7px}
  .charinfo .ctit{font-family:var(--mono);font-size:11.5px;color:var(--gold);margin-top:3px}
  .charinfo .job-next{font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:3px}
  .stats{display:flex;flex-direction:column;gap:7px;margin-top:12px}
  .st{display:flex;align-items:center;gap:9px;font-family:var(--mono);font-size:11px;color:var(--muted)}
  .st .sl{width:70px}.st .strack{flex:1;height:6px;border-radius:4px;background:#11131a;overflow:hidden}
  .st .strack i{display:block;height:100%}
  .st .sv{width:40px;text-align:right;color:var(--text)}
  .st.atk i{background:var(--coral)}.st.def i{background:var(--sky)}.st.spd i{background:var(--teal)}.st.mag i{background:var(--purple)}
  .equip{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  .slot{background:var(--panel);border:1px solid var(--border);border-radius:13px;padding:15px 16px;position:relative;overflow:hidden}
  .slot .stype{font-family:var(--mono);font-size:10px;letter-spacing:.14em;color:var(--faint);text-transform:uppercase}
  .slot .srow{display:flex;align-items:center;gap:11px;margin-top:9px}
  .slot .sico{font-size:30px;line-height:1}
  .slot .sname{font-size:14px;font-weight:700}
  .slot .splus{color:var(--teal);font-family:var(--mono)}
  .slot .rar{font-family:var(--mono);font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;color:#15171e;display:inline-block;margin-top:3px}
  .slot .rar.ssr{background:linear-gradient(135deg,#ff7aa8,#ffcd4d,#5fd0d8)}
  .slot .rar.sr{background:var(--purple);color:#fff}.slot .rar.r{background:var(--sky)}
  .slot .src{font-family:var(--mono);font-size:10.5px;color:var(--muted);margin-top:10px}
  .momentum{padding:18px 22px 14px}
  .momentum .pxrow{display:flex;align-items:baseline;gap:12px;margin-bottom:8px;flex-wrap:wrap}
  .momentum .head{display:flex;align-items:baseline;gap:12px}
  .momentum .head-lv{display:none}
  .momentum .px{font-family:var(--mono);font-size:30px;font-weight:700;font-variant-numeric:tabular-nums}
  .momentum .chg{font-family:var(--mono);font-size:13px;color:var(--teal)}
  .momentum .metrics{margin-left:auto;display:flex;gap:6px}
  .momentum .ranges{display:flex;gap:6px}
  .momentum .metrics{padding-right:10px;margin-right:4px;border-right:1px solid var(--border)}
  .momentum .ranges label,.momentum .metrics label{cursor:pointer;font-family:var(--mono);font-size:11px;padding:3px 9px;border-radius:6px;color:var(--faint);border:1px solid transparent;transition:color .12s,background .12s,border-color .12s}
  .momentum .ranges label:hover,.momentum .metrics label:hover{color:var(--gold)}
  .momentum .mr{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  .momentum .mview{display:none;position:relative}
  .momentum #mr-all:checked~#mm-exp:checked~.mv-all.met-exp,.momentum #mr-3y:checked~#mm-exp:checked~.mv-3y.met-exp,.momentum #mr-1y:checked~#mm-exp:checked~.mv-1y.met-exp,.momentum #mr-3m:checked~#mm-exp:checked~.mv-3m.met-exp,.momentum #mr-1m:checked~#mm-exp:checked~.mv-1m.met-exp,.momentum #mr-all:checked~#mm-lv:checked~.mv-all.met-lv,.momentum #mr-3y:checked~#mm-lv:checked~.mv-3y.met-lv,.momentum #mr-1y:checked~#mm-lv:checked~.mv-1y.met-lv,.momentum #mr-3m:checked~#mm-lv:checked~.mv-3m.met-lv,.momentum #mr-1m:checked~#mm-lv:checked~.mv-1m.met-lv{display:block}
  .momentum #mr-all:checked~.pxrow .r-all,.momentum #mr-3y:checked~.pxrow .r-3y,.momentum #mr-1y:checked~.pxrow .r-1y,.momentum #mr-3m:checked~.pxrow .r-3m,.momentum #mr-1m:checked~.pxrow .r-1m{color:var(--gold);border-color:var(--gold-dim);background:rgba(230,180,80,.1)}
  .momentum #mm-exp:checked~.pxrow .rm-exp,.momentum #mm-lv:checked~.pxrow .rm-lv{color:var(--gold);border-color:var(--gold-dim);background:rgba(230,180,80,.1)}
  .momentum #mm-lv:checked~.pxrow .head-exp{display:none}
  .momentum #mm-lv:checked~.pxrow .head-lv{display:flex}
  .momentum svg{display:block;width:100%;height:170px}
  .momentum .xaxis{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:6px}
  .momentum .yaxis{position:absolute;inset:0;pointer-events:none}
  .momentum .ytick{position:absolute;left:2px;transform:translateY(-50%);font-family:var(--mono);font-size:10px;color:var(--faint);font-variant-numeric:tabular-nums;background:rgba(29,32,42,.72);padding:0 4px;border-radius:3px}
  .momentum .mcross{position:absolute;top:0;height:140px;width:1px;background:var(--gold-dim);opacity:0;pointer-events:none;transition:opacity .1s}
  .momentum .mdot{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 3px rgba(230,180,80,.22);opacity:0;pointer-events:none}
  .momentum .mtip{position:absolute;transform:translate(-50%,calc(-100% - 11px));white-space:nowrap;font-family:var(--mono);font-size:11px;line-height:1.35;color:var(--text);background:var(--raised);border:1px solid var(--border);border-radius:7px;padding:5px 9px;opacity:0;pointer-events:none;z-index:3;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.35)}
  .momentum .mview.hovering .mcross,.momentum .mview.hovering .mdot,.momentum .mview.hovering .mtip{opacity:1}
  .momentum .met-lv .mcross{background:rgba(95,168,216,.55)}
  .momentum .met-lv .mdot{background:var(--sky);box-shadow:0 0 0 3px rgba(95,168,216,.22)}
  .pulse{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  .pulse .s{background:var(--panel);border:1px solid var(--border);border-radius:13px;padding:16px 17px}
  .pulse .s .k{font-family:var(--mono);font-size:11px;color:var(--muted)}
  .pulse .s .v{font-family:var(--mono);font-size:30px;font-weight:700;margin-top:8px;line-height:1}
  .pulse .s .v span{font-size:13px;color:var(--muted);font-weight:500}
  .pulse .s.fire .v{color:var(--coral)}.pulse .s.xp .v{color:var(--gold)}
  .spark{display:flex;align-items:flex-end;gap:3px;height:28px;margin-top:12px}
  .spark i{flex:1;border-radius:2px;min-height:3px;background:rgba(230,180,80,.5)}
  .journey{padding:20px 20px 22px}
  .routewrap{overflow-x:auto;margin:0 -20px;padding:0 20px 4px}
  .route{display:flex;align-items:flex-start;min-width:640px}
  .stage{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;padding:0 4px}
  .stage::before{content:"";position:absolute;top:31px;left:-50%;width:100%;height:3px;background:repeating-linear-gradient(90deg,var(--faint) 0 7px,transparent 7px 13px);z-index:0}
  .stage:first-child::before{display:none}
  .stage.done::before{background:var(--teal)}
  .node{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;position:relative;z-index:1;border:2px solid var(--border)}
  .stage.s-grass .node{background:radial-gradient(circle,#3a5a3a,#22321f)}
  .stage.s-forest .node{background:radial-gradient(circle,#2f4a3a,#1d2f26)}
  .stage.s-temple .node{background:radial-gradient(circle,#4a4368,#28243a)}
  .stage.s-mtn .node{background:radial-gradient(circle,#4a4a55,#2a2a33)}
  .stage.s-castle .node{background:radial-gradient(circle,#5a4a2a,#332a17)}
  .stage.done .node{border-color:var(--teal)}
  .stage.you .node{border-color:var(--coral);box-shadow:0 0 0 4px rgba(232,121,74,.25)}
  .stage.locked .node{opacity:.5;border-style:dashed}
  .stage .sname{font-size:12.5px;font-weight:700;margin-top:10px}
  .stage .sstat{font-family:var(--mono);font-size:10.5px;color:var(--muted);margin-top:3px;line-height:1.4}
  .stage.you .sname{color:var(--coral)}.stage.done .sname{color:var(--teal)}.stage.castle-goal .sname{color:var(--gold)}
  .instage{margin-top:18px;border-top:1px solid var(--border);padding-top:14px}
  .instage .ih{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 2px 10px}
  .instage .ih .it{font-size:14px;font-weight:700}.instage .ih .it b{color:var(--coral)}
  .instage .ih .ip{font-family:var(--mono);font-size:11px;color:var(--muted);margin-left:auto}
  .instage .ip b{color:var(--gold)}
  .imapwrap{overflow-x:auto;margin:0 -20px;padding:0 20px}
  .imap{display:block;width:100%;min-width:560px;height:auto}
  .imap text{font-family:var(--mono)}
  .cityrow{display:grid;grid-template-columns:1.6fr 1fr;gap:16px}
  .citycard{padding:16px 18px 14px;display:flex;flex-direction:column}
  .citycard svg{display:block;width:100%;height:auto;border-radius:8px}
  .citycard .legend{display:flex;gap:18px;font-family:var(--mono);font-size:11px;color:var(--muted);padding-top:12px;flex-wrap:wrap}
  .citycard .legend b{color:var(--text)}
  .unlock{padding:16px 18px}
  .unlock h3{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin:0 0 12px}
  .ub{display:flex;align-items:center;gap:11px;padding:8px 0;border-bottom:1px solid var(--border)}
  .ub:last-child{border-bottom:none}
  .ub .uico{font-size:22px;width:26px;text-align:center}
  .ub .un{font-size:13px;flex:1}.ub .un small{display:block;font-family:var(--mono);font-size:10px;color:var(--faint)}
  .ub .ustat{font-family:var(--mono);font-size:10px;padding:2px 7px;border-radius:4px}
  .ub .ustat.ok{color:var(--teal);background:rgba(87,184,148,.12);border:1px solid rgba(87,184,148,.3)}
  .ub .ustat.lock{color:var(--faint);background:rgba(90,94,108,.12);border:1px solid var(--border)}
  .ub.locked{opacity:.55}
  .board{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .col{background:var(--panel);border:1px solid var(--border);border-radius:13px;padding:14px 14px 16px}
  .col .colh{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}
  .col .colh .ct{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase}
  .col.todo .ct{color:var(--muted)}.col.prog .ct{color:var(--gold)}.col.done .ct{color:var(--teal)}
  .col .colh .cn{font-family:var(--mono);font-size:12px;color:var(--faint)}
  .qcard{background:var(--raised);border:1px solid var(--border);border-radius:9px;padding:11px 12px;margin-bottom:9px}
  .qcard:last-child{margin-bottom:0}
  .qcard .qhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
  .chip{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.06em;padding:2px 6px;border-radius:4px;text-transform:uppercase}
  .chip.main{color:var(--gold);background:rgba(230,180,80,.12);border:1px solid var(--gold-dim)}
  .chip.sub{color:var(--muted);background:rgba(139,142,155,.1);border:1px solid var(--border)}
  .qcard .qx{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--gold)}
  .col.done .qx{color:var(--teal)}
  .qcard .qt{font-size:13.5px;line-height:1.4}
  .qcard .qnum{font-family:var(--mono);font-size:11px;color:var(--faint)}
  .col.done .qcard{opacity:.82}.col.done .qcard .qt{text-decoration:line-through;text-decoration-color:var(--faint)}
  .empty{font-family:var(--mono);font-size:11px;color:var(--faint);padding:6px 2px}
  .badges{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
  .badge{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px 8px 13px;text-align:center}
  .badge .ico{font-size:26px;line-height:1}
  .badge .bn{font-family:var(--mono);font-size:11px;margin-top:9px}
  .badge .bw{font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:3px}
  .badge.locked{opacity:.4}.badge.locked .ico{filter:grayscale(1) brightness(.7)}
  .note{font-family:var(--mono);font-size:11.5px;color:var(--muted);background:var(--panel);border:1px dashed var(--border);border-radius:12px;padding:14px 16px;margin-top:24px}
  .note b{color:var(--text)}
  @media(max-width:880px){.hero{grid-template-columns:1fr}.equip{grid-template-columns:repeat(2,1fr)}.cityrow{grid-template-columns:1fr}.board{grid-template-columns:1fr}.badges{grid-template-columns:repeat(3,1fr)}.pulse{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:560px){.lvlcard,.charcard{grid-template-columns:1fr;justify-items:center;text-align:center}}
</style>
</head>
<body>
<div class="wrap">

  <div class="topbar">
    <div class="b"><span class="eyebrow">Dev Cockpit</span><h1>${esc(projectName)}</h1></div>
    <span class="date">${genStr} 集計</span>
  </div>

  <div class="hero">
    <div class="card lvlcard">
      <div class="lvl"><span class="t">LV</span><span class="n">${lv.level}</span></div>
      <div class="hmeta">
        <p class="rank">${r.character.jobIcon} ${esc(r.character.fullName)} <small>/ Lv.${lv.level}</small></p>
        <div class="since">${r.daysSinceStart != null ? `冒険開始から ${r.daysSinceStart} 日 · ` : ''}累計 ${nf(lv.totalExp)} EXP</div>
        <div class="exprow"><span class="now">EXP <b>${nf(lv.totalExp)}</b> / ${nf(lv.nextLevelAt)}</span><span>次のレベルまで <b>${nf(lv.toNext)}</b></span></div>
        <div class="bar"><span style="width:${pct}%"></span></div>
        <div class="breakdown">
          <div><div class="bn">${nf(r.totalCommits)}</div><div class="bl">総コミット</div></div>
          <div><div class="bn">${r.mergedPRs}</div><div class="bl">マージPR</div></div>
          <div><div class="bn">${r.releases}</div><div class="bl">リリース</div></div>
          <div><div class="bn">${unlocked} / ${r.badges.length}</div><div class="bl">実績解除</div></div>
        </div>
      </div>
    </div>
    ${characterCard(r.character)}
  </div>

  <div class="sh"><h2>装備 / Equipment</h2><span class="line"></span><span class="hint">活動量で自動強化</span></div>
  <div class="equip">${equipmentSlots(r.character.equipment)}</div>

  <div class="sh"><h2>勢い / Momentum</h2><span class="line"></span><span class="hint">活動EXP（コミット+PR）の累計 / レベル推移・指標と期間を切替</span></div>
  ${momentumCard(r.momentums, r.level)}

  <div class="sh"><h2>今週のアクティビティ</h2><span class="line"></span><span class="hint">git + gh から自動集計</span></div>
  <div class="pulse">
    <div class="s fire"><div class="k">🔥 ストリーク</div><div class="v">${r.currentStreak}<span> 日</span></div></div>
    <div class="s"><div class="k">コミット / 週</div><div class="v">${r.weekCommits}</div><div class="spark">${sparkBars(r.dailyCommitCounts)}</div></div>
    <div class="s"><div class="k">マージPR / 週</div><div class="v">${r.weekPRs}</div></div>
    <div class="s xp"><div class="k">獲得EXP / 週</div><div class="v">+${r.weekExp}</div></div>
  </div>

  <div class="sh"><h2>冒険の地図 / 次のステージへ</h2><span class="line"></span><span class="hint">レベル帯 = ステージ</span></div>
  <div class="card journey">
    ${overworld(r.journey)}
    ${inStageMap(r.journey, r)}
  </div>

  <div class="sh"><h2>これまでの積み上げ / ${esc(projectName)}・シティ</h2><span class="line"></span><span class="hint">実績で建てられる建物が増える</span></div>
  <div class="cityrow">
    <div class="card citycard">
      ${citySkyline(r.city)}
      <div class="legend">
        <span>🏙 街の建物 <b>${r.city.built} / ${r.city.total}</b></span>
        <span>🪟 灯り = <b>コミット</b></span>
        <span>🚧 = <b>未解放（バッジ待ち）</b></span>
      </div>
    </div>
    <div class="card unlock">
      <h3>建設できる建物</h3>
      <div class="ub"><span class="uico">🏠</span><div class="un">開発者の家<small>最初から</small></div><span class="ustat ok">解放</span></div>
      ${unlockList(r.city)}
    </div>
  </div>

${questBoardSection(r)}

  <div class="sh"><h2>実績バッジ</h2><span class="line"></span><span class="hint">${unlocked} / ${r.badges.length} 解除 · 街の建物が増える</span></div>
  <div class="badges">${badgeCells(r.badges)}</div>

  <div class="note">🧭 すべて git / gh / GitHub Projects から自動集計。クエストの Size を設定すると EXP が増えます（XS=10〜XL=200、未設定は30）。装備・街・冒険マップ・勢いは活動量とバッジで自動的に育ちます。</div>

</div>
${momentumHoverScript()}
</body>
</html>
`
}
