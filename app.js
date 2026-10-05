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
  ui: { showClosed: false, filters: {}, ptMs: (() => { try { return localStorage.getItem('zjpm.ptms') !== '0'; } catch (e) { return true; } })(), showNotes: (() => { try { return localStorage.getItem('zjpm.notes') !== '0'; } catch (e) { return true; } })(), listAll: (() => { try { return localStorage.getItem('zjpm.listAll') === '1'; } catch (e) { return false; } })() },
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
/** a 之後（不含 a）到 b（含 b）之間的工作天數，扣除週末與國定假日，補班日算工作天 */
function workdaysBetween(a, b) {
  let n = 0, d = a, g = 0;
  while (d < b && g++ < 800) { d = addDays(d, 1); if (!isOff(d)) n++; }
  return n;
}
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
    if (L.notes != null && !Array.isArray(L.notes)) L.notes = [];
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
    if (m.src) return true;   // 由 Google 日曆匯入的期程，同一格可以有多筆，不合併
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
    // 專案紀事逐則合併，避免兩台電腦同一天各自新增時遺失
    const nx = (x && x.notes) || [], ny = (y && y.notes) || [];
    if (nx.length || ny.length) r.notes = mergeArr(nx, ny);
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
  holder(key) { return key === 'config' ? S.config : key === 'schedule' ? S.sched : S.docs[key.slice(6)]; },
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
          if (key === 'config' || key === 'schedule') {   // 設定與主管的調整版本：以本機為準覆寫
            res = await Store.save(key, h.data, remote ? remote.rev : 0);
          } else {
            h.data = mergeStaff(h.data, normalizeStaff(remote ? remote.data : null));
            res = await Store.save(key, h.data, remote ? remote.rev : 0);
            merged = true;
          }
          if (res.conflict) throw new Error('conflict');
        }
        h.rev = res.rev;
        if (key.startsWith('staff_')) S.fetchedAt[key.slice(6)] = now();
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
function touchSched() { Sync.mark('schedule'); }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && Sync.dirty.size && !Sync.busy) { clearTimeout(Sync.timer); Sync.flush(); }
});
window.addEventListener('beforeunload', e => {
  if (Sync.dirty.size || Sync.busy) { Sync.flush(); e.preventDefault(); e.returnValue = ''; }
});

