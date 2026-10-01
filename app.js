/* 紫晶設計｜專案管理系統 主程式（一般不需要修改） */
(function(){
'use strict';
/* =====================================================================
 * 紫晶設計｜專案管理系統
 * 純前端網頁程式，可直接放在 GitHub Pages。
 * 資料存放在 config.js 指定的 GitHub 倉庫（多人共用）；
 * 未設定時自動改為「單機模式」，資料存於此瀏覽器。
 * ===================================================================== */

const APP_VERSION = '1.0.0';
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const STATUS = [
  { v: '', t: '未標記', sym: '○', cls: 'none' },
  { v: 'doing', t: '進行中', sym: '◐', cls: 'doing' },
  { v: 'done', t: '已完成', sym: '✓', cls: 'done' },
  { v: 'delay', t: '延宕', sym: '!', cls: 'delay' },
  { v: 'moved', t: '另作安排', sym: '↪', cls: 'moved' },
  { v: 'cancel', t: '取消', sym: '✕', cls: 'cancel' },
];
const ST = Object.fromEntries(STATUS.map(s => [s.v, s]));
const PALETTE = ['#46607A', '#2E7D8C', '#C0582B', '#3B7A3E', '#A63D6B', '#35609C', '#8C6D1F', '#1F7A6E', '#7A3FA0', '#B0402F', '#4F5D75', '#6B4E3D'];
const HOURS = [['ot', '加班'], ['comp', '補休'], ['personal', '事假'], ['sick', '病假'], ['annual', '特休']];
const SIDE_NAME = { ours: '紫晶進度', client: '單位進度' };

const DEFAULT_HOLIDAYS = `# 格式：日期 名稱（一行一筆）。名稱含「補班」代表該日要上班。
# 依據行政院人事行政總處公告之 115、116 年政府行政機關辦公日曆表
2026-09-25 中秋節
2026-09-28 孔子誕辰紀念日
2026-10-09 國慶日補假
2026-10-10 國慶日
2026-10-25 臺灣光復節
2026-10-26 光復節補假
2026-12-25 行憲紀念日
2027-01-01 開國紀念日
2027-02-04 小年夜
2027-02-05 除夕
2027-02-06 春節初一
2027-02-07 春節初二
2027-02-08 春節初三
2027-02-09 春節補假
2027-02-10 春節補假
2027-02-28 和平紀念日
2027-03-01 和平紀念日補假
2027-04-04 兒童節
2027-04-05 清明節
2027-04-06 兒童節補假
2027-04-30 勞動節補假
2027-05-01 勞動節
2027-06-09 端午節
2027-09-15 中秋節
2027-09-28 孔子誕辰紀念日
2027-10-10 國慶日
2027-10-11 國慶日補假
2027-10-25 臺灣光復暨金門古寧頭大捷紀念日
2027-12-24 行憲紀念日補假
2027-12-25 行憲紀念日
2027-12-31 開國紀念日補假`;

function defaultConfig() {
  return {
    app: 'zijing-pm', version: 1, company: '紫晶設計',
    staff: [
      { id: 'zhuang', name: '阿莊', prefix: '莊', color: '#46607A', pin: '' },
      { id: 'tong', role: 'design', name: '阿彤', prefix: '彤', color: '#2E7D8C', pin: '' },
    ],
    bossPin: '',
    range: { start: '2026-09-25', end: '2027-09-25' },
    holidays: DEFAULT_HOLIDAYS,
  };
}
function emptyStaff() { return { projects: [], milestones: [], logs: {}, deleted: {}, links: [] }; }

/* ---------------- small utilities ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const now = () => Date.now();
const clone = o => JSON.parse(JSON.stringify(o));
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return ymd(d); };
const dowOf = s => toDate(s).getDay();
const todayStr = () => ymd(new Date());
const md = s => { const d = toDate(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const mdw = s => `${md(s)}(${WEEK[dowOf(s)]})`;
const mondayOf = s => { const w = dowOf(s); return addDays(s, w === 0 ? -6 : 1 - w); };
const monthStart = s => s.slice(0, 8) + '01';
const addMonths = (s, n) => { const d = toDate(monthStart(s)); d.setMonth(d.getMonth() + n); return ymd(d); };
const monthEnd = s => addDays(addMonths(s, 1), -1);
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const clampDate = (s, a, b) => (s < a ? a : s > b ? b : s);
const byId = (arr, id) => arr.find(x => x.id === id);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

/* ---------------- app state ---------------- */
const S = {
  config: null,          // {rev, data}
  docs: {},              // sid -> {rev, data}
  fetchedAt: {},
  route: {},
  ui: { showClosed: false, filters: {} },
  unlocked: JSON.parse(sessionStorage.getItem('zjpm.unlock') || '{}'),
};
const CFG = () => S.config.data;
const D = sid => S.docs[sid].data;
const staffOf = sid => CFG().staff.find(s => s.id === sid);
const RANGE = () => CFG().range;

/* ---------------- holidays ---------------- */
let HOL = {};
function parseHolidays(text) {
  const map = {};
  String(text || '').split(/\r?\n/).forEach(line => {
    const m = line.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    if (m) map[m[1]] = { name: m[2].trim(), work: /補班/.test(m[2]) };
  });
  return map;
}
function refreshHolidays() { HOL = parseHolidays(CFG().holidays); }
function isWeekend(s) { const w = dowOf(s); return w === 0 || w === 6; }
function isOff(s) { const h = HOL[s]; if (h) return !h.work; return isWeekend(s); }
function prevWorkday(s, lim = 14) { let d = s; for (let i = 0; i < lim; i++) { d = addDays(d, -1); if (!isOff(d)) return d; } return addDays(s, -1); }
function nextWorkday(s, lim = 14) { let d = s; for (let i = 0; i < lim; i++) { d = addDays(d, 1); if (!isOff(d)) return d; } return addDays(s, 1); }

/* ---------------- storage layer ----------------
 * 共用模式：資料以 JSON 檔存放在 GitHub 倉庫（config.js 的 dataRepo），
 *           透過 GitHub API 讀寫，每次儲存都是一筆 commit，可追溯歷史。
 * 單機模式：沒有設定 dataRepo 時，資料存在這台電腦的瀏覽器。
 * ------------------------------------------------ */
class AuthError extends Error {}
const SETTINGS = Object.assign({ dataRepo: '', folder: 'data' }, window.ZJ_SETTINGS || {});
SETTINGS.dataRepo = String(SETTINGS.dataRepo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
SETTINGS.folder = String(SETTINGS.folder || 'data').replace(/^\/+|\/+$/g, '');
function b64encode(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(String(b64 || '').replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
const Store = {
  mode: 'local',          // 'server' = GitHub 共用；'local' = 單機；'auth' = 需要輸入權杖
  note: '',
  token: localStorage.getItem('zjpm.gh') || '',
  staleRevs: new Set(),   // 自己已經覆寫過的舊版本（避免 GitHub 快取回傳舊資料時蓋掉畫面）
  api(path) { return 'https://api.github.com/repos/' + SETTINGS.dataRepo + path; },
  hdr(json) {
    const h = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + this.token };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  },
  path(key) { return (SETTINGS.folder ? SETTINGS.folder + '/' : '') + key + '.json'; },
  async detect() {
    this.note = '';
    if (!SETTINGS.dataRepo) { this.note = 'norepo'; return (this.mode = 'local'); }
    if (!this.token) { this.note = ''; return (this.mode = 'auth'); }
    let r;
    try { r = await fetch(this.api('') + '?t=' + now(), { headers: this.hdr(), cache: 'no-store' }); }
    catch (e) { this.note = 'offline'; return (this.mode = 'error'); }
    if (r.status === 401) { this.note = 'badtoken'; return (this.mode = 'auth'); }
    if (r.status === 403 || r.status === 404) { this.note = 'noaccess'; return (this.mode = 'auth'); }
    if (!r.ok) { this.note = 'offline'; return (this.mode = 'error'); }
    return (this.mode = 'server');
  },
  async getOne(key) {
    const r = await fetch(this.api('/contents/' + this.path(key)) + '?t=' + now(), { headers: this.hdr(), cache: 'no-store' });
    if (r.status === 404) return null;
    if (r.status === 401) throw new AuthError('auth');
    if (!r.ok) throw new Error('讀取失敗（GitHub ' + r.status + '）');
    const j = await r.json();
    let b64 = j.content;
    if ((!b64 || j.encoding === 'none') && j.sha) {       // 超過 1MB 的檔案改用 blob 讀取
      const rb = await fetch(this.api('/git/blobs/' + j.sha), { headers: this.hdr(), cache: 'no-store' });
      if (!rb.ok) throw new Error('讀取失敗（GitHub ' + rb.status + '）');
      b64 = (await rb.json()).content;
    }
    let obj = null; try { obj = JSON.parse(b64decode(b64)); } catch (e) { obj = null; }
    return { rev: j.sha, data: obj && obj.data !== undefined ? obj.data : obj };
  },
  async load(keys) {
    const res = {};
    if (this.mode === 'server') {
      const arr = await Promise.all(keys.map(k => this.getOne(k)));
      keys.forEach((k, i) => { res[k] = arr[i]; });
      return res;
    }
    keys.forEach(k => { try { res[k] = JSON.parse(localStorage.getItem('zjpm:' + k) || 'null'); } catch (e) { res[k] = null; } });
    return res;
  },
  async save(key, data, baseRev, force) {
    if (this.mode === 'server') {
      if (force) { const cur = await this.getOne(key); baseRev = cur ? cur.rev : 0; }
      const body = {
        message: '更新 ' + key + '（' + new Date().toLocaleString('zh-TW', { hour12: false }) + '）',
        content: b64encode(JSON.stringify({ app: 'zijing-pm', savedAt: new Date().toISOString(), data }, null, 1)),
      };
      if (baseRev) body.sha = baseRev;
      const r = await fetch(this.api('/contents/' + this.path(key)), { method: 'PUT', headers: this.hdr(true), body: JSON.stringify(body) });
      if (r.status === 401) throw new AuthError('auth');
      if (r.status === 409 || r.status === 422) {        // 別人先存了新版本
        await new Promise(ok => setTimeout(ok, 600));
        return { conflict: true, doc: await this.getOne(key) };
      }
      if (r.status === 429 || (r.status === 403 && (r.headers.get('x-ratelimit-remaining') === '0' || /rate limit/i.test(await r.clone().text())))) {
        const e = new Error('儲存太頻繁，GitHub 暫時限制，1 分鐘後自動重試'); e.rate = true; throw e;
      }
      if (r.status === 403 || r.status === 404) throw new Error('沒有寫入權限，請確認權杖有此倉庫的 Contents 讀寫權限');
      if (!r.ok) throw new Error('儲存失敗（GitHub ' + r.status + '）');
      const j = await r.json();
      if (baseRev) this.staleRevs.add(baseRev);
      return { rev: j.content.sha };
    }
    let cur = null; try { cur = JSON.parse(localStorage.getItem('zjpm:' + key) || 'null'); } catch (e) { cur = null; }
    const rev = (cur ? cur.rev : 0) + 1;
    try {
      localStorage.setItem('zjpm:' + key, JSON.stringify({ rev, savedAt: new Date().toISOString(), data }));
    } catch (e) { throw new Error('瀏覽器儲存空間已滿，請到「系統設定」下載備份'); }
    return { rev };
  },
};

/* ---------------- normalize & merge ---------------- */
function normalizeConfig(c) {
  const d = defaultConfig();
  c = c && typeof c === 'object' ? c : {};
  const out = Object.assign({}, d, c);
  out.range = Object.assign({}, d.range, c.range || {});
  if (!Array.isArray(out.staff)) out.staff = d.staff;
  out.staff = out.staff.filter(s => s && s.id).map(s => Object.assign({ name: '未命名', prefix: '', color: PALETTE[0], pin: '', role: 'pm' }, s));
  out.staff.forEach(s => { if (s.role !== 'design') s.role = 'pm'; });
  if (typeof out.holidays !== 'string') out.holidays = d.holidays;
  return out;
}
function normalizeStaff(x) {
  const d = x && typeof x === 'object' ? x : {};
  const out = emptyStaff();
  out.projects = Array.isArray(d.projects) ? d.projects.filter(p => p && p.id) : [];
  out.milestones = Array.isArray(d.milestones) ? d.milestones.filter(m => m && m.id && isDate(m.date)) : [];
  out.logs = d.logs && typeof d.logs === 'object' && !Array.isArray(d.logs) ? d.logs : {};
  out.deleted = d.deleted && typeof d.deleted === 'object' && !Array.isArray(d.deleted) ? d.deleted : {};
  out.links = Array.isArray(d.links) ? d.links.filter(l => l && l.id && l.sid && l.pid) : [];
  Object.keys(out.logs).forEach(k => {
    const L = out.logs[k];
    if (!L || typeof L !== 'object') { delete out.logs[k]; return; }
    if (!Array.isArray(L.tasks)) L.tasks = [];
    if (!L.auto || typeof L.auto !== 'object' || Array.isArray(L.auto)) L.auto = {};
    if (!L.hours || typeof L.hours !== 'object' || Array.isArray(L.hours)) L.hours = {};
  });
  return out;
}
/** 合併兩份同一人員的資料（本機 a、雲端 b）：逐筆比較更新時間，主管回饋獨立合併 */
function mergeStaff(a, b) {
  const out = emptyStaff();
  out.deleted = Object.assign({}, b.deleted, a.deleted);
  const mergeArr = (x, y) => {
    const m = new Map();
    y.forEach(it => m.set(it.id, it));
    x.forEach(it => { const o = m.get(it.id); if (!o || (it.u || 0) >= (o.u || 0)) m.set(it.id, it); });
    return Array.from(m.values()).filter(it => !out.deleted[it.id]).map(clone);
  };
  out.projects = mergeArr(a.projects, b.projects);
  out.milestones = mergeArr(a.milestones, b.milestones);
  out.links = mergeArr(a.links || [], b.links || []);
  // 同一格出現兩筆時合併文字
  const seen = {};
  out.milestones = out.milestones.filter(m => {
    const k = m.projectId + '|' + m.date + '|' + m.side;
    if (seen[k]) { if (m.text && !seen[k].text.includes(m.text)) seen[k].text += '\n' + m.text; out.deleted[m.id] = now(); return false; }
    seen[k] = m; return true;
  });
  new Set([...Object.keys(a.logs), ...Object.keys(b.logs)]).forEach(d => {
    const x = a.logs[d], y = b.logs[d];
    let r = !x ? clone(y) : !y ? clone(x) : clone((x.u || 0) >= (y.u || 0) ? x : y);
    const bx = x && x.boss, by = y && y.boss;
    const bb = !bx ? by : !by ? bx : ((bx.at || 0) >= (by.at || 0) ? bx : by);
    if (bb) r.boss = clone(bb); else delete r.boss;
    out.logs[d] = r;
  });
  return normalizeStaff(out);
}

/* ---------------- sync (auto-save) ---------------- */
const Sync = {
  dirty: new Set(), timer: null, busy: false, again: false, state: 'saved',
  mark(key) {
    this.dirty.add(key);
    this.set('pending');
    clearTimeout(this.timer);
    // 共用模式每次儲存都是一筆 GitHub 紀錄：停止輸入 3 秒後才存，且兩次儲存至少間隔 10 秒
    const wait = Store.mode === 'server' ? Math.max(3000, 10000 - (now() - (this.lastFlush || 0))) : 700;
    this.timer = setTimeout(() => this.flush(), wait);
  },
  holder(key) { return key === 'config' ? S.config : S.docs[key.slice(6)]; },
  set(st, msg) {
    this.state = st;
    const el = $('#savestate');
    if (!el) return;
    el.className = 'savestate ' + st;
    el.textContent = st === 'saved' ? (Store.mode === 'server' ? '已儲存到雲端' : '已存於此電腦') : st === 'pending' ? '儲存中…' : (msg || '無法儲存，稍後自動重試');
  },
  async flush() {
    if (this.busy) { this.again = true; return; }
    this.busy = true; this.lastFlush = now();
    let failed = false, merged = false, retryIn = 5000;
    for (const key of Array.from(this.dirty)) {
      this.dirty.delete(key);
      const h = this.holder(key);
      if (!h) continue;
      try {
        let res = await Store.save(key, h.data, h.rev);
        if (res.conflict) {
          const remote = res.doc;
          if (key === 'config') {
            res = await Store.save(key, h.data, remote ? remote.rev : 0);
          } else {
            h.data = mergeStaff(h.data, normalizeStaff(remote ? remote.data : null));
            res = await Store.save(key, h.data, remote ? remote.rev : 0);
            merged = true;
          }
          if (res.conflict) throw new Error('conflict');
        }
        h.rev = res.rev;
        if (key !== 'config') S.fetchedAt[key.slice(6)] = now();
      } catch (e) {
        console.error(e);
        this.dirty.add(key); failed = true;
        if (e instanceof AuthError) { location.reload(); return; }
        if (e.rate) retryIn = 60000;
        this.set('error', String(e.message || '').includes('儲存空間') || e.rate ? e.message : null);
      }
    }
    this.busy = false;
    if (failed) { setTimeout(() => this.flush(), retryIn); return; }
    if (merged) { toast('已與其他裝置上的最新內容合併'); render({ keepScroll: true }); }
    if (this.again || this.dirty.size) { this.again = false; if (this.dirty.size) return this.flush(); }
    this.set('saved');
  },
};
function touchStaff(sid) { Sync.mark('staff_' + sid); }
function touchConfig() { Sync.mark('config'); }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && Sync.dirty.size && !Sync.busy) { clearTimeout(Sync.timer); Sync.flush(); }
});
window.addEventListener('beforeunload', e => {
  if (Sync.dirty.size || Sync.busy) { Sync.flush(); e.preventDefault(); e.returnValue = ''; }
});

async function loadAll() {
  const docs = await Store.load(['config']);
  if (docs.config && docs.config.data) {
    S.config = { rev: docs.config.rev, data: normalizeConfig(docs.config.data) };
  } else {
    S.config = { rev: 0, data: defaultConfig() };
    const r = await Store.save('config', S.config.data, 0);
    if (r.rev) S.config.rev = r.rev;
    else if (r.conflict && r.doc) S.config = { rev: r.doc.rev, data: normalizeConfig(r.doc.data) };
  }
  refreshHolidays();
  await loadStaffDocs(CFG().staff.map(s => s.id));
}
async function loadStaffDocs(ids) {
  if (!ids.length) return false;
  const docs = await Store.load(ids.map(id => 'staff_' + id));
  let changed = false;
  ids.forEach(id => {
    const key = 'staff_' + id;
    if (Sync.dirty.has(key)) return;
    const d = docs[key];
    const cur = S.docs[id];
    const rev = d ? d.rev : 0;
    if (cur && d && Store.staleRevs.has(rev)) { return; }
    if (!cur || cur.rev !== rev) { S.docs[id] = { rev, data: normalizeStaff(d ? d.data : null) }; changed = true; }
    S.fetchedAt[id] = now();
  });
  return changed;
}
async function refreshIfStale(ids, maxAge = 15000) {
  if (Store.mode !== 'server') return false;
  const stale = ids.filter(id => !S.fetchedAt[id] || now() - S.fetchedAt[id] > maxAge);
  if (!stale.length) return false;
  try { return await loadStaffDocs(stale); } catch (e) { console.warn(e); return false; }
}

/* ---------------- data helpers ---------------- */
function sortedProjects(doc, includeClosed = true) {
  const order = { active: 0, paused: 1, closed: 2 };
  return doc.projects
    .filter(p => includeClosed || p.status !== 'closed')
    .slice().sort((a, b) => (order[a.status] || 0) - (order[b.status] || 0) || String(a.code || '').localeCompare(String(b.code || ''), 'zh-Hant', { numeric: true }) || (a.created || 0) - (b.created || 0));
}
/* ---------- 參與的專案（連結到其他人管理的專案，唯讀、即時連動） ---------- */
const ROLE_NAME = { pm: '企劃編輯', design: '設計' };
const roleOf = sid => { const s = staffOf(sid); return s && s.role === 'design' ? 'design' : 'pm'; };
/** 某人參與的專案：[{ link, owner, p }]（p 為管理者那邊的專案；找不到的連結不列入） */
function linkedOf(sid) {
  const doc = S.docs[sid] && S.docs[sid].data; if (!doc) return [];
  const out = [], seen = new Set((doc.projects || []).map(p => p.id));
  (doc.links || []).forEach(l => {
    const od = S.docs[l.sid] && S.docs[l.sid].data; const owner = staffOf(l.sid);
    if (!od || !owner || l.sid === sid) return;
    const p = byId(od.projects, l.pid);
    if (!p || seen.has(p.id)) return;
    seen.add(p.id); out.push({ link: l, owner, p });
  });
  return out;
}
function danglingLinks(sid) {
  const doc = S.docs[sid] && S.docs[sid].data; if (!doc) return [];
  const ok = new Set(linkedOf(sid).map(x => x.link.id));
  return (doc.links || []).filter(l => !ok.has(l.id));
}
/** 讀取用的合併資料：自己的專案＋參與的專案（期程直接取自管理者，所以會自動連動）。只用於顯示，不可拿來新增或刪除專案、期程。 */
function V(sid) {
  const doc = D(sid);
  const linked = linkedOf(sid);
  if (!linked.length) return doc;
  const projects = doc.projects.slice(), milestones = doc.milestones.slice();
  linked.forEach(({ link, owner, p }) => {
    projects.push(Object.assign({}, p, { link: { id: link.id, sid: owner.id, name: owner.name } }));
    D(owner.id).milestones.forEach(m => { if (m.projectId === p.id) milestones.push(m); });
  });
  return Object.assign({}, doc, { projects, milestones });
}
/** 哪些人參與了 owner 的這個專案 */
function participantsOf(ownerSid, pid) {
  return CFG().staff.filter(s => s.id !== ownerSid && S.docs[s.id] && (D(s.id).links || []).some(l => l.sid === ownerSid && l.pid === pid));
}
function linkOwners(sid) {
  const doc = S.docs[sid] && S.docs[sid].data;
  return doc ? Array.from(new Set((doc.links || []).map(l => l.sid))).filter(id => id !== sid && staffOf(id)) : [];
}
/** 專案簡稱（2～4 字），顯示在日曆、工作日誌與期程提醒；未填時取專案名稱前 4 字 */
function shortOf(p) {
  if (!p) return '其他';
  const s = String(p.short || '').trim();
  if (s) return s;
  const n = String(p.name || '').trim();
  return n ? Array.from(n).slice(0, 4).join('') : (p.code || '專案');
}
const fullOf = p => p ? `${p.code ? p.code + ' ' : ''}${p.name || ''}` : '';
function projLabel(p) { return p ? shortOf(p) : '其他'; }
function nextCode(sid) {
  const st = staffOf(sid); const pre = st.prefix || st.name.replace(/^阿/, '').slice(0, 1);
  let max = 0;
  D(sid).projects.forEach(p => { const m = String(p.code || '').match(/(\d+)$/); if (m && String(p.code).startsWith(pre)) max = Math.max(max, +m[1]); });
  return pre + pad2(max + 1);
}
function findCell(doc, pid, date, side) { return doc.milestones.find(m => m.projectId === pid && m.date === date && m.side === side); }
function delMilestone(doc, m) {
  doc.milestones = doc.milestones.filter(x => x !== m);
  doc.deleted[m.id] = now();
}
function getLog(doc, date, create) {
  let L = doc.logs[date];
  if (!L && create) L = doc.logs[date] = { u: now(), auto: {}, tasks: [], hours: {}, remark: '' };
  return L || null;
}
function staffTouchLog(L) { L.u = now(); }
/** 某日的專案期程（含期間型的延續日） */
function milestonesOn(doc, date, opts = {}) {
  const res = [];
  const pmap = Object.fromEntries(doc.projects.map(p => [p.id, p]));
  doc.milestones.forEach(m => {
    if (!m.text || !m.text.trim()) return;
    const p = pmap[m.projectId]; if (!p) return;
    if (m.date === date) res.push({ m, p, cont: false });
    else if (m.endDate && m.date < date && date <= m.endDate && (opts.includeOff || !isOff(date))) res.push({ m, p, cont: true });
  });
  return res.sort((a, b) => String(a.p.code || '').localeCompare(String(b.p.code || ''), 'zh-Hant', { numeric: true }) || (a.m.side === b.m.side ? 0 : a.m.side === 'ours' ? -1 : 1));
}
/** 一段期間的期程對照表 date -> [{m,p,cont}] */
function milestoneMap(doc, from, to, filter) {
  const map = {};
  const pmap = Object.fromEntries(doc.projects.map(p => [p.id, p]));
  doc.milestones.forEach(m => {
    if (!m.text || !m.text.trim()) return;
    const p = pmap[m.projectId]; if (!p) return;
    if (filter && !filter(m, p)) return;
    const end = m.endDate && m.endDate > m.date ? m.endDate : m.date;
    if (end < from || m.date > to) return;
    let d = m.date < from ? from : m.date;
    let guard = 0;
    while (d <= end && d <= to && guard++ < 800) {
      if (d === m.date || !isOff(d)) (map[d] = map[d] || []).push({ m, p, cont: d !== m.date });
      d = addDays(d, 1);
    }
  });
  Object.values(map).forEach(arr => arr.sort((a, b) => (a.cont - b.cont) || String(a.p.code || '').localeCompare(String(b.p.code || ''), 'zh-Hant', { numeric: true })));
  return map;
}
function autoStatus(doc, date, mid) { const L = doc.logs[date]; return L && L.auto && L.auto[mid] ? L.auto[mid].status || '' : ''; }
function dayStats(doc, date) {
  const L = doc.logs[date];
  const items = [];
  milestonesOn(doc, date).forEach(({ m }) => items.push(L && L.auto[m.id] ? L.auto[m.id].status || '' : ''));
  if (L) L.tasks.forEach(t => { if ((t.text || '').trim()) items.push(t.status || ''); });
  const c = { total: items.length, done: 0, doing: 0, delay: 0, moved: 0, cancel: 0, none: 0 };
  items.forEach(s => { c[s || 'none'] = (c[s || 'none'] || 0) + 1; });
  return c;
}
function autoText(p, m) { return `${p.name}｜${m.text.trim()}`; }

/* ---------------- UI infrastructure ---------------- */
const ICON_GEM = '<svg class="logo" viewBox="0 0 397 433" aria-hidden="true"><g transform="translate(0,433) scale(0.1,-0.1)" fill="currentColor"><path d="M1892 4313 c-44 -19 -1728 -1428 -1798 -1505 -20 -22 -48 -66 -63 -97 l-26 -56 -3 -864 c-3 -994 -9 -927 87 -1021 l56 -55 865 -354 865 -355 86 -4 c58 -3 102 0 135 10 27 8 431 171 897 363 921 378 895 365 949 467 l23 43 0 885 0 885 -27 58 c-15 32 -38 71 -50 87 -30 37 -1754 1487 -1793 1507 -45 24 -151 27 -203 6z m702 -964 c322 -272 582 -497 578 -500 -4 -4 -263 -103 -575 -219 -543 -203 -571 -212 -625 -208 -42 4 -205 60 -612 212 -305 114 -558 211 -562 214 -7 7 1101 947 1160 985 15 9 32 15 38 13 7 -3 276 -226 598 -497z m-1424 -1092 l695 -261 120 0 120 0 714 267 c548 206 716 265 722 255 5 -7 9 -333 9 -724 0 -664 -1 -713 -17 -732 -11 -12 -320 -144 -767 -327 -679 -278 -753 -307 -793 -302 -57 6 -1512 602 -1535 629 -17 19 -18 68 -18 728 0 390 3 716 6 724 4 12 13 15 28 10 11 -4 334 -124 716 -267z"/></g></svg>';

function toast(msg, err) {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), err ? 5000 : 2600);
}

