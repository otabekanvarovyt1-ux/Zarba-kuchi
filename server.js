/* Zarba Kuchi — onlayn xona serveri.
   Server o'yinni HISOBLAMAYDI: faqat xonalarni boshqaradi va xabarlarni (tugma bosishlar) o'yinchilar o'rtasida uzatadi. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const INDEX = path.join(__dirname, 'public', 'index.html');
const MAX = 4;
const MODES = { '1v1': [2, 2], '2v2': [4, 4], ffa: [2, 4] };
const rooms = new Map();

const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (u === '/' || u === '/index.html') {
    fs.readFile(INDEX, (e, d) => {
      if (e) { res.writeHead(500); return res.end('index.html topilmadi'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(d);
    });
    return;
  }
  const MIME = { '.png': 'image/png', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };
  const fp = path.join(__dirname, 'public', path.normalize(decodeURIComponent(u)).replace(/^(\.\.[\/\\])+/, ''));
  if (fp.startsWith(path.join(__dirname, 'public') + path.sep) && MIME[path.extname(fp).toLowerCase()]) {
    fs.readFile(fp, (e, d) => {
      if (e) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()], 'Cache-Control': 'public, max-age=3600' });
      res.end(d);
    });
    return;
  }
  res.writeHead(404); res.end('404');
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192 });
const LAG = +process.env.LAG_MS || 0;   /* faqat sinov uchun: sun'iy kechikish */
const send = (ws, m) => { const d = JSON.stringify(m); const go = () => { if (ws.readyState === 1) ws.send(d); }; LAG ? setTimeout(go, LAG) : go(); };
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() {
  for (let k = 0; k < 200; k++) {
    let c = ''; for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}
const roomMsg = r => ({
  t: 'room', code: r.code, host: r.host, playing: r.playing, cfg: r.cfg,
  players: [...r.pl.entries()].sort((a, b) => a[0] - b[0]).map(([slot, p]) => ({ slot, ch: p.ch, ready: p.ready }))
});
const bcast = (r, m, except) => { for (const p of r.pl.values()) if (p.ws !== except) send(p.ws, m); };
const pushRoom = r => bcast(r, roomMsg(r));

function leave(ws) {
  const r = ws.room; if (!r) return;
  const slot = ws.slot;
  r.pl.delete(slot); ws.room = null;
  if (slot === r.host || r.pl.size === 0) {          /* xona egasi chiqdi: xona yopiladi */
    bcast(r, { t: 'closed' });
    for (const p of r.pl.values()) p.ws.room = null;
    rooms.delete(r.code); return;
  }
  if (r.playing) bcast(r, { t: 'left', s: slot });
  pushRoom(r);
}

wss.on('connection', ws => {
  ws.alive = true; ws.room = null; ws.slot = -1; ws.n = 0; ws.t0 = Date.now();
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => {
    /* oddiy tezlik chegarasi: soniyasiga ~200 xabar */
    const now = Date.now();
    if (now - ws.t0 > 1000) { ws.t0 = now; ws.n = 0; }
    if (++ws.n > 600) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const r = ws.room;
    switch (m.t) {
      case 'create': {
        if (r) leave(ws);
        const code = newCode(); if (!code) return send(ws, { t: 'err', m: 'full' });
        const nr = { code, host: 0, playing: false, cfg: { mode: '1v1', arena: -1 }, pl: new Map() };
        nr.pl.set(0, { ws, ch: 0, ready: false });
        ws.room = nr; ws.slot = 0; rooms.set(code, nr);
        send(ws, { t: 'joined', slot: 0 }); pushRoom(nr); break;
      }
      case 'join': {
        if (r) leave(ws);
        const nr = rooms.get(String(m.code || '').toUpperCase().slice(0, 4));
        if (!nr) return send(ws, { t: 'err', m: 'nocode' });
        if (nr.playing) return send(ws, { t: 'err', m: 'playing' });
        let slot = -1; for (let i = 0; i < MAX; i++) if (!nr.pl.has(i)) { slot = i; break; }
        if (slot < 0) return send(ws, { t: 'err', m: 'full' });
        nr.pl.set(slot, { ws, ch: slot % 24, ready: false });
        ws.room = nr; ws.slot = slot;
        send(ws, { t: 'joined', slot }); pushRoom(nr); break;
      }
      case 'pick': {
        if (!r || r.playing) return;
        const p = r.pl.get(ws.slot); if (!p) return;
        if (Number.isInteger(m.ch) && m.ch >= 0 && m.ch < 64) p.ch = m.ch;
        p.ready = !!m.ready; pushRoom(r); break;
      }
      case 'cfg': {
        if (!r || r.playing || ws.slot !== r.host) return;
        if (MODES[m.mode]) r.cfg.mode = m.mode;
        if (Number.isInteger(m.arena) && m.arena >= -1 && m.arena < 64) r.cfg.arena = m.arena;
        for (const p of r.pl.values()) p.ready = false;
        pushRoom(r); break;
      }
      case 'start': {
        if (!r || r.playing || ws.slot !== r.host) return;
        const n = r.pl.size, [lo, hi] = MODES[r.cfg.mode];
        if (n < lo || n > hi) return send(ws, { t: 'err', m: 'count' });
        for (const p of r.pl.values()) if (!p.ready) return send(ws, { t: 'err', m: 'notready' });
        const c = m.cfg || {};
        const cfg = {
          mode: r.cfg.mode, arena: Number.isInteger(c.arena) ? c.arena : 0, seed: (Math.random() * 4294967295) >>> 0,
          pw: 420, rounds: [1, 2, 3].includes(c.rounds) ? c.rounds : 2, time: [0, 30, 60, 99].includes(c.time) ? c.time : 60,
          aim: ['auto', 'assist', 'manual'].includes(c.aim) ? c.aim : 'auto'
        };
        const players = [...r.pl.entries()].sort((a, b) => a[0] - b[0]).map(([slot, p]) => ({ slot, ch: p.ch }));
        r.playing = true; for (const p of r.pl.values()) p.ready = false;
        bcast(r, { t: 'start', cfg, players }); break;
      }
      case 'lobby': { if (r && r.playing) { r.playing = false; pushRoom(r); } break; }
      case 'in': case 'snap': {
        if (!r || !r.playing) return;
        m.s = ws.slot;
        if (m.t === 'snap' && ws.slot !== r.host) return;
        bcast(r, m, ws); break;
      }
      case 'ping': send(ws, { t: 'pong', c: m.c }); break;
    }
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => { try { ws.terminate(); } catch (e) {} });
});

/* o'lik ulanishlarni tozalash */
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false; try { ws.ping(); } catch (e) {}
  }
}, 20000);

server.listen(PORT, () => console.log('Zarba Kuchi server: http://localhost:' + PORT));
