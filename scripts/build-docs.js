'use strict'
/**
 * Renders help-data.js into one self-contained, offline-capable HTML manual.
 *   node scripts/build-docs.js   → docs/index.html (GitHub Pages / web) and renderer/help.html (in-app help window)
 */
const fs = require('node:fs')
const path = require('node:path')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const CSS = `
:root{--red:#d4202a;--hot:#ff3b3b;--blue:#1d3fd8;--navy:#0a1131;--navy2:#141c4a;--ink:#05060d;--yellow:#ffd83a;--paper:#f4f1e6;--mute:#9fb0ff;--comic:'Arial Black','Segoe UI Black',Impact,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:radial-gradient(circle at 1px 1px,rgba(255,255,255,.06) 1px,transparent 1.6px) 0 0/8px 8px,radial-gradient(120% 60% at 50% 0,#1b2a78 0,var(--navy) 60%);background-attachment:fixed;color:var(--paper);font:16px/1.6 'Segoe UI',system-ui,sans-serif}
a{color:var(--yellow)}
header.hero{padding:56px 24px 40px;text-align:center;border-bottom:4px solid #000;background:linear-gradient(100deg,var(--red) 0 58%,var(--blue) 58%);box-shadow:0 6px 0 #000}
.hero h1{margin:0;font:italic 900 clamp(34px,7vw,72px)/1 var(--comic);letter-spacing:.02em;text-shadow:4px 4px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000}
.hero h1 em{color:var(--yellow);font-style:italic}
.hero p{margin:14px auto 0;max-width:760px;font-size:18px;text-shadow:2px 2px 0 #000}
.hero .badge{display:inline-block;margin-top:18px;padding:6px 14px;background:var(--yellow);color:#111;font:italic 900 14px var(--comic);border:3px solid #000;box-shadow:4px 4px 0 #000;transform:rotate(-1.5deg)}
.layout{display:grid;grid-template-columns:230px 1fr;gap:28px;max-width:1180px;margin:0 auto;padding:28px 20px 80px}
nav{position:sticky;top:16px;align-self:start;max-height:calc(100vh - 32px);overflow:auto;padding:14px;background:rgba(5,6,13,.8);border:3px solid #000;border-radius:12px;box-shadow:5px 5px 0 var(--red)}
nav b{display:block;margin:10px 0 4px;font:900 11px var(--comic);color:var(--mute);letter-spacing:.08em}
nav a{display:block;padding:4px 8px;border-radius:6px;color:var(--paper);text-decoration:none;font-size:14px}
nav a:hover{background:var(--blue)}
#q{width:100%;padding:9px 11px;font:inherit;font-size:14px;color:#111;background:var(--yellow);border:3px solid #000;border-radius:8px}
main section{margin:0 0 44px;scroll-margin-top:16px}
h2{margin:0 0 14px;font:italic 900 28px var(--comic);text-shadow:3px 3px 0 var(--red);display:flex;align-items:center;gap:10px}
h3{margin:22px 0 8px;font:900 15px var(--comic);color:var(--yellow);letter-spacing:.04em;text-transform:uppercase}
.card{background:rgba(5,6,13,.72);border:3px solid #000;border-radius:12px;padding:16px 18px;box-shadow:5px 5px 0 #000;margin:0 0 14px}
.card.red{box-shadow:5px 5px 0 var(--red)}.card.blue{box-shadow:5px 5px 0 var(--blue)}
ol.steps{margin:0;padding-left:22px}ol.steps li{margin:6px 0}
.keys{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
kbd{display:inline-block;padding:3px 9px;margin:0 2px;font:900 13px var(--comic);color:#111;background:var(--paper);border:3px solid #000;border-bottom-width:5px;border-radius:6px}
.cmds{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px}
.cmd{position:relative;background:rgba(20,28,74,.7);border:3px solid #000;border-radius:10px;padding:12px 14px 12px;box-shadow:4px 4px 0 #000}
.cmd code{display:block;margin:0 0 6px;padding:6px 10px;font:700 15px Consolas,'Cascadia Mono',monospace;color:#111;background:var(--yellow);border:2px solid #000;border-radius:6px;cursor:pointer}
.cmd code:hover{filter:brightness(1.08)}
.cmd p{margin:0;font-size:14px;color:#dfe5ff}.cmd small{display:block;margin-top:6px;color:var(--mute)}.cmd .note{color:#ff9a9a}
.feature{padding:0}
.feature>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 18px}
.feature>summary::-webkit-details-marker{display:none}
.feature .ico{font-size:28px;width:38px;text-align:center}
.feature .ttl{font:900 17px var(--comic);color:var(--paper)}.feature .sum{display:block;font-size:14px;color:var(--mute);font-weight:400;font-family:'Segoe UI',system-ui,sans-serif}
.feature[open]>summary{border-bottom:3px solid #000;background:rgba(29,63,216,.25)}
.feature .body{padding:6px 22px 16px}.feature .body li{margin:9px 0}
.reads{margin:12px 0 0;padding:10px 12px;border-left:5px solid var(--yellow);background:rgba(255,216,58,.08);font-size:14px}
.tray{columns:2;column-gap:28px;margin:0;padding-left:20px}.tray li{margin:4px 0;break-inside:avoid}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 10px;text-align:left;border-bottom:2px solid #000;vertical-align:top}th{color:var(--yellow);font:900 12px var(--comic);text-transform:uppercase}
td code{color:var(--yellow)}
details.faq{background:rgba(5,6,13,.72);border:3px solid #000;border-radius:10px;margin:0 0 10px;box-shadow:4px 4px 0 #000}
details.faq summary{cursor:pointer;padding:11px 14px;font-weight:700}details.faq p{margin:0;padding:0 16px 14px;color:#dfe5ff}
.hidden{display:none!important}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:8px 18px;background:var(--yellow);color:#111;font:900 14px var(--comic);border:3px solid #000;box-shadow:4px 4px 0 #000;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.on{opacity:1}
footer{padding:26px;text-align:center;color:var(--mute);border-top:4px solid #000;font-size:14px}
@media(max-width:860px){.layout{grid-template-columns:1fr}nav{position:static;max-height:none}.tray{columns:1}}
`