let modalStack = [];
function openModal({ title, body, actions = [], onOpen, wide }) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${wide ? 'style="width:min(760px,100%)"' : ''}>
    <div class="modal-h"><h2>${esc(title)}</h2><button class="icon-btn" data-x aria-label="關閉">✕</button></div>
    <div class="modal-b">${body}</div>
    <div class="modal-f">${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
  const prevFocus = document.activeElement;
  const close = () => { bg.remove(); modalStack = modalStack.filter(x => x !== close); if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {} };
  bg.addEventListener('click', e => {
    if (e.target === bg || e.target.closest('[data-x]')) { const c = actions.find(a => a.cancel); if (c && c.onClick) c.onClick(bg); close(); return; }
    const b = e.target.closest('.modal-f [data-i]');
    if (b) { const a = actions[+b.dataset.i]; const r = a.onClick ? a.onClick(bg) : undefined; if (r !== false) close(); }
  });
  bg.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); const c = actions.find(a => a.cancel); if (c && c.onClick) c.onClick(bg); close(); }
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
      const p = actions.findIndex(a => a.primary); if (p >= 0) { e.preventDefault(); bg.querySelector(`[data-i="${p}"]`).click(); }
    }
  });
  document.body.appendChild(bg);
  modalStack.push(close);
  const f = bg.querySelector('.modal-b input:not([type=hidden]):not([type=radio]),.modal-b textarea,.modal-b select') || bg.querySelector('.modal-f .primary');
  if (f) setTimeout(() => { if (!bg.contains(document.activeElement)) f.focus(); }, 30);  // 使用者已經點進某個欄位時就不搶焦點
  if (onOpen) onOpen(bg);
  return close;
}
function confirmBox(title, msg, okLabel = '確定', danger) {
  return new Promise(res => {
    openModal({
      title, body: `<p style="margin:0 0 6px;white-space:pre-wrap">${esc(msg)}</p>`,
      actions: [{ label: '取消', cancel: true, onClick: () => res(false) }, { label: okLabel, cls: danger ? 'danger' : 'primary', primary: true, onClick: () => res(true) }],
    });
  });
}
function download(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type: type + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function csv(rows) {
  return '\ufeff' + rows.map(r => r.map(v => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
}
function autosize(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }

/* ---------------- router ---------------- */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  return { parts, q };
}
function go(hash, replace) {
  if (replace) history.replaceState(null, '', hash); else location.hash = hash.replace(/^#/, '');
  if (replace) render();
}
function qs(obj) { const p = new URLSearchParams(); Object.entries(obj).forEach(([k, v]) => { if (v != null && v !== '') p.set(k, v); }); const s = p.toString(); return s ? '?' + s : ''; }

let lastRouteKey = '';
function render(opts = {}) {
  const app = $('#app');
  if (!S.config) return;
  const { parts, q } = parseHash();
  S.route = { parts, q };
  const routeKey = parts.join('/') + JSON.stringify(q);
  const sameRoute = routeKey === lastRouteKey;
  lastRouteKey = routeKey;
  const y = window.scrollY;
  let html = '';
  try {
    html = route(parts, q);
  } catch (e) {
    console.error(e);
    html = topbar({}) + `<main><div class="empty"><h3>畫面發生錯誤</h3><p>${esc(e.message)}</p><a class="btn" href="#/">回首頁</a></div></main>`;
  }
  if (html == null) return; // redirected
  app.innerHTML = html;
  $$('textarea[data-auto]', app).forEach(autosize);
  Sync.set(Sync.dirty.size || Sync.busy ? 'pending' : Sync.state === 'error' ? 'error' : 'saved');
  if (opts.keepScroll || sameRoute) window.scrollTo(0, y); else window.scrollTo(0, 0);
  if (S.afterRender) { const f = S.afterRender; S.afterRender = null; f(); }
}
function route(parts, q) {
  const [a, b, c, d] = parts;
  if (!a) { document.title = CFG().company + '｜專案管理'; return viewHome(); }
  if (a === 'settings') { if (!bossOk()) return viewGate('boss', '#/settings'); document.title = '系統設定｜' + CFG().company; return viewSettings(); }
  if (a === 's') {
    const st = staffOf(b);
    if (!st || !S.docs[b]) { go('#/', true); return null; }
    if (st.pin && !S.unlocked[b]) return viewGate(b, location.hash);
    document.title = `${st.name}｜${c === 'log' ? '工作日誌' : '專案期程'}`;
    if (c === 'log') return viewStaffLog(b, d, q);
    return viewPlan(b, c === 'plan' ? d : null, parts[4], q);
  }
  if (a === 'boss') {
    if (!bossOk()) return viewGate('boss', location.hash);
    document.title = '主管檢視｜' + CFG().company;
    if (b && staffOf(b) && S.docs[b]) return viewBossStaff(b, c || 'log', d, q);
    return viewBossBoard(q);
  }
  go('#/', true); return null;
}
function bossOk() { return !CFG().bossPin || S.unlocked.__boss; }

/* ---------------- top bar ---------------- */
function topbar(ctx) {
  const st = ctx.sid ? staffOf(ctx.sid) : null;
  let mid = '';
  if (ctx.mode === 'staff' && st) {
    mid = `<div class="who"><span class="dot" style="--c:${esc(st.color)}"></span>${esc(st.name)}</div>
      <nav class="tabs" aria-label="分頁">
        <a class="${ctx.tab === 'plan' ? 'on' : ''}" href="#/s/${st.id}/plan">專案期程</a>
        <a class="${ctx.tab === 'log' ? 'on' : ''}" href="#/s/${st.id}/log">工作日誌</a>
      </nav>`;
  } else if (ctx.mode === 'boss') {
    mid = `<div class="who boss">主管檢視</div>
      <nav class="tabs" aria-label="人員">
        <a class="${!ctx.sid ? 'on' : ''}" href="#/boss">全員總覽</a>
        ${CFG().staff.map(s => `<a class="${ctx.sid === s.id ? 'on' : ''}" href="#/boss/${s.id}">${esc(s.name)}</a>`).join('')}
      </nav>`;
  } else if (ctx.mode === 'settings') {
    mid = `<div class="who">系統設定</div>`;
  }
  const modeBadge = Store.mode === 'server' ? '' :
    `<span class="mode-badge" title="目前資料只存在這台電腦的瀏覽器中。在 config.js 設定資料倉庫後即可多人共用。">單機模式</span>`;
  return `<header class="top">
    <a class="brand" href="#/" title="回首頁">${ICON_GEM}<span class="brand-name">${esc(CFG().company)}</span><span class="brand-sub">專案管理</span></a>
    ${mid}
    <div class="top-right">${modeBadge}<span id="savestate" class="savestate" aria-live="polite"></span>
      ${ctx.mode ? `<a class="btn sm ghost" href="#/">切換人員</a>` : ''}</div>
  </header>`;
}

/* ---------------- tear-off calendar ---------------- */
function tearOff(date, foot = '') {
  const d = toDate(date); const h = HOL[date];
  return `<div class="tear ${isOff(date) ? 'is-off' : ''}" aria-label="${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${WEEK[d.getDay()]}">
    <div class="tear-top"><span>${d.getFullYear()}</span><span>${d.getMonth() + 1} 月</span></div>
    <div class="tear-perf"></div>
    <div class="tear-day">${d.getDate()}</div>
    <div class="tear-week">星期${WEEK[d.getDay()]}</div>
    ${h ? `<div class="tear-hol">${esc(h.name)}</div>` : ''}
    <div class="tear-foot">${foot}</div>
  </div>`;
}

/* ---------------- home ---------------- */
function modeNotice() {
  if (Store.mode === 'server') return '';
  return `<div class="notice"><b>單機模式：</b>資料只會存在這台電腦的瀏覽器中，其他人（包括主管）看不到。
    要讓大家共用，請在 config.js 填入存放資料的 GitHub 倉庫（做法見 README）。可在「系統設定」下載備份。</div>`;
}
function viewHome() {
  const t = todayStr();
  const cards = CFG().staff.map(st => {
    const doc = S.docs[st.id] ? V(st.id) : emptyStaff();
    const act = doc.projects.filter(p => p.status !== 'closed').length;
    const todayMs = milestonesOn(doc, t).length;
    const L = doc.logs[t];
    const tasks = L ? L.tasks.filter(x => (x.text || '').trim()).length : 0;
    return `<article class="staff-card" style="--c:${esc(st.color)}">
      <h2>${esc(st.name)}<span class="role-tag">${ROLE_NAME[st.role === 'design' ? 'design' : 'pm']}</span></h2>
      <div class="meta">${act ? `進行中專案 ${act} 個` : '尚未建立專案'}<br>今天有 ${todayMs} 項重要期程${tasks ? `、${tasks} 項自排工作` : ''}</div>
      <div class="row"><a class="btn" href="#/s/${st.id}/plan">專案期程</a><a class="btn primary" href="#/s/${st.id}/log">工作日誌</a></div>
    </article>`;
  }).join('');
  return topbar({}) + `<main class="home">
    <div>${tearOff(t)}</div>
    <section>
      ${modeNotice()}
      <h1>請選擇你的名字</h1>
      <p class="lead">專案期程用來排定各專案的重要日期；工作日誌會自動帶入當天的期程，再加上自己安排的工作。</p>
      <div class="staff-list">${cards || '<div class="empty">尚未建立人員，請到系統設定新增。</div>'}</div>
      <div class="home-foot">
        <a class="btn primary" href="#/boss">主管檢視</a>
        <a class="btn ghost" href="#/settings">系統設定</a>
        <span class="muted small" style="margin-left:auto">可填寫期間 ${esc(RANGE().start.replace(/-/g, '/'))} 至 ${esc(RANGE().end.replace(/-/g, '/'))}</span>
      </div>
    </section>
  </main>`;
}

/* ---------------- PIN gate ---------------- */
function viewGate(who, back) {
  const isBoss = who === 'boss';
  const st = isBoss ? null : staffOf(who);
  S.gate = { who, back };
  return topbar({}) + `<main><form class="gate" data-sub="gate">
    <h1>${isBoss ? '主管密碼' : esc(st.name) + ' 的密碼'}</h1>
    <p>${isBoss ? '進入主管檢視與系統設定前，請輸入主管密碼。' : '這份資料有設定密碼，請輸入後繼續。'}</p>
    <label class="sr" for="gatepin">密碼</label>
    <input id="gatepin" type="password" autocomplete="current-password" autofocus>
    <div class="err" id="gateerr"></div>
    <div class="row"><button class="btn primary" type="submit">進入</button><a class="btn ghost" href="#/">返回</a></div>
  </form></main>`;
}
function submitGate(form) {
  const v = $('#gatepin', form).value;
  const { who, back } = S.gate || {};
  const ok = who === 'boss' ? v === CFG().bossPin : (staffOf(who) && v === staffOf(who).pin);
  if (!ok) { $('#gateerr').textContent = '密碼不正確，請再試一次。'; $('#gatepin').select(); return; }
  S.unlocked[who === 'boss' ? '__boss' : who] = true;
  sessionStorage.setItem('zjpm.unlock', JSON.stringify(S.unlocked));
  if (location.hash === back) render(); else location.hash = back.replace(/^#/, '');
}

function viewToken(note) {
  const err = { badtoken: '這組權杖無效或已過期，請重新產生後貼上。', noaccess: `這組權杖無法存取資料倉庫「${esc(SETTINGS.dataRepo)}」。請確認倉庫名稱正確，且權杖有勾選這個倉庫、Contents 權限為 Read and write。` }[note] || '';
  return `<main><form class="gate token-gate" id="keyform">
    <h1>連線到資料倉庫</h1>
    <p>資料存放在 GitHub 倉庫 <b>${esc(SETTINGS.dataRepo)}</b>。<br>請貼上管理者提供的「存取權杖（Token）」，每台電腦只需要輸入一次。</p>
    <label class="sr" for="akey">存取權杖</label>
    <input id="akey" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_ 開頭的一串文字" autofocus>
    <div class="err">${err}</div>
    <button class="btn primary" type="submit">連線</button>
    <p class="muted small" style="margin-top:14px">權杖只會存在這台電腦的瀏覽器裡。如何產生權杖請見 README 的說明。</p>
  </form></main>`;
}

/* =====================================================================
 * 專案期程
 * ===================================================================== */
function viewPlan(sid, sub, arg, q) {
  const doc = V(sid);
  const projects = sortedProjects(doc, true);
  if (!sub) { go(`#/s/${sid}/plan/${projects.length ? 'overview' : 'start'}`, true); return null; }
  const own = projects.filter(p => !p.link), linked = projects.filter(p => p.link);
  const vis = list => list.filter(p => S.ui.showClosed || p.status !== 'closed' || (sub === 'p' && p.id === arg));
  const closedCount = projects.filter(p => p.status === 'closed').length;
  const item = p => `<li><a class="proj-link ${p.status || 'active'} ${sub === 'p' && arg === p.id ? 'on' : ''}" style="--c:${esc(p.color)}" href="#/s/${sid}/plan/p/${p.id}" title="${esc(p.name)}${p.link ? `（由${esc(p.link.name)}管理）` : ''}">
      <span class="code">${esc(p.code || '')}</span><span class="nm">${esc(p.name)}</span>${p.link ? `<span class="owner">${esc(p.link.name)}</span>` : ''}</a></li>`;
  const dangling = danglingLinks(sid).length;
  const isDesign = roleOf(sid) === 'design';
  const ownBlock = `<div class="side-head"><span>我的專案</span><span>${own.length}</span></div>
    <ul class="proj-list">${vis(own).map(item).join('') || (isDesign ? '<li class="side-empty">還沒有自己的專案</li>' : '')}</ul>
    <button class="btn ${isDesign ? 'ghost' : ''}" data-act="newProject">＋ 新增專案</button>`;
  const linkBlock = `<div class="side-head"><span>參與的專案</span><span>${linked.length}</span></div>
    ${linked.length ? `<ul class="proj-list">${vis(linked).map(item).join('')}</ul>` : '<p class="side-hint">選擇企劃編輯已建立的專案，期程會跟著企劃編輯的修改自動更新。</p>'}
    ${dangling ? `<p class="side-hint warn-text">有 ${dangling} 個參與的專案已被管理者刪除。<button class="link-btn" data-act="cleanLinks">清除</button></p>` : ''}
    <button class="btn ${isDesign ? 'primary' : ''}" data-act="linkProjects">＋ 加入企劃編輯的專案</button>`;
  const side = `<aside class="side" aria-label="專案清單">
    <a class="side-item ${sub === 'overview' ? 'on' : ''}" href="#/s/${sid}/plan/overview">綜合檢視</a>
    ${isDesign ? linkBlock + '<div class="side-sep"></div>' + ownBlock : ownBlock + '<div class="side-sep"></div>' + linkBlock}
    ${closedCount ? `<label class="chk"><input type="checkbox" data-ch="toggleClosed" ${S.ui.showClosed ? 'checked' : ''}> 顯示已結案（${closedCount}）</label>` : ''}
  </aside>`;
  let main = '';
  if (sub === 'overview') main = overviewHTML(sid, q, false);
  else if (sub === 'p') {
    const p = byId(doc.projects, arg);
    if (!p) { go(`#/s/${sid}/plan`, true); return null; }
    main = p.link ? linkedProjectHTML(sid, p) : projectHTML(sid, p, q);
  } else {
    main = `<div class="empty"><h3>還沒有任何專案</h3>
      <p>${isDesign ? '可以直接加入企劃編輯已建立的專案，期程會自動同步；' : '先新增一個專案，就能依日期填寫它的重要期程；'}<br>也可以自己新增專案，或到「系統設定」匯入原本專案管制表的內容。</p>
      <div class="row" style="justify-content:center"><button class="btn primary" data-act="linkProjects">＋ 加入企劃編輯的專案</button><button class="btn" data-act="newProject">＋ 新增專案</button></div></div>`;
  }
  return topbar({ mode: 'staff', sid, tab: 'plan' }) + `<main><div class="plan">${side}<section>${main}</section></div></main>`;
}

/* ---------- 參與的專案（唯讀） ---------- */
function linkedProjectHTML(sid, p) {
  const doc = V(sid);
  const t = todayStr();
  const ms = doc.milestones.filter(m => m.projectId === p.id && (m.text || '').trim()).sort((a, b) => a.date.localeCompare(b.date) || (a.side === 'ours' ? -1 : 1));
  const next = ms.find(m => m.date >= t);
  const stName = { active: '進行中', paused: '暫停', closed: '已結案' }[p.status || 'active'];
  const others = participantsOf(p.link.sid, p.id).filter(s => s.id !== sid).map(s => s.name);
  const head = `<header class="proj-head" style="--c:${esc(p.color)}">
    <div class="proj-title"><span class="code">${esc(p.code || '')}</span><h2>${esc(p.name)}</h2><span class="st-badge ${p.status || 'active'}">${stName}</span><span class="tag owner-tag">管理：${esc(p.link.name)}</span></div>
    <div class="row noprint"><button class="btn sm" data-act="exportProject" data-pid="${p.id}">匯出 CSV</button><button class="btn sm danger" data-act="unlinkProject" data-lid="${esc(p.link.id)}">取消參與</button></div>
    <div class="proj-meta">${p.client ? `<span>委託單位 <b>${esc(p.client)}</b></span>` : ''}<span>簡稱 <b>${esc(shortOf(p))}</b></span><span>期程 <b>${ms.length}</b> 筆</span>
      ${next ? `<span>下一個期程 <b>${mdw(next.date)} ${esc(next.text.split('\n')[0])}</b></span>` : ''}${others.length ? `<span>其他參與：${esc(others.join('、'))}</span>` : ''}</div>
  </header>
  <div class="notice info noprint">這個專案由 <b>${esc(p.link.name)}</b> 管理，期程會跟著 ${esc(p.link.name)} 的修改自動更新，這裡只能檢視。每天的執行狀況請到「工作日誌」標記，不會影響 ${esc(p.link.name)} 的資料。</div>`;
  const rows = ms.map(m => `<tr class="${(m.endDate || m.date) < t ? 'past' : ''} ${m.date === t ? 'today' : ''}">
    <td class="nowrap">${mdw(m.date)}${m.date.slice(0, 4) !== t.slice(0, 4) ? `<br><small class="muted">${m.date.slice(0, 4)}</small>` : ''}</td>
    <td class="nowrap">${m.side === 'ours' ? '紫晶進度' : '<span class="tag client">單位進度</span>'}</td>
    <td style="white-space:pre-wrap">${esc(m.text.trim())}${m.note ? `<div class="small muted">${esc(m.note)}</div>` : ''}</td>
    <td class="nowrap">${m.endDate ? '至 ' + mdw(m.endDate) : ''}${m.tentative ? ' <span class="tag tent">待確認</span>' : ''}</td></tr>`).join('');
  const firstUpcoming = ms.findIndex(m => (m.endDate || m.date) >= t);
  if (firstUpcoming > 3) S.afterRender = () => { const tr = document.querySelectorAll('.linked-list tbody tr')[firstUpcoming]; if (tr) tr.scrollIntoView({ block: 'center' }); };
  return head + `<div class="toolbar"><h3 style="font-size:17px">期程清單</h3><span class="grow"></span><button class="btn sm noprint" data-act="print">列印</button></div>
    ${ms.length ? `<div class="grid-wrap"><table class="plain linked-list"><thead><tr><th>日期</th><th>類別</th><th>內容</th><th>期間／標記</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="empty"><h3>${esc(p.link.name)} 還沒有填寫這個專案的期程</h3><p>填寫後會自動出現在這裡。</p></div>`}`;
}
function linkDialog(sid) {
  const mine = D(sid);
  const linked = new Map((mine.links || []).map(l => [l.sid + '|' + l.pid, l]));
  const owners = CFG().staff.filter(s => s.id !== sid && S.docs[s.id] && roleOf(s.id) === 'pm');
  const groups = owners.map(o => {
    const list = sortedProjects(D(o.id), true).filter(p => p.status !== 'closed' || linked.has(o.id + '|' + p.id));
    if (!list.length) return '';
    return `<fieldset class="link-group"><legend>${esc(o.name)} 管理的專案</legend>${list.map(p => {
      const n = D(o.id).milestones.filter(m => m.projectId === p.id && (m.text || '').trim()).length;
      const on = linked.has(o.id + '|' + p.id);
      return `<label class="link-row" style="--c:${esc(p.color)}"><input type="checkbox" name="lk" value="${esc(o.id + '|' + p.id)}" ${on ? 'checked' : ''}>
        <span class="code">${esc(p.code || '')}</span><span class="nm">${esc(p.name)}</span><span class="muted small">${n} 筆期程${p.status === 'paused' ? '・暫停' : p.status === 'closed' ? '・已結案' : ''}</span></label>`;
    }).join('')}</fieldset>`;
  }).join('');
  openModal({
    title: '加入企劃編輯的專案',
    body: groups ? `<p class="muted small" style="margin:0 0 12px">勾選你參與的專案。期程由企劃編輯維護，會自動同步到你的綜合檢視與工作日誌。取消勾選即可退出。</p><div class="link-groups">${groups}</div>`
      : `<p>目前沒有可加入的專案。${owners.length ? '' : '請先到「系統設定 → 人員」把相關人員的職務設為「企劃編輯」。'}</p>`,
    actions: groups ? [{ label: '取消', cancel: true }, {
      label: '儲存', cls: 'primary', primary: true, onClick: bg => {
        const want = new Set(Array.from(bg.querySelectorAll('[name=lk]:checked')).map(x => x.value));
        let add = 0, del = 0;
        mine.links = (mine.links || []).filter(l => {
          const k = l.sid + '|' + l.pid;
          if (want.has(k) || !owners.some(o => o.id === l.sid)) { want.delete(k); return true; }
          mine.deleted[l.id] = now(); del++; return false;
        });
        want.forEach(k => { const [osid, pid] = k.split('|'); mine.links.push({ id: uid(), sid: osid, pid, u: now() }); add++; });
        if (add || del) { touchStaff(sid); toast(add && del ? `已加入 ${add} 個、退出 ${del} 個專案` : add ? `已加入 ${add} 個專案` : `已退出 ${del} 個專案`); }
        render({ keepScroll: true });
      },
    }] : [{ label: '關閉', cls: 'primary', primary: true }],
  });
}
function unlinkProject(sid, lid) {
  const doc = D(sid); const l = (doc.links || []).find(x => x.id === lid); if (!l) return;
  const p = S.docs[l.sid] ? byId(D(l.sid).projects, l.pid) : null;
  confirmBox('取消參與', `確定不再參與「${p ? (p.code ? p.code + ' ' : '') + p.name : '這個專案'}」？\n${p ? '專案本身與企劃編輯的期程不受影響，' : ''}之後隨時可以再加入。`, '取消參與', true).then(ok => {
    if (!ok) return;
    doc.links = doc.links.filter(x => x.id !== lid); doc.deleted[lid] = now();
    touchStaff(sid); toast('已取消參與'); go(`#/s/${sid}/plan/overview`);
  });
}

/* ---------- project editor ---------- */
function monthsInRange() {
  const out = []; let m = monthStart(RANGE().start); const end = RANGE().end;
  while (m <= end && out.length < 60) { out.push(m); m = addMonths(m, 1); }
  return out;
}
function projectHTML(sid, p, q) {
  const doc = D(sid);
  const mode = q.mode === 'list' ? 'list' : 'month';
  const ms = doc.milestones.filter(m => m.projectId === p.id && (m.text || '').trim());
  const t = todayStr();
  const next = ms.filter(m => m.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  const stName = { active: '進行中', paused: '暫停', closed: '已結案' }[p.status || 'active'];
  const head = `<header class="proj-head" style="--c:${esc(p.color)}">
    <div class="proj-title"><span class="code">${esc(p.code || '')}</span><h2>${esc(p.name)}</h2><span class="st-badge ${p.status || 'active'}">${stName}</span></div>
    <div class="row noprint"><button class="btn sm" data-act="editProject" data-pid="${p.id}">編輯專案</button><button class="btn sm" data-act="exportProject" data-pid="${p.id}">匯出 CSV</button></div>
    <div class="proj-meta">${p.client ? `<span>委託單位 <b>${esc(p.client)}</b></span>` : ''}<span>簡稱 <b>${esc(shortOf(p))}</b>${p.short ? '' : '（未設定，可在「編輯專案」填寫）'}</span><span>已填期程 <b>${ms.length}</b> 筆</span>
      ${next ? `<span>下一個期程 <b>${mdw(next.date)} ${esc(next.text.split('\n')[0])}</b></span>` : ''}${(() => { const ps = participantsOf(sid, p.id); return ps.length ? `<span>參與：<b>${esc(ps.map(x => x.name).join('、'))}</b>（修改期程會同步給他們）</span>` : ''; })()}${p.note ? `<span>${esc(p.note)}</span>` : ''}</div>
  </header>`;
  const seg = `<div class="seg" role="tablist"><a role="tab" class="${mode === 'month' ? 'on' : ''}" href="#/s/${sid}/plan/p/${p.id}${qs({ m: q.m })}">逐日填寫</a><a role="tab" class="${mode === 'list' ? 'on' : ''}" href="#/s/${sid}/plan/p/${p.id}?mode=list">期程清單</a></div>`;
  if (mode === 'list') return head + listModeHTML(sid, p, ms, seg);

  const months = monthsInRange();
  let cur = q.m && /^\d{4}-\d{2}$/.test(q.m) ? q.m + '-01' : monthStart(clampDate(t, RANGE().start, RANGE().end));
  if (!months.includes(cur)) cur = months[0];
  const has = new Set(ms.map(m => m.date.slice(0, 7) + '-01'));
  const idx = months.indexOf(cur);
  const monthBtns = months.map((m, i) => {
    const d = toDate(m); const yr = (i === 0 || d.getMonth() === 0) ? `<span class="yr">${d.getFullYear()}</span>` : '';
    return `${yr}<button class="${m === cur ? 'on' : ''} ${has.has(m) ? 'has' : ''}" data-act="projMonth" data-m="${m.slice(0, 7)}">${d.getMonth() + 1} 月</button>`;
  }).join('');
  const nav = `<div class="toolbar">${seg}
    <div class="row"><button class="icon-btn" data-act="projMonth" data-m="${idx > 0 ? months[idx - 1].slice(0, 7) : ''}" ${idx > 0 ? '' : 'disabled'} aria-label="上個月">‹</button>
    <h3 style="font-size:19px">${toDate(cur).getFullYear()} 年 ${toDate(cur).getMonth() + 1} 月</h3>
    <button class="icon-btn" data-act="projMonth" data-m="${idx < months.length - 1 ? months[idx + 1].slice(0, 7) : ''}" ${idx < months.length - 1 ? '' : 'disabled'} aria-label="下個月">›</button></div>
    <span class="grow"></span></div>
    <div class="months noprint">${monthBtns}</div>
    <p class="hint-line noprint">直接在格子裡輸入，會自動儲存。滑到格子右側的「⋯」可設定期間（例如 9/7 至 9/14）、標記待確認，或加上備註。</p>`;

  // rows
  const from = cur < RANGE().start ? RANGE().start : cur;
  const endM = monthEnd(cur); const to = endM > RANGE().end ? RANGE().end : endM;
  const own = {}; ms.forEach(m => { own[m.date + '|' + m.side] = m; });
  // 期間延續提示
  const contMap = {};
  doc.milestones.filter(m => m.projectId === p.id && m.endDate && m.endDate > m.date && (m.text || '').trim()).forEach(m => {
    let d = addDays(m.date, 1), g = 0;
    while (d <= m.endDate && g++ < 800) { (contMap[d + '|' + m.side] = contMap[d + '|' + m.side] || []).push(m); d = addDays(d, 1); }
  });
  let rows = '';
  for (let d = from, g = 0; d <= to && g < 40; d = addDays(d, 1), g++) {
    const h = HOL[d];
    const cls = [isWeekend(d) ? 'wk' : '', isOff(d) ? 'off' : '', d === t ? 'today' : ''].join(' ');
    const cell = side => {
      const m = own[d + '|' + side];
      const conts = (contMap[d + '|' + side] || []).map(c => `<div class="cont" style="--c:${esc(p.color)}">↳ ${esc(c.text.split('\n')[0])}（${md(c.date)}–${md(c.endDate)}）</div>`).join('');
      const tags = m && (m.endDate || m.tentative || m.note) ? `<div class="cell-tags">${m.endDate ? `<span class="tag">期間至 ${mdw(m.endDate)}</span>` : ''}${m.tentative ? '<span class="tag tent">待確認</span>' : ''}${m.note ? `<span>${esc(m.note)}</span>` : ''}</div>` : '';
      return `<td class="cell" data-side="${side}">${conts}<div class="cell-edit ${m && m.text.trim() ? 'filled' : ''} ${m && m.tentative ? 'tent' : ''}" style="--c:${esc(p.color)}">
        <textarea rows="1" data-auto data-in="cell" data-ch="cellDone" data-date="${d}" data-side="${side}" aria-label="${md(d)} ${SIDE_NAME[side]}">${esc(m ? m.text : '')}</textarea>
        <button class="cell-more" data-act="cellMore" data-date="${d}" data-side="${side}" title="期間、待確認、備註" aria-label="${md(d)} ${SIDE_NAME[side]} 詳細設定">⋯</button></div>${tags}</td>`;
    };
    rows += `<tr class="${cls}" data-date="${d}"><td class="c-date">${md(d)}</td><td class="c-dow">${WEEK[dowOf(d)]}</td><td class="c-hol">${h ? esc(h.name) : ''}</td>${cell('ours')}${cell('client')}</tr>`;
  }
  const table = `<div class="grid-wrap"><table class="grid"><thead><tr><th class="c-date">日期</th><th class="c-dow">星期</th><th class="c-hol">節日</th><th>紫晶進度</th><th>單位進度</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  if (q.focus) {
    S.afterRender = () => {
      const tr = document.querySelector(`tr[data-date="${q.focus}"]`);
      if (tr) { tr.scrollIntoView({ block: 'center' }); tr.classList.add('flash'); }
    };
  }
  return head + nav + table;
}
function listModeHTML(sid, p, ms, seg) {
  const t = todayStr();
  const list = ms.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.side === 'ours' ? -1 : 1));
  const rows = list.map(m => `<tr class="${m.date < t ? 'past' : ''}">
    <td class="nowrap">${mdw(m.date)}${m.date.slice(0, 4) !== t.slice(0, 4) ? `<br><small class="muted">${m.date.slice(0, 4)}</small>` : ''}</td>
    <td class="nowrap">${m.side === 'ours' ? '紫晶進度' : '<span class="tag client">單位進度</span>'}</td>
    <td style="white-space:pre-wrap">${esc(m.text.trim())}${m.note ? `<div class="small muted">${esc(m.note)}</div>` : ''}</td>
    <td class="nowrap">${m.endDate ? '至 ' + mdw(m.endDate) : ''}${m.tentative ? ' <span class="tag tent">待確認</span>' : ''}</td>
    <td class="nowrap noprint"><button class="btn sm" data-act="msEdit" data-mid="${m.id}">編輯</button></td></tr>`).join('');
  return `<div class="toolbar">${seg}<span class="grow"></span><button class="btn primary sm noprint" data-act="msNew" data-pid="${p.id}">＋ 新增期程</button><button class="btn sm noprint" data-act="print">列印</button></div>
    ${list.length ? `<div class="grid-wrap"><table class="plain"><thead><tr><th>日期</th><th>類別</th><th>內容</th><th>期間／標記</th><th class="noprint"></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="empty"><h3>這個專案還沒有期程</h3><p>可以切換到「逐日填寫」直接在日期旁輸入，或按「新增期程」。</p></div>`}`;
}

/* ---------- project dialog ---------- */
function projectDialog(sid, p) {
  const isNew = !p;
  const doc = D(sid);
  const used = new Set(doc.projects.map(x => x.color));
  const color = p ? p.color : (PALETTE.find(c => !used.has(c)) || PALETTE[doc.projects.length % PALETTE.length]);
  const body = `<div class="row" style="align-items:flex-start">
      <label class="field" style="width:100px"><span>代號</span><input type="text" name="code" value="${esc(p ? p.code : nextCode(sid))}" maxlength="12"></label>
      <label class="field" style="flex:1"><span>專案名稱（必填）</span><input type="text" name="name" value="${esc(p ? p.name : '')}" maxlength="60" placeholder="例如：土文館專刊"></label>
    </div>
    <label class="field"><span>簡稱（2～4 字）</span><input type="text" name="short" value="${esc(p ? p.short || '' : '')}" maxlength="4" placeholder="例如：土文館" style="max-width:180px">
      <span class="hint">顯示在日曆、工作日誌與期程提醒上，方便一眼辨識。未填時會取專案名稱的前 4 個字。</span></label>
    <label class="field"><span>委託單位</span><input type="text" name="client" value="${esc(p ? p.client || '' : '')}" maxlength="60"></label>
    <div class="field"><span>顏色（在月曆上辨識用）</span><div class="swatches">${PALETTE.map(c => `<label><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''} aria-label="顏色 ${c}"><span style="--c:${c}"></span></label>`).join('')}</div></div>
    <label class="field"><span>狀態</span><select name="status">
      ${[['active', '進行中'], ['paused', '暫停'], ['closed', '已結案']].map(([v, t]) => `<option value="${v}" ${(p ? p.status || 'active' : 'active') === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <span class="hint">已結案的專案，期程仍會保留，但預設不會顯示在清單中。</span></label>
    <label class="field"><span>備註</span><input type="text" name="note" value="${esc(p ? p.note || '' : '')}" maxlength="120"></label>`;
  const actions = [];
  if (!isNew) actions.push({
    label: '刪除專案', cls: 'danger left', onClick: () => {
      const n = doc.milestones.filter(m => m.projectId === p.id).length;
      confirmBox('刪除專案', `確定要刪除「${p.name}」？\n這個專案的 ${n} 筆期程也會一併刪除，且無法復原。\n（若只是做完了，建議把狀態改為「已結案」。）`, '刪除', true).then(ok => {
        if (!ok) return;
        doc.milestones.filter(m => m.projectId === p.id).forEach(m => delMilestone(doc, m));
        doc.projects = doc.projects.filter(x => x.id !== p.id);
        doc.deleted[p.id] = now();
        touchStaff(sid); toast('已刪除專案'); go(`#/s/${sid}/plan`);
      });
    },
  });
  actions.push({ label: '取消', cancel: true });
  actions.push({
    label: isNew ? '建立專案' : '儲存', cls: 'primary', primary: true, onClick: bg => {
      const f = n => bg.querySelector(`[name=${n}]`);
      const name = f('name').value.trim();
      if (!name) { f('name').focus(); f('name').style.borderColor = 'var(--seal)'; return false; }
      const short = f('short').value.trim();
      if (short && Array.from(short).length < 2) { f('short').focus(); f('short').style.borderColor = 'var(--seal)'; toast('簡稱請填 2～4 個字', true); return false; }
      const data = { code: f('code').value.trim(), name, short, client: f('client').value.trim(), color: (bg.querySelector('[name=color]:checked') || {}).value || color, status: f('status').value, note: f('note').value.trim(), u: now() };
      if (isNew) {
        const np = Object.assign({ id: uid(), created: now() }, data);
        doc.projects.push(np); touchStaff(sid); toast('已建立專案');
        go(`#/s/${sid}/plan/p/${np.id}`);
      } else {
        Object.assign(p, data); touchStaff(sid); toast('已儲存'); render({ keepScroll: true });
      }
    },
  });
  openModal({ title: isNew ? '新增專案' : '編輯專案', body, actions });
}

/* ---------- milestone dialog ---------- */
function milestoneDialog(sid, opts) {
  const doc = D(sid);
  let m = opts.mid ? byId(doc.milestones, opts.mid) : findCell(doc, opts.pid, opts.date, opts.side);
  const pid = m ? m.projectId : opts.pid;
  const p = byId(doc.projects, pid);
  const R = RANGE();
  const body = `<p class="muted small" style="margin:0 0 12px">${esc(p.code || '')} ${esc(p.name)}</p>
    <div class="row" style="align-items:flex-start">
      <label class="field" style="flex:1"><span>日期</span><input type="date" name="date" value="${m ? m.date : opts.date || todayStr()}" min="${R.start}" max="${R.end}" required></label>
      <label class="field" style="flex:1"><span>類別</span><select name="side"><option value="ours" ${(m ? m.side : opts.side) !== 'client' ? 'selected' : ''}>紫晶進度</option><option value="client" ${(m ? m.side : opts.side) === 'client' ? 'selected' : ''}>單位進度</option></select></label>
    </div>
    <label class="field"><span>內容</span><textarea name="text" rows="3" placeholder="例如：提供二校電子檔">${esc(m ? m.text : '')}</textarea></label>
    <label class="field"><span>結束日期（選填）</span><input type="date" name="endDate" value="${m ? m.endDate || '' : ''}" min="${R.start}" max="${R.end}">
      <span class="hint">設定後會成為一段期間，期間內每個工作日都會出現在工作日誌裡。</span></label>
    <label class="chk" style="margin-bottom:14px"><input type="checkbox" name="tentative" ${m && m.tentative ? 'checked' : ''}> 待確認（日期或內容尚未定案）</label>
    <label class="field"><span>備註</span><input type="text" name="note" value="${esc(m ? m.note || '' : '')}" maxlength="200" placeholder="例如：決標日翌日起 30 日內提交"></label>`;
  const actions = [];
  if (m) actions.push({ label: '刪除此期程', cls: 'danger left', onClick: () => { delMilestone(doc, m); touchStaff(sid); toast('已刪除期程'); render({ keepScroll: true }); } });
  actions.push({ label: '取消', cancel: true });
  actions.push({
    label: '儲存', cls: 'primary', primary: true, onClick: bg => {
      const f = n => bg.querySelector(`[name=${n}]`);
      const date = f('date').value, text = f('text').value, side = f('side').value;
      let endDate = f('endDate').value;
      if (!isDate(date)) { f('date').focus(); return false; }
      if (!text.trim()) { f('text').focus(); f('text').style.borderColor = 'var(--seal)'; return false; }
      if (endDate && endDate <= date) endDate = '';
      const data = { date, side, text, endDate, tentative: f('tentative').checked, note: f('note').value.trim(), u: now() };
      const clash = findCell(doc, pid, date, side);
      if (clash && clash !== m) {
        clash.text = clash.text.trim() + '\n' + text.trim();
        clash.u = now();
        if (m) delMilestone(doc, m);
        toast('該日已有期程，已合併到同一格');
      } else if (m) Object.assign(m, data);
      else doc.milestones.push(Object.assign({ id: uid(), projectId: pid }, data));
      touchStaff(sid);
      render({ keepScroll: true });
    },
  });
  openModal({ title: m ? '期程詳細設定' : '新增期程', body, actions });
}

/* =====================================================================
 * 綜合檢視（週曆／月曆／清單）— 專員與主管共用
 * ===================================================================== */
function calFilter(sid) {
  if (!S.ui.filters[sid]) S.ui.filters[sid] = { side: 'all', hidden: {}, tasks: true };
  return S.ui.filters[sid];
}
function overviewHTML(sid, q, readOnly) {
  const doc = V(sid);
  const F = calFilter(sid);
  const view = ['month', 'week', 'list'].includes(q.v) ? q.v : 'month';
  const t = todayStr();
  let anchor = isDate(q.d) ? q.d : t;
  const base = readOnly ? `#/boss/${sid}/overview` : `#/s/${sid}/plan/overview`;
  const link = (v, d) => base + qs({ v, d });
  const showProj = sortedProjects(doc, true).filter(p => p.status !== 'closed' || doc.milestones.some(m => m.projectId === p.id));
  const filter = (m, p) => !F.hidden[p.id] && (F.side === 'all' || F.side === m.side);

  let title, prevD, nextD, body;
  if (view === 'month') {
    const ms = monthStart(anchor);
    title = `${toDate(ms).getFullYear()} 年 ${toDate(ms).getMonth() + 1} 月`;
    prevD = addMonths(ms, -1); nextD = addMonths(ms, 1);
    const gridStart = mondayOf(ms);
    const gridEnd = addDays(gridStart, 41);
    const map = milestoneMap(doc, gridStart, gridEnd, filter);
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      if (i === 35 && d.slice(0, 7) !== ms.slice(0, 7)) break;
      const items = map[d] || [];
      const max = 4;
      const h = HOL[d];
      const outR = d < RANGE().start || d > RANGE().end;
      cells += `<div class="cal-day ${d.slice(0, 7) !== ms.slice(0, 7) ? 'other' : ''} ${isWeekend(d) ? 'wk' : ''} ${isOff(d) ? 'off' : ''} ${d === t ? 'today' : ''} ${outR ? 'outr' : ''}">
        <div class="cal-dnum"><button data-act="calGo" data-href="${esc(link('week', d))}" aria-label="${mdw(d)}，查看該週">${toDate(d).getDate()}</button>${h ? `<span class="cal-hol" title="${esc(h.name)}">${esc(h.name)}</span>` : ''}</div>
        <div class="cal-items">${items.slice(0, max).map(it => chipHTML(doc, it, d, sid, readOnly, 'short')).join('')}
        ${items.length > max ? `<button class="more-btn" data-act="calGo" data-href="${esc(link('week', d))}">還有 ${items.length - max} 項</button>` : ''}</div></div>`;
    }
    body = `<div class="cal-month"><div class="cal-head">${['一', '二', '三', '四', '五', '六', '日'].map(w => `<div>${w}</div>`).join('')}</div><div class="cal-grid">${cells}</div></div>`;
  } else if (view === 'week') {
    const ws = mondayOf(anchor); const we = addDays(ws, 6);
    title = `${toDate(ws).getFullYear()} 年 ${md(ws)} – ${md(we)}`;
    prevD = addDays(ws, -7); nextD = addDays(ws, 7);
    const map = milestoneMap(doc, ws, we, filter);
    let cols = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i); const h = HOL[d];
      const items = map[d] || [];
      const L = doc.logs[d];
      const tasks = F.tasks && L ? L.tasks.filter(x => (x.text || '').trim()) : [];
      cols += `<div class="cw-col ${isWeekend(d) ? 'wk' : ''} ${isOff(d) ? 'off' : ''} ${d === t ? 'today' : ''}">
        <div class="cw-head"><b>${toDate(d).getDate()}</b><span>週${WEEK[dowOf(d)]}</span>${h ? `<span class="cal-hol" style="width:100%">${esc(h.name)}</span>` : ''}</div>
        <div class="cw-body">${items.map(it => chipHTML(doc, it, d, sid, readOnly, 'full')).join('') || (tasks.length ? '' : '<span class="muted small">—</span>')}
        ${tasks.length ? `<div class="cw-sub">自排工作</div>${tasks.map(tk => { const p = byId(doc.projects, tk.pid); const s = ST[tk.status || '']; return `<div class="chip task ${tk.status === 'done' ? 'done' : ''}" title="${esc(s.t)}"><span class="ct"><span class="sym ${s.cls}">${s.sym}</span> ${p ? esc(projLabel(p)) + '｜' : ''}${esc(tk.text)}</span></div>`; }).join('')}` : ''}
        </div></div>`;
    }
    body = `<div class="cal-week">${cols}</div>`;
  } else {
    const from = anchor; const to = addDays(from, 62);
    title = `${md(from)} 起 9 週`;
    prevD = addDays(from, -63); nextD = addDays(from, 63);
    const map = milestoneMap(doc, from, to, filter);
    const days = Object.keys(map).sort();
    body = days.length ? `<div class="agenda">${days.map(d => `<div class="ag-day ${isOff(d) ? 'off' : ''}"><div class="ag-date">${mdw(d)}${HOL[d] ? `<small>${esc(HOL[d].name)}</small>` : ''}${d.slice(0, 4) !== t.slice(0, 4) ? `<small class="muted" style="color:var(--ink3)">${d.slice(0, 4)}</small>` : ''}</div>
      <div class="ag-items">${map[d].map(it => chipHTML(doc, it, d, sid, readOnly, 'full')).join('')}</div></div>`).join('')}</div>`
      : `<div class="empty"><h3>這段期間沒有期程</h3><p>換個日期範圍，或檢查上方的篩選條件。</p></div>`;
  }
  const bar = `<div class="cal-bar">
    <div class="seg" role="tablist">${[['month', '月曆'], ['week', '週曆'], ['list', '清單']].map(([v, n]) => `<a role="tab" class="${view === v ? 'on' : ''}" href="${esc(link(v, anchor))}">${n}</a>`).join('')}</div>
    <div class="cal-nav"><a class="icon-btn" href="${esc(link(view, prevD))}" aria-label="上一段">‹</a><a class="btn sm" href="${esc(link(view, t))}">今天</a><a class="icon-btn" href="${esc(link(view, nextD))}" aria-label="下一段">›</a><h3>${title}</h3></div>
    <span class="grow"></span>
    <select data-ch="calSide" data-sid="${sid}" aria-label="期程類別"><option value="all" ${F.side === 'all' ? 'selected' : ''}>全部期程</option><option value="ours" ${F.side === 'ours' ? 'selected' : ''}>只看紫晶進度</option><option value="client" ${F.side === 'client' ? 'selected' : ''}>只看單位進度</option></select>
    ${view === 'week' ? `<label class="chk"><input type="checkbox" data-ch="calTasks" data-sid="${sid}" ${F.tasks ? 'checked' : ''}> 顯示自排工作</label>` : ''}
    <button class="btn sm" data-act="print">列印</button>
  </div>`;
  const legend = showProj.length ? `<div class="legend">${showProj.map(p => `<button class="${F.hidden[p.id] ? 'off' : ''}" style="--c:${esc(p.color)}" data-act="calToggle" data-sid="${sid}" data-pid="${p.id}" aria-pressed="${!F.hidden[p.id]}" title="${esc(fullOf(p))}（點一下可隱藏／顯示）">${esc(shortOf(p))}</button>`).join('')}
    <span class="key"><i style="background:var(--ame-tint);border-left:3px solid var(--ame)"></i>紫晶進度</span><span class="key"><i style="border:1px solid var(--ame-soft);border-left:3px solid var(--ame)"></i>單位進度</span><span class="key"><i style="border:1px dashed var(--ame-soft)"></i>待確認</span></div>` : '';
  const head = readOnly ? '' : `<div class="page-head"><div><h1>綜合檢視</h1><p>所有專案的期程集中在同一張行事曆。點選期程可跳到該專案編輯。</p></div></div>`;
  const empty = !doc.projects.length ? `<div class="notice info">${readOnly ? '這位專員還沒有建立專案。' : '還沒有專案。先在左側新增專案並填寫期程，這裡就會自動彙整。'}</div>` : '';
  return head + empty + bar + legend + body;
}
function chipHTML(doc, it, d, sid, readOnly, size) {
  const { m, p, cont } = it;
  const st = autoStatus(doc, d, m.id);
  const text = m.text.trim().replace(/\n/g, '／');
  const cls = ['chip', m.side === 'client' ? 'client' : '', m.tentative ? 'tent' : '', cont ? 'cont' : '', st === 'done' ? 'done' : ''].join(' ');
  const tip = `${p.code || ''} ${p.name}｜${SIDE_NAME[m.side]}\n${m.text.trim()}${m.endDate ? `\n期間 ${md(m.date)}–${md(m.endDate)}` : ''}${m.tentative ? '\n待確認' : ''}${m.note ? '\n' + m.note : ''}${st ? '\n狀態：' + ST[st].t : ''}`;
  const pre = size === 'full' ? `<span class="cc">${esc(shortOf(p))}${m.side === 'client' ? '｜單位' : ''}${cont ? '｜延續' : ''}${st === 'done' ? ' ✓' : ''}</span>` : `<span class="cc">${esc(shortOf(p))}</span>`;
  return `<button class="${cls}" style="--c:${esc(p.color)}" data-act="chip" data-sid="${sid}" data-mid="${m.id}" data-date="${d}" data-ro="${readOnly ? 1 : ''}" title="${esc(tip)}">${pre}<span class="ct">${esc(text)}</span></button>`;
}
function chipDetail(sid, mid, date) {
  const doc = V(sid); const m = byId(doc.milestones, mid); if (!m) return;
  const p = byId(doc.projects, m.projectId);
  const L = doc.logs[date]; const a = L && L.auto[m.id];
  const st = a ? ST[a.status || ''] : ST[''];
  openModal({
    title: `${p.code || ''} ${p.name}`,
    body: `<dl class="kv">${p.link ? `<dt>管理</dt><dd>${esc(p.link.name)}</dd>` : ''}<dt>日期</dt><dd>${mdw(m.date)}${m.endDate ? ' 至 ' + mdw(m.endDate) : ''}</dd>
      <dt>類別</dt><dd>${SIDE_NAME[m.side]}${m.tentative ? ' <span class="tag tent">待確認</span>' : ''}</dd>
      <dt>內容</dt><dd style="white-space:pre-wrap">${esc(m.text.trim())}</dd>
      ${m.note ? `<dt>備註</dt><dd>${esc(m.note)}</dd>` : ''}
      <dt>${md(date)} 執行狀況</dt><dd><span class="sbadge ${st.cls}">${st.t}</span>${a && a.note ? ' ' + esc(a.note) : ''}</dd></dl>`,
    actions: [{ label: '查看當天日誌', onClick: () => { location.hash = `#/boss/${sid}/log/${date}?v=day`; } }, { label: '關閉', cls: 'primary', primary: true }],
  });
}

/* =====================================================================
 * 工作日誌
 * ===================================================================== */
function logDateFrom(d) {
  const R = RANGE();
  return clampDate(isDate(d) ? d : todayStr(), R.start, R.end);
}
function viewStaffLog(sid, d, q) {
  const date = logDateFrom(d);
  if (d !== date) { go(`#/s/${sid}/log/${date}${qs({ v: q.v })}`, true); return null; }
  const v = q.v === 'week' ? 'week' : 'day';
  return topbar({ mode: 'staff', sid, tab: 'log' }) + `<main>${logBar(sid, date, v, false)}${v === 'week' ? weekTableHTML(sid, date, false) : dayHTML(sid, date, false)}</main>`;
}
function logBar(sid, date, v, isBoss) {
  const doc = V(sid); const R = RANGE();
  const ws = mondayOf(date); const t = todayStr();
  // 專員預設單日、主管預設一週總表
  const link = (d, view) => isBoss ? `#/boss/${sid}/log/${d}${view === 'day' ? '?v=day' : ''}` : `#/s/${sid}/log/${d}${view === 'week' ? '?v=week' : ''}`;
  let strip = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    const inR = d >= R.start && d <= R.end;
    const c = dayStats(doc, d);
    const pips = []; for (let k = 0; k < Math.min(c.total, 5); k++) pips.push(k < c.done ? 'd' : (k < c.done + c.delay ? 'w' : ''));
    strip += inR ? `<a class="${d === date && v === 'day' ? 'on' : ''} ${isOff(d) ? 'off' : ''} ${d === t ? 'istoday' : ''}" href="${link(d, 'day')}" aria-label="${mdw(d)}"><small>${WEEK[dowOf(d)]}</small><b>${toDate(d).getDate()}</b><span class="pips">${pips.map(x => `<i class="${x}"></i>`).join('')}</span></a>`
      : `<a aria-disabled="true" style="opacity:.3;pointer-events:none"><small>${WEEK[dowOf(d)]}</small><b>${toDate(d).getDate()}</b><span class="pips"></span></a>`;
  }
  const prevW = clampDate(addDays(ws, -7), R.start, R.end), nextW = clampDate(addDays(ws, 7), R.start, R.end);
  return `<div class="log-bar noprint">
    <div class="seg" role="tablist"><a role="tab" class="${v === 'day' ? 'on' : ''}" href="${link(date, 'day')}">單日</a><a role="tab" class="${v === 'week' ? 'on' : ''}" href="${link(date, 'week')}">一週總表</a></div>
    <div class="wstrip"><a href="${link(prevW, v)}" aria-label="上一週" style="width:30px">‹</a>${strip}<a href="${link(nextW, v)}" aria-label="下一週" style="width:30px">›</a></div>
    <input type="date" value="${date}" min="${R.start}" max="${R.end}" data-ch="logJump" data-sid="${sid}" data-boss="${isBoss ? 1 : ''}" data-v="${v}" aria-label="跳到日期">
    <a class="btn sm" href="${link(logDateFrom(t), v)}">今天</a>
    <span style="flex:1"></span>
    <button class="btn sm" data-act="exportLog" data-sid="${sid}" data-date="${date}">匯出本月 CSV</button>
    <button class="btn sm" data-act="print">列印</button>
  </div>`;
}
function statusSelect(st, extra) {
  return `<select class="status" ${extra} aria-label="完成狀況">${STATUS.map(s => `<option value="${s.v}" ${s.v === (st || '') ? 'selected' : ''}>${s.t}</option>`).join('')}</select>`;
}
function progressBox(c) {
  const pct = k => c.total ? (c[k] / c.total * 100) : 0;
  return `<div class="progress">
    <div>已完成 <b style="font-size:18px;color:var(--ink);font-family:var(--serif)">${c.done}</b> ／ ${c.total} 項</div>
    <div class="bar"><i style="width:${pct('done')}%;background:var(--ok)"></i><i style="width:${pct('doing')}%;background:var(--ame-soft)"></i><i style="width:${pct('delay')}%;background:#E7B566"></i><i style="width:${pct('moved')}%;background:#9DB8DA"></i></div>
    <div class="nums">${c.doing ? `<span>進行中 ${c.doing}</span>` : ''}${c.delay ? `<span style="color:var(--warn)">延宕 ${c.delay}</span>` : ''}${c.moved ? `<span>另作安排 ${c.moved}</span>` : ''}${c.none ? `<span>未標記 ${c.none}</span>` : ''}</div>
  </div>`;
}
function dayHTML(sid, date, readOnly) {
  const doc = V(sid);
  const L = doc.logs[date] || { auto: {}, tasks: [], hours: {}, remark: '' };
  const ms = milestonesOn(doc, date);
  const projects = sortedProjects(doc, false);
  const c = dayStats(doc, date);

  // 重要期程
  const autoRows = ms.map(({ m, p, cont }) => {
    const a = L.auto[m.id] || {};
    const s = ST[a.status || ''];
    const tags = `${m.side === 'client' ? '<span class="tag client">單位進度</span>' : ''}${cont || m.endDate ? `<span class="tag">期間 ${md(m.date)}–${md(m.endDate)}</span>` : ''}${m.tentative ? '<span class="tag tent">待確認</span>' : ''}`;
    return `<div class="task auto st-${s.cls}" data-mid="${m.id}">
      <span class="tp" style="--c:${esc(p.color)}" title="${esc(fullOf(p))}">${esc(shortOf(p))}</span>
      <div class="task-body"><div class="task-text">${esc(p.name)}｜${esc(m.text.trim())}${tags}</div>
        ${m.note ? `<div class="meta">${esc(m.note)}</div>` : ''}
        ${readOnly ? (a.note ? `<div class="meta" style="color:var(--ink2)">說明：${esc(a.note)}</div>` : '')
          : `<input type="text" class="task-note" data-in="autoNote" value="${esc(a.note || '')}" placeholder="說明（例如：已寄出、等單位回覆、延到下週一）" aria-label="說明">`}
        ${a.movedTo ? `<div class="meta">↪ 已改到 ${mdw(a.movedTo)}</div>` : ''}
      </div>
      ${readOnly ? `<span class="sbadge ${s.cls}">${s.t}</span>` : statusSelect(a.status, 'data-ch="autoStatus"')}
    </div>`;
  }).join('');

  // 自排工作
  const taskRows = L.tasks.map(tk => {
    const p = byId(doc.projects, tk.pid);
    const s = ST[tk.status || ''];
    if (readOnly) {
      if (!(tk.text || '').trim()) return '';
      return `<div class="task auto st-${s.cls}"><span class="tp ${p ? '' : 'none'}" style="${p ? `--c:${esc(p.color)}` : ''}">${esc(p ? projLabel(p) : '其他')}</span>
        <div class="task-body"><div class="task-text">${esc(tk.text)}</div>${tk.note ? `<div class="meta" style="color:var(--ink2)">說明：${esc(tk.note)}</div>` : ''}
        ${tk.from ? `<div class="meta">由 ${mdw(tk.from)} 移入</div>` : ''}${tk.movedTo ? `<div class="meta">↪ 已改到 ${mdw(tk.movedTo)}</div>` : ''}</div>
        <span class="sbadge ${s.cls}">${s.t}</span></div>`;
    }
    const opts = `<option value="">其他／雜事</option>` + projects.concat(p && !projects.includes(p) ? [p] : []).map(x => `<option value="${x.id}" ${x.id === tk.pid ? 'selected' : ''}>${esc(x.code ? x.code + ' ' : '')}${esc(x.name)}</option>`).join('');
    return `<div class="task self st-${s.cls}" data-tid="${tk.id}">
      <select class="task-projsel" data-ch="taskProj" style="--c:${p ? esc(p.color) : 'var(--line)'}" aria-label="所屬專案">${opts}</select>
      <div class="task-body"><input type="text" class="task-in" data-in="taskText" data-key="taskKey" value="${esc(tk.text || '')}" placeholder="工作內容，按 Enter 新增下一項" aria-label="工作內容">
        <input type="text" class="task-note" data-in="taskNote" value="${esc(tk.note || '')}" placeholder="說明（完成狀況、延宕原因、改期安排…）" aria-label="說明">
        ${tk.from ? `<div class="meta">由 ${mdw(tk.from)} 移入</div>` : ''}${tk.movedTo ? `<div class="meta">↪ 已改到 ${mdw(tk.movedTo)}</div>` : ''}</div>
      ${statusSelect(tk.status, 'data-ch="taskStatus"')}
      <button class="icon-btn" data-act="delTask" aria-label="刪除這項工作" title="刪除">✕</button>
    </div>`;
  }).join('');

  const carry = readOnly ? null : carryCandidates(doc, date);
  const hours = HOURS.map(([k, n]) => readOnly
    ? (num(L.hours[k]) ? `<span class="tag">${n} ${num(L.hours[k])} 小時</span> ` : '')
    : `<label>${n}<input type="number" min="0" max="24" step="0.5" inputmode="decimal" data-in="hours" data-k="${k}" value="${L.hours[k] != null && L.hours[k] !== '' ? esc(L.hours[k]) : ''}" placeholder="0"></label>`).join('');
  const boss = L.boss || null;

  const side = `<aside class="log-side">${tearOff(date, readOnly ? '' : (isOff(date) ? '今天是休假日' : ''))}${progressBox(c)}
    ${readOnly ? '' : `<a class="btn sm noprint" href="#/s/${sid}/plan/overview?v=week&d=${date}">查看本週期程</a>`}</aside>`;

  const main = `<div>
    <section class="blk" aria-labelledby="h-auto"><div class="blk-h"><h3 id="h-auto">重要期程</h3><span class="sub">由「專案期程」自動帶入</span></div>
      ${autoRows || `<p class="muted small" style="margin:0">這天沒有專案期程。${readOnly ? '' : '在「專案期程」填寫後會自動出現在這裡。'}</p>`}</section>
    <section class="blk" aria-labelledby="h-self"><div class="blk-h"><h3 id="h-self">自排工作</h3><span class="sub">當天自己安排的其他工作</span></div>
      ${taskRows || (readOnly ? '<p class="muted small" style="margin:0">沒有填寫自排工作。</p>' : '')}
      ${readOnly ? '' : `<div class="add-row noprint"><button class="btn" data-act="addTask">＋ 新增工作</button>
        ${carry && carry.items.length ? `<button class="btn" data-act="carry">帶入 ${mdw(carry.from)} 未完成的 ${carry.items.length} 項</button>` : ''}</div>`}
    </section>
    <section class="blk" aria-labelledby="h-hours"><div class="blk-h"><h3 id="h-hours">出勤時數</h3><span class="sub">單位：小時，沒有就留空</span></div>
      ${readOnly ? (hours.trim() || '<span class="muted small">無</span>') : `<div class="hours">${hours}</div>`}</section>
    <section class="blk" aria-labelledby="h-rem"><div class="blk-h"><h3 id="h-rem">外包／其他備註</h3></div>
      ${readOnly ? (L.remark ? `<div class="readonly-text">${esc(L.remark)}</div>` : '<span class="muted small">無</span>')
        : `<textarea class="remark" data-auto data-in="remark" placeholder="外包進度、廠商聯絡、其他需要記錄的事">${esc(L.remark || '')}</textarea>`}</section>
    ${readOnly ? bossBoxHTML(sid, date, boss) : (boss && (boss.comment || boss.reviewed) ? `<section class="blk boss-note"><div class="blk-h"><h3>主管回饋</h3>${boss.reviewed ? '<span class="tag boss">主管已閱</span>' : ''}</div>${boss.comment ? `<p>${esc(boss.comment)}</p>` : ''}</section>` : '')}
  </div>`;
  return `<div class="log-day">${side}${main}</div>`;
}
function bossBoxHTML(sid, date, boss) {
  boss = boss || {};
  return `<section class="blk boss-note bossbox noprint"><div class="blk-h"><h3>主管回饋</h3><span class="sub">專員會在自己的工作日誌看到</span></div>
    <textarea data-in="bossComment" data-sid="${sid}" data-date="${date}" placeholder="給 ${esc(staffOf(sid).name)} 的回饋或提醒">${esc(boss.comment || '')}</textarea>
    <div class="row" style="margin-top:8px"><label class="chk"><input type="checkbox" data-ch="bossReviewed" data-sid="${sid}" data-date="${date}" ${boss.reviewed ? 'checked' : ''}> 已閱</label>
    ${boss.at ? `<span class="muted small">最後更新 ${new Date(boss.at).toLocaleString('zh-TW', { hour12: false })}</span>` : ''}</div></section>`;
}
function carryCandidates(doc, date) {
  const from = prevWorkday(date);
  const L0 = doc.logs[from]; const L = doc.logs[date];
  const already = new Set((L ? L.tasks : []).filter(t => t.srcId).map(t => t.srcId));
  const items = [];
  if (L0) {
    L0.tasks.forEach(t => { if ((t.text || '').trim() && ['', 'doing', 'delay'].includes(t.status || '') && !already.has(t.id)) items.push({ srcId: t.id, text: t.text, pid: t.pid || '' }); });
    milestonesOn(doc, from).forEach(({ m, p }) => {
      const a = L0.auto[m.id];
      if (a && ['doing', 'delay'].includes(a.status) && !already.has(m.id + '@' + from)) {
        // 若今天仍是期間內，重要期程已自動出現，不必再帶
        if (milestonesOn(doc, date).some(x => x.m.id === m.id)) return;
        items.push({ srcId: m.id + '@' + from, text: autoText(p, m), pid: p.id });
      }
    });
  }
  return { from, items };
}

/* ---------- week table (staff & boss) ---------- */
function weekTableHTML(sid, date, readOnly) {
  const doc = V(sid);
  const ws = mondayOf(date); const t = todayStr();
  const tot = { total: 0, done: 0, delay: 0, moved: 0 };
  const hoursSum = {};
  let rows = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    const L = doc.logs[d] || { auto: {}, tasks: [], hours: {} };
    const c = dayStats(doc, d);
    tot.total += c.total; tot.done += c.done; tot.delay += c.delay; tot.moved += c.moved;
    const li = (st, text, note) => { const s = ST[st || '']; return `<li><span class="sym ${s.cls}" title="${s.t}">${s.sym}</span><span>${esc(text)}${note ? `<span class="n">${esc(note)}</span>` : ''}</span></li>`; };
    const autos = milestonesOn(doc, d).map(({ m, p }) => { const a = L.auto[m.id] || {}; return li(a.status, `${p.name}｜${m.text.trim().replace(/\n/g, '／')}${m.side === 'client' ? '（單位）' : ''}`, a.note); }).join('');
    const tasks = L.tasks.filter(x => (x.text || '').trim()).map(tk => { const p = byId(doc.projects, tk.pid); return li(tk.status, (p ? p.name + '｜' : '') + tk.text, tk.note); }).join('');
    const hrs = HOURS.filter(([k]) => num(L.hours[k])).map(([k, n]) => { hoursSum[n] = (hoursSum[n] || 0) + num(L.hours[k]); return `${n} ${num(L.hours[k])}h`; }).join('<br>');
    const b = L.boss;
    const href = readOnly ? `#/boss/${sid}/log/${d}?v=day` : `#/s/${sid}/log/${d}`;
    rows += `<tr class="rowlink ${isWeekend(d) ? 'wk' : ''} ${isOff(d) ? 'off' : ''} ${d === t ? 'today' : ''}" data-act="rowGo" data-href="${href}" tabindex="0">
      <td class="d">${mdw(d)}${HOL[d] ? `<small>${esc(HOL[d].name)}</small>` : ''}</td>
      <td>${autos ? `<ul>${autos}</ul>` : ''}</td><td>${tasks ? `<ul>${tasks}</ul>` : ''}</td>
      <td class="small">${hrs}</td><td class="small" style="white-space:pre-wrap">${esc(L.remark || '')}</td>
      <td class="small">${b && b.reviewed ? '<span class="tag boss">已閱</span>' : ''}${b && b.comment ? `<div>${esc(b.comment)}</div>` : ''}</td></tr>`;
  }
  const hs = Object.entries(hoursSum).map(([n, h]) => `<span>${n} <b>${h}</b>小時</span>`).join('');
  return `<div class="wk-sum"><span>本週 ${md(ws)}–${md(addDays(ws, 6))}</span><span><b>${tot.done}</b>／${tot.total} 項完成</span>${tot.delay ? `<span style="color:var(--warn)"><b style="color:var(--warn)">${tot.delay}</b>項延宕</span>` : ''}${tot.moved ? `<span><b>${tot.moved}</b>項另作安排</span>` : ''}${hs}</div>
    <div class="wk-wrap"><table class="wkt"><thead><tr><th>日期</th><th>重要期程</th><th>自排工作</th><th>出勤</th><th>備註</th><th>主管</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted small">符號：✓ 已完成　◐ 進行中　! 延宕　↪ 另作安排　✕ 取消　○ 未標記。點選任一天可查看完整內容。</p>`;
}

/* ---------- log mutations ---------- */
function curLogCtx(el) {
  const { parts } = S.route;
  const sid = parts[1]; const date = logDateFrom(parts[3]);
  return { sid, date, doc: V(sid) };  // logs 與 D(sid) 共用同一份，可直接寫入
}
function addTask(sid, date, data, focus) {
  const doc = D(sid);
  const L = getLog(doc, date, true);
  const tk = Object.assign({ id: uid(), text: '', pid: '', status: '', note: '' }, data || {});
  L.tasks.push(tk); staffTouchLog(L); touchStaff(sid);
  if (focus) S.afterRender = () => { const el = document.querySelector(`[data-tid="${tk.id}"] .task-in`); if (el) el.focus(); };
  return tk;
}
function moveDialog(onPick, onCancel, fromDate) {
  const R = RANGE();
  const def = clampDate(nextWorkday(fromDate), R.start, R.end);
  openModal({
    title: '另作安排',
    body: `<p class="muted small" style="margin:0 0 12px">選擇要改到哪一天，系統會在那天的「自排工作」自動加上這項工作。</p>
      <label class="field"><span>改到</span><input type="date" name="to" value="${def}" min="${R.start}" max="${R.end}"></label>
      <label class="field"><span>說明（選填）</span><input type="text" name="note" placeholder="例如：單位延後提供資料"></label>`,
    actions: [{ label: '取消', cancel: true, onClick: onCancel }, {
      label: '確定改期', cls: 'primary', primary: true, onClick: bg => {
        const to = bg.querySelector('[name=to]').value;
        if (!isDate(to) || to === fromDate) { bg.querySelector('[name=to]').focus(); return false; }
        onPick(to, bg.querySelector('[name=note]').value.trim());
      },
    }],
  });
}
function exportLogCSV(sid, date) {
  const doc = V(sid); const st = staffOf(sid);
  const from = monthStart(date), to = monthEnd(date);
  const rows = [['日期', '星期', '節日', '重要期程', '自排工作', '加班', '補休', '事假', '病假', '特休', '外包／其他備註', '主管回饋']];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const L = doc.logs[d] || { auto: {}, tasks: [], hours: {} };
    const autos = milestonesOn(doc, d).map(({ m, p }) => { const a = L.auto[m.id] || {}; return `${p.name}｜${m.text.trim()}【${ST[a.status || ''].t}】${a.note ? ' ' + a.note : ''}`; }).join('\n');
    const tasks = L.tasks.filter(x => (x.text || '').trim()).map(tk => { const p = byId(doc.projects, tk.pid); return `${p ? p.name + '｜' : ''}${tk.text}【${ST[tk.status || ''].t}】${tk.note ? ' ' + tk.note : ''}`; }).join('\n');
    rows.push([d.replace(/-/g, '/'), WEEK[dowOf(d)], HOL[d] ? HOL[d].name : '', autos, tasks, ...HOURS.map(([k]) => L.hours[k] || ''), L.remark || '', L.boss ? L.boss.comment || '' : '']);
  }
  download(`${CFG().company}_工作日誌_${st.name}_${from.slice(0, 7)}.csv`, csv(rows), 'text/csv');
}
function exportProjectCSV(sid, pid) {
  const doc = V(sid); const p = byId(doc.projects, pid);
  const rows = [['日期', '星期', '節日', '類別', '內容', '結束日期', '待確認', '備註']];
  doc.milestones.filter(m => m.projectId === pid && (m.text || '').trim()).sort((a, b) => a.date.localeCompare(b.date))
    .forEach(m => rows.push([m.date.replace(/-/g, '/'), WEEK[dowOf(m.date)], HOL[m.date] ? HOL[m.date].name : '', SIDE_NAME[m.side], m.text.trim(), m.endDate ? m.endDate.replace(/-/g, '/') : '', m.tentative ? '是' : '', m.note || '']));
  download(`${CFG().company}_專案期程_${p.code || ''}${p.name}.csv`, csv(rows), 'text/csv');
}

/* =====================================================================
 * 主管檢視
 * ===================================================================== */
function symLi(st, html) { const s = ST[st || '']; return `<li><span class="sym ${s.cls}" title="${s.t}">${s.sym}</span><span>${html}</span></li>`; }
function viewBossBoard(q) {
  const date = isDate(q.d) ? q.d : todayStr();
  const t = todayStr();
  const cards = CFG().staff.map(st => {
    const doc = V(st.id);
    const L = doc.logs[date] || { auto: {}, tasks: [], hours: {} };
    const c = dayStats(doc, date);
    const autos = milestonesOn(doc, date).map(({ m, p }) => { const a = L.auto[m.id] || {}; return symLi(a.status, `<b style="color:${esc(p.color)}" title="${esc(fullOf(p))}">${esc(shortOf(p))}</b>｜${esc(m.text.trim())}${m.side === 'client' ? ' <span class="tag client">單位</span>' : ''}${a.note ? `<span class="small muted">　${esc(a.note)}</span>` : ''}`); }).join('');
    const tasks = L.tasks.filter(x => (x.text || '').trim()).map(tk => { const p = byId(doc.projects, tk.pid); return symLi(tk.status, `${p ? `<b style="color:${esc(p.color)}">${esc(projLabel(p))}</b> ` : ''}${esc(tk.text)}${tk.note ? `<span class="small muted">　${esc(tk.note)}</span>` : ''}`); }).join('');
    const hrs = HOURS.filter(([k]) => num(L.hours[k])).map(([k, n]) => `<span class="tag">${n} ${num(L.hours[k])} 小時</span>`).join(' ');
    return `<article class="bcard" style="--c:${esc(st.color)}">
      <div class="bcard-h"><h2>${esc(st.name)}</h2>${L.boss && L.boss.reviewed ? '<span class="tag boss">已閱</span>' : ''}<span class="small muted">完成 ${c.done}／${c.total}${c.delay ? `，<span style="color:var(--warn)">延宕 ${c.delay}</span>` : ''}</span></div>
      <h4>重要期程</h4>${autos ? `<ul>${autos}</ul>` : '<p class="small muted" style="margin:0">無</p>'}
      <h4>自排工作</h4>${tasks ? `<ul>${tasks}</ul>` : '<p class="small muted" style="margin:0">尚未填寫</p>'}
      ${hrs ? `<h4>出勤</h4>${hrs}` : ''}
      <div class="row noprint"><a class="btn sm primary" href="#/boss/${st.id}/log/${date}?v=day">查看日誌並回饋</a><a class="btn sm" href="#/boss/${st.id}/log/${date}">一週總表</a><a class="btn sm" href="#/boss/${st.id}/overview">綜合檢視</a></div>
    </article>`;
  }).join('');

  // 未來兩週全員重要期程
  const to = addDays(date, 13);
  const merged = {};
  CFG().staff.forEach(st => {
    const map = milestoneMap(V(st.id), date, to, (m, p) => p.status !== 'closed');
    Object.entries(map).forEach(([d, arr]) => arr.forEach(it => { if (!it.cont) (merged[d] = merged[d] || []).push(Object.assign({ st }, it)); }));
  });
  const days = Object.keys(merged).sort();
  const upcoming = days.length ? `<div class="agenda">${days.map(d => `<div class="ag-day ${isOff(d) ? 'off' : ''}"><div class="ag-date">${mdw(d)}${HOL[d] ? `<small>${esc(HOL[d].name)}</small>` : ''}</div>
    <ul class="ag-items" style="margin:0">${merged[d].map(({ st, m, p }) => `<li class="row" style="gap:8px;flex-wrap:nowrap;align-items:baseline"><span class="who-tag" style="--c:${esc(st.color)}">${esc(st.name)}</span><span><b style="color:${esc(p.color)}" title="${esc(fullOf(p))}">${esc(shortOf(p))}</b>｜${esc(m.text.trim().replace(/\n/g, '／'))}${m.side === 'client' ? ' <span class="tag client">單位</span>' : ''}${m.tentative ? ' <span class="tag tent">待確認</span>' : ''}${m.endDate ? ` <span class="tag">至 ${md(m.endDate)}</span>` : ''}</span></li>`).join('')}</ul></div>`).join('')}</div>`
    : '<div class="empty"><p>未來兩週沒有專案期程。</p></div>';

  return topbar({ mode: 'boss' }) + `<main>
    <div class="page-head"><div><h1>全員總覽</h1><p>${mdw(date)}${HOL[date] ? '　' + esc(HOL[date].name) : ''}　各專員的工作日誌與完成狀況</p></div>
      <div class="row noprint"><a class="icon-btn" href="#/boss?d=${addDays(date, -1)}" aria-label="前一天">‹</a><input type="date" value="${date}" data-ch="bossDate" aria-label="選擇日期"><a class="icon-btn" href="#/boss?d=${addDays(date, 1)}" aria-label="後一天">›</a>${date !== t ? `<a class="btn sm" href="#/boss">今天</a>` : ''}<button class="btn sm" data-act="print">列印</button></div></div>
    ${modeNotice()}
    <div class="board">${cards}</div>
    <div class="page-head"><div><h1 style="font-size:21px">未來兩週的重要期程</h1><p>${md(date)} – ${md(to)}，所有人進行中的專案</p></div></div>
    ${upcoming}
  </main>`;
}
function viewBossStaff(sid, sub, d, q) {
  const st = staffOf(sid);
  const head = (active) => `<div class="page-head"><div><h1>${esc(st.name)}</h1><p>主管檢視（唯讀，可留下回饋）</p></div>
    <div class="seg noprint" role="tablist"><a role="tab" class="${active === 'overview' ? 'on' : ''}" href="#/boss/${sid}/overview">綜合檢視</a><a role="tab" class="${active === 'log' ? 'on' : ''}" href="#/boss/${sid}/log">工作日誌</a></div></div>`;
  if (sub === 'overview') return topbar({ mode: 'boss', sid }) + `<main>${head('overview')}${overviewHTML(sid, q, true)}</main>`;
  const date = logDateFrom(d);
  const v = q.v === 'day' ? 'day' : 'week';
  return topbar({ mode: 'boss', sid }) + `<main>${head('log')}${logBar(sid, date, v, true)}${v === 'week' ? weekTableHTML(sid, date, true) : dayHTML(sid, date, true)}</main>`;
}

/* =====================================================================
 * 系統設定
 * ===================================================================== */
function viewSettings() {
  if (!S.setDraft) S.setDraft = clone(CFG());
  const c = S.setDraft;
  const staffRows = c.staff.map((s, i) => `<div class="staff-edit" data-i="${i}">
    <input type="text" data-f="name" value="${esc(s.name)}" aria-label="顯示名稱" placeholder="顯示名稱">
    <select data-f="role" aria-label="職務"><option value="pm" ${s.role !== 'design' ? 'selected' : ''}>企劃編輯</option><option value="design" ${s.role === 'design' ? 'selected' : ''}>設計</option></select>
    <input type="text" data-f="prefix" value="${esc(s.prefix || '')}" aria-label="專案代號字首" placeholder="代號字首" maxlength="4">
    <input type="color" data-f="color" value="${esc(s.color)}" aria-label="代表色">
    <input type="text" data-f="pin" value="${esc(s.pin || '')}" aria-label="個人密碼" placeholder="不設密碼">
    <button class="btn sm danger" data-act="delStaff" data-i="${i}">移除</button></div>`).join('');
  const staffOpts = CFG().staff.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  const modeText = Store.mode === 'server' ? `共用模式：資料存於 GitHub 倉庫 ${esc(SETTINGS.dataRepo)} 的 ${esc(SETTINGS.folder || '（根目錄）')} 資料夾，所有人共用。` : '單機模式：資料只存在這台電腦的瀏覽器。';
  return topbar({ mode: 'settings' }) + `<main class="settings">
    <div class="page-head"><div><h1>系統設定</h1><p>修改後請按最下方的「儲存設定」。</p></div></div>
    ${modeNotice()}
    <section class="set-sec"><h2>公司名稱</h2><p>顯示在左上角。</p>
      <input type="text" id="set-company" value="${esc(c.company)}" maxlength="30"></section>
    <section class="set-sec"><h2>人員</h2><p>代號字首會用在新增專案時自動編號（例如「莊」會產生 莊01、莊02）。個人密碼可防止誤填到別人的資料，留空代表不需要密碼。</p>
      <div class="staff-edit head"><span>顯示名稱</span><span>職務</span><span>代號字首</span><span>顏色</span><span>個人密碼</span><span></span></div>
      ${staffRows}
      <button class="btn" data-act="addStaff">＋ 新增人員</button></section>
    <section class="set-sec"><h2>主管密碼</h2><p>設定後，進入「主管檢視」與「系統設定」都需要輸入。留空代表不需要密碼。</p>
      <input type="text" id="set-bosspin" value="${esc(c.bossPin || '')}" placeholder="不設密碼" autocomplete="off"></section>
    <section class="set-sec"><h2>可填寫期間</h2><p>專案期程與工作日誌可選擇的日期範圍。</p>
      <div class="row"><input type="date" id="set-start" value="${esc(c.range.start)}" aria-label="開始日期"><span>至</span><input type="date" id="set-end" value="${esc(c.range.end)}" aria-label="結束日期"></div></section>
    <section class="set-sec"><h2>國定假日與補班</h2><p>一行一筆，格式「日期 名稱」。假日在行事曆會以紅色顯示；名稱含「補班」的日子視為上班日。已預先填好 2026 下半年到 2027 年的政府公告假日，公司另有安排可直接修改。</p>
      <textarea class="holtext" id="set-hol" spellcheck="false">${esc(c.holidays)}</textarea>
      <div class="row" style="margin-top:8px"><button class="btn sm" data-act="resetHol">還原預設假日</button></div></section>
    <div class="row" style="position:sticky;bottom:12px;z-index:5;background:var(--paper);padding:10px 0;margin-bottom:26px">
      <button class="btn primary" data-act="saveSettings">儲存設定</button><button class="btn ghost" data-act="cancelSettings">放棄修改</button></div>

    <section class="set-sec"><h2>匯入專案檔</h2><p>選擇人員後，匯入「專案匯入檔（.json）」中的專案與期程（例如由原本專案管制表轉出的莊01–莊08）。已存在相同代號的專案會略過，可以放心重複執行。</p>
      <div class="row"><select id="seed-to" aria-label="匯入到">${staffOpts}</select><button class="btn" data-act="importSeed">選擇檔案並匯入</button>
      <input type="file" id="seed-file" accept=".json,application/json" hidden></div></section>
    <section class="set-sec"><h2>資料備份</h2><p>建議每月下載一次完整備份。還原會以備份檔覆蓋目前所有資料。${Store.mode === 'local' ? '單機模式下，也可以用備份檔把資料搬到另一台電腦。' : ''}</p>
      <div class="row"><button class="btn" data-act="exportBackup">下載完整備份</button><button class="btn" data-act="importBackup">從備份檔還原</button>
      <input type="file" id="backup-file" accept=".json,application/json" hidden></div></section>
    <section class="set-sec"><h2>系統資訊</h2>
      <dl class="kv"><dt>儲存方式</dt><dd>${modeText}</dd><dt>程式版本</dt><dd>${APP_VERSION}</dd>
      ${Store.mode === 'server' ? `<dt>修改紀錄</dt><dd>每次儲存都會在 GitHub 倉庫留下一筆紀錄（commit），需要時可在 GitHub 上找回任何時間點的內容。</dd>` : ''}</dl>
      ${Store.mode === 'server' ? `<div class="row" style="margin-top:10px"><button class="btn sm danger" data-act="forgetToken">清除這台電腦的存取權杖</button></div>` : ''}</section>
  </main>`;
}
function harvestSettings() {
  const c = S.setDraft; if (!c) return;
  const v = id => { const el = document.getElementById(id); return el ? el.value : null; };
  if (v('set-company') != null) c.company = v('set-company').trim() || '紫晶設計';
  if (v('set-bosspin') != null) c.bossPin = v('set-bosspin').trim();
  if (v('set-start') != null) c.range = { start: v('set-start'), end: v('set-end') };
  if (v('set-hol') != null) c.holidays = v('set-hol');
  $$('.staff-edit[data-i]').forEach(row => {
    const s = c.staff[+row.dataset.i]; if (!s) return;
    $$('[data-f]', row).forEach(inp => { s[inp.dataset.f] = inp.value.trim(); });
  });
}

/* ---------------- seed import ---------------- */
function importSeed(sid, SEED) {
  const doc = D(sid);
  let np = 0, nm = 0;
  SEED.forEach((sp, i) => {
    if (doc.projects.some(p => p.code === sp.code)) return;
    const p = { id: uid(), code: sp.code, name: sp.name, short: String(sp.short || '').trim().slice(0, 4), client: '', color: PALETTE[i % PALETTE.length], status: 'active', note: '由專案管制表匯入', created: now() + i, u: now() };
    doc.projects.push(p); np++;
    sp.ms.forEach(([date, side, text, note]) => {
      const ex = findCell(doc, p.id, date, side);
      if (ex) { ex.text += '\n' + text; if (note) ex.note = ex.note ? ex.note + '；' + note : note; return; }
      doc.milestones.push({ id: uid(), projectId: p.id, date, side, text, endDate: '', tentative: false, note: note || '', u: now() }); nm++;
    });
  });
  if (!np) { toast('這位人員已經有這些專案了，沒有重複匯入'); return; }
  touchStaff(sid);
  toast(`已匯入 ${np} 個專案、${nm} 筆期程`);
}

/* =====================================================================
 * 事件處理
 * ===================================================================== */
const ctxSid = () => S.route.parts[1];
const ACT = {
  newProject: () => projectDialog(ctxSid()),
  editProject: el => projectDialog(ctxSid(), byId(D(ctxSid()).projects, el.dataset.pid)),
  linkProjects: () => linkDialog(ctxSid()),
  unlinkProject: el => unlinkProject(ctxSid(), el.dataset.lid),
  cleanLinks: () => {
    const sid = ctxSid(); const doc = D(sid); const bad = new Set(danglingLinks(sid).map(l => l.id));
    doc.links = (doc.links || []).filter(l => { if (bad.has(l.id)) { doc.deleted[l.id] = now(); return false; } return true; });
    touchStaff(sid); toast('已清除'); render({ keepScroll: true });
  },
  exportProject: el => exportProjectCSV(ctxSid(), el.dataset.pid),
  projMonth: el => { if (!el.dataset.m) return; const { parts } = S.route; go(`#/s/${parts[1]}/plan/p/${parts[4]}?m=${el.dataset.m}`); },
  cellMore: el => milestoneDialog(ctxSid(), { pid: S.route.parts[4], date: el.dataset.date, side: el.dataset.side }),
  msEdit: el => milestoneDialog(ctxSid(), { mid: el.dataset.mid }),
  msNew: el => milestoneDialog(ctxSid(), { pid: el.dataset.pid, date: clampDate(todayStr(), RANGE().start, RANGE().end), side: 'ours', fresh: true }),
  print: () => window.print(),
  calGo: el => { location.hash = el.dataset.href.replace(/^#/, ''); },
  rowGo: el => { location.hash = el.dataset.href.replace(/^#/, ''); },
  calToggle: el => { const F = calFilter(el.dataset.sid); F.hidden[el.dataset.pid] = !F.hidden[el.dataset.pid]; render({ keepScroll: true }); },
  chip: el => {
    const sid = el.dataset.sid;
    if (el.dataset.ro) return chipDetail(sid, el.dataset.mid, el.dataset.date);
    const m = byId(V(sid).milestones, el.dataset.mid); if (!m) return;
    location.hash = `#/s/${sid}/plan/p/${m.projectId}?m=${m.date.slice(0, 7)}&focus=${m.date}`;
  },
  addTask: () => { const { sid, date } = curLogCtx(); addTask(sid, date, {}, true); render({ keepScroll: true }); },
  delTask: async el => {
    const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date); if (!L) return;
    const tid = el.closest('[data-tid]').dataset.tid; const tk = L.tasks.find(t => t.id === tid);
    if (tk && (tk.text || '').trim() && !(await confirmBox('刪除工作', `確定刪除「${tk.text}」？`, '刪除', true))) return;
    L.tasks = L.tasks.filter(t => t.id !== tid); staffTouchLog(L); touchStaff(sid); render({ keepScroll: true });
  },
  carry: () => {
    const { sid, date, doc } = curLogCtx();
    const c = carryCandidates(doc, date);
    c.items.forEach(it => addTask(sid, date, { text: it.text, pid: it.pid, from: c.from, srcId: it.srcId }));
    toast(`已帶入 ${c.items.length} 項`); render({ keepScroll: true });
  },
  exportLog: el => exportLogCSV(el.dataset.sid, el.dataset.date),
  addStaff: () => {
    harvestSettings();
    const used = new Set(S.setDraft.staff.map(s => s.color));
    S.setDraft.staff.push({ id: 's' + uid(), name: '', role: 'pm', prefix: '', color: PALETTE.find(c => !used.has(c)) || PALETTE[0], pin: '' });
    render({ keepScroll: true });
    const rows = $$('.staff-edit[data-i]'); const last = rows[rows.length - 1]; if (last) $('input', last).focus();
  },
  delStaff: async el => {
    harvestSettings();
    const s = S.setDraft.staff[+el.dataset.i];
    if (!(await confirmBox('移除人員', `確定移除「${s.name || '未命名'}」？\n按「儲存設定」後才會生效。${Store.mode === 'server' ? '\n他的資料檔仍會保留在 GitHub 倉庫中。' : ''}`, '移除', true))) return;
    S.setDraft.staff.splice(+el.dataset.i, 1); render({ keepScroll: true });
  },
  resetHol: () => { const el = $('#set-hol'); if (el) el.value = DEFAULT_HOLIDAYS; toast('已還原，按「儲存設定」後生效'); },
  cancelSettings: () => { S.setDraft = null; location.hash = '#/'; },
  saveSettings: async () => {
    harvestSettings();
    const c = S.setDraft;
    if (!isDate(c.range.start) || !isDate(c.range.end) || c.range.start >= c.range.end) { toast('可填寫期間不正確，結束日期需晚於開始日期', true); return; }
    if (c.staff.some(s => !s.name)) { toast('每位人員都需要顯示名稱', true); return; }
    S.config.data = normalizeConfig(clone(c));
    refreshHolidays();
    const newIds = CFG().staff.map(s => s.id).filter(id => !S.docs[id]);
    try { await loadStaffDocs(newIds); } catch (e) { newIds.forEach(id => { S.docs[id] = { rev: 0, data: emptyStaff() }; }); }
    touchConfig(); S.setDraft = null; toast('設定已儲存'); location.hash = '#/';
  },
  importSeed: () => {
    const sid = $('#seed-to').value; const st = staffOf(sid);
    const inp = $('#seed-file');
    inp.onchange = async () => {
      const f = inp.files[0]; inp.value = ''; if (!f) return;
      let b; try { b = JSON.parse(await f.text()); } catch (e) { b = null; }
      const list = b && b.app === 'zijing-pm' && b.type === 'projects' && Array.isArray(b.projects) ? b.projects.filter(x => x && x.code && Array.isArray(x.ms)) : null;
      if (!list) { toast('這不是專案匯入檔', true); return; }
      if (!(await confirmBox('匯入專案', `要把 ${list.map(x => x.code).join('、')} 共 ${list.length} 個專案匯入到「${st.name}」嗎？`, '匯入'))) return;
      importSeed(sid, list);
    };
    inp.click();
  },
  forgetToken: async () => {
    if (!(await confirmBox('清除存取權杖', '清除後，這台電腦需要重新輸入權杖才能使用。適合在公用電腦使用完畢時執行。', '清除', true))) return;
    localStorage.removeItem('zjpm.gh'); location.reload();
  },
  exportBackup: () => {
    const b = { app: 'zijing-pm', type: 'backup', version: APP_VERSION, exportedAt: new Date().toISOString(), config: CFG(), staff: {} };
    CFG().staff.forEach(s => { b.staff[s.id] = D(s.id); });
    download(`${CFG().company}_專案管理備份_${todayStr()}.json`, JSON.stringify(b, null, 1), 'application/json');
  },
  importBackup: () => {
    const inp = $('#backup-file');
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      let b; try { b = JSON.parse(await f.text()); } catch (e) { toast('無法讀取這個檔案，請確認是本系統下載的備份檔', true); return; }
      if (!b || b.app !== 'zijing-pm' || !b.config) { toast('這不是本系統的備份檔', true); return; }
      if (!(await confirmBox('從備份檔還原', `備份時間：${new Date(b.exportedAt).toLocaleString('zh-TW', { hour12: false })}\n還原後，目前的資料會被備份檔的內容取代。確定繼續？`, '還原', true))) return;
      try {
        S.config.data = normalizeConfig(b.config);
        const r = await Store.save('config', S.config.data, S.config.rev, true); S.config.rev = r.rev;
        for (const [sid, data] of Object.entries(b.staff || {})) {
          const cur = S.docs[sid] || { rev: 0 };
          S.docs[sid] = { rev: cur.rev, data: normalizeStaff(data) };
          const rr = await Store.save('staff_' + sid, S.docs[sid].data, cur.rev, true); S.docs[sid].rev = rr.rev;
        }
        await loadStaffDocs(CFG().staff.map(s => s.id).filter(id => !S.docs[id]));
        refreshHolidays(); S.setDraft = null; toast('已從備份還原'); location.hash = '#/';
      } catch (e) { toast('還原失敗：' + e.message, true); }
      inp.value = '';
    };
    inp.click();
  },
};
const IN = {
  cell: el => {
    const sid = ctxSid(), pid = S.route.parts[4]; const doc = D(sid);
    const date = el.dataset.date, side = el.dataset.side;
    let m = findCell(doc, pid, date, side);
    if (!m) {
      if (!el.value.trim()) return;
      m = { id: uid(), projectId: pid, date, side, text: '', endDate: '', tentative: false, note: '', u: now() };
      doc.milestones.push(m);
    }
    m.text = el.value; m.u = now();
    autosize(el); touchStaff(sid);
  },
  autoNote: el => {
    const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date, true);
    const mid = el.closest('[data-mid]').dataset.mid;
    L.auto[mid] = Object.assign({}, L.auto[mid], { note: el.value }); staffTouchLog(L); touchStaff(sid);
  },
  taskText: el => { const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date, true); const tk = L.tasks.find(t => t.id === el.closest('[data-tid]').dataset.tid); if (tk) { tk.text = el.value; staffTouchLog(L); touchStaff(sid); } },
  taskNote: el => { const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date, true); const tk = L.tasks.find(t => t.id === el.closest('[data-tid]').dataset.tid); if (tk) { tk.note = el.value; staffTouchLog(L); touchStaff(sid); } },
  hours: el => { const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date, true); L.hours[el.dataset.k] = el.value; staffTouchLog(L); touchStaff(sid); },
  remark: el => { const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date, true); L.remark = el.value; autosize(el); staffTouchLog(L); touchStaff(sid); },
  bossComment: el => {
    const sid = el.dataset.sid, date = el.dataset.date; const doc = D(sid);
    const L = doc.logs[date] || (doc.logs[date] = { u: 0, auto: {}, tasks: [], hours: {}, remark: '' });
    L.boss = Object.assign({}, L.boss, { comment: el.value, at: now() }); touchStaff(sid);
  },
};
const CH = {
  cellDone: el => {
    const sid = ctxSid(), pid = S.route.parts[4]; const doc = D(sid);
    const m = findCell(doc, pid, el.dataset.date, el.dataset.side);
    const box = el.closest('.cell-edit');
    if (m && !m.text.trim()) {
      delMilestone(doc, m); touchStaff(sid);
      box.classList.remove('filled', 'tent');
      const tags = box.parentNode.querySelector('.cell-tags'); if (tags) tags.remove();
    } else if (m) box.classList.add('filled');
  },
  toggleClosed: el => { S.ui.showClosed = el.checked; render({ keepScroll: true }); },
  calSide: el => { calFilter(el.dataset.sid).side = el.value; render({ keepScroll: true }); },
  calTasks: el => { calFilter(el.dataset.sid).tasks = el.checked; render({ keepScroll: true }); },
  logJump: el => {
    if (!isDate(el.value)) return;
    const d = logDateFrom(el.value);
    location.hash = el.dataset.boss ? `#/boss/${el.dataset.sid}/log/${d}${el.dataset.v === 'day' ? '?v=day' : ''}` : `#/s/${el.dataset.sid}/log/${d}${el.dataset.v === 'week' ? '?v=week' : ''}`;
  },
  bossDate: el => { if (isDate(el.value)) location.hash = '#/boss?d=' + el.value; },
  autoStatus: el => {
    const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date, true);
    const mid = el.closest('[data-mid]').dataset.mid;
    const prev = (L.auto[mid] || {}).status || '';
    const set = (status, extra) => { L.auto[mid] = Object.assign({}, L.auto[mid], { status }, extra || {}); if (status !== 'moved') delete L.auto[mid].movedTo; staffTouchLog(L); touchStaff(sid); render({ keepScroll: true }); };
    if (el.value === 'moved') {
      const m = byId(doc.milestones, mid); const p = m && byId(doc.projects, m.projectId);
      moveDialog((to, note) => {
        addTask(sid, to, { text: autoText(p, m), pid: p.id, from: date, srcId: mid + '@' + date, note });
        set('moved', { movedTo: to, note: note || (L.auto[mid] || {}).note || '' });
        toast(`已安排到 ${mdw(to)}`);
      }, () => { el.value = prev; }, date);
    } else set(el.value);
  },
  taskStatus: el => {
    const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date, true);
    const tk = L.tasks.find(t => t.id === el.closest('[data-tid]').dataset.tid); if (!tk) return;
    const prev = tk.status || '';
    const set = status => { tk.status = status; if (status !== 'moved') delete tk.movedTo; staffTouchLog(L); touchStaff(sid); render({ keepScroll: true }); };
    if (el.value === 'moved') {
      if (!(tk.text || '').trim()) { el.value = prev; toast('請先填寫工作內容', true); return; }
      moveDialog((to, note) => {
        addTask(sid, to, { text: tk.text, pid: tk.pid || '', from: date, srcId: tk.id, note });
        tk.movedTo = to; if (note && !tk.note) tk.note = note; set('moved');
        toast(`已安排到 ${mdw(to)}`);
      }, () => { el.value = prev; }, date);
    } else set(el.value);
  },
  taskProj: el => {
    const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date, true);
    const tk = L.tasks.find(t => t.id === el.closest('[data-tid]').dataset.tid); if (!tk) return;
    tk.pid = el.value; staffTouchLog(L); touchStaff(sid); render({ keepScroll: true });
  },
  bossReviewed: el => {
    const sid = el.dataset.sid, date = el.dataset.date; const doc = D(sid);
    const L = doc.logs[date] || (doc.logs[date] = { u: 0, auto: {}, tasks: [], hours: {}, remark: '' });
    L.boss = Object.assign({}, L.boss, { reviewed: el.checked, at: now() }); touchStaff(sid);
    toast(el.checked ? '已標記為已閱' : '已取消已閱');
  },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('.modal-bg')) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('input', e => { const el = e.target; if (el.dataset && IN[el.dataset.in]) IN[el.dataset.in](el, e); });