function normalizeSched(x) {
  const d = x && typeof x === 'object' ? x : {};
  return { drafts: d.drafts && typeof d.drafts === 'object' && !Array.isArray(d.drafts) ? d.drafts : {} };
}
async function loadAll() {
  const docs = await Store.load(['config', 'schedule']);
  S.sched = { rev: docs.schedule ? docs.schedule.rev : 0, data: normalizeSched(docs.schedule ? docs.schedule.data : null) };
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
/* ---------- 專案紀事：記在撰寫人自己的工作日誌裡（logs[日期].notes），依 sid＋pid 指向專案 ---------- */
/** 全部紀事 [{ n, author, date }]，新的在前；可指定專案 */
function allNotes(ownerSid, pid) {
  const out = [];
  CFG().staff.forEach(st => {
    const doc = S.docs[st.id] && S.docs[st.id].data; if (!doc) return;
    Object.entries(doc.logs || {}).forEach(([date, L]) => (L.notes || []).forEach(n => {
      if (!n || !(n.text || '').trim()) return;
      if (ownerSid && (n.sid !== ownerSid || n.pid !== pid)) return;
      out.push({ n, author: st, date });
    }));
  });
  return out.sort((a, b) => (b.date + (b.n.at || 0)).localeCompare(a.date + (a.n.at || 0), 'en', { numeric: true }) || (b.n.at || 0) - (a.n.at || 0));
}
/** 期程進度：日期已經過去的期程數／全部期程數 */
function scheduleProgress(ownerSid, pid) {
  const t = todayStr();
  const ms = (S.docs[ownerSid] ? D(ownerSid).milestones : []).filter(m => m.projectId === pid && (m.text || '').trim());
  const dates = ms.map(m => m.date).sort();
  const passed = ms.filter(m => m.date < t).length;
  return { total: ms.length, passed, pct: ms.length ? Math.round(passed / ms.length * 100) : 0, first: dates[0] || '', last: dates[dates.length - 1] || '', ms };
}
/** 專案的負責人 sid（參與的專案會帶 link） */
const ownerOf = (sid, p) => p && p.link ? p.link.sid : sid;
const hm = ts => { const d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

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
  if (a === 'timeline') return viewProjects(false, Object.assign({}, q, { view: 'timeline' }));
  if (a === 'projects') return b && c ? viewCaseProject(false, b, c, q) : viewProjects(false, q);
  if (a === 'settings') { if (!bossOk()) return viewGate('boss', '#/settings'); document.title = '系統設定｜' + CFG().company; return viewSettings(); }
  if (a === 's') {
    const st = staffOf(b);
    if (!st || !S.docs[b]) { go('#/', true); return null; }
    if (st.pin && !S.unlocked[b]) return viewGate(b, location.hash);
    document.title = `${st.name}｜${c === 'log' ? '工作日誌' : c === 'tasks' ? '自排工作' : '專案期程'}`;
    if (c === 'log') return viewStaffLog(b, d, q);
    if (c === 'tasks') return viewTasks(b, q);
    return viewPlan(b, c === 'plan' ? d : null, parts[4], q);
  }
  if (a === 'boss') {
    if (!bossOk()) return viewGate('boss', location.hash);
    document.title = '主管檢視｜' + CFG().company;
    if (b === 'timeline') return viewProjects(true, Object.assign({}, q, { view: 'timeline' }));
    if (b === 'projects') return c && d ? viewCaseProject(true, c, d, q) : viewProjects(true, q);
    if (b === 'attendance') return viewBossAttendance(q);
    if (b === 'schedule') return viewBossSchedule(q);
    if (b && staffOf(b) && S.docs[b]) return viewBossStaff(b, c || 'log', d, q);
    return viewBossBoard(q);
  }
  go('#/', true); return null;
}
function bossOk() { return !CFG().bossPin || S.unlocked.__boss; }

/* ---------------- top bar ---------------- */
function topbar(ctx) {
  S.ctxTop = ctx;   // 搜尋會依目前的檢視者決定連結
  const st = ctx.sid ? staffOf(ctx.sid) : null;
  let mid = '';
  if (ctx.mode === 'staff' && st) {
    mid = `<div class="who"><span class="dot" style="--c:${esc(st.color)}"></span>${esc(st.name)}</div>
      <nav class="tabs" aria-label="分頁">
        <a class="${ctx.tab === 'plan' ? 'on' : ''}" href="#/s/${st.id}/plan">專案期程</a>
        <a class="${ctx.tab === 'tasks' ? 'on' : ''}" href="#/s/${st.id}/tasks">自排工作</a>
        <a class="${ctx.tab === 'log' ? 'on' : ''}" href="#/s/${st.id}/log">工作日誌</a>
      </nav>`;
  } else if (ctx.mode === 'boss') {
    mid = `<div class="who boss">主管檢視</div>
      <nav class="tabs" aria-label="人員">
        <a class="${!ctx.tab ? 'on' : ''}" href="#/boss">全員總覽</a>
        <a class="${ctx.tab === 'schedule' ? 'on' : ''}" href="#/boss/schedule">工作期程表</a>
        <a class="${ctx.tab === 'projects' ? 'on' : ''}" href="#/boss/projects">專案總覽</a>
        <a class="${ctx.tab === 'attendance' ? 'on' : ''}" href="#/boss/attendance">出缺勤</a>
      </nav>`;
  } else if (ctx.mode === 'projects') {
    mid = `<div class="who">專案總覽</div>`;
  } else if (ctx.mode === 'settings') {
    mid = `<div class="who">系統設定</div>`;
  }
  const modeBadge = Store.mode === 'server' ? '' :
    `<span class="mode-badge" title="目前資料只存在這台電腦的瀏覽器中。在 config.js 設定資料倉庫後即可多人共用。">單機模式</span>`;
  return `<header class="top">
    <a class="brand" href="#/" title="回首頁">${ICON_GEM}<span class="brand-name">${esc(CFG().company)}</span><span class="brand-sub">專案管理</span></a>
    ${mid}
    <div class="top-right"><button class="search-btn" data-act="openSearch" title="搜尋專案、期程、紀事、工作日誌（Ctrl＋K）">${ICON_SEARCH}<span>搜尋</span><kbd>Ctrl K</kbd></button>${modeBadge}<span id="savestate" class="savestate" aria-live="polite"></span>
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
  const card = st => {
    const doc = S.docs[st.id] ? V(st.id) : emptyStaff();
    const act = doc.projects.filter(p => p.status !== 'closed').length;
    const todayMs = milestonesOn(doc, t).length;
    const L = doc.logs[t];
    const tasks = L ? L.tasks.filter(x => (x.text || '').trim()).length : 0;
    return `<article class="staff-card" style="--c:${esc(st.color)}">
      <h2>${esc(st.name)}</h2>
      <div class="meta">${act ? `進行中專案 ${act} 個` : '尚未建立專案'}<br>今天有 ${todayMs} 項重要期程${tasks ? `、${tasks} 項自排工作` : ''}</div>
      <div class="row three"><a class="btn" href="#/s/${st.id}/plan">專案期程</a><a class="btn" href="#/s/${st.id}/tasks">自排工作</a><a class="btn primary" href="#/s/${st.id}/log">工作日誌</a></div>
    </article>`;
  };
  const col = (role, name) => { const list = CFG().staff.filter(s => (s.role === 'design' ? 'design' : 'pm') === role); return `<div class="staff-col"><h3>${name}<small>${list.length} 人</small></h3>${list.map(card).join('') || '<p class="muted small">尚未設定這個職務的人員。</p>'}</div>`; };
  const cards = CFG().staff.length ? `<div class="staff-cols">${col('pm', '企劃編輯')}${col('design', '設計')}</div>` : '';
  return topbar({}) + `<main class="home">
    <div class="home-cal">${tearOff(t)}
      <nav class="home-nav" aria-label="其他功能">
        <a class="btn primary" href="#/boss">主管檢視</a>
        <a class="btn" href="#/projects">專案總覽</a>
        <a class="btn" href="#/settings">系統設定</a>
      </nav>
      <p class="home-range">可填寫期間<br>${esc(RANGE().start.replace(/-/g, '/'))} 至 ${esc(RANGE().end.replace(/-/g, '/'))}</p>
    </div>
    <section>
      ${modeNotice()}
      <h1>請選擇你的名字</h1>
      <p class="lead">專案期程用來排定各專案的重要日期；工作日誌會自動帶入當天的期程，再加上自己安排的工作。</p>
      ${cards || '<div class="empty">尚未建立人員，請到系統設定新增。</div>'}
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
  const item = p => `<li data-q="${esc([p.code, p.name, p.short, p.client, p.link ? p.link.name : ''].join(' ').toLowerCase())}"><a class="proj-link ${p.status || 'active'} ${sub === 'p' && arg === p.id ? 'on' : ''}" style="--c:${esc(p.color)}" href="#/s/${sid}/plan/p/${p.id}" title="${esc(p.name)}${p.link ? `（由${esc(p.link.name)}管理）` : ''}">
      <span class="code">${esc(p.code || '')}</span><span class="nm">${esc(p.name)}</span>${p.link ? `<span class="owner">${esc(p.link.name)}</span>` : ''}</a></li>`;
  const dangling = danglingLinks(sid).length;
  const isDesign = roleOf(sid) === 'design';
  const ownBlock = `<div class="side-head"><span>我的專案</span><span>${own.length}</span></div>
    <ul class="proj-list">${vis(own).map(item).join('') || (isDesign ? '<li class="side-empty">還沒有自己的專案</li>' : '')}</ul>
    <button class="btn ${isDesign ? 'ghost' : ''}" data-act="newProject">＋ 新增專案</button>
    <button class="btn ghost" data-act="importPlan">＋ 匯入專案期程</button>`;
  const linkBlock = `<div class="side-head"><span>參與的專案</span><span>${linked.length}</span></div>
    ${linked.length ? `<ul class="proj-list">${vis(linked).map(item).join('')}</ul>` : '<p class="side-hint">選擇企劃編輯已建立的專案，期程會跟著企劃編輯的修改自動更新。</p>'}
    ${dangling ? `<p class="side-hint warn-text">有 ${dangling} 個參與的專案已被管理者刪除。<button class="link-btn" data-act="cleanLinks">清除</button></p>` : ''}
    <button class="btn ${isDesign ? 'primary' : ''}" data-act="linkProjects">＋ 加入企劃編輯的專案</button>`;
  const side = `<aside class="side" aria-label="專案清單">
    <a class="side-item ${sub === 'overview' ? 'on' : ''}" href="#/s/${sid}/plan/overview">綜合檢視</a>
    ${projects.length > 8 ? `<input class="side-filter" type="search" data-in="sideFilter" placeholder="篩選專案…" aria-label="篩選專案清單">` : ''}
    ${isDesign ? linkBlock + '<div class="side-sep"></div>' + ownBlock : ownBlock + '<div class="side-sep"></div>' + linkBlock}
    ${closedCount ? `<label class="chk"><input type="checkbox" data-ch="toggleClosed" ${S.ui.showClosed ? 'checked' : ''}> 顯示已結案（${closedCount}）</label>` : ''}
  </aside>`;
  let main = '';
  if (sub === 'overview') main = overviewHTML(sid, q, false);
  else if (sub === 'p') {
    const p = byId(doc.projects, arg);
    if (!p) { go(`#/s/${sid}/plan`, true); return null; }
    const tab = q.mode === 'list' ? 'list' : (q.tab === 'grid' || q.m || q.focus) ? (p.link ? 'list' : 'grid') : 'home';
    main = projTabs(sid, p, tab) + (tab === 'home'
      ? projectHomeHTML(ownerOf(sid, p), p, { sid, canEdit: !p.link, allNotes: q.notes === 'all' })
      : p.link ? linkedProjectHTML(sid, p) : projectHTML(sid, p, q));
  } else {
    main = `<div class="empty"><h3>還沒有任何專案</h3>
      <p>${isDesign ? '可以直接加入企劃編輯已建立的專案，期程會自動同步；' : '先新增一個專案，就能依日期填寫它的重要期程；'}<br>也可以自己新增專案，或用「匯入專案期程」貼上整理好的期程。</p>
      <div class="row" style="justify-content:center"><button class="btn primary" data-act="linkProjects">＋ 加入企劃編輯的專案</button><button class="btn" data-act="newProject">＋ 新增專案</button><button class="btn" data-act="importPlan">＋ 匯入專案期程</button></div></div>`;
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
    <div class="row noprint"><button class="btn sm" data-act="editProject" data-pid="${p.id}">編輯專案</button><button class="btn sm" data-act="importPlan" data-pid="${p.id}">匯入期程</button><button class="btn sm" data-act="exportProject" data-pid="${p.id}">匯出 CSV</button></div>
    <div class="proj-meta">${p.client ? `<span>委託單位 <b>${esc(p.client)}</b></span>` : ''}<span>簡稱 <b>${esc(shortOf(p))}</b>${p.short ? '' : '（未設定，可在「編輯專案」填寫）'}</span><span>已填期程 <b>${ms.length}</b> 筆</span>
      ${next ? `<span>下一個期程 <b>${mdw(next.date)} ${esc(next.text.split('\n')[0])}</b></span>` : ''}${(() => { const ps = participantsOf(sid, p.id); return ps.length ? `<span>參與：<b>${esc(ps.map(x => x.name).join('、'))}</b>（修改期程會同步給他們）</span>` : ''; })()}${p.note ? `<span>${esc(p.note)}</span>` : ''}</div>
  </header>`;
  const seg = '';   // 改由上方的「首頁｜逐日填寫｜期程清單」分頁切換
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
  const own = {}, extra = {};
  ms.forEach(m => { const k = m.date + '|' + m.side; if (!own[k]) own[k] = m; else (extra[k] = extra[k] || []).push(m); });  // 同一格有多筆時，第一筆可直接編輯，其餘列在下方
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
        <button class="cell-more" data-act="cellMore" data-date="${d}" data-side="${side}" title="期間、待確認、備註" aria-label="${md(d)} ${SIDE_NAME[side]} 詳細設定">⋯</button></div>${tags}${(extra[d + '|' + side] || []).map(x => `<button class="cell-extra" style="--c:${esc(p.color)}" data-act="msEdit" data-mid="${x.id}" title="點一下編輯">${esc(x.text.split('\n')[0])}${x.endDate ? `<span class="tag">至 ${md(x.endDate)}</span>` : ''}</button>`).join('')}</td>`;
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
  const body = `<p class="muted small" style="margin:0 0 12px">${esc(p.code || '')} ${esc(p.name)}${m && m.src && m.src.startsWith('ics:') ? `<br><span class="warn-text">這筆來自 Google 日曆「${esc(m.src.split(':')[1])}」，重新上傳日曆檔時會以日曆內容為準。</span>` : ''}</p>
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
 * 綜合檢視（週曆／月曆／清單）— 同仁與主管共用
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

  // 專案紀事（本人負責或參與的專案，所有人寫的都顯示）
  const notesBy = {};
  if (S.ui.showNotes) {
    const keys = new Set(doc.projects.filter(p => !F.hidden[p.id]).map(p => ownerOf(sid, p) + '|' + p.id));
    allNotes().forEach(x => { if (keys.has(x.n.sid + '|' + x.n.pid)) (notesBy[x.date] = notesBy[x.date] || []).push(x); });
  }
  const noteChip = x => { const p = byId(doc.projects, x.n.pid); return `<div class="chip note" style="--c:${esc(p ? p.color : 'var(--ink3)')}" title="${esc(`${x.author.name} ${hm(x.n.at)}　${x.n.text}`)}"><span class="ct">✎ ${p ? esc(shortOf(p)) + '｜' : ''}${esc(x.n.text.replace(/\n/g, ' '))}</span></div>`; };
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
        ${items.length > max ? `<button class="more-btn" data-act="calGo" data-href="${esc(link('week', d))}">還有 ${items.length - max} 項</button>` : ''}
        ${(notesBy[d] || []).slice(0, 2).map(noteChip).join('')}${(notesBy[d] || []).length > 2 ? `<button class="more-btn" data-act="calGo" data-href="${esc(link('week', d))}">還有 ${notesBy[d].length - 2} 則紀事</button>` : ''}</div></div>`;
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
        <div class="cw-body">${items.map(it => chipHTML(doc, it, d, sid, readOnly, 'full')).join('') || (tasks.length || notesBy[d] ? '' : '<span class="muted small">—</span>')}
        ${notesBy[d] ? `<div class="cw-sub">紀事</div>${notesBy[d].map(noteChip).join('')}` : ''}
        ${tasks.length ? `<div class="cw-sub">自排工作</div>${tasks.map(tk => { const p = byId(doc.projects, tk.pid); const s = ST[tk.status || '']; return `<div class="chip task ${tk.status === 'done' ? 'done' : ''}" title="${esc(s.t)}"><span class="ct"><span class="sym ${s.cls}">${s.sym}</span> ${p ? esc(projLabel(p)) + '｜' : ''}${esc(tk.text)}</span></div>`; }).join('')}` : ''}
        </div></div>`;
    }
    body = `<div class="cal-week">${cols}</div>`;
  } else {
    const from = anchor; const to = addDays(from, 62);
    title = `${md(from)} 起 9 週`;
    prevD = addDays(from, -63); nextD = addDays(from, 63);
    const map = milestoneMap(doc, from, to, filter);
    const all = !!S.ui.listAll;
    // 每個專案的期程日期（依目前篩選），用來計算「距上一個期程」的工作天數
    const pm = Object.fromEntries(doc.projects.map(p => [p.id, p]));
    const datesBy = {};
    doc.milestones.forEach(m => { const p = pm[m.projectId]; if (p && (m.text || '').trim() && (!filter || filter(m, p))) (datesBy[p.id] = datesBy[p.id] || new Set()).add(m.date); });
    Object.keys(datesBy).forEach(k => { datesBy[k] = Array.from(datesBy[k]).sort(); });
    const gapTag = (pid, d) => {
      const arr = datesBy[pid] || []; let prev = null;
      for (const x of arr) { if (x < d) prev = x; else break; }
      if (!prev) return '';
      const n = workdaysBetween(prev, d);
      return `<span class="gap" title="從 ${mdw(prev)} 的上一個期程算起（扣除週末與國定假日）">距上一個期程 <b>${n}</b> 個工作天</span>`;
    };
    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) if (all || map[d] || notesBy[d]) days.push(d);
    let lastMonth = '';
    const rows = days.map(d => {
      const head = d.slice(0, 7) !== lastMonth ? `<div class="ag-month">${d.slice(0, 4)} 年 ${+d.slice(5, 7)} 月</div>` : '';
      lastMonth = d.slice(0, 7);
      const items = map[d] || [];
      const seen = new Set();
      const body = items.length ? items.map(it => {
        const chip = chipHTML(doc, it, d, sid, readOnly, 'full');
        if (it.cont || seen.has(it.p.id)) return `<div class="ag-row">${chip}</div>`;
        seen.add(it.p.id);
        return `<div class="ag-row">${chip}${gapTag(it.p.id, d)}</div>`;
      }).join('') + (notesBy[d] || []).map(x => `<div class="ag-row">${noteChip(x)}</div>`).join('') : (notesBy[d] ? notesBy[d].map(x => `<div class="ag-row">${noteChip(x)}</div>`).join('') : '<span class="ag-none">—</span>');
      return `${head}<div class="ag-day ${isOff(d) ? 'off' : ''} ${items.length ? '' : 'blank'} ${d === t ? 'today' : ''}"><div class="ag-date">${mdw(d)}${HOL[d] ? `<small>${esc(HOL[d].name)}</small>` : ''}</div>
      <div class="ag-items">${body}</div></div>`;
    }).join('');
    const toggle = `<label class="chk ag-toggle noprint"><input type="checkbox" data-ch="listAll" ${all ? 'checked' : ''}> 顯示每一天（包含沒有期程的日子）</label>`;
    body = toggle + (days.length ? `<div class="agenda">${rows}</div>`
      : `<div class="empty"><h3>這段期間沒有期程</h3><p>換個日期範圍、勾選「顯示每一天」，或檢查上方的篩選條件。</p></div>`);
  }
  const bar = `<div class="cal-bar">
    <div class="seg" role="tablist">${[['month', '月曆'], ['week', '週曆'], ['list', '清單']].map(([v, n]) => `<a role="tab" class="${view === v ? 'on' : ''}" href="${esc(link(v, anchor))}">${n}</a>`).join('')}</div>
    <div class="cal-nav"><a class="icon-btn" href="${esc(link(view, prevD))}" aria-label="上一段">‹</a><a class="btn sm" href="${esc(link(view, t))}">今天</a><a class="icon-btn" href="${esc(link(view, nextD))}" aria-label="下一段">›</a><h3>${title}</h3></div>
    <span class="grow"></span>
    <select data-ch="calSide" data-sid="${sid}" aria-label="期程類別"><option value="all" ${F.side === 'all' ? 'selected' : ''}>全部期程</option><option value="ours" ${F.side === 'ours' ? 'selected' : ''}>只看紫晶進度</option><option value="client" ${F.side === 'client' ? 'selected' : ''}>只看單位進度</option></select>
    ${view === 'week' ? `<label class="chk"><input type="checkbox" data-ch="calTasks" data-sid="${sid}" ${F.tasks ? 'checked' : ''}> 顯示自排工作</label>` : ''}
    <label class="chk"><input type="checkbox" data-ch="calNotes" ${S.ui.showNotes ? 'checked' : ''}> 顯示紀事</label>
    <button class="btn sm" data-act="print">列印</button>
  </div>`;
  const legend = showProj.length ? `<div class="legend">${showProj.map(p => `<button class="${F.hidden[p.id] ? 'off' : ''}" style="--c:${esc(p.color)}" data-act="calToggle" data-sid="${sid}" data-pid="${p.id}" aria-pressed="${!F.hidden[p.id]}" title="${esc(fullOf(p))}（點一下可隱藏／顯示）">${esc(shortOf(p))}</button>`).join('')}
    <span class="key"><i style="background:var(--ame-tint);border-left:3px solid var(--ame)"></i>紫晶進度</span><span class="key"><i style="border:1px solid var(--ame-soft);border-left:3px solid var(--ame)"></i>單位進度</span><span class="key"><i style="border:1px dashed var(--ame-soft)"></i>待確認</span></div>` : '';
  const head = readOnly ? '' : `<div class="page-head"><div><h1>綜合檢視</h1><p>所有專案的期程集中在同一張行事曆。點選期程可跳到該專案編輯。</p></div></div>`;
  const empty = !doc.projects.length ? `<div class="notice info">${readOnly ? '這位同仁還沒有建立專案。' : '還沒有專案。先在左側新增專案並填寫期程，這裡就會自動彙整。'}</div>` : '';
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
  // 同仁預設單日、主管預設一週總表
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

  // 主管在「工作期程表」確認調整後寫入的標示
  const bossTag = tk => {
    const b = tk.boss; if (!b) return '';
    const nm = id => staffOf(id) ? staffOf(id).name : '';
    const txt = b.kind === 'add' ? '主管新增'
      : b.kind === 'edit' ? `主管修改${b.old ? `（原：${b.old}）` : ''}`
      : b.kind === 'move' ? (b.fromSid && b.fromSid !== sid ? `主管改派：原由 ${nm(b.fromSid)} 負責` : `主管調整：由 ${mdw(b.from)} 改到這天`) + (b.old ? `（原：${b.old}）` : '')
      : b.kind === 'out' ? `主管改到 ${mdw(b.to)}${b.toSid && b.toSid !== sid ? `，改由 ${nm(b.toSid)} 負責` : ''}`
      : b.kind === 'remove' ? '主管取消' : '主管調整';
    return `<div class="boss-tag">${esc(txt)}</div>`;
  };
  // 自排工作
  const taskRows = L.tasks.map(tk => {
    const p = byId(doc.projects, tk.pid);
    const s = ST[tk.status || ''];
    if (readOnly) {
      if (!(tk.text || '').trim()) return '';
      return `<div class="task auto st-${s.cls} ${tk.boss ? 'boss-adj' : ''}"><span class="tp ${p ? '' : 'none'}" style="${p ? `--c:${esc(p.color)}` : ''}">${esc(p ? projLabel(p) : '其他')}</span>
        <div class="task-body"><div class="task-text">${esc(tk.text)}</div>${tk.note ? `<div class="meta" style="color:var(--ink2)">說明：${esc(tk.note)}</div>` : ''}
        ${tk.from ? `<div class="meta">由 ${mdw(tk.from)} 移入</div>` : ''}${tk.movedTo && !tk.boss ? `<div class="meta">↪ 已改到 ${mdw(tk.movedTo)}</div>` : ''}${bossTag(tk)}</div>
        <span class="sbadge ${s.cls}">${s.t}</span></div>`;
    }
    const opts = `<option value="">其他／雜事</option>` + projects.concat(p && !projects.includes(p) ? [p] : []).map(x => `<option value="${x.id}" ${x.id === tk.pid ? 'selected' : ''}>${esc(x.code ? x.code + ' ' : '')}${esc(x.name)}</option>`).join('');
    return `<div class="task self st-${s.cls} ${tk.boss ? 'boss-adj' : ''}" data-tid="${tk.id}">
      <select class="task-projsel" data-ch="taskProj" style="--c:${p ? esc(p.color) : 'var(--line)'}" aria-label="所屬專案">${opts}</select>
      <div class="task-body"><input type="text" class="task-in" data-in="taskText" data-key="taskKey" value="${esc(tk.text || '')}" placeholder="工作內容，按 Enter 新增下一項" aria-label="工作內容">
        <input type="text" class="task-note" data-in="taskNote" value="${esc(tk.note || '')}" placeholder="說明（完成狀況、延宕原因、改期安排…）" aria-label="說明">
        ${tk.from ? `<div class="meta">由 ${mdw(tk.from)} 移入</div>` : ''}${tk.movedTo && !tk.boss ? `<div class="meta">↪ 已改到 ${mdw(tk.movedTo)}</div>` : ''}${bossTag(tk)}</div>
      ${statusSelect(tk.status, 'data-ch="taskStatus"')}
      <button class="icon-btn" data-act="delTask" aria-label="刪除這項工作" title="刪除">✕</button>
    </div>`;
  }).join('');

  // 專案紀事（只限自己負責或參與的專案）
  const noteRows = (L.notes || []).map(n => {
    const owner = staffOf(n.sid);
    const p = n.sid && S.docs[n.sid] ? byId(D(n.sid).projects, n.pid) : null;
    if (readOnly) {
      if (!(n.text || '').trim()) return '';
      return `<div class="note-row ro"><span class="tp ${p ? '' : 'none'}" style="${p ? `--c:${esc(p.color)}` : ''}">${esc(p ? shortOf(p) : '已刪除的專案')}</span><div class="note-text">${esc(n.text)}</div><span class="note-time">${hm(n.at)}</span></div>`;
    }
    const cur = p ? n.sid + '|' + n.pid : '';
    const opts = projects.map(x => { const v = ownerOf(sid, x) + '|' + x.id; return `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(shortOf(x))}｜${esc(x.name)}</option>`; }).join('')
      + (p && !projects.some(x => x.id === p.id) ? `<option value="${esc(cur)}" selected>${esc(shortOf(p))}｜${esc(p.name)}</option>` : '');
    return `<div class="note-row" data-nid="${n.id}">
      <select class="task-projsel" data-ch="noteProj" style="--c:${p ? esc(p.color) : 'var(--line)'}" aria-label="紀事所屬專案">${opts}</select>
      <textarea class="note-in" data-in="noteText" data-auto rows="1" placeholder="例如：書歌B封面＋A封底，已轉達設計" aria-label="紀事內容">${esc(n.text || '')}</textarea>
      <span class="note-time" title="紀錄時間">${hm(n.at)}</span>
      <button class="icon-btn" data-act="delNote" aria-label="刪除這則紀事" title="刪除">✕</button>
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
    <section class="blk" aria-labelledby="h-self"><div class="blk-h"><h3 id="h-self">自排工作</h3><span class="sub">當天自己安排的其他工作${readOnly ? '' : `・<a href="#/s/${sid}/tasks?d=${date}">到「自排工作」預排兩週 ›</a>`}</span></div>
      ${taskRows || (readOnly ? '<p class="muted small" style="margin:0">沒有填寫自排工作。</p>' : '')}
      ${readOnly ? '' : `<div class="add-row noprint"><button class="btn" data-act="addTask">＋ 新增工作</button>
        ${carry && carry.items.length ? `<button class="btn" data-act="carry">帶入 ${mdw(carry.from)} 未完成的 ${carry.items.length} 項</button>` : ''}</div>`}
    </section>
    <section class="blk notes-blk" aria-labelledby="h-notes"><div class="blk-h"><h3 id="h-notes">專案紀事</h3><span class="sub">記錄專案的重要變動與決定，會出現在專案首頁與綜合檢視</span></div>
      ${noteRows || (readOnly ? '<p class="muted small" style="margin:0">這天沒有專案紀事。</p>' : '')}
      ${readOnly ? '' : (projects.length ? `<div class="add-row noprint"><button class="btn" data-act="addNote">＋ 新增紀事</button></div>` : '<p class="muted small" style="margin:0">建立或加入專案後，就可以記錄專案紀事。</p>')}
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
  return `<section class="blk boss-note bossbox noprint"><div class="blk-h"><h3>主管回饋</h3><span class="sub">同仁會在自己的工作日誌看到</span></div>
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
 * 全案時間表：所有企劃編輯的專案並排在同一條時間軸上（唯讀）
 * 路由：#/timeline（所有人）、#/boss/timeline（主管檢視）
 * 參數：d=起始月份中的任一天、z=1|3|6（顯示幾個月）、who=人員 id、closed=1（含已結案）
 * ===================================================================== */
const TL_DW = { 1: 30, 3: 11, 6: 6 };           // 每一天的寬度（px）
const TL_ROW = { head: 26, days: 24, dens: 30, group: 30, proj: 38 };

function viewTimeline(isBoss, q, embed) {
  const t = todayStr();
  const z = ['1', '3', '6'].includes(String(q.z)) ? +q.z : 3;
  const start = monthStart(isDate(q.d) ? q.d : t);
  const endEx = addMonths(start, z);
  const link = o => casesLink(isBoss, q, Object.assign({ view: 'timeline', d: start, z }, o));
  const who = caseFilters(q).who;

  // 日期軸
  const days = [];
  for (let d = start; d < endEx; d = addDays(d, 1)) days.push(d);
  const dw = TL_DW[z], W = days.length * dw;
  const idx = d => Math.round((toDate(d) - toDate(start)) / 86400000);
  const P = px => (px / W * 100).toFixed(4) + '%';   // 以百分比定位，畫面較寬時自動撐滿
  const cx = d => idx(d) * dw + dw / 2;
  const inView = d => d >= start && d < endEx;

  // 專案（依負責人分組；參與者標在旁邊），套用專案總覽上方的篩選
  const groups = caseGroups(q);

  // 每週期程數（目前顯示的專案）
  const perDay = {};
  groups.forEach(g => g.projs.forEach(x => x.ms.forEach(m => { if (inView(m.date)) perDay[m.date] = (perDay[m.date] || 0) + 1; })));
  const weeks = [];
  for (let wk = mondayOf(start); wk < endEx; wk = addDays(wk, 7)) {
    let n = 0; const a = wk < start ? start : wk; const bEx = addDays(wk, 7) < endEx ? addDays(wk, 7) : endEx;
    for (let d = a; d < bEx; d = addDays(d, 1)) n += perDay[d] || 0;
    weeks.push({ wk, left: idx(a) * dw, width: idx(bEx) * dw - idx(a) * dw, n });
  }
  const level = n => n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 8 ? 3 : 4;

  // 右側：時間軸各列
  const offLayer = days.map(d => isOff(d) ? `<i class="tl-off ${HOL[d] && !isWeekend(d) ? 'hol' : ''}" style="left:${P(idx(d) * dw)};width:${P(dw)}" title="${esc(mdw(d) + (HOL[d] ? ' ' + HOL[d].name : ''))}"></i>` : '').join('');
  const todayLine = inView(t) ? `<i class="tl-today" style="left:${P(cx(t))}" title="今天 ${mdw(t)}"></i>` : '';
  const months = [];
  for (let m = start; m < endEx; m = addMonths(m, 1)) {
    const a = idx(m), b = idx(addMonths(m, 1) < endEx ? addMonths(m, 1) : endEx);
    months.push(`<div class="tl-mon" style="left:${P(a * dw)};width:${P((b - a) * dw)}">${(m === start || m.slice(5, 7) === '01') ? m.slice(0, 4) + ' 年 ' : ''}${+m.slice(5, 7)} 月</div>`);
  }
  const ticks = z === 1
    ? days.map(d => `<span class="tl-tick ${isOff(d) ? 'off' : ''} ${d === t ? 'on' : ''}" style="left:${P(idx(d) * dw)};width:${P(dw)}">${+d.slice(8)}<small>${WEEK[dowOf(d)]}</small></span>`).join('')
    : days.filter(d => dowOf(d) === 1).map(d => `<span class="tl-tick wk" style="left:${P(idx(d) * dw)}">${+d.slice(8)}</span>`).join('');
  const dens = weeks.map(w => `<span class="tl-dens l${level(w.n)}" style="left:${P(w.left)};width:${P(w.width)}" title="${md(w.wk)} 這週：${w.n} 筆期程">${w.n || ''}</span>`).join('');

  const projRow = x => {
    const { p, ms } = x;
    if (!ms.length) return `<div class="tl-row proj" style="height:${TL_ROW.proj}px"></div>`;
    const dates = ms.map(m => m.date).concat(ms.filter(m => m.endDate).map(m => m.endDate)).sort();
    const first = dates[0], last = dates[dates.length - 1];
    let line = '';
    if (last >= start && first < endEx) {
      const a = first < start ? 0 : cx(first), b = last >= endEx ? W : cx(last);
      line = `<i class="tl-line" style="left:${P(a)};width:${P(Math.max(0, b - a))};--c:${esc(p.color)}"></i>`;
    }
    const bars = ms.filter(m => m.endDate && m.endDate > m.date && m.endDate >= start && m.date < endEx).map(m => {
      const a = m.date < start ? 0 : cx(m.date), b = m.endDate >= endEx ? W : cx(m.endDate);
      return `<i class="tl-bar" style="left:${P(a)};width:${P(b - a)};--c:${esc(p.color)}"></i>`;
    }).join('');
    const byDate = {};
    ms.filter(m => inView(m.date)).forEach(m => (byDate[m.date] = byDate[m.date] || []).push(m));
    const dkeys = Object.keys(byDate).sort();
    const dots = dkeys.map((d, i) => {
      const arr = byDate[d].sort((a, b) => (a.side === 'ours' ? -1 : 1) - (b.side === 'ours' ? -1 : 1));
      const allClient = arr.every(m => m.side === 'client');
      const tent = arr.some(m => m.tentative);
      const tip = `${shortOf(p)}｜${mdw(d)}\n` + arr.map(m => `${m.side === 'client' ? '［單位］' : ''}${m.text.trim().replace(/\n/g, '／')}${m.tentative ? '（待確認）' : ''}`).join('\n');
      let label = '';
      if (z === 1) {
        const nx = dkeys[i + 1] ? cx(dkeys[i + 1]) : W;
        const room = Math.min(nx - cx(d) - 14, 220);
        if (room >= 28) label = `<span class="tl-lab" style="left:${P(cx(d) + 9)};max-width:${room}px">${esc(arr[0].text.trim().split('\n')[0])}</span>`;
      }
      return `<button class="tl-dot ${allClient ? 'client' : ''} ${tent ? 'tent' : ''}" style="left:${P(cx(d))};--c:${esc(p.color)}" data-act="tlDot" data-owner="${esc(x.owner.id)}" data-pid="${esc(p.id)}" data-date="${d}" title="${esc(tip)}" aria-label="${esc(tip)}">${arr.length > 1 ? `<b>${arr.length}</b>` : ''}</button>${label}`;
    }).join('');
    return `<div class="tl-row proj ${p.status === 'closed' ? 'closed' : ''}" style="height:${TL_ROW.proj}px">${line}${bars}${dots}</div>`;
  };

  let left = `<div class="tl-l head" style="height:${TL_ROW.head + TL_ROW.days}px">專案</div>
    <div class="tl-l dens" style="height:${TL_ROW.dens}px" title="全公司每週的期程筆數，顏色越深代表越忙">每週期程數</div>`;
  let right = `<div class="tl-row head" style="height:${TL_ROW.head}px">${months.join('')}</div>
    <div class="tl-row days" style="height:${TL_ROW.days}px">${ticks}</div>
    <div class="tl-row dens" style="height:${TL_ROW.dens}px">${dens}</div>`;
  groups.forEach(g => {
    left += `<div class="tl-l group" style="height:${TL_ROW.group}px"><span class="dot" style="--c:${esc(g.o.color)}"></span>${esc(g.o.name)}<small>${ROLE_NAME[roleOf(g.o.id)]}</small></div>`;
    right += `<div class="tl-row group" style="height:${TL_ROW.group}px"></div>`;
    g.projs.forEach(x => {
      left += `<a class="tl-l proj ${x.p.status === 'closed' ? 'closed' : ''}" href="${esc(isBoss ? `#/boss/projects/${x.owner.id}/${x.p.id}` : projLink(x.owner.id, x.p.id))}" style="height:${TL_ROW.proj}px;--c:${esc(x.p.color)}" title="${esc(fullOf(x.p))}${x.parts.length ? '｜參與：' + esc(x.parts.map(s => s.name).join('、')) : ''}">
        <b>${esc(shortOf(x.p))}</b>${x.parts.map(s => `<span class="who-mini" style="--c:${esc(s.color)}">${esc(s.name)}</span>`).join('')}</a>`;
      right += projRow(x);
    });
  });

  const zooms = [[1, '1 個月'], [3, '3 個月'], [6, '半年']];
  const lastDay = addDays(endEx, -1);
  const bar = `<div class="cal-bar noprint">
    <div class="seg" role="tablist">${zooms.map(([v, n]) => `<a role="tab" class="${z === v ? 'on' : ''}" href="${esc(link({ z: v }))}">${n}</a>`).join('')}</div>
    <div class="cal-nav"><a class="icon-btn" href="${esc(link({ d: addMonths(start, -z) }))}" aria-label="往前">‹</a><a class="btn sm" href="${esc(link({ d: t }))}">本月</a><a class="icon-btn" href="${esc(link({ d: addMonths(start, z) }))}" aria-label="往後">›</a>
      <h3>${start.slice(0, 4)}/${+start.slice(5, 7)} – ${lastDay.slice(0, 4) !== start.slice(0, 4) ? lastDay.slice(0, 4) + '/' : ''}${+lastDay.slice(5, 7)} 月</h3></div>
    <span class="grow"></span>
    <button class="btn sm" data-act="print">列印</button>
  </div>`;
  const legend = `<div class="tl-legend"><span><i class="tl-dot-k"></i>紫晶進度</span><span><i class="tl-dot-k client"></i>單位進度</span><span><i class="tl-dot-k tent"></i>待確認</span>
    <span><i class="tl-bar-k"></i>期間</span><span><i class="tl-off-k"></i>週末／國定假日</span><span><i class="tl-today-k"></i>今天</span>
    <span class="muted">點一下圓點可看詳細內容${z === 1 ? '' : '；切換到「1 個月」可直接看到文字'}</span></div>`;

  const body = groups.length
    ? `<div class="tl"><div class="tl-left">${left}</div><div class="tl-right" id="tl-scroll"><div class="tl-canvas" style="min-width:${W}px">${offLayer}${todayLine}${right}</div></div></div>`
    : `<div class="empty"><h3>沒有符合條件的專案</h3><p>試著清除上方的篩選條件。</p></div>`;
  if (inView(t)) S.afterRender = () => { const sc = $('#tl-scroll'); if (sc && sc.scrollWidth > sc.clientWidth) sc.scrollLeft = Math.max(0, cx(t) - sc.clientWidth * 0.3); };
  return `${bar}${legend}${body}`;
}

function tlDetail(ownerSid, pid, date) {
  const o = staffOf(ownerSid); if (!o || !S.docs[ownerSid]) return;
  const p = byId(D(ownerSid).projects, pid); if (!p) return;
  const ms = D(ownerSid).milestones.filter(m => m.projectId === pid && m.date === date && (m.text || '').trim())
    .sort((a, b) => (a.side === 'ours' ? -1 : 1) - (b.side === 'ours' ? -1 : 1));
  const parts = participantsOf(ownerSid, pid);
  openModal({
    title: `${shortOf(p)}｜${mdw(date)}`,
    body: `<p class="muted small" style="margin:0 0 10px">${esc(fullOf(p))}　負責：${esc(o.name)}${parts.length ? '　參與：' + esc(parts.map(s => s.name).join('、')) : ''}</p>
      <ul class="tl-detail">${ms.map(m => `<li><span class="tag ${m.side === 'client' ? 'client' : ''}">${SIDE_NAME[m.side]}</span>${m.tentative ? '<span class="tag tent">待確認</span>' : ''}${m.endDate ? `<span class="tag">至 ${mdw(m.endDate)}</span>` : ''}
        <div style="white-space:pre-wrap;margin-top:4px">${esc(m.text.trim())}</div>${m.note ? `<div class="small muted">${esc(m.note)}</div>` : ''}</li>`).join('')}</ul>`,
    actions: [{ label: '關閉', cls: 'primary', primary: true }],
  });
}

function tlGo(changes) {
  const base = S.route.parts[0] === 'boss' ? '#/boss/timeline' : '#/timeline';
  const q = Object.assign({}, S.route.q, changes);
  go(base + '?' + Object.entries(q).filter(([, v]) => v !== '' && v != null).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&'));
}

/* =====================================================================
 * 案件視角：專案首頁、專案總覽（卡片／時間表）、搜尋
 * 路由：#/projects（所有人）、#/projects/:owner/:pid（專案首頁，唯讀）
 *       #/boss/projects、#/boss/projects/:owner/:pid（主管檢視）
 *       #/s/:sid/plan/p/:pid（同仁自己的專案首頁，可新增紀事）
 * ===================================================================== */
const ICON_SEARCH = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M20 20l-4.2-4.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const STATUS_NAME = { active: '進行中', paused: '暫停', closed: '已結案' };

/** 依目前檢視者決定專案要連到哪裡 */
function projLink(ownerSid, pid) {
  const c = S.ctxTop || {};
  if (c.mode === 'boss') return `#/boss/projects/${ownerSid}/${pid}`;
  if (c.mode === 'staff' && c.sid && S.docs[c.sid]) {
    if (ownerSid === c.sid || (D(c.sid).links || []).some(l => l.sid === ownerSid && l.pid === pid)) return `#/s/${c.sid}/plan/p/${pid}`;
  }
  return `#/projects/${ownerSid}/${pid}`;
}

/* ---------------- 篩選（專案總覽與時間表共用） ---------------- */
function caseFilters(q) {
  return {
    s: String(q.s || '').trim(),
    owner: q.owner && staffOf(q.owner) ? q.owner : '',
    who: q.who && staffOf(q.who) ? q.who : '',
    st: ['all', 'closed', 'active'].includes(q.st) ? q.st : (q.closed === '1' ? 'all' : 'active'),
  };
}
function caseGroups(q) {
  const F = caseFilters(q);
  const terms = F.s.toLowerCase().split(/\s+/).filter(Boolean);
  return CFG().staff.map(o => {
    if (!S.docs[o.id] || (F.owner && F.owner !== o.id)) return null;
    const projs = sortedProjects(D(o.id), true)
      .filter(p => F.st === 'all' || (F.st === 'closed' ? p.status === 'closed' : p.status !== 'closed'))
      .map(p => ({ p, owner: o, parts: participantsOf(o.id, p.id), ms: D(o.id).milestones.filter(m => m.projectId === p.id && (m.text || '').trim()) }))
      .filter(x => !F.who || x.owner.id === F.who || x.parts.some(s => s.id === F.who))
      .filter(x => !terms.length || terms.every(tm => [x.p.code, x.p.name, x.p.short, x.p.client, x.owner.name, ...x.parts.map(s => s.name)].join(' ').toLowerCase().includes(tm)));
    return projs.length ? { o, projs } : null;
  }).filter(Boolean);
}
function casesBase(isBoss) { return isBoss ? '#/boss/projects' : '#/projects'; }
function casesLink(isBoss, q, o) {
  const p = Object.assign({}, q, o);
  const qs = Object.entries(p).filter(([, v]) => v !== '' && v != null).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  return casesBase(isBoss) + (qs ? '?' + qs : '');
}
function casesGo(changes) {
  const isBoss = S.route.parts[0] === 'boss';
  go(casesLink(isBoss, S.route.q, changes));
}

/* ---------------- 專案總覽 ---------------- */
function progressBar(pr) {
  return `<div class="pbar" role="img" aria-label="期程進度 ${pr.pct}%"><i style="width:${pr.pct}%"></i></div>`;
}
function viewProjects(isBoss, q) {
  const view = q.view === 'timeline' ? 'timeline' : 'cards';
  const F = caseFilters(q);
  const t = todayStr();
  const opt = (list, cur, all) => `<option value="">${all}</option>` + list.map(s => `<option value="${esc(s.id)}" ${cur === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const staff = CFG().staff;
  const bar = `<div class="case-bar noprint">
    <label class="case-search">${ICON_SEARCH}<input id="case-s" type="search" data-in="caseSearch" value="${esc(F.s)}" placeholder="篩選專案名稱、簡稱、代號、委託單位、人員" aria-label="篩選專案"></label>
    <select data-ch="caseOwner" aria-label="負責人">${opt(staff.filter(s => roleOf(s.id) === 'pm'), F.owner, '全部負責人')}</select>
    <select data-ch="caseWho" aria-label="參與者">${opt(staff, F.who, '全部參與者')}</select>
    <select data-ch="caseSt" aria-label="狀態"><option value="active" ${F.st === 'active' ? 'selected' : ''}>進行中（含暫停）</option><option value="all" ${F.st === 'all' ? 'selected' : ''}>全部專案</option><option value="closed" ${F.st === 'closed' ? 'selected' : ''}>已結案</option></select>
    <span class="grow"></span>
    <div class="seg" role="tablist"><a role="tab" class="${view === 'cards' ? 'on' : ''}" href="${esc(casesLink(isBoss, q, { view: '' }))}">卡片</a><a role="tab" class="${view === 'timeline' ? 'on' : ''}" href="${esc(casesLink(isBoss, q, { view: 'timeline' }))}">時間表</a></div>
  </div>`;
  let body;
  if (view === 'timeline') body = viewTimeline(isBoss, q, true);
  else {
    const groups = caseGroups(q);
    body = groups.length ? groups.map(g => `<section class="case-group">
      <h2><span class="dot" style="--c:${esc(g.o.color)}"></span>${esc(g.o.name)}<small>${ROLE_NAME[roleOf(g.o.id)]}・${g.projs.length} 個專案</small></h2>
      <div class="case-cards">${g.projs.map(x => {
        const pr = scheduleProgress(g.o.id, x.p.id);
        const next = x.ms.filter(m => m.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
        const nNotes = allNotes(g.o.id, x.p.id).length;
        return `<a class="case-card ${x.p.status || 'active'}" style="--c:${esc(x.p.color)}" href="${esc(isBoss ? `#/boss/projects/${g.o.id}/${x.p.id}` : projLink(g.o.id, x.p.id))}">
          <div class="cc-top"><b>${esc(shortOf(x.p))}</b><span class="st-badge ${x.p.status || 'active'}">${STATUS_NAME[x.p.status || 'active']}</span></div>
          <div class="cc-name">${esc(fullOf(x.p))}</div>
          ${x.parts.length ? `<div class="cc-parts">參與：${x.parts.map(s => `<span class="who-mini" style="--c:${esc(s.color)}">${esc(s.name)}</span>`).join('')}</div>` : '<div class="cc-parts muted">沒有參與的設計</div>'}
          ${progressBar(pr)}
          <div class="cc-meta">${pr.total ? `期程進度 ${pr.passed}／${pr.total}（${pr.pct}%）` : '尚未填寫期程'}${nNotes ? `・紀事 ${nNotes} 則` : ''}</div>
          <div class="cc-next">${next ? `下一個：<b>${mdw(next.date)}</b> ${esc(next.text.split('\n')[0])}` : '<span class="muted">沒有之後的期程</span>'}</div>
        </a>`;
      }).join('')}</div></section>`).join('')
      : `<div class="empty"><h3>沒有符合條件的專案</h3><p>試著清除上方的篩選條件。</p></div>`;
  }
  document.title = '專案總覽｜' + CFG().company;
  return topbar(isBoss ? { mode: 'boss', tab: 'projects' } : { mode: 'projects' }) + `<main class="${view === 'timeline' ? 'wide' : ''}">
    <div class="page-head"><div><h1>專案總覽</h1><p>以案件為主的檢視：每個專案的狀態、進度與下一個期程。點專案可進入專案首頁。</p></div></div>
    ${bar}${body}</main>`;
}

/* ---------------- 專案首頁 ---------------- */
function miniTimeline(ownerSid, p) {
  const t = todayStr();
  const start = monthStart(t), endEx = addMonths(start, 3);
  const total = Math.round((toDate(endEx) - toDate(start)) / 86400000);
  const pos = d => ((toDate(d) - toDate(start)) / 86400000 + 0.5) / total * 100;
  const inV = d => d >= start && d < endEx;
  const ms = D(ownerSid).milestones.filter(m => m.projectId === p.id && (m.text || '').trim() && inV(m.date));
  const notes = allNotes(ownerSid, p.id).filter(x => inV(x.date));
  const months = [0, 1, 2].map(i => { const m = addMonths(start, i); return `<span class="mt-mon" style="left:${pos(m) - 0.5 / total * 100}%">${+m.slice(5, 7)} 月</span>`; }).join('');
  const dots = ms.map(m => `<i class="mt-dot ${m.side === 'client' ? 'client' : ''} ${m.tentative ? 'tent' : ''}" style="left:${pos(m.date)}%" title="${esc(mdw(m.date) + ' ' + (m.side === 'client' ? '［單位］' : '') + m.text.trim())}"></i>`).join('');
  const nds = notes.map(x => `<i class="mt-note" style="left:${pos(x.date)}%" title="${esc(mdw(x.date) + ' ✎ ' + x.author.name + '：' + x.n.text)}">✎</i>`).join('');
  return `<div class="mtl" style="--c:${esc(p.color)}">${months}<div class="mt-line"></div>${dots}${nds}${inV(t) ? `<i class="mt-today" style="left:${pos(t)}%" title="今天"></i>` : ''}</div>
    <div class="mt-key"><span><i class="mt-dot"></i>紫晶進度</span><span><i class="mt-dot client"></i>單位進度</span><span><i class="mt-note">✎</i>紀事</span><span><i class="mt-today-k"></i>今天</span></div>`;
}

/**
 * opt: { sid: 檢視中的同仁（可新增紀事）, canEdit, allNotes, isBoss }
 */
function projectHomeHTML(ownerSid, p, opt = {}) {
  const t = todayStr();
  const owner = staffOf(ownerSid);
  const parts = participantsOf(ownerSid, p.id);
  const pr = scheduleProgress(ownerSid, p.id);
  const odoc = D(ownerSid);
  // 本週
  const mon = mondayOf(t), sun = addDays(mon, 6);
  const wk = [];
  for (let d = mon; d <= sun; d = addDays(d, 1)) odoc.milestones.forEach(m => { if (m.projectId === p.id && m.date === d && (m.text || '').trim()) wk.push(m); });
  const next = pr.ms.filter(m => m.date > sun).sort((a, b) => a.date.localeCompare(b.date))[0];
  // 需要注意：近 30 天被標記延宕的期程、未來兩週待確認的期程
  const watch = [];
  [owner].concat(parts).forEach(st => {
    if (!st || !S.docs[st.id]) return;
    Object.entries(D(st.id).logs || {}).forEach(([d, L]) => {
      if (d < addDays(t, -30) || d > t) return;
      Object.entries(L.auto || {}).forEach(([mid, a]) => {
        if (!a || a.status !== 'delay') return;
        const m = byId(odoc.milestones, mid);
        if (m && m.projectId === p.id) watch.push({ kind: 'delay', d, m, st, note: a.note || '' });
      });
    });
  });
  pr.ms.filter(m => m.tentative && m.date >= t && m.date <= addDays(t, 14)).forEach(m => watch.push({ kind: 'tent', d: m.date, m }));
  watch.sort((a, b) => a.d.localeCompare(b.d));
  // 紀事
  const notes = allNotes(ownerSid, p.id);
  const shown = opt.allNotes ? notes : notes.slice(0, 6);
  const canNote = !!opt.sid && (opt.sid === ownerSid || parts.some(s => s.id === opt.sid));

  const msRow = m => `<li><span class="d">${mdw(m.date)}</span><span class="tx">${m.side === 'client' ? '<span class="tag client">單位</span>' : ''}${esc(m.text.trim().replace(/\n/g, '／'))}${m.tentative ? '<span class="tag tent">待確認</span>' : ''}${m.endDate ? `<span class="tag">至 ${md(m.endDate)}</span>` : ''}</span></li>`;
  const startD = pr.first, endD = pr.last;
  const todayPos = startD && endD && endD > startD ? Math.min(100, Math.max(0, (toDate(t) - toDate(startD)) / (toDate(endD) - toDate(startD)) * 100)) : null;

  return `<div class="phome" style="--c:${esc(p.color)}">
    <header class="ph-head">
      <div class="ph-title"><h2>${esc(shortOf(p))}</h2><span class="ph-full">${esc(fullOf(p))}</span><span class="st-badge ${p.status || 'active'}">${STATUS_NAME[p.status || 'active']}</span></div>
      <div class="ph-meta"><span>負責：<b>${esc(owner ? owner.name : '')}</b>（${ROLE_NAME[roleOf(ownerSid)]}）</span>
        <span>參與：${parts.length ? parts.map(s => `<span class="who-mini" style="--c:${esc(s.color)}">${esc(s.name)}</span>`).join('') : '<span class="muted">無</span>'}</span>
        ${p.client ? `<span>委託單位：<b>${esc(p.client)}</b></span>` : ''}${p.note ? `<span class="muted">${esc(p.note)}</span>` : ''}</div>
      ${opt.canEdit ? `<div class="row noprint"><button class="btn sm" data-act="editProject" data-pid="${p.id}">編輯專案</button><button class="btn sm" data-act="importPlan" data-pid="${p.id}">匯入期程</button></div>` : ''}
    </header>
    <section class="ph-card ph-progress">
      <div class="ph-h"><h3>期程進度</h3><span class="muted small">日期已過的期程數／全部期程數</span></div>
      ${pr.total ? `<div class="ph-pct"><b>${pr.pct}%</b><span>已走過 ${pr.passed}／${pr.total} 個期程</span></div>${progressBar(pr)}
        <div class="ph-span"><span>${mdw(startD)}${startD.slice(0, 4) !== t.slice(0, 4) ? ' ' + startD.slice(0, 4) : ''} 第一個期程</span>${todayPos != null ? `<span class="ph-today" style="left:${todayPos}%">今天</span>` : ''}<span>${mdw(endD)}${endD.slice(0, 4) !== t.slice(0, 4) ? ' ' + endD.slice(0, 4) : ''} 最後一個期程</span></div>`
        : '<p class="muted">尚未填寫期程。</p>'}
    </section>
    <div class="ph-grid">
      <section class="ph-card"><div class="ph-h"><h3>本週期程</h3><span class="muted small">${md(mon)}–${md(sun)}</span></div>
        ${wk.length ? `<ul class="ph-list">${wk.map(msRow).join('')}</ul>` : '<p class="muted small" style="margin:0">本週沒有期程。</p>'}
        ${next ? `<div class="ph-next">下一個期程：<b>${mdw(next.date)}</b> ${esc(next.text.split('\n')[0])}</div>` : ''}</section>
      <section class="ph-card"><div class="ph-h"><h3>需要注意</h3><span class="muted small">近 30 天延宕、未來兩週待確認</span></div>
        ${watch.length ? `<ul class="ph-list">${watch.map(w => w.kind === 'delay'
          ? `<li class="warn"><span class="d">${mdw(w.d)}</span><span class="tx"><b>延宕</b>　${esc(w.m.text.trim().split('\n')[0])}<span class="muted">（${esc(w.st.name)}標記${w.note ? '：' + esc(w.note) : ''}）</span></span></li>`
          : `<li class="tent"><span class="d">${mdw(w.d)}</span><span class="tx"><b>待確認</b>　${esc(w.m.text.trim().split('\n')[0])}</span></li>`).join('')}</ul>` : '<p class="muted small" style="margin:0">目前沒有需要注意的事項。</p>'}</section>
    </div>
    <section class="ph-card"><div class="ph-h"><h3>專案紀事</h3><span class="muted small">共 ${notes.length} 則，由新到舊</span></div>
      ${canNote ? `<div class="ph-addnote noprint"><textarea id="ph-note" rows="2" data-auto placeholder="記錄這個專案的重要變動或決定，例如：書歌B封面＋A封底，已轉達設計"></textarea><button class="btn primary" data-act="addProjNote" data-owner="${esc(ownerSid)}" data-pid="${p.id}">新增紀事</button></div>` : ''}
      ${shown.length ? `<ol class="ph-notes">${shown.map(x => `<li><div class="pn-when"><b>${mdw(x.date)}</b>${x.date.slice(0, 4) !== t.slice(0, 4) ? ' ' + x.date.slice(0, 4) : ''}<span>${hm(x.n.at)}</span></div>
          <div class="pn-body"><span class="who-mini" style="--c:${esc(x.author.color)}">${esc(x.author.name)}</span>${esc(x.n.text)}${opt.sid === x.author.id ? ` <a class="pn-edit noprint" href="#/s/${x.author.id}/log/${x.date}">在日誌中編輯</a>` : ''}</div></li>`).join('')}</ol>`
        : `<p class="muted small" style="margin:0">還沒有紀事。${canNote ? '' : '負責人與參與的設計可以在工作日誌或自己的專案首頁新增。'}</p>`}
      ${!opt.allNotes && notes.length > shown.length ? `<button class="btn sm" data-act="phAllNotes">看全部 ${notes.length} 則</button>` : ''}
    </section>
    <section class="ph-card"><div class="ph-h"><h3>未來三個月</h3><span class="muted small">本專案的期程與紀事</span></div>${miniTimeline(ownerSid, p)}</section>
  </div>`;
}

function projTabs(sid, p, tab) {
  const base = `#/s/${sid}/plan/p/${p.id}`;
  const tabs = p.link ? [['home', '首頁', base], ['list', '期程清單', base + '?mode=list']]
    : [['home', '首頁', base], ['grid', '逐日填寫', base + '?tab=grid'], ['list', '期程清單', base + '?mode=list']];
  return `<nav class="ptabs noprint" aria-label="專案分頁">${tabs.map(([k, n, h]) => `<a class="${tab === k ? 'on' : ''}" href="${h}">${n}</a>`).join('')}</nav>`;
}

function viewCaseProject(isBoss, ownerSid, pid, q) {
  const o = staffOf(ownerSid);
  const p = o && S.docs[ownerSid] ? byId(D(ownerSid).projects, pid) : null;
  if (!p) { go(casesBase(isBoss), true); return null; }
  document.title = shortOf(p) + '｜專案首頁';
  return topbar(isBoss ? { mode: 'boss', tab: 'projects' } : { mode: 'projects' }) + `<main>
    <a class="backlink noprint" href="${casesBase(isBoss)}">‹ 專案總覽</a>
    ${projectHomeHTML(ownerSid, p, { allNotes: q.notes === 'all', isBoss })}</main>`;
}

function addProjNote(el) {
  const sid = S.ctxTop && S.ctxTop.sid; if (!sid) return;
  const ta = $('#ph-note'); const text = ta ? ta.value.trim() : '';
  if (!text) { if (ta) ta.focus(); toast('請先輸入紀事內容', true); return; }
  const doc = D(sid), date = todayStr();
  const L = getLog(doc, date, true);
  L.notes = L.notes || [];
  L.notes.push({ id: uid(), sid: el.dataset.owner, pid: el.dataset.pid, text, at: now(), u: now() });
  staffTouchLog(L); touchStaff(sid);
  toast('已新增紀事'); render({ keepScroll: true });
}

/* ---------------- 搜尋 ---------------- */
function searchIndex() {
  const c = S.ctxTop || {};
  const staffCtx = c.mode === 'staff' && c.sid ? c.sid : null;
  const items = [];
  CFG().staff.forEach(st => {
    const doc = S.docs[st.id] && S.docs[st.id].data; if (!doc) return;
    const pm = Object.fromEntries(doc.projects.map(p => [p.id, p]));
    doc.projects.forEach(p => items.push({ type: 'proj', text: [p.code, p.name, p.short, p.client, p.note].filter(Boolean).join(' '), p, owner: st, date: '', href: projLink(st.id, p.id),
      title: `${shortOf(p)}　${fullOf(p)}`, sub: `負責：${st.name}${p.client ? '・' + p.client : ''}・${STATUS_NAME[p.status || 'active']}` }));
    doc.milestones.forEach(m => {
      const p = pm[m.projectId]; if (!p || !(m.text || '').trim()) return;
      const own = staffCtx && projLink(st.id, p.id).startsWith('#/s/');
      items.push({ type: 'ms', text: m.text + ' ' + (m.note || ''), p, owner: st, date: m.date,
        href: own ? `#/s/${staffCtx}/plan/p/${p.id}?m=${m.date.slice(0, 7)}&focus=${m.date}` : projLink(st.id, p.id),
        title: `${shortOf(p)}｜${m.text.trim().replace(/\n/g, '／')}`, sub: `${mdw(m.date)}${m.date.slice(0, 4) !== todayStr().slice(0, 4) ? ' ' + m.date.slice(0, 4) : ''}・${m.side === 'client' ? '單位進度' : '紫晶進度'}${m.note ? '・' + m.note : ''}` });
    });
  });
  allNotes().forEach(x => {
    const p = S.docs[x.n.sid] ? byId(D(x.n.sid).projects, x.n.pid) : null;
    items.push({ type: 'note', text: x.n.text, p, owner: staffOf(x.n.sid), date: x.date, href: p ? projLink(x.n.sid, p.id) : '#/',
      title: `${p ? shortOf(p) + '｜' : ''}${x.n.text}`, sub: `${mdw(x.date)} ${hm(x.n.at)}・${x.author.name}` });
  });
  CFG().staff.forEach(st => {
    if (staffCtx && st.id !== staffCtx) return;   // 同仁只搜尋自己的日誌
    const doc = S.docs[st.id] && S.docs[st.id].data; if (!doc) return;
    const vdoc = V(st.id);
    const href = d => staffCtx ? `#/s/${st.id}/log/${d}` : `#/boss/${st.id}/log/${d}?v=day`;
    Object.entries(doc.logs || {}).forEach(([d, L]) => {
      (L.tasks || []).forEach(tk => { if ((tk.text || '').trim()) { const p = byId(vdoc.projects, tk.pid); items.push({ type: 'log', text: tk.text + ' ' + (tk.note || ''), p, owner: st, date: d, href: href(d), title: `${p ? shortOf(p) + '｜' : ''}${tk.text}`, sub: `${mdw(d)}・${st.name}・自排工作${tk.note ? '・' + tk.note : ''}` }); } });
      Object.entries(L.auto || {}).forEach(([mid, a]) => { if (a && (a.note || '').trim()) { const m = byId(vdoc.milestones, mid); items.push({ type: 'log', text: a.note + ' ' + (m ? m.text : ''), owner: st, date: d, href: href(d), title: a.note, sub: `${mdw(d)}・${st.name}・期程說明${m ? '：' + m.text.split('\n')[0] : ''}` }); } });
      if ((L.remark || '').trim()) items.push({ type: 'log', text: L.remark, owner: st, date: d, href: href(d), title: L.remark.trim().split('\n')[0], sub: `${mdw(d)}・${st.name}・外包／其他備註`, long: L.remark });
    });
  });
  return items;
}
const SEARCH_TYPES = [['all', '全部'], ['proj', '專案'], ['ms', '期程'], ['note', '紀事'], ['log', '工作日誌']];
function openSearch(prefill) {
  if (document.querySelector('.modal.search-modal')) return;
  const idx = searchIndex();
  const st = { type: 'all', more: {} };
  const body = `<div class="srch">
    <label class="case-search big">${ICON_SEARCH}<input id="srch-q" type="search" value="${esc(prefill || '')}" placeholder="搜尋專案、期程、紀事、工作日誌…" aria-label="搜尋" autocomplete="off"></label>
    <div class="srch-types" role="tablist">${SEARCH_TYPES.map(([k, n]) => `<button type="button" role="tab" data-t="${k}" class="${k === 'all' ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="srch-res" id="srch-res" aria-live="polite"></div></div>`;
  openModal({
    title: '搜尋', wide: true, body, actions: [],
    onOpen: bg => {
      bg.querySelector('.modal').classList.add('search-modal');
      const inp = bg.querySelector('#srch-q'), box = bg.querySelector('#srch-res');
      const hl = (s, terms) => { let h = esc(s); terms.forEach(tm => { if (!tm) return; const re = new RegExp(esc(tm).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); h = h.replace(re, x => `<mark>${x}</mark>`); }); return h; };
      const paint = () => {
        const terms = inp.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (!terms.length) { box.innerHTML = '<p class="muted small">輸入關鍵字，例如專案簡稱、期程內容或紀事中的文字。多個關鍵字用空格分開。</p>'; return; }
        const hits = idx.filter(it => (st.type === 'all' || it.type === st.type) && terms.every(tm => (it.text + ' ' + (it.title || '')).toLowerCase().includes(tm)));
        if (!hits.length) { box.innerHTML = '<p class="muted">找不到符合的內容。</p>'; return; }
        box.innerHTML = SEARCH_TYPES.slice(1).map(([k, n]) => {
          let list = hits.filter(h => h.type === k); if (!list.length) return '';
          list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          const lim = st.more[k] ? list.length : 8;
          return `<section class="srch-g"><h3>${n}<small>${list.length}</small></h3><ul>${list.slice(0, lim).map(h => {
            let title = h.title;
            if (h.long) { const low = h.long.toLowerCase(); const i = low.indexOf(terms[0]); title = (i > 20 ? '…' : '') + h.long.slice(Math.max(0, i - 20), i + 60).replace(/\n/g, ' '); }
            return `<li><a href="${esc(h.href)}" data-go>${h.p ? `<span class="sw" style="--c:${esc(h.p.color)}"></span>` : '<span class="sw"></span>'}<span class="srch-t">${hl(title, terms)}</span><span class="srch-s">${hl(h.sub || '', terms)}</span></a></li>`;
          }).join('')}</ul>${list.length > lim ? `<button type="button" class="link-btn" data-more="${k}">顯示全部 ${list.length} 筆</button>` : ''}</section>`;
        }).join('');
      };
      let tm = null;
      inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(paint, 120); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const a = box.querySelector('a[data-go]'); if (a) a.click(); } });
      bg.querySelector('.srch-types').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; st.type = b.dataset.t; bg.querySelectorAll('.srch-types button').forEach(x => x.classList.toggle('on', x === b)); paint(); });
      box.addEventListener('click', e => {
        const m = e.target.closest('[data-more]'); if (m) { st.more[m.dataset.more] = true; paint(); return; }
        const a = e.target.closest('a[data-go]'); if (a) { const x = bg.querySelector('[data-x]'); if (x) x.click(); }
      });
      paint(); setTimeout(() => { inp.focus(); inp.select(); }, 40);
    },
  });
}
document.addEventListener('keydown', e => {
  if (!S.config) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openSearch(); }
  else if (e.key === '/' && !typing && !document.querySelector('.modal-bg')) { e.preventDefault(); openSearch(); }
});