const JS = `
const q=document.getElementById('q');
const blocks=[...document.querySelectorAll('[data-s]')];
q.addEventListener('input',()=>{const t=q.value.trim().toLowerCase();let n=0;
 blocks.forEach(b=>{const hit=!t||b.dataset.s.includes(t);b.classList.toggle('hidden',!hit);if(hit&&t)n++;if(b.tagName==='DETAILS'&&t)b.open=hit});
 document.getElementById('count').textContent=t?n+' match'+(n===1?'':'es'):''});
const toast=document.getElementById('toast');
document.addEventListener('click',e=>{const c=e.target.closest('code[data-copy]');if(!c)return;
 (navigator.clipboard?navigator.clipboard.writeText(c.dataset.copy):Promise.reject()).then(()=>{toast.textContent='COPIED: '+c.dataset.copy;toast.classList.add('on');setTimeout(()=>toast.classList.remove('on'),1400)}).catch(()=>{})});
`

function render(D) {
  const s = (...parts) => esc(parts.join(' ').toLowerCase())

  const nav = [
    ['start', 'Start here'],
    ['hotkeys', 'Hotkeys'],
    ['karen', 'Karen commands'],
    ['features', 'Features in depth'],
    ['tray', 'Tray menu'],
    ['privacy', 'Privacy & data'],
    ['trouble', 'Troubleshooting'],
    ['cli', 'Command line']
  ]
    .map(([id, t]) => `<a href="#${id}">${t}</a>`)
    .join('')

  const featureNav = D.features.map((f) => `<a href="#${f.id}">${esc(f.icon)} ${esc(f.name.split(' — ')[0])}</a>`).join('')

  const karen = D.karen
    .map(
      (g) => `
    <h3>${esc(g.group)}</h3>
    <div class="cmds">${g.items
      .map(
        (it) => `
      <div class="cmd" data-s="${s(it.say, it.does, ...(it.aka || []))}">
        <code data-copy="${esc(it.try)}" title="Click to copy an example">${esc(it.say)}</code>
        <p>${esc(it.does)}</p>
        ${it.aka && it.aka.length ? `<small>also: ${it.aka.map(esc).join(' · ')}</small>` : ''}
        ${it.note ? `<small class="note">${esc(it.note)}</small>` : ''}
      </div>`
      )
      .join('')}</div>`
    )
    .join('')

  const features = D.features
    .map(
      (f) => `
    <details class="card feature red" id="${f.id}" data-s="${s(f.name, f.summary, ...f.how, f.reads || '')}">
      <summary><span class="ico">${esc(f.icon)}</span><span class="ttl">${esc(f.name)}<span class="sum">${esc(f.summary)}</span></span></summary>
      <div class="body"><ul>${f.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
      ${f.reads ? `<div class="reads"><b>What it reads:</b> ${esc(f.reads)}</div>` : ''}</div>
    </details>`
    )
    .join('')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
<title>Spidey Sense — manual</title>
<style>${CSS}</style></head><body>
<header class="hero">
  <h1>SPIDEY <em>SENSE</em></h1>
  <p>${esc(D.tagline)} ${esc(D.intro)}</p>
  <span class="badge">THE COMPLETE MANUAL</span>
</header>
<div class="layout">
<nav>
  <input id="q" type="search" placeholder="Search everything…" aria-label="Search the manual"><div id="count" style="font-size:12px;color:var(--mute);min-height:18px;margin-top:4px"></div>
  <b>GUIDE</b>${nav}
  <b>FEATURES</b>${featureNav}
</nav>
<main>
  <section id="start"><h2>🚀 Start here</h2>
    <div class="card blue"><ol class="steps">${D.quickstart.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>
  </section>

  <section id="hotkeys"><h2>⌨ Hotkeys</h2>
    <div class="keys">${D.hotkeys
      .map(
        (k) =>
          `<div class="card" data-s="${s(k.keys, k.does)}"><div>${k.keys
            .split('+')
            .map((p) => `<kbd>${esc(p)}</kbd>`)
            .join('+')}</div><p style="margin:8px 0 0">${esc(k.does)}</p></div>`
      )
      .join('')}</div>
  </section>

  <section id="karen"><h2>🤖 Karen — everything you can type</h2>
    <div class="card red"><b>How:</b> press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>K</kbd> (or click the box in the panel), type, press <kbd>Enter</kbd>. <b>Click any yellow command below to copy an example.</b>
      <ul>${D.karenNotes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>
    ${karen}
  </section>

  <section id="features"><h2>🕸 Features in depth</h2>${features}</section>

  <section id="tray"><h2>🕷 Tray menu</h2>
    <div class="card" data-s="${s('tray menu', ...D.tray)}"><p style="margin-top:0">Right-click the red spider next to the clock:</p>
    <ul class="tray">${D.tray.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
  </section>

  <section id="privacy"><h2>🔒 Privacy & your data</h2>
    <div class="card blue" data-s="${s('privacy', ...D.privacy)}"><ul>${D.privacy.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>
    <div class="card" data-s="${s('data files storage', ...D.data.map((d) => d.what + d.where))}"><table><tr><th>What</th><th>Where</th><th>Notes</th></tr>
      ${D.data.map((d) => `<tr><td>${esc(d.what)}</td><td><code>${esc(d.where)}</code></td><td>${esc(d.note)}</td></tr>`).join('')}</table></div>
  </section>

  <section id="trouble"><h2>🛠 Troubleshooting</h2>
    ${D.troubleshooting.map((t) => `<details class="faq" data-s="${s(t.q, t.a)}"><summary>${esc(t.q)}</summary><p>${esc(t.a)}</p></details>`).join('')}
  </section>

  <section id="cli"><h2>⌨ The command line</h2>
    <div class="card" data-s="command line cli spidey.cmd terminal"><p style="margin-top:0">Prefer a terminal? The installer drops a <code>spidey.cmd</code> next to the app. From a checkout use <code>node bin/spidey.js</code> (or <code>npm run help</code>).</p>
    <table><tr><th>Command</th><th>Shows</th></tr>
    <tr><td><code>spidey help</code></td><td>Overview and topics</td></tr>
    <tr><td><code>spidey commands</code></td><td>Every Karen command with examples</td></tr>
    <tr><td><code>spidey features</code> · <code>spidey feature guardian</code></td><td>Feature list, or one feature in full</td></tr>
    <tr><td><code>spidey hotkeys</code> · <code>tray</code> · <code>privacy</code> · <code>data</code> · <code>troubleshoot</code></td><td>The matching section of this manual</td></tr>
    <tr><td><code>spidey search ram</code></td><td>Search the whole manual</td></tr>
    <tr><td><code>spidey docs</code></td><td>Open this page</td></tr></table></div>
  </section>
</main></div>
<footer>Spidey Sense · fan-made, not affiliated with Marvel · all artwork is original/procedural · <a href="${esc(D.repo)}">${esc(D.repo)}</a></footer>
<div class="toast" id="toast" role="status"></div>
<script>${JS}</script>
</body></html>
`
}

module.exports = { render, esc }

if (require.main === module) {
  const D = require('../help-data')
  const html = render(D)
  const root = path.join(__dirname, '..')
  for (const file of ['docs/index.html', 'renderer/help.html']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), html)
    console.log('wrote', file, `(${Math.round(html.length / 1024)} KB)`)
  }
}