document.addEventListener('change', e => { const el = e.target; if (el.dataset && CH[el.dataset.ch]) CH[el.dataset.ch](el, e); });
document.addEventListener('keydown', e => {
  const el = e.target;
  if (e.key === 'Enter' && el.dataset && el.dataset.act === 'rowGo') { ACT.rowGo(el); return; }
  if (e.key === 'Enter' && el.dataset && el.dataset.key === 'taskKey' && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date, true);
    const idx = L.tasks.findIndex(t => t.id === el.closest('[data-tid]').dataset.tid);
    const next = L.tasks[idx + 1];
    if (next && !(next.text || '').trim()) { const n = document.querySelector(`[data-tid="${next.id}"] .task-in`); if (n) n.focus(); return; }
    const tk = { id: uid(), text: '', pid: L.tasks[idx] ? L.tasks[idx].pid || '' : '', status: '', note: '' };
    L.tasks.splice(idx + 1, 0, tk); staffTouchLog(L); touchStaff(sid);
    S.afterRender = () => { const n = document.querySelector(`[data-tid="${tk.id}"] .task-in`); if (n) n.focus(); };
    render({ keepScroll: true });
  }
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.dataset.sub === 'gate') { e.preventDefault(); submitGate(f); }
});

/* =====================================================================
 * 啟動
 * ===================================================================== */