/* =====================================================================
 * 主管檢視：工作期程表（未來兩週，每位同仁一欄）
 * 路由：#/boss/schedule?d=日期&v=draft
 *  - 員工原排：直接讀取各同仁工作日誌的自排工作（即時）
 *  - 調整版本：主管的副本，存在 data/schedule.json，修改不影響同仁
 *  - 確認調整期程：把有變動的項目寫回同仁的工作日誌，並以「主管調整」顏色標示
 * ===================================================================== */
const SCHED_DAYS = 14;
const LEAVE_NAME = { annual: '特休', personal: '事假', sick: '病假', comp: '補休' };
const BOSS_KIND = { add: '主管新增', edit: '主管修改', move: '主管調整', out: '主管改期', remove: '主管取消' };

function schedDates(start) { const a = []; for (let i = 0; i < SCHED_DAYS; i++) a.push(addDays(start, i)); return a; }
function schedCols() {
  return [['pm', '企劃編輯'], ['design', '設計']].map(([role, name]) => ({ role, name, staff: CFG().staff.filter(s => S.docs[s.id] && roleOf(s.id) === role) })).filter(g => g.staff.length);
}
/** 同仁某天的自排工作（員工原排） */
function origItems(sid, date) {
  const L = D(sid).logs[date]; if (!L) return [];
  const vdoc = V(sid);
  return (L.tasks || []).filter(tk => (tk.text || '').trim() && tk.status !== 'moved').map(tk => {
    const p = tk.pid ? byId(vdoc.projects, tk.pid) : null;
    return { tid: tk.id, text: tk.text.trim(), pid: tk.pid || '', p, status: tk.status || '', boss: tk.boss || null };
  });
}
function leaveText(sid, date) {
  const L = D(sid).logs[date]; if (!L) return '';
  return Object.entries(LEAVE_NAME).filter(([k]) => num((L.hours || {})[k])).map(([k, n]) => `◆${n} ${num(L.hours[k])}h`).join('　');
}
function dayMilestones(date) {
  const seen = new Set(), out = [];
  CFG().staff.forEach(st => {
    if (!S.docs[st.id]) return;
    const doc = D(st.id);
    doc.milestones.forEach(m => {
      if (m.date !== date || !(m.text || '').trim() || seen.has(m.id)) return;
      const p = byId(doc.projects, m.projectId); if (!p || p.status === 'closed') return;
      seen.add(m.id); out.push({ m, p });
    });
  });
  return out.sort((a, b) => String(a.p.code || '').localeCompare(String(b.p.code || ''), 'zh-Hant', { numeric: true }));
}

/* ---------------- 調整版本（副本） ---------------- */
const SCH = () => S.sched.data;
function draftOf(start) { return SCH().drafts[start] || null; }
function createDraft(start) {
  const dr = { start, created: now(), u: now(), status: 'draft', appliedAt: 0, cells: {}, removed: [] };
  CFG().staff.forEach(st => {
    if (!S.docs[st.id]) return;
    dr.cells[st.id] = {};
    schedDates(start).forEach(d => {
      const items = origItems(st.id, d).filter(it => it.status !== 'cancel');
      if (items.length) dr.cells[st.id][d] = items.map(it => ({ id: uid(), text: it.text, pid: it.pid, src: { sid: st.id, date: d, tid: it.tid, text: it.text, pid: it.pid } }));
    });
  });
  SCH().drafts[start] = dr;
  // 只保留最近 12 份
  const keys = Object.keys(SCH().drafts).sort();
  while (keys.length > 12) delete SCH().drafts[keys.shift()];
  touchSched();
  return dr;
}
function itemKind(it, sid, date) {
  if (!it.src) return 'add';
  if (it.src.sid !== sid || it.src.date !== date) return 'move';
  if (it.text !== it.src.text || (it.pid || '') !== (it.src.pid || '')) return 'edit';
  return '';
}
function draftStats(dr) {
  const n = { add: 0, move: 0, edit: 0, remove: (dr.removed || []).length };
  Object.entries(dr.cells || {}).forEach(([sid, days]) => Object.entries(days).forEach(([d, items]) => items.forEach(it => { const k = itemKind(it, sid, d); if (k) n[k]++; })));
  n.total = n.add + n.move + n.edit + n.remove;
  return n;
}