function idsForRoute(parts) {
  if ((parts[0] === 's' || parts[0] === 'boss') && parts[1] && staffOf(parts[1])) return [parts[1]].concat(linkOwners(parts[1]));
  return CFG().staff.map(s => s.id);
}
async function refreshRoute(maxAge) {
  if (Store.mode !== 'server' || Sync.dirty.size || Sync.busy) return false;
  const { parts } = parseHash();
  let changed = false;
  if (!parts[0] || parts[0] === 'boss') {
    try {
      const docs = await Store.load(['config']);
      if (docs.config && docs.config.rev !== S.config.rev && !Store.staleRevs.has(docs.config.rev) && !Sync.dirty.has('config')) {
        S.config = { rev: docs.config.rev, data: normalizeConfig(docs.config.data) }; refreshHolidays(); changed = true;
        const miss = CFG().staff.map(s => s.id).filter(id => !S.docs[id]);
        if (miss.length) await loadStaffDocs(miss);
      }
    } catch (e) { console.warn(e); }
  }
  if (await refreshIfStale(idsForRoute(parts), maxAge)) changed = true;
  return changed;
}
function showKeyForm(note) {
  $('#app').innerHTML = viewToken(note);
  $('#keyform').addEventListener('submit', async e => {
    e.preventDefault();
    const v = $('#akey').value.trim(); if (!v) return;
    Store.token = v;
    localStorage.setItem('zjpm.gh', v);
    await boot();
  });
}
async function boot() {
  $('#app').innerHTML = '<div class="loading">載入中</div>';
  await Store.detect();
  if (Store.mode === 'auth') { showKeyForm(Store.note); return; }
  if (Store.mode === 'error') {
    $('#app').innerHTML = `<main><div class="empty"><h3>目前連不上 GitHub</h3><p>請確認網路連線後重新整理。</p><button class="btn primary" onclick="location.reload()">重新整理</button></div></main>`;
    return;
  }
  try { await loadAll(); }
  catch (e) {
    if (e instanceof AuthError) { showKeyForm('badtoken'); return; }
    console.error(e);
    $('#app').innerHTML = `<main><div class="empty"><h3>無法載入資料</h3><p>${esc(e.message)}</p><button class="btn primary" onclick="location.reload()">重新整理</button></div></main>`;
    return;
  }
  render();
}
window.addEventListener('hashchange', async () => {
  modalStack.slice().forEach(c => c());
  if (!S.config) return;
  if (parseHash().parts[0] !== 'settings') S.setDraft = null;
  render();
  if (await refreshRoute(15000)) render({ keepScroll: true });
});
window.addEventListener('focus', async () => {
  if (!S.config) return;
  if (await refreshRoute(5000)) {
    const a = document.activeElement;
    if (!a || !['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)) render({ keepScroll: true });
  }
});
boot();

})();