/* ---------------- 表格 ---------------- */
function schedTableHTML(start, mode) {
  const dates = schedDates(start), t = todayStr();
  const groups = schedCols(), staff = groups.flatMap(g => g.staff);
  const dr = mode === 'draft' ? draftOf(start) : null;
  const projOf = (sid, pid) => pid ? byId(V(sid).projects, pid) : null;
  const itemHTML = (sid, d, it) => {
    const p = it.p !== undefined ? it.p : projOf(sid, it.pid);
    const lab = p ? `<b style="color:${esc(p.color)}">${esc(shortOf(p))}</b>｜` : '';
    let cls = '', tag = '';
    if (mode === 'draft') {
      const k = itemKind(it, sid, d);
      if (k) { cls = 'chg'; tag = k === 'add' ? '新增' : k === 'edit' ? '修改' : (it.src.sid !== sid ? `由${esc(staffOf(it.src.sid) ? staffOf(it.src.sid).name : '')}改派` : `由${md(it.src.date)}改期`); }
    } else if (it.boss) { cls = 'chg applied'; tag = BOSS_KIND[it.boss.kind] || '主管調整'; }
    if (it.status === 'cancel') cls += ' cancel';
    return `<div class="si ${cls}">${lab}${esc(it.text)}${tag ? `<span class="si-tag">${tag}</span>` : ''}</div>`;
  };
  const cellItems = (sid, d) => {
    if (mode === 'draft') {
      const list = (dr.cells[sid] && dr.cells[sid][d]) || [];
      const rem = (dr.removed || []).filter(r => r.sid === sid && r.date === d);
      return list.map(it => itemHTML(sid, d, it)).join('') + rem.map(r => { const p = projOf(sid, r.pid); return `<div class="si chg removed">${p ? `<b>${esc(shortOf(p))}</b>｜` : ''}${esc(r.text)}<span class="si-tag">取消</span></div>`; }).join('');
    }
    return origItems(sid, d).map(it => itemHTML(sid, d, it)).join('');
  };
  // 每格內容 → 用來合併連續相同的工作
  const cellHTML = {}, sig = {};
  staff.forEach(st => dates.forEach(d => {
    const lv = leaveText(st.id, d);
    const h = (lv ? `<div class="si leave">${esc(lv)}</div>` : '') + cellItems(st.id, d);
    cellHTML[st.id + d] = h; sig[st.id + d] = h.replace(/\s+/g, ' ');
  }));
  // 休假連續區段
  const offRun = {};
  for (let i = 0; i < dates.length; i++) {
    if (!isOff(dates[i]) || (i > 0 && isOff(dates[i - 1]))) continue;
    let j = i; while (j + 1 < dates.length && isOff(dates[j + 1])) j++;
    const ds = dates.slice(i, j + 1), names = Array.from(new Set(ds.map(d => HOL[d] && !HOL[d].work ? HOL[d].name : '').filter(Boolean)));
    offRun[dates[i]] = { n: ds.length, label: names.length ? `◆${names.join('／')}${ds.length > 1 ? `連假${ds.length}日` : ''}` : `◆週休${ds.length}日` };
    for (let k = i + 1; k <= j; k++) offRun[dates[k]] = 'skip';
  }
  // 每欄的合併（只在連續的工作天之間）
  const span = {};
  staff.forEach(st => {
    let i = 0;
    while (i < dates.length) {
      const d = dates[i];
      if (isOff(d)) { i++; continue; }
      let j = i;
      if (sig[st.id + d]) while (j + 1 < dates.length && !isOff(dates[j + 1]) && sig[st.id + dates[j + 1]] === sig[st.id + d]) j++;
      span[st.id + d] = j - i + 1;
      for (let k = i + 1; k <= j; k++) span[st.id + dates[k]] = 0;
      i = j + 1;
    }
  });
  const editable = mode === 'draft' && dr && dr.status === 'draft';
  const head1 = `<tr><th rowspan="2" class="c-date">日期</th><th rowspan="2" class="c-dow">星期</th>${groups.map(g => `<th colspan="${g.staff.length}" class="grp ${g.role}">${g.name}</th>`).join('')}<th rowspan="2" class="c-ms">重要期程</th></tr>`;
  const head2 = `<tr>${staff.map(st => `<th class="st-col" style="--c:${esc(st.color)}">${esc(st.name)}</th>`).join('')}</tr>`;
  const rows = dates.map(d => {
    const off = isOff(d), run = offRun[d];
    const msHTML = dayMilestones(d).map(({ m, p }) => `<div class="si"><b style="color:${esc(p.color)}">${esc(shortOf(p))}</b>｜${esc(m.text.trim().split('\n')[0])}${m.side === 'client' ? '<span class="si-tag cl">單位</span>' : ''}</div>`).join('');
    let mid = '';
    if (off) { if (run && run !== 'skip') mid = `<td colspan="${staff.length}" rowspan="${run.n}" class="offband">${esc(run.label)}</td>`; }
    else mid = staff.map(st => {
      const n = span[st.id + d]; if (!n) return '';
      return `<td rowspan="${n}" class="cell ${editable ? 'edit' : ''}" ${editable ? `data-act="schedCell" data-sid="${st.id}" data-date="${d}" title="點一下調整 ${esc(st.name)} ${md(d)} 的工作"` : ''}>${cellHTML[st.id + d] || (editable ? '<span class="add-hint">＋</span>' : '')}</td>`;
    }).join('');
    return `<tr class="${off ? 'off' : ''} ${d === t ? 'today' : ''}"><td class="c-date">${d.slice(5).replace('-', '')}</td><td class="c-dow">${WEEK[dowOf(d)]}</td>${mid}<td class="c-ms">${msHTML}</td></tr>`;
  }).join('');
  // 專案一覽（負責／參與）
  const projRows = CFG().staff.filter(s => S.docs[s.id]).flatMap(o => sortedProjects(D(o.id), false).map(p => ({ o, p, parts: participantsOf(o.id, p.id) })));
  const legend = projRows.length ? `<table class="sched-legend"><thead><tr><th>專案</th><th>委託單位</th><th>負責</th><th>參與</th></tr></thead><tbody>${projRows.map(x => `<tr><td><b style="color:${esc(x.p.color)}">${esc(shortOf(x.p))}</b>　${esc(x.p.name)}</td><td>${esc(x.p.client || '')}</td><td><span class="who-chip" style="--c:${esc(x.o.color)}">${esc(x.o.name)}</span></td><td>${x.parts.map(s => `<span class="who-chip" style="--c:${esc(s.color)}">${esc(s.name)}</span>`).join('')}</td></tr>`).join('')}</tbody></table>` : '';
  const end = dates[dates.length - 1];
  return `<div class="sched-sheet" id="sched-sheet">
    <h2 class="sched-title">工作期程表（${start.replace(/-/g, '/')}–${end.slice(5).replace('-', '/')}）${mode === 'draft' ? `<span class="sched-ver">${dr && dr.status === 'applied' ? '調整版本・已確認' : '調整版本'}</span>` : '<span class="sched-ver orig">員工原排</span>'}</h2>
    <div class="sched-wrap"><table class="sched">${head1}${head2}${rows}</table></div>${legend}</div>`;
}

function viewBossSchedule(q) {
  const t = todayStr();
  const start = mondayOf(isDate(q.d) ? q.d : t);
  const mode = q.v === 'draft' ? 'draft' : 'orig';
  const dr = draftOf(start);
  const base = o => '#/boss/schedule?' + Object.entries(Object.assign({ d: start, v: mode === 'draft' ? 'draft' : '' }, o)).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join('&');
  const st = dr ? draftStats(dr) : null;
  let notice = '', actions = '';
  if (mode === 'orig') {
    notice = `<div class="notice info noprint">這是同仁自己在工作日誌安排的工作（即時）。要調整時請建立「調整版本」，在副本中修改不會影響同仁的安排。</div>`;
    actions = dr ? `<a class="btn primary" href="${base({ v: 'draft' })}">${dr.status === 'applied' ? '查看調整版本' : '繼續編輯調整版本'}</a>` : `<button class="btn primary" data-act="schedNewDraft" data-start="${start}">建立調整版本</button>`;
  } else if (!dr) {
    notice = `<div class="empty"><h3>這兩週還沒有調整版本</h3><p>建立後會複製一份員工原排，可以自由修改。</p><button class="btn primary" data-act="schedNewDraft" data-start="${start}">建立調整版本</button></div>`;
  } else if (dr.status === 'applied') {
    const at = new Date(dr.appliedAt);
    notice = `<div class="notice ok noprint">已於 ${at.getMonth() + 1}/${at.getDate()} ${hm(dr.appliedAt)} 確認調整，共 ${st.total} 項已寫入同仁的工作日誌，並以「主管調整」顏色標示。這份版本已鎖定。</div>`;
    actions = `<button class="btn" data-act="schedNewDraft" data-start="${start}" data-confirm="1">建立新的調整版本</button>`;
  } else {
    notice = `<div class="notice noprint">調整版本：點任一格即可修改、新增、改期或改派。已調整 <b>${st.total}</b> 項（新增 ${st.add}、改期／改派 ${st.move}、修改 ${st.edit}、取消 ${st.remove}）。修改內容只存在副本中，按「確認調整期程」後才會寫入同仁的工作日誌。</div>`;
    actions = `<button class="btn primary" data-act="schedApply" data-start="${start}" ${st.total ? '' : 'disabled'}>確認調整期程</button><button class="btn danger" data-act="schedDiscard" data-start="${start}">捨棄調整版本</button>`;
  }
  const showTable = mode === 'orig' || dr;
  document.title = '工作期程表｜' + CFG().company;
  return topbar({ mode: 'boss', tab: 'schedule' }) + `<main class="wide">
    <div class="page-head"><div><h1>工作期程表</h1><p>每位同仁未來兩週的自排工作與重要期程。適合每週一開會時逐一確認。</p></div></div>
    <div class="cal-bar noprint">
      <div class="seg" role="tablist"><a role="tab" class="${mode === 'orig' ? 'on' : ''}" href="${base({ v: '' })}">員工原排</a><a role="tab" class="${mode === 'draft' ? 'on' : ''}" href="${base({ v: 'draft' })}">調整版本${dr && dr.status === 'draft' && st.total ? `（${st.total}）` : ''}</a></div>
      <div class="cal-nav"><a class="icon-btn" href="${base({ d: addDays(start, -7) })}" aria-label="前一週">‹</a><a class="btn sm" href="${base({ d: t })}">本週</a><a class="icon-btn" href="${base({ d: addDays(start, 7) })}" aria-label="後一週">›</a>
        <h3>${md(start)}–${md(addDays(start, SCHED_DAYS - 1))}</h3></div>
      <span class="grow"></span>
      ${showTable ? `<button class="btn sm" data-act="schedExport" data-kind="png">匯出圖片</button><button class="btn sm" data-act="schedExport" data-kind="pdf">匯出 PDF</button>` : ''}
      ${actions}
    </div>
    ${notice}
    ${showTable ? schedTableHTML(start, mode) : ''}
  </main>`;
}

/* ---------------- 編輯一格 ---------------- */
function schedCellDialog(start, sid, date) {
  const dr = draftOf(start); if (!dr || dr.status !== 'draft') return;
  const st = staffOf(sid);
  const cur = ((dr.cells[sid] || {})[date] || []).map(it => Object.assign({}, it));
  const dates = schedDates(start);
  const staff = schedCols().flatMap(g => g.staff);
  const row = (it, i) => {
    const projs = sortedProjects(V(sid), false);
    return `<div class="sc-row" data-i="${i}">
      <select class="sc-proj" aria-label="專案"><option value="">其他／雜事</option>${projs.map(p => `<option value="${p.id}" ${p.id === it.pid ? 'selected' : ''}>${esc(shortOf(p))}｜${esc(p.name)}</option>`).join('')}</select>
      <input class="sc-text" type="text" value="${esc(it.text)}" placeholder="工作內容" aria-label="工作內容">
      <select class="sc-date" aria-label="日期">${dates.map(d => `<option value="${d}" ${d === (it.date || date) ? 'selected' : ''}>${mdw(d)}${isOff(d) ? '（休）' : ''}</option>`).join('')}</select>
      <select class="sc-who" aria-label="負責同仁">${staff.map(s => `<option value="${s.id}" ${s.id === (it.sid || sid) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <button type="button" class="icon-btn sc-del" aria-label="刪除" title="刪除">✕</button>
      ${it.src ? `<div class="sc-orig">原排：${mdw(it.src.date)} ${esc(staffOf(it.src.sid) ? staffOf(it.src.sid).name : '')}｜${esc(it.src.text)}</div>` : '<div class="sc-orig new">新增的工作</div>'}
    </div>`;
  };
  const paint = bg => { bg.querySelector('.sc-list').innerHTML = cur.map(row).join('') || '<p class="muted small">這天沒有工作，按下方「＋ 新增工作」加入。</p>'; };
  const read = bg => bg.querySelectorAll('.sc-row').forEach(r => {
    const it = cur[+r.dataset.i];
    it.pid = r.querySelector('.sc-proj').value; it.text = r.querySelector('.sc-text').value.trim();
    it.date = r.querySelector('.sc-date').value; it.sid = r.querySelector('.sc-who').value;
  });
  openModal({
    title: `${st ? st.name : ''}｜${mdw(date)} 的工作`, wide: true,
    body: `<p class="muted small" style="margin:0 0 10px">可以修改內容、改到其他天或改派給其他同仁。這裡的修改只存在調整版本中。</p><div class="sc-list"></div><button type="button" class="btn sm sc-add">＋ 新增工作</button>`,
    actions: [{ label: '取消', cancel: true }, { label: '套用到調整版本', cls: 'primary', primary: true, onClick: bg => {
      read(bg);
      const removedHere = [];
      const keep = cur.filter(it => { if (it.del || !it.text) { if (it.src) removedHere.push(it.src); return false; } return true; });
      dr.cells[sid] = dr.cells[sid] || {};
      dr.cells[sid][date] = [];
      keep.forEach(it => {
        const ts = it.sid || sid, td = it.date || date;
        const o = { id: it.id || uid(), text: it.text, pid: ts === sid ? it.pid : (it.pid && byId(V(ts).projects, it.pid) ? it.pid : ''), src: it.src || null };
        dr.cells[ts] = dr.cells[ts] || {}; (dr.cells[ts][td] = dr.cells[ts][td] || []).push(o);
      });
      removedHere.forEach(s => { if (!dr.removed.some(r => r.tid === s.tid && r.sid === s.sid)) dr.removed.push({ sid: s.sid, date: s.date, tid: s.tid, text: s.text, pid: s.pid }); });
      dr.u = now(); touchSched(); render({ keepScroll: true });
    } }],
    onOpen: bg => {
      paint(bg);
      bg.querySelector('.sc-add').addEventListener('click', () => { read(bg); cur.push({ id: uid(), text: '', pid: '', src: null }); paint(bg); const ins = bg.querySelectorAll('.sc-text'); if (ins.length) ins[ins.length - 1].focus(); });
      bg.querySelector('.sc-list').addEventListener('click', e => {
        const b = e.target.closest('.sc-del'); if (!b) return;
        read(bg); const r = b.closest('.sc-row'); cur[+r.dataset.i].del = true; r.remove();
      });
    },
  });
}

/* ---------------- 確認調整期程：寫回同仁的工作日誌 ---------------- */
function applyDraft(dr) {
  const at = now(), touched = new Set();
  const findTask = (sid, date, tid) => { const L = S.docs[sid] && D(sid).logs[date]; return L ? { L, tk: (L.tasks || []).find(x => x.id === tid) } : { L: null, tk: null }; };
  const addTask2 = (sid, date, it, boss) => {
    const L = getLog(D(sid), date, true);
    L.tasks.push({ id: uid(), text: it.text, pid: it.pid || '', status: '', note: '', boss });
    staffTouchLog(L); touched.add(sid);
  };
  (dr.removed || []).forEach(r => { const { L, tk } = findTask(r.sid, r.date, r.tid); if (tk) { tk.status = 'cancel'; tk.boss = { kind: 'remove', at }; staffTouchLog(L); touched.add(r.sid); } });
  Object.entries(dr.cells || {}).forEach(([sid, days]) => Object.entries(days).forEach(([d, items]) => items.forEach(it => {
    const k = itemKind(it, sid, d); if (!k) return;
    if (k === 'add') { addTask2(sid, d, it, { kind: 'add', at }); return; }
    const { L, tk } = findTask(it.src.sid, it.src.date, it.src.tid);
    if (k === 'edit') {
      if (tk) { tk.boss = { kind: 'edit', at, old: tk.text }; tk.text = it.text; tk.pid = it.pid || ''; staffTouchLog(L); touched.add(sid); }
      else addTask2(sid, d, it, { kind: 'add', at });
      return;
    }
    // 改期或改派
    if (tk) { tk.status = 'moved'; tk.movedTo = d; tk.boss = { kind: 'out', at, to: d, toSid: sid }; staffTouchLog(L); touched.add(it.src.sid); }
    addTask2(sid, d, it, { kind: 'move', at, from: it.src.date, fromSid: it.src.sid, old: it.src.text !== it.text ? it.src.text : '' });
  })));
  touched.forEach(sid => touchStaff(sid));
  dr.status = 'applied'; dr.appliedAt = at; dr.u = at; touchSched();
  return touched.size;
}

/* ---------------- 匯出圖片／PDF ---------------- */
const LIBS = {
  h2c: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
};
function loadScript(src) {
  return new Promise((ok, fail) => {
    if (document.querySelector(`script[src="${src}"]`)) { ok(); return; }
    const s = document.createElement('script'); s.src = src; s.onload = () => ok(); s.onerror = () => fail(new Error('無法載入匯出工具，請確認網路連線'));
    document.head.appendChild(s);
  });
}
async function schedExport(kind) {
  const el = $('#sched-sheet'); if (!el) return;
  toast('正在產生' + (kind === 'pdf' ? ' PDF' : '圖片') + '…');
  try {
    await loadScript(LIBS.h2c);
    if (kind === 'pdf') await loadScript(LIBS.pdf);
    // 以畫面上表格的實際寬度輸出（同仁多時表格較寬，會完整輸出不截斷）
    const tbl = el.querySelector('.sched');
    const w = Math.max(1200, el.clientWidth, tbl ? tbl.scrollWidth + 36 : 0);
    el.classList.add('exporting'); el.style.width = w + 'px';
    const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', width: w, height: el.scrollHeight, windowWidth: w + 40 });
    el.classList.remove('exporting'); el.style.width = '';
    const q = S.route.q, start = mondayOf(isDate(q.d) ? q.d : todayStr());
    const name = `工作期程表_${start}${q.v === 'draft' ? '_調整版本' : ''}`;
    if (kind === 'png') {
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = name + '.png'; document.body.appendChild(a); a.click(); a.remove();
    } else {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 8;
      const r = Math.min((pw - 2 * m) / canvas.width, (ph - 2 * m) / canvas.height);
      const w = canvas.width * r, h = canvas.height * r;
      if (h <= ph - 2 * m) pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', (pw - w) / 2, m, w, h);
      else {  // 太長時分頁
        const r2 = (pw - 2 * m) / canvas.width, sliceH = Math.floor((ph - 2 * m) / r2);
        for (let y = 0, first = true; y < canvas.height; y += sliceH, first = false) {
          const c = document.createElement('canvas'); c.width = canvas.width; c.height = Math.min(sliceH, canvas.height - y);
          c.getContext('2d').drawImage(canvas, 0, y, canvas.width, c.height, 0, 0, canvas.width, c.height);
          if (!first) pdf.addPage();
          pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', m, m, canvas.width * r2, c.height * r2);
        }
      }
      pdf.save(name + '.pdf');
    }
    toast('已下載');
  } catch (e) { el.classList.remove('exporting'); console.error(e); toast(e.message || '匯出失敗', true); }
}

/* =====================================================================
 * 同仁分頁：自排工作（兩週一頁，類似原本的 Excel 期程表）
 * 路由：#/s/:sid/tasks?d=日期
 * 這裡的每一項就是工作日誌的「自排工作」（logs[日期].tasks），
 * 所以會同步出現在工作日誌、主管的全員總覽與工作期程表。
 * ===================================================================== */
const PT_DAYS = 14;

function viewTasks(sid, q) {
  const t = todayStr();
  const start = mondayOf(isDate(q.d) ? q.d : t);
  const dates = []; for (let i = 0; i < PT_DAYS; i++) dates.push(addDays(start, i));
  const end = dates[dates.length - 1];
  const doc = D(sid), vdoc = V(sid);
  const projects = sortedProjects(vdoc, false);
  const showMs = S.ui.ptMs;
  const link = d => `#/s/${sid}/tasks?d=${d}`;

  const projOpts = cur => `<option value="">其他／雜事</option>` + projects.map(p => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${esc(shortOf(p))}｜${esc(p.name)}</option>`).join('')
    + (cur && !projects.some(p => p.id === cur) ? (() => { const p = byId(vdoc.projects, cur); return p ? `<option value="${p.id}" selected>${esc(shortOf(p))}｜${esc(p.name)}</option>` : ''; })() : '');
  const bossLabel = (tk) => {
    const b = tk.boss; if (!b) return '';
    const nm = id => staffOf(id) ? staffOf(id).name : '';
    const txt = b.kind === 'add' ? '主管新增' : b.kind === 'edit' ? `主管修改${b.old ? `（原：${b.old}）` : ''}`
      : b.kind === 'move' ? (b.fromSid && b.fromSid !== sid ? `主管改派：原由 ${nm(b.fromSid)} 負責` : `主管調整：由 ${mdw(b.from)} 改到這天`)
      : b.kind === 'out' ? `主管改到 ${mdw(b.to)}${b.toSid && b.toSid !== sid ? `，改由 ${nm(b.toSid)} 負責` : ''}` : b.kind === 'remove' ? '主管取消' : '主管調整';
    return `<div class="boss-tag">${esc(txt)}</div>`;
  };

  let lastMonth = '';
  const rows = dates.map((d, i) => {
    const L = doc.logs[d];
    const tasks = (L && L.tasks) || [];
    const off = isOff(d), h = HOL[d];
    const items = tasks.map(tk => {
      const p = tk.pid ? byId(vdoc.projects, tk.pid) : null;
      const s = ST[tk.status || ''] || ST[''];
      return `<div class="pt-item st-${s.cls} ${tk.boss ? 'boss-adj' : ''}" data-tid="${tk.id}" data-date="${d}">
        <select class="pt-proj" data-ch="ptProj" style="--c:${p ? esc(p.color) : 'var(--line)'}" aria-label="專案標籤">${projOpts(tk.pid || '')}</select>
        <textarea class="pt-in" data-in="ptText" data-key="ptKey" data-auto rows="1" placeholder="輸入工作內容，按 Enter 新增下一項" aria-label="${md(d)} 的工作">${esc(tk.text || '')}</textarea>
        ${tk.status ? `<span class="pt-st ${s.cls}" title="在工作日誌標記的狀態">${s.t}${tk.status === 'moved' && tk.movedTo ? ` ${md(tk.movedTo)}` : ''}</span>` : ''}
        <button class="icon-btn pt-del" data-act="ptDel" aria-label="刪除這項工作" title="刪除">✕</button>
        ${bossLabel(tk)}
      </div>`;
    }).join('');
    const ms = showMs ? milestonesOn(vdoc, d).map(({ m, p, cont }) => `<a class="pt-msi ${cont ? 'cont' : ''}" href="#/s/${sid}/plan/p/${p.id}?m=${m.date.slice(0, 7)}&focus=${m.date}" title="${esc(fullOf(p))}">${cont ? '↳ ' : ''}<b style="color:${esc(p.color)}">${esc(shortOf(p))}</b>｜${esc(m.text.trim().split('\n')[0])}${m.side === 'client' ? '<span class="tag client">單位</span>' : ''}${m.tentative ? '<span class="tag tent">待確認</span>' : ''}</a>`).join('') : '';
    const monthHead = d.slice(0, 7) !== lastMonth ? `<tr class="pt-month"><td colspan="${showMs ? 5 : 4}">${d.slice(0, 4)} 年 ${+d.slice(5, 7)} 月</td></tr>` : '';
    lastMonth = d.slice(0, 7);
    return `${monthHead}<tr class="${off ? 'off' : ''} ${d === t ? 'today' : ''} ${d < t ? 'past' : ''} ${dowOf(d) === 1 && i ? 'wk-start' : ''}">
      <td class="pt-date"><a href="#/s/${sid}/log/${d}" title="打開 ${md(d)} 的工作日誌">${pad2(+d.slice(5, 7))}/${pad2(+d.slice(8))}</a>${d === t ? '<small>今天</small>' : ''}</td>
      <td class="pt-dow">${WEEK[dowOf(d)]}</td>
      <td class="pt-hol">${h ? esc(h.name) : ''}</td>
      ${showMs ? `<td class="pt-ms">${ms}</td>` : ''}
      <td class="pt-tasks">${(() => { const lv = Object.entries(LEAVE_NAME).filter(([k]) => num(((L && L.hours) || {})[k])).map(([k, n]) => `◆${n} ${num(L.hours[k])}h`).join('　'); return lv ? `<div class="pt-leave">${esc(lv)}</div>` : ''; })()}${items}<button class="pt-add" data-act="ptAdd" data-date="${d}" title="新增 ${md(d)} 的工作">＋ 新增</button></td>
    </tr>`;
  }).join('');

  document.title = `${staffOf(sid).name}｜自排工作`;
  return topbar({ mode: 'staff', sid, tab: 'tasks' }) + `<main>
    <div class="page-head"><div><h1>自排工作</h1><p>預排未來兩週的工作。這裡填的內容就是工作日誌的「自排工作」，主管的工作期程表也會同步看到。</p></div></div>
    <div class="cal-bar noprint">
      <div class="cal-nav"><a class="icon-btn" href="${link(addDays(start, -7))}" aria-label="前一週">‹</a><a class="btn sm" href="${link(t)}">本週</a><a class="icon-btn" href="${link(addDays(start, 7))}" aria-label="後一週">›</a>
        <h3>${md(start)}–${md(end)}</h3></div>
      <input type="date" data-ch="ptJump" value="${start}" aria-label="跳到日期">
      <span class="grow"></span>
      <label class="chk"><input type="checkbox" data-ch="ptMs" ${showMs ? 'checked' : ''}> 顯示重要期程</label>
      <button class="btn sm" data-act="print">列印</button>
    </div>
    <div class="pt-wrap"><table class="pt-table ${showMs ? '' : 'no-ms'}">
      <thead><tr><th class="pt-date">日期</th><th class="pt-dow">星期</th><th class="pt-hol">節日</th>${showMs ? '<th class="pt-ms">重要期程</th>' : ''}<th class="pt-tasks">自排期程</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <p class="muted small noprint" style="margin-top:12px">提示：在工作內容按 Enter 會新增下一項；點日期可打開當天的工作日誌，標記完成狀態。主管調整過的項目會以琥珀色標示。</p>
  </main>`;
}

/* 找到某一天的某項工作 */
function ptFind(sid, date, tid) {
  const L = getLog(D(sid), date, true);
  return { L, tk: (L.tasks || []).find(x => x.id === tid) };
}
function ptFocus(tid) {
  S.afterRender = () => { const el = document.querySelector(`.pt-item[data-tid="${tid}"] .pt-in`); if (el) { el.focus(); const v = el.value.length; el.setSelectionRange(v, v); } };
}

/* =====================================================================
 * 匯入專案期程：① 專案匯入檔（JSON）② 直接貼上文字（逗號分隔或從 Excel 複製）
 * ===================================================================== */

/** 解析日期文字 → 'YYYY-MM-DD'；看不懂回傳 null。沒寫年份時依可填寫期間推算。 */
function parseImportDate(raw) {
  let s = String(raw || '').trim()
    .replace(/[（(][^）)]*[）)]/g, '')          // 去掉「(四)」這類星期
    .replace(/\s+\d{1,2}:\d{2}(:\d{2})?$/, '')  // 去掉 Excel 的時間
    .replace(/\s+/g, '');
  let y = 0, mo, d, m;
  if ((m = s.match(/^(\d{4})[/\-.年](\d{1,2})[/\-.月](\d{1,2})日?$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{2,3})[/\-.年](\d{1,2})[/\-.月](\d{1,2})日?$/))) { y = +m[1] + 1911; mo = +m[2]; d = +m[3]; }  // 民國年
  else if ((m = s.match(/^(\d{1,2})[/\-.月](\d{1,2})日?$/))) { mo = +m[1]; d = +m[2]; }
  else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const mk = yy => { const dt = new Date(yy, mo - 1, d); return dt.getMonth() === mo - 1 ? ymd(dt) : null; };
  if (y) return mk(y);
  const R = RANGE(), y0 = +R.start.slice(0, 4);
  const cands = [mk(y0), mk(y0 + 1)].filter(Boolean);
  return cands.find(x => x >= R.start && x <= R.end) || cands[0] || null;
}

/** 依分隔符號切成列與欄（支援 Excel 複製時帶引號的多行儲存格） */
function splitTable(text, delim) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
      continue;
    }
    if (ch === '"' && cell.trim() === '') { q = true; cell = ''; continue; }
    if (ch === delim) { row.push(cell); cell = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows.map(r => r.map(c => c.replace(/\r/g, '').trim()));
}

/** 解析貼上的文字 → { rows:[{n,date,ours,client,err,raw}], blank, header } */
function parsePaste(text) {
  const t = String(text || '').replace(/\u00a0/g, ' ');
  const delim = t.includes('\t') ? '\t' : t.includes(',') ? ',' : t.includes('，') ? '，' : '\t';
  const table = splitTable(t, delim).map((cells, i) => ({ cells, n: i + 1 })).filter(r => r.cells.some(c => c));
  let map = { date: 0, ours: 1, client: 2 }, header = false;
  if (table.length) {
    const first = table[0].cells, joined = first.join(' ');
    if (!parseImportDate(first[0]) && /日期|紫晶|業主|單位|進度/.test(joined)) {
      header = true;
      if (first.length > 1) {
        const find = re => first.findIndex(c => re.test(c));
        const di = find(/日期/), oi = find(/紫晶/), ci = find(/單位|業主|客戶/);
        if (di >= 0 && (oi >= 0 || ci >= 0)) map = { date: di, ours: oi, client: ci };
      }
    }
  }
  const data = header ? table.slice(1) : table;
  if (!header && data.some(r => r.cells.length >= 5 && /^[（(]?(星期|週|周)?[一二三四五六日天][）)]?$/.test(r.cells[1] || ''))) map = { date: 0, ours: 3, client: 4 };  // 原專案管制表的五欄
  const R = RANGE();
  let blank = 0;
  const rows = [];
  data.forEach(r => {
    const c = r.cells, get = i => (i >= 0 && i < c.length ? c[i] : '');
    const ours = get(map.ours), client = get(map.client);
    if (!ours && !client) { blank++; return; }
    const date = parseImportDate(get(map.date));
    let err = '';
    if (!date) err = get(map.date) ? `看不懂日期「${get(map.date)}」` : '缺少日期';
    else if (date < R.start || date > R.end) err = `${date.replace(/-/g, '/')} 超出可填寫期間`;
    rows.push({ n: r.n, date, ours, client, err, raw: c.join(delim === '\t' ? ' ｜ ' : ', ') });
  });
  return { rows, blank, header };
}

function importDialog(sid, presetPid) {
  const doc = D(sid);
  const own = sortedProjects(doc, true).filter(p => !p.link);
  const st = { json: null, jsonName: '', cal: null, calName: '' };
  const usedColors = new Set(doc.projects.map(x => x.color));
  const folder = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 6a2 2 0 0 1 2-2h4.2l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  const sel = presetPid && own.some(p => p.id === presetPid) ? presetPid : (own[0] ? own[0].id : '');
  const body = `<div class="imp">
    <div class="imp-target" id="imp-target">
      <div class="imp-label">匯入到</div>
      <label class="imp-opt"><input type="radio" name="tgt" value="exist" ${own.length ? 'checked' : 'disabled'}> 既有專案
        <select name="pid" ${own.length ? '' : 'disabled'}>${own.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(fullOf(p))}</option>`).join('') || '<option>（還沒有專案）</option>'}</select></label>
      <label class="imp-opt"><input type="radio" name="tgt" value="new" ${own.length ? '' : 'checked'}> 新專案</label>
      <div class="imp-new">
        <label class="field" style="width:90px"><span>代號</span><input type="text" name="code" value="${esc(nextCode(sid))}" maxlength="12"></label>
        <label class="field" style="flex:1"><span>專案名稱（必填）</span><input type="text" name="name" maxlength="60" placeholder="例如：土文館專刊"></label>
        <label class="field" style="width:120px"><span>簡稱（2～4 字）</span><input type="text" name="short" maxlength="4" placeholder="例如：土文館"></label>
      </div>
    </div>
    <label class="imp-drop" id="imp-drop">${folder}<span>選擇檔案</span><small>Google 日曆匯出的 .zip／.ics（直接上傳，不用解壓縮），或專案匯入檔 .json</small><input type="file" accept=".zip,.ics,.json,application/zip,text/calendar,application/json" hidden></label>
    <div class="imp-or"><span>或貼上文字</span></div>
    <textarea class="imp-text" name="paste" rows="6" spellcheck="false" placeholder="日期, 紫晶, 業主&#10;10/01, 1校提供,&#10;10/05, , 回復校稿&#10;10/20, 2校提供, 回復2校修改&#10;&#10;也可以直接從 Excel 複製「日期／紫晶進度／單位進度」幾欄貼上"></textarea>
    <div class="imp-preview" id="imp-preview" aria-live="polite"></div>
  </div>`;

  const targetInfo = bg => {
    const tgt = (bg.querySelector('[name=tgt]:checked') || {}).value;
    return tgt === 'exist' ? { pid: bg.querySelector('[name=pid]').value } : { pid: null };
  };
  const paint = bg => {
    const box = bg.querySelector('#imp-preview');
    bg.querySelector('.imp').classList.toggle('filemode', !!(st.cal || st.json));  // 選了檔案就收起貼上文字區
    const isNew = (bg.querySelector('[name=tgt]:checked') || {}).value === 'new';
    bg.querySelector('.imp-new').classList.toggle('on', isNew);
    bg.querySelector('[name=pid]').disabled = isNew || !own.length;
    if (st.cal) {
      const { pid } = targetInfo(bg);
      box.innerHTML = `<div class="imp-sum">已選擇日曆檔 <b>${esc(st.calName)}</b>：${st.cal.length} 個日曆。重新上傳同一份日曆時，改過的行程會更新、刪掉的會移除，不會重複。 <button type="button" class="link-btn" data-clear>改用貼上文字</button></div>${calPreviewHTML(doc, pid, st.cal)}`;
      bg.querySelector('.imp-text').disabled = true;
      box.querySelector('[data-clear]').onclick = () => { st.cal = null; bg.querySelector('.imp-text').disabled = false; paint(bg); };
      box.querySelectorAll('[data-cal-on]').forEach(el => el.addEventListener('change', () => { st.cal[+el.dataset.calOn].on = el.checked; paint(bg); }));
      box.querySelectorAll('[data-cal-side]').forEach(el => el.addEventListener('change', () => { st.cal[+el.dataset.calSide].side = el.value; paint(bg); }));
      box.querySelectorAll('[data-cal-tag]').forEach(el => el.addEventListener('change', () => { st.cal[+el.dataset.calTag].tag = el.value.trim() || st.cal[+el.dataset.calTag].name; paint(bg); }));
      return;
    }
    if (st.json) {
      const exists = new Set(doc.projects.map(p => p.code));
      const items = st.json.map(x => `<li class="${exists.has(x.code) ? 'skip' : ''}"><b>${esc(x.code)}</b> ${esc(x.name)}${x.short ? `（${esc(x.short)}）` : ''}<span class="muted">　${x.ms.length} 筆期程${exists.has(x.code) ? '・已存在，略過' : ''}</span></li>`).join('');
      const nNew = st.json.filter(x => !exists.has(x.code)).length;
      box.innerHTML = `<div class="imp-sum">已選擇檔案 <b>${esc(st.jsonName)}</b>：將建立 <b>${nNew}</b> 個新專案 <button type="button" class="link-btn" data-clear>改用貼上文字</button></div><ul class="imp-json">${items}</ul>`;
      bg.querySelector('#imp-target').classList.add('dim');
      bg.querySelector('.imp-text').disabled = true;
      box.querySelector('[data-clear]').onclick = () => { st.json = null; bg.querySelector('#imp-target').classList.remove('dim'); bg.querySelector('.imp-text').disabled = false; paint(bg); };
      return;
    }
    const text = bg.querySelector('.imp-text').value;
    if (!text.trim()) { box.innerHTML = '<p class="muted small" style="margin:0">貼上文字後，這裡會顯示預覽。</p>'; return; }
    const P = parsePaste(text);
    const { pid } = targetInfo(bg);
    let nOurs = 0, nClient = 0;
    const rowsHTML = P.rows.slice(0, 400).map(r => {
      let note = r.err;
      if (!r.err) {
        const notes = [];
        [['ours', r.ours], ['client', r.client]].forEach(([side, txt]) => {
          if (!txt) return;
          side === 'ours' ? nOurs++ : nClient++;
          const ex = pid ? findCell(doc, pid, r.date, side) : null;
          if (ex && (ex.text || '').trim()) notes.push(ex.text.trim() === txt ? `${SIDE_NAME[side]}內容相同，略過` : `${SIDE_NAME[side]}已有內容，會接在後面`);
        });
        note = notes.join('；') || '新增';
      }
      return `<tr class="${r.err ? 'err' : ''}"><td class="nowrap">${r.date ? mdw(r.date) + (r.date.slice(0, 4) !== todayStr().slice(0, 4) ? `<small class="muted"> ${r.date.slice(0, 4)}</small>` : '') : '—'}</td><td>${esc(r.ours)}</td><td>${esc(r.client)}</td><td class="st">${r.err ? `第 ${r.n} 行：${esc(note)}` : esc(note)}</td></tr>`;
    }).join('');
    const bad = P.rows.filter(r => r.err).length, good = P.rows.length - bad;
    box.innerHTML = `<div class="imp-sum">可匯入 <b>${good}</b> 行（紫晶進度 ${nOurs} 筆、單位進度 ${nClient} 筆）${P.blank ? `・空白 ${P.blank} 行略過` : ''}${bad ? `・<span class="bad">有問題 ${bad} 行，不會匯入</span>` : ''}${P.header ? '・已略過標題行' : ''}</div>
      ${P.rows.length ? `<div class="imp-table"><table class="plain"><thead><tr><th>日期</th><th>紫晶進度</th><th>單位進度</th><th>狀態</th></tr></thead><tbody>${rowsHTML}</tbody></table></div>` : ''}`;
  };

  const resolveTarget = bg => {
    let { pid } = targetInfo(bg);
    if (pid) return { pid, p: byId(doc.projects, pid) };
    const f = n => bg.querySelector(`[name=${n}]`);
    const name = f('name').value.trim();
    if (!name) { f('name').focus(); f('name').style.borderColor = 'var(--seal)'; toast('請填寫新專案的名稱', true); return null; }
    const short = f('short').value.trim();
    if (short && Array.from(short).length < 2) { f('short').focus(); f('short').style.borderColor = 'var(--seal)'; toast('簡稱請填 2～4 個字', true); return null; }
    const color = PALETTE.find(c => !usedColors.has(c)) || PALETTE[doc.projects.length % PALETTE.length];
    const p = { id: uid(), code: f('code').value.trim(), name, short, client: '', color, status: 'active', note: '', created: now(), u: now() };
    doc.projects.push(p);
    return { pid: p.id, p };
  };
  const doImport = bg => {
    if (st.json) { importSeed(sid, st.json); render({ keepScroll: true }); return true; }
    if (st.cal) {
      if (!st.cal.some(c => c.on)) { toast('請至少勾選一個日曆', true); return false; }
      const tgt = resolveTarget(bg); if (!tgt) return false;
      const r = applyCalendars(doc, tgt.pid, st.cal);
      touchStaff(sid);
      toast(`已從 Google 日曆匯入到「${shortOf(tgt.p)}」：新增 ${r.add} 筆${r.upd ? `、更新 ${r.upd} 筆` : ''}${r.del ? `、移除 ${r.del} 筆` : ''}`);
      const first = st.cal.filter(c => c.on).flatMap(c => c.occ).map(o => o.date).filter(d => d >= RANGE().start && d <= RANGE().end).sort()[0];
      go(`#/s/${sid}/plan/p/${tgt.pid}${first ? '?m=' + first.slice(0, 7) : ''}`);
      return true;
    }
    const P = parsePaste(bg.querySelector('.imp-text').value);
    const rows = P.rows.filter(r => !r.err);
    if (!rows.length) { toast(P.rows.length ? '沒有可以匯入的資料，請檢查標紅的行' : '請選擇 JSON 檔案或貼上文字', true); return false; }
    const tgt = resolveTarget(bg); if (!tgt) return false;
    const { pid, p } = tgt;
    let added = 0, appended = 0, same = 0;
    rows.forEach(r => [['ours', r.ours], ['client', r.client]].forEach(([side, txt]) => {
      if (!txt) return;
      const ex = findCell(doc, pid, r.date, side);
      if (ex && (ex.text || '').trim()) {
        if (ex.text.trim() === txt) { same++; return; }
        ex.text = ex.text.replace(/\s+$/, '') + '\n' + txt; ex.u = now(); appended++; return;
      }
      if (ex) { ex.text = txt; ex.u = now(); added++; return; }
      doc.milestones.push({ id: uid(), projectId: pid, date: r.date, side, text: txt, endDate: '', tentative: false, note: '', u: now() }); added++;
    }));
    touchStaff(sid);
    toast(`已匯入到「${shortOf(p)}」：新增 ${added} 筆${appended ? `、接在原內容後 ${appended} 筆` : ''}${same ? `、相同略過 ${same} 筆` : ''}`);
    const firstDate = rows.map(r => r.date).sort()[0];
    go(`#/s/${sid}/plan/p/${pid}?m=${firstDate.slice(0, 7)}`);
    return true;
  };

  openModal({
    title: '匯入專案期程', wide: true, body,
    actions: [{ label: '取消', cancel: true }, { label: '確認匯入', cls: 'primary', primary: true, onClick: doImport }],
    onOpen: bg => {
      let tm = null;
      bg.querySelector('.imp-text').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => paint(bg), 150); });
      bg.querySelectorAll('[name=tgt],[name=pid]').forEach(el => el.addEventListener('change', () => paint(bg)));
      const file = bg.querySelector('#imp-drop input');
      file.addEventListener('change', async () => {
        const fl = file.files[0]; file.value = ''; if (!fl) return;
        if (/\.(zip|ics)$/i.test(fl.name)) {
          try { st.cal = await readCalendarFile(fl); st.calName = fl.name; st.json = null; bg.querySelector('#imp-target').classList.remove('dim'); paint(bg); }
          catch (e) { toast(e.message || '讀不到這個日曆檔', true); }
          return;
        }
        let b = null; try { b = JSON.parse(await fl.text()); } catch (e) { b = null; }
        const list = b && b.app === 'zijing-pm' && b.type === 'projects' && Array.isArray(b.projects) ? b.projects.filter(x => x && x.code && Array.isArray(x.ms)) : null;
        if (!list || !list.length) { toast('請選擇 Google 日曆的 .zip／.ics，或專案匯入檔 .json', true); return; }
        st.cal = null; st.json = list; st.jsonName = fl.name; paint(bg);
      });
      paint(bg);
    },
  });
}

/* =====================================================================
 * Google 日曆匯入：直接讀取 Google 日曆「匯出日曆」下載的 .zip（或 .ics）
 * 每筆期程記住來源（日曆＋行程），重新上傳時會更新、刪除對應的期程，不會重複。
 * ===================================================================== */

/** 解開 .zip，回傳 [{ name, bytes }]（只支援一般的 stored / deflate 壓縮） */
async function unzipFiles(buf) {
  const dv = new DataView(buf), len = buf.byteLength;
  let eocd = -1;
  for (let i = len - 22; i >= Math.max(0, len - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('這不是有效的 zip 檔');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nlen));
    p += 46 + nlen + elen + clen;
    if (name.endsWith('/')) continue;
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    const data = new Uint8Array(buf, start, csize);
    let bytes;
    if (method === 0) bytes = data;
    else if (method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('這個瀏覽器無法直接讀取 zip，請改用最新版 Chrome／Edge，或先解壓縮後選擇 .ics 檔');
      bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    } else continue;
    out.push({ name, bytes });
  }
  return out;
}

function icsTime(v, params) {
  v = String(v || '').trim(); let m;
  if ((params && params.VALUE === 'DATE') || /^\d{8}$/.test(v)) {
    m = v.match(/^(\d{4})(\d{2})(\d{2})/);
    return m ? { date: `${m[1]}-${m[2]}-${m[3]}`, time: '', allDay: true } : null;
  }
  m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  if (m[7]) {  // UTC → 這台電腦的時區
    const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]));
    return { date: ymd(d), time: pad2(d.getHours()) + ':' + pad2(d.getMinutes()), allDay: false };
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}`, allDay: false };
}
const icsUnesc = v => v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

/** 解析 .ics 文字 → { name, events } */
function icsParse(text, fileName) {
  const lines = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const cal = { name: '', events: [] }, stack = [];
  let ev = null;
  for (const raw of lines) {
    const ci = raw.indexOf(':'); if (ci < 0) continue;
    const left = raw.slice(0, ci), value = raw.slice(ci + 1);
    const [nm, ...ps] = left.split(';'); const N = nm.toUpperCase();
    const params = {}; ps.forEach(x => { const k = x.indexOf('='); if (k > 0) params[x.slice(0, k).toUpperCase()] = x.slice(k + 1).replace(/^"|"$/g, ''); });
    if (N === 'BEGIN') { stack.push(value.trim().toUpperCase()); if (value.trim().toUpperCase() === 'VEVENT') ev = { exdates: [] }; continue; }
    if (N === 'END') { const v = stack.pop(); if (v === 'VEVENT' && ev) { cal.events.push(ev); ev = null; } continue; }
    const top = stack[stack.length - 1];
    if (ev && top === 'VEVENT') {
      if (N === 'UID') ev.uid = value.trim();
      else if (N === 'SUMMARY') ev.summary = icsUnesc(value).trim();
      else if (N === 'DESCRIPTION') ev.desc = icsUnesc(value).replace(/<[^>]+>/g, ' ').trim();
      else if (N === 'LOCATION') ev.loc = icsUnesc(value).trim();
      else if (N === 'DTSTART') ev.start = icsTime(value, params);
      else if (N === 'DTEND') ev.end = icsTime(value, params);
      else if (N === 'RRULE') ev.rrule = value.trim();
      else if (N === 'EXDATE') value.split(',').forEach(v => { const t = icsTime(v, params); if (t) ev.exdates.push(t.date); });
      else if (N === 'RECURRENCE-ID') ev.recur = icsTime(value, params);
      else if (N === 'STATUS') ev.status = value.trim().toUpperCase();
    } else if (top === 'VCALENDAR' && N === 'X-WR-CALNAME') cal.name = icsUnesc(value).trim();
  }
  if (!cal.name) cal.name = String(fileName || '日曆').replace(/^.*\//, '').replace(/\.ics$/i, '').replace(/_[^_]*@[^@]*$/, '').trim() || '日曆';
  return cal;
}

/** 依 RRULE 展開重複行程的日期（支援每日／每週／每月／每年，含 INTERVAL、COUNT、UNTIL、BYDAY、BYMONTHDAY） */
function rruleDates(start, rule, limitEnd) {
  const r = {}; rule.split(';').forEach(x => { const k = x.indexOf('='); if (k > 0) r[x.slice(0, k).toUpperCase()] = x.slice(k + 1); });
  const interval = Math.max(1, +r.INTERVAL || 1), count = r.COUNT ? +r.COUNT : Infinity;
  let until = limitEnd;
  if (r.UNTIL) { const u = icsTime(r.UNTIL, {}); if (u && u.date < until) until = u.date; }
  const DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const byday = (r.BYDAY || '').split(',').filter(Boolean), bymd = (r.BYMONTHDAY || '').split(',').filter(Boolean).map(Number);
  const out = []; let n = 0;
  const push = d => { if (d < start) return true; if (d > until || n >= count || out.length >= 800) return false; out.push(d); n++; return true; };
  if (r.FREQ === 'DAILY') { for (let d = start, g = 0; g < 3000; d = addDays(d, interval), g++) if (!push(d)) break; }
  else if (r.FREQ === 'WEEKLY') {
    const days = byday.length ? byday.map(x => DOW.indexOf(x.slice(-2))).filter(x => x >= 0) : [dowOf(start)];
    let wk = addDays(start, -((dowOf(start) + 6) % 7));
    outer: for (let g = 0; g < 600; g++, wk = addDays(wk, 7 * interval)) {
      for (const d of days.map(dw => addDays(wk, (dw + 6) % 7)).sort()) if (!push(d)) break outer;
    }
  } else if (r.FREQ === 'MONTHLY') {
    for (let g = 0, mo = start.slice(0, 7); g < 400; g++, mo = addMonths(mo + '-01', interval).slice(0, 7)) {
      if (mo + '-01' > until) break;
      const ds = [];
      if (byday.length) byday.forEach(x => {
        const mm = x.match(/^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/); if (!mm) return;
        const dw = DOW.indexOf(mm[2]), nth = mm[1] ? +mm[1] : 0, all = [];
        for (let d = mo + '-01'; d.slice(0, 7) === mo; d = addDays(d, 1)) if (dowOf(d) === dw) all.push(d);
        if (!nth) ds.push(...all); else { const pick = nth > 0 ? all[nth - 1] : all[all.length + nth]; if (pick) ds.push(pick); }
      });
      else (bymd.length ? bymd : [+start.slice(8)]).forEach(dn => { const dt = new Date(+mo.slice(0, 4), +mo.slice(5, 7) - 1, dn); if (dt.getMonth() === +mo.slice(5, 7) - 1) ds.push(ymd(dt)); });
      let stop = false; for (const d of ds.sort()) if (!push(d)) { stop = true; break; }
      if (stop) break;
    }
  } else if (r.FREQ === 'YEARLY') {
    for (let y = +start.slice(0, 4), g = 0; g < 60; y += interval, g++) {
      const dt = new Date(y, +start.slice(5, 7) - 1, +start.slice(8));
      if (dt.getMonth() !== +start.slice(5, 7) - 1) continue;
      if (!push(ymd(dt))) break;
    }
  } else out.push(start);
  return out;
}

/** 日曆 → 每一次發生的行程 [{ key, date, endDate, time, summary, loc, desc }] */
function icsOccurrences(cal) {
  const R = RANGE();
  const masters = cal.events.filter(e => !e.recur), overrides = cal.events.filter(e => e.recur && e.recur.date);
  const ov = {}; overrides.forEach(o => { ov[o.uid + '|' + o.recur.date] = o; });
  const out = [];
  const emit = (ev, orig) => {
    if (ev.status === 'CANCELLED' || !ev.start) return;
    let end = '';
    if (ev.end) { let ed = ev.end.date; if (ev.end.allDay || (ev.end.time === '00:00' && ed > ev.start.date)) ed = addDays(ed, -1); if (ed > ev.start.date) end = ed; }
    // 單次行程只用 UID 辨識（改日期也算同一筆）；重複行程用 UID＋原本的那一天
    out.push({ key: (ev.uid || ev.summary || '') + (orig ? '|' + orig : ''), date: ev.start.date, endDate: end, time: ev.start.allDay ? '' : ev.start.time, summary: ev.summary || '（無標題）', loc: ev.loc || '', desc: ev.desc || '' });
  };
  masters.forEach(ev => {
    if (!ev.start) return;
    if (!ev.rrule) { emit(ev, ''); return; }
    const dates = rruleDates(ev.start.date, ev.rrule, R.end);
    dates.forEach(d => {
      if (ev.exdates.includes(d)) return;
      if (ov[ev.uid + '|' + d]) { emit(ov[ev.uid + '|' + d], d); return; }
      if (d === ev.start.date) { emit(ev, d); return; }
      const delta = Math.round((toDate(d) - toDate(ev.start.date)) / 86400000);
      emit(Object.assign({}, ev, { start: Object.assign({}, ev.start, { date: d }), end: ev.end ? Object.assign({}, ev.end, { date: addDays(ev.end.date, delta) }) : null }), d);
    });
  });
  overrides.forEach(o => { if (!masters.some(m => m.uid === o.uid)) emit(o, o.recur.date); });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

/** 讀取使用者選的檔案（.zip 或 .ics）→ [{ id, name, tag, side, on, occ }] */
async function readCalendarFile(file) {
  const lower = file.name.toLowerCase();
  let parts = [];
  if (lower.endsWith('.zip')) {
    const files = await unzipFiles(await file.arrayBuffer());
    parts = files.filter(f => /\.ics$/i.test(f.name)).map(f => ({ name: f.name, text: new TextDecoder().decode(f.bytes) }));
    if (!parts.length) throw new Error('zip 檔裡沒有 .ics 日曆檔');
  } else parts = [{ name: file.name, text: await file.text() }];
  const cals = parts.map(p => icsParse(p.text, p.name)).filter(c => c.events.length);
  if (!cals.length) throw new Error('日曆檔裡沒有任何行程');
  return cals.map(c => ({ id: c.name, name: c.name, tag: c.name, side: 'ours', on: true, occ: icsOccurrences(c) }));
}

/** 單一行程要寫成的期程內容 */
function calMilestone(c, o) {
  const text = `〔${c.tag || c.name}〕${o.time ? o.time + ' ' : ''}${o.summary}`;
  const note = [o.loc ? '地點：' + o.loc : '', o.desc.replace(/\s+/g, ' ').slice(0, 160)].filter(Boolean).join('｜').slice(0, 200);
  return { date: o.date, endDate: o.endDate || '', side: c.side, text, note, src: `ics:${c.id}:${o.key}` };
}

/** 比對目標專案現有的期程，算出新增／更新／不變／移除 */
function calPlan(doc, pid, c) {
  const R = RANGE();
  const prefix = `ics:${c.id}:`;
  const existing = new Map((pid ? doc.milestones.filter(m => m.projectId === pid && m.src && m.src.startsWith(prefix)) : []).map(m => [m.src, m]));
  const rows = [], keep = new Set();
  c.occ.forEach(o => {
    const inRange = (o.endDate || o.date) >= R.start && o.date <= R.end;
    const want = calMilestone(c, o);
    if (!inRange) { rows.push({ o, want, st: 'out' }); return; }
    const ex = existing.get(want.src);
    if (ex) keep.add(want.src);
    const same = ex && ex.date === want.date && (ex.endDate || '') === want.endDate && ex.side === want.side && ex.text === want.text && (ex.note || '') === want.note;
    rows.push({ o, want, ex, st: !ex ? 'add' : same ? 'same' : 'upd' });
  });
  const removed = Array.from(existing.values()).filter(m => !keep.has(m.src));
  return { rows, removed };
}

function calPreviewHTML(doc, pid, cals) {
  const ST = { add: '新增', upd: '更新', same: '不變', out: '超出可填寫期間，略過' };
  return cals.map((c, ci) => {
    const P = calPlan(doc, pid, c);
    const n = k => P.rows.filter(r => r.st === k).length;
    const list = P.rows.filter(r => r.st !== 'same').slice(0, 300).map(r => `<tr class="${r.st === 'out' ? 'mute' : ''}"><td class="nowrap">${mdw(r.o.date)}${r.o.endDate ? `–${md(r.o.endDate)}` : ''}${r.o.date.slice(0, 4) !== todayStr().slice(0, 4) ? `<small class="muted"> ${r.o.date.slice(0, 4)}</small>` : ''}</td><td>${esc(r.want.text)}</td><td class="st">${ST[r.st]}</td></tr>`).join('')
      + P.removed.map(m => `<tr class="del"><td class="nowrap">${mdw(m.date)}</td><td>${esc(m.text)}</td><td class="st">日曆已刪除，將移除</td></tr>`).join('');
    return `<div class="cal-blk ${c.on ? '' : 'off'}">
      <div class="cal-blk-h">
        <label class="chk"><input type="checkbox" data-cal-on="${ci}" ${c.on ? 'checked' : ''}> <b>${esc(c.name)}</b></label>
        <label class="mini">放到 <select data-cal-side="${ci}"><option value="ours" ${c.side === 'ours' ? 'selected' : ''}>紫晶進度</option><option value="client" ${c.side === 'client' ? 'selected' : ''}>單位進度</option></select></label>
        <label class="mini">標籤〔<input type="text" data-cal-tag="${ci}" value="${esc(c.tag)}" maxlength="10">〕</label>
      </div>
      <div class="imp-sum">共 ${c.occ.length} 筆行程：新增 <b>${n('add')}</b>、更新 <b>${n('upd')}</b>、不變 ${n('same')}${P.removed.length ? `、<span class="bad">移除 ${P.removed.length}</span>` : ''}${n('out') ? `、超出期間略過 ${n('out')}` : ''}</div>
      ${list ? `<div class="imp-table"><table class="plain"><thead><tr><th>日期</th><th>期程內容</th><th>狀態</th></tr></thead><tbody>${list}</tbody></table></div>` : '<p class="muted small" style="margin:0">內容與系統相同，不需要更新。</p>'}
    </div>`;
  }).join('');
}

/** 寫入：新增、更新、移除 */
function applyCalendars(doc, pid, cals) {
  let add = 0, upd = 0, del = 0;
  cals.filter(c => c.on).forEach(c => {
    const P = calPlan(doc, pid, c);
    P.rows.forEach(r => {
      if (r.st === 'add') { doc.milestones.push(Object.assign({ id: uid(), projectId: pid, tentative: false, u: now() }, r.want)); add++; }
      else if (r.st === 'upd') { Object.assign(r.ex, r.want, { u: now() }); upd++; }
    });
    P.removed.forEach(m => { delMilestone(doc, m); del++; });
  });
  return { add, upd, del };
}

/* =====================================================================
 * 主管檢視：出缺勤月報（依月份統計加班、補休、事假、病假、特休）
 * 路由：#/boss/attendance?m=YYYY-MM
 * 資料來源：各同仁工作日誌中的「出勤時數」
 * ===================================================================== */
const HOUR_ABBR = { ot: '加', comp: '補', personal: '事', sick: '病', annual: '特' };

/** 這天的日誌有沒有填寫任何內容 */
function logFilled(L) {
  if (!L) return false;
  return (L.tasks || []).some(t => (t.text || '').trim()) ||
    Object.values(L.auto || {}).some(a => a && (a.status || (a.note || '').trim())) ||
    HOURS.some(([k]) => num((L.hours || {})[k])) || !!(L.remark || '').trim();
}
const fmtH = n => (Math.round(n * 100) / 100).toString();

function attendanceData(month) {
  const from = month + '-01', to = monthEnd(from), t = todayStr();
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const rows = CFG().staff.filter(s => S.docs[s.id]).map(st => {
    const logs = D(st.id).logs || {};
    const sum = Object.fromEntries(HOURS.map(([k]) => [k, 0]));
    let filled = 0, workdays = 0;
    const cells = days.map(d => {
      const L = logs[d];
      const h = {};
      HOURS.forEach(([k]) => { const v = num(L && L.hours && L.hours[k]); if (v) { h[k] = v; sum[k] += v; } });
      const off = isOff(d), past = d <= t, f = logFilled(L);
      if (!off && past) { workdays++; if (f) filled++; }
      return { d, h, off, past, filled: f };
    });
    return { st, sum, filled, workdays, cells };
  });
  return { from, to, days, rows };
}

function viewBossAttendance(q) {
  const t = todayStr();
  const month = /^\d{4}-\d{2}$/.test(q.m || '') ? q.m : t.slice(0, 7);
  const A = attendanceData(month);
  const prevM = addMonths(month + '-01', -1).slice(0, 7), nextM = addMonths(month + '-01', 1).slice(0, 7);
  const total = Object.fromEntries(HOURS.map(([k]) => [k, A.rows.reduce((n, r) => n + r.sum[k], 0)]));
  const val = n => n ? `<b>${fmtH(n)}</b><small> 小時</small>` : '<span class="muted">—</span>';

  const summary = `<div class="grid-wrap"><table class="plain att-sum">
    <thead><tr><th>同仁</th>${HOURS.map(([, n]) => `<th class="num">${n}</th>`).join('')}<th class="num">日誌填寫</th></tr></thead>
    <tbody>${A.rows.map(r => `<tr><td><span class="who-tag" style="--c:${esc(r.st.color)}">${esc(r.st.name)}</span></td>
      ${HOURS.map(([k]) => `<td class="num ${k}">${val(r.sum[k])}</td>`).join('')}
      <td class="num">${r.workdays ? `${r.filled}／${r.workdays} 個工作天${r.filled < r.workdays ? `<div class="small warn-text">${r.workdays - r.filled} 天未填</div>` : ''}` : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody>
    ${A.rows.length > 1 ? `<tfoot><tr><th>合計</th>${HOURS.map(([k]) => `<th class="num">${total[k] ? fmtH(total[k]) + ' 小時' : '—'}</th>`).join('')}<th></th></tr></tfoot>` : ''}
  </table></div>`;

  const head = A.days.map(d => `<th class="${isOff(d) ? 'off' : ''} ${d === t ? 'today' : ''}" title="${esc(mdw(d) + (HOL[d] ? ' ' + HOL[d].name : ''))}">${+d.slice(8)}<small>${WEEK[dowOf(d)]}</small></th>`).join('');
  const body = A.rows.map(r => `<tr><th class="who"><span class="who-tag" style="--c:${esc(r.st.color)}">${esc(r.st.name)}</span></th>${r.cells.map(c => {
    const items = HOURS.filter(([k]) => c.h[k]).map(([k, n]) => `<span class="hb ${k}" title="${n} ${fmtH(c.h[k])} 小時">${HOUR_ABBR[k]}${fmtH(c.h[k])}</span>`).join('');
    const miss = !items && !c.off && c.past && !c.filled ? '<span class="miss" title="這天沒有填寫工作日誌">未填</span>' : '';
    return `<td class="${c.off ? 'off' : ''} ${c.d === t ? 'today' : ''}"><a href="#/boss/${r.st.id}/log/${c.d}?v=day" title="${esc(r.st.name + ' ' + mdw(c.d))}${HOL[c.d] ? ' ' + esc(HOL[c.d].name) : ''}，點一下查看當天日誌">${items || miss || '&nbsp;'}</a></td>`;
  }).join('')}</tr>`).join('');
  const matrix = `<div class="att-wrap"><table class="att-grid"><thead><tr><th class="who">同仁</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
    <div class="att-legend">${HOURS.map(([k, n]) => `<span><span class="hb ${k}">${HOUR_ABBR[k]}</span>${n}</span>`).join('')}<span><span class="miss">未填</span>工作天沒有填寫日誌</span><span class="muted">數字為小時；點格子可查看當天日誌並留下回饋</span></div>`;

  document.title = '出缺勤月報｜' + CFG().company;
  return topbar({ mode: 'boss', tab: 'attendance' }) + `<main>
    <div class="page-head"><div><h1>出缺勤月報</h1><p>${month.slice(0, 4)} 年 ${+month.slice(5)} 月　依各同仁工作日誌中的「出勤時數」統計</p></div>
      <div class="row noprint"><a class="icon-btn" href="#/boss/attendance?m=${prevM}" aria-label="上個月">‹</a>
        <input type="month" value="${month}" data-ch="attMonth" aria-label="選擇月份"><a class="icon-btn" href="#/boss/attendance?m=${nextM}" aria-label="下個月">›</a>
        ${month !== t.slice(0, 7) ? `<a class="btn sm" href="#/boss/attendance">本月</a>` : ''}
        <button class="btn sm" data-act="exportAttendance" data-m="${month}">匯出 CSV</button><button class="btn sm" data-act="print">列印</button></div></div>
    <section class="att-sec"><h2>本月合計</h2>${A.rows.length ? summary : '<div class="empty"><p>尚未建立同仁。</p></div>'}</section>
    <section class="att-sec"><h2>每日明細</h2>${A.rows.length ? matrix : ''}</section>
  </main>`;
}

function exportAttendanceCSV(month) {
  const A = attendanceData(month);
  const rows = [['同仁', '日期', '星期', '假日', ...HOURS.map(([, n]) => n + '（小時）'), '日誌']];
  A.rows.forEach(r => {
    r.cells.forEach(c => {
      const any = HOURS.some(([k]) => c.h[k]);
      const miss = !c.off && c.past && !c.filled;
      if (!any && !miss) return;
      rows.push([r.st.name, c.d.replace(/-/g, '/'), WEEK[dowOf(c.d)], HOL[c.d] ? HOL[c.d].name : '', ...HOURS.map(([k]) => c.h[k] ? fmtH(c.h[k]) : ''), c.filled ? '已填' : '未填']);
    });
    rows.push([r.st.name + ' 合計', '', '', '', ...HOURS.map(([k]) => r.sum[k] ? fmtH(r.sum[k]) : '0'), `${r.filled}/${r.workdays} 個工作天已填`]);
    rows.push([]);
  });
  download(`出缺勤_${month}.csv`, csv(rows), 'text/csv');
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

  return topbar({ mode: 'boss' }) + `<main>
    <div class="page-head"><div><h1>全員總覽</h1><p>${mdw(date)}${HOL[date] ? '　' + esc(HOL[date].name) : ''}　各同仁的工作日誌與完成狀況</p></div>
      <div class="row noprint"><a class="icon-btn" href="#/boss?d=${addDays(date, -1)}" aria-label="前一天">‹</a><input type="date" value="${date}" data-ch="bossDate" aria-label="選擇日期"><a class="icon-btn" href="#/boss?d=${addDays(date, 1)}" aria-label="後一天">›</a>${date !== t ? `<a class="btn sm" href="#/boss">今天</a>` : ''}<button class="btn sm" data-act="print">列印</button></div></div>
    ${modeNotice()}
    <div class="board">${cards}</div>
    <p class="muted small noprint" style="margin-top:18px">要看未來兩週每個人的工作安排與重要期程，請到上方的「工作期程表」。</p>
  </main>`;
}
function viewBossStaff(sid, sub, d, q) {
  const st = staffOf(sid);
  const head = (active) => `<a class="backlink noprint" href="#/boss">‹ 全員總覽</a><div class="page-head"><div><h1>${esc(st.name)}</h1><p>主管檢視（唯讀，可留下回饋）</p></div>
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
  const used = new Set(doc.projects.map(p => p.color));
  SEED.forEach((sp, i) => {
    if (doc.projects.some(p => p.code === sp.code)) return;
    const color = PALETTE.find(c => !used.has(c)) || PALETTE[(doc.projects.length) % PALETTE.length]; used.add(color);
    const p = { id: uid(), code: sp.code, name: sp.name, short: String(sp.short || '').trim().slice(0, 4), client: '', color, status: 'active', note: '由專案匯入檔匯入', created: now() + i, u: now() };
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
  openSearch: () => openSearch(),
  ptAdd: el => {
    const sid = S.route.parts[1], date = el.dataset.date;
    const L = getLog(D(sid), date, true);
    const empty = (L.tasks || []).find(x => !(x.text || '').trim());
    if (empty) { const n = document.querySelector(`.pt-item[data-tid="${empty.id}"] .pt-in`); if (n) { n.focus(); return; } }
    const last = L.tasks[L.tasks.length - 1];
    const tk = { id: uid(), text: '', pid: last ? last.pid || '' : '', status: '', note: '' };
    L.tasks.push(tk); staffTouchLog(L); touchStaff(sid); ptFocus(tk.id); render({ keepScroll: true });
  },
  ptDel: async el => {
    const sid = S.route.parts[1], it = el.closest('.pt-item');
    const { L, tk } = ptFind(sid, it.dataset.date, it.dataset.tid); if (!tk) return;
    if ((tk.text || '').trim() && !(await confirmBox('刪除工作', `確定刪除「${tk.text}」？\n工作日誌中的這一項也會一併刪除。`, '刪除', true))) return;
    L.tasks = L.tasks.filter(x => x.id !== tk.id); staffTouchLog(L); touchStaff(sid); render({ keepScroll: true });
  },
  schedNewDraft: async el => {
    const start = el.dataset.start;
    if (draftOf(start) && !(await confirmBox('建立新的調整版本', '會以目前的員工原排重新建立一份調整版本，取代舊的版本。', '建立'))) return;
    createDraft(start); go(`#/boss/schedule?d=${start}&v=draft`);
  },
  schedDiscard: async el => {
    const start = el.dataset.start;
    if (!(await confirmBox('捨棄調整版本', '確定捨棄這份調整版本？同仁的工作日誌不受影響。', '捨棄', true))) return;
    delete SCH().drafts[start]; touchSched(); go(`#/boss/schedule?d=${start}`);
  },
  schedApply: async el => {
    const start = el.dataset.start; const dr = draftOf(start); if (!dr) return;
    const st = draftStats(dr); if (!st.total) { toast('調整版本沒有任何變動'); return; }
    if (!(await confirmBox('確認調整期程', `將把 ${st.total} 項調整（新增 ${st.add}、改期／改派 ${st.move}、修改 ${st.edit}、取消 ${st.remove}）寫入同仁的工作日誌，並以「主管調整」顏色標示。\n確認後這份調整版本會鎖定。`, '確認調整'))) return;
    const n = applyDraft(dr);
    toast(`已套用到 ${n} 位同仁的工作日誌`); render({ keepScroll: true });
  },
  schedCell: el => { const q = S.route.q; schedCellDialog(mondayOf(isDate(q.d) ? q.d : todayStr()), el.dataset.sid, el.dataset.date); },
  schedExport: el => schedExport(el.dataset.kind),
  addProjNote: el => addProjNote(el),
  phAllNotes: () => { const q = Object.assign({}, S.route.q, { notes: 'all' }); go(location.hash.split('?')[0] + '?' + Object.entries(q).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&')); },
  importPlan: el => importDialog(ctxSid(), el.dataset.pid),
  exportAttendance: el => exportAttendanceCSV(el.dataset.m),
  tlDot: el => tlDetail(el.dataset.owner, el.dataset.pid, el.dataset.date),
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
  addNote: () => {
    const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date, true);
    const ps = sortedProjects(V(sid), false);
    const last = S.ui.lastNote && ps.find(p => ownerOf(sid, p) + '|' + p.id === S.ui.lastNote);
    const p = last || ps[0]; if (!p) return;
    L.notes = L.notes || [];
    const n = { id: uid(), sid: ownerOf(sid, p), pid: p.id, text: '', at: now(), u: now() };
    L.notes.push(n); staffTouchLog(L); touchStaff(sid); render({ keepScroll: true });
    setTimeout(() => { const el = document.querySelector(`[data-nid="${n.id}"] .note-in`); if (el) el.focus(); }, 30);
  },
  delNote: async el => {
    const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date); if (!L) return;
    const nid = el.closest('[data-nid]').dataset.nid; const n = (L.notes || []).find(x => x.id === nid);
    if (n && (n.text || '').trim() && !(await confirmBox('刪除紀事', `確定刪除這則紀事？\n「${n.text}」`, '刪除', true))) return;
    L.notes = (L.notes || []).filter(x => x.id !== nid); doc.deleted[nid] = now(); staffTouchLog(L); touchStaff(sid); render({ keepScroll: true });
  },
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
  caseSearch: el => {
    clearTimeout(S._caseT);
    S._caseT = setTimeout(() => {
      const v = el.value;
      S.afterRender = () => { const i = $('#case-s'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } };
      casesGo({ s: v.trim() });
    }, 350);
  },
  sideFilter: el => {
    const v = el.value.trim().toLowerCase();
    $$('.proj-list li[data-q]').forEach(li => { li.hidden = !!v && !li.dataset.q.includes(v); });
  },
  ptText: el => {
    const sid = S.route.parts[1], it = el.closest('.pt-item');
    const { L, tk } = ptFind(sid, it.dataset.date, it.dataset.tid);
    if (tk) { tk.text = el.value; staffTouchLog(L); touchStaff(sid); }
    autosize(el);
  },
  noteText: el => {
    const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date, true);
    const n = (L.notes || []).find(x => x.id === el.closest('[data-nid]').dataset.nid);
    if (n) { n.text = el.value; n.u = now(); staffTouchLog(L); touchStaff(sid); }
    autosize(el);
  },
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
  tlWho: el => tlGo({ who: el.value }),
  caseOwner: el => casesGo({ owner: el.value }),
  ptProj: el => {
    const sid = S.route.parts[1], it = el.closest('.pt-item');
    const { L, tk } = ptFind(sid, it.dataset.date, it.dataset.tid); if (!tk) return;
    tk.pid = el.value; staffTouchLog(L); touchStaff(sid); render({ keepScroll: true });
  },
  ptMs: el => { S.ui.ptMs = el.checked; try { localStorage.setItem('zjpm.ptms', el.checked ? '1' : '0'); } catch (e) {} render({ keepScroll: true }); },
  ptJump: el => { if (isDate(el.value)) go(`#/s/${S.route.parts[1]}/tasks?d=${el.value}`); },
  caseWho: el => casesGo({ who: el.value }),
  caseSt: el => casesGo({ st: el.value === 'active' ? '' : el.value }),
  calNotes: el => { S.ui.showNotes = el.checked; try { localStorage.setItem('zjpm.notes', el.checked ? '1' : '0'); } catch (e) {} render({ keepScroll: true }); },
  attMonth: el => { if (/^\d{4}-\d{2}$/.test(el.value)) go('#/boss/attendance?m=' + el.value); },
  tlClosed: el => tlGo({ closed: el.checked ? '1' : '' }),
  listAll: el => { S.ui.listAll = el.checked; try { localStorage.setItem('zjpm.listAll', el.checked ? '1' : ''); } catch (e) {} render({ keepScroll: true }); },
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
  noteProj: el => {
    const { sid, date, doc } = curLogCtx(); const L = getLog(doc, date, true);
    const n = (L.notes || []).find(x => x.id === el.closest('[data-nid]').dataset.nid); if (!n) return;
    const [osid, pid] = el.value.split('|'); n.sid = osid; n.pid = pid; n.u = now(); S.ui.lastNote = el.value;
    staffTouchLog(L); touchStaff(sid); render({ keepScroll: true });
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
  if (e.key === 'Enter' && !e.shiftKey && el.dataset && el.dataset.key === 'ptKey' && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    const sid = S.route.parts[1], it = el.closest('.pt-item'), date = it.dataset.date;
    const { L } = ptFind(sid, date, it.dataset.tid);
    const idx = L.tasks.findIndex(x => x.id === it.dataset.tid);
    const next = L.tasks[idx + 1];
    if (next && !(next.text || '').trim()) { const n = document.querySelector(`.pt-item[data-tid="${next.id}"] .pt-in`); if (n) n.focus(); return; }
    if (!(el.value || '').trim()) return;
    const tk = { id: uid(), text: '', pid: L.tasks[idx] ? L.tasks[idx].pid || '' : '', status: '', note: '' };
    L.tasks.splice(idx + 1, 0, tk); staffTouchLog(L); touchStaff(sid); ptFocus(tk.id); render({ keepScroll: true });
    return;
  }
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
