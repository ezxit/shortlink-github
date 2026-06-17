// --- config ---
const SUPABASE_URL = localStorage.getItem('sb_url') || 'https://vhifkvzmujbhcdwjixdj.supabase.co';
const SUPABASE_ANON_KEY = localStorage.getItem('sb_anon_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoaWZrdnptdWpiaGNkd2ppeGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0ODgzOTYsImV4cCI6MjA5NzA2NDM5Nn0.nZ7zBk3p_Fh5Q88makO5OmHJFCJ2uG_0inIZ8kmq-zc';
const configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

async function sb(path, method, body) {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (body) headers['Content-Type'] = 'application/json';
  if (method === 'POST') headers['Prefer'] = 'return=representation';
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    let msg;
    try { msg = JSON.parse(text).message || `请求失败 (${res.status})`; }
    catch { msg = `请求失败 (${res.status})`; }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// --- state ---
let namespace = localStorage.getItem('sb_namespace') || 'default';
let files = [];

// --- view counter (localStorage-based link visit tracking) ---
const VIEWS_KEY = 'link_views';

function getViews() {
  try { return JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}'); }
  catch { return {}; }
}
function incrementView(gistId) {
  const v = getViews();
  v[gistId] = (v[gistId] || 0) + 1;
  localStorage.setItem(VIEWS_KEY, JSON.stringify(v));
}
function getViewCount(gistId) {
  return getViews()[gistId] || 0;
}

// --- optimistic cache (bridges eventual-consistency gaps after mutations) ---
const OPTI_CREATES_KEY = 'opti_creates';
const OPTI_DELETES_KEY = 'opti_deletes';
const OPTI_MAX_AGE_MS = 10 * 60 * 1000;

function loadOptiCreates() {
  try { return JSON.parse(sessionStorage.getItem(OPTI_CREATES_KEY) || '[]'); }
  catch { return []; }
}
function saveOptiCreates(items) { sessionStorage.setItem(OPTI_CREATES_KEY, JSON.stringify(items)); }
function loadOptiDeletes() {
  try { return JSON.parse(sessionStorage.getItem(OPTI_DELETES_KEY) || '[]'); }
  catch { return []; }
}
function saveOptiDeletes(ids) { sessionStorage.setItem(OPTI_DELETES_KEY, JSON.stringify(ids)); }

function addOptiCreate(id, desc, date) {
  const items = loadOptiCreates();
  items.unshift({ id, desc, date, ts: Date.now() });
  saveOptiCreates(items);
}
function addOptiDelete(id) {
  const ids = loadOptiDeletes();
  if (!ids.includes(id)) ids.push(id);
  saveOptiDeletes(ids);
}
function cleanOptiState(apiIds) {
  const now = Date.now();
  let creates = loadOptiCreates();
  creates = creates.filter(c => !apiIds.has(c.id) && (now - c.ts) < OPTI_MAX_AGE_MS);
  saveOptiCreates(creates);
  let deletes = loadOptiDeletes();
  deletes = deletes.filter(id => apiIds.has(id));
  saveOptiDeletes(deletes);
}

const THEMES = ['auto', 'midnight', 'daylight', 'sepia', 'ocean', 'cherry'];

function getTheme() {
  const t = localStorage.getItem('theme') || 'auto';
  return t === 'auto' ? resolveAuto() : t;
}

function resolveAuto() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'daylight';
}

function setTheme(name) {
  localStorage.setItem('theme', name);
  applyTheme(name);
}

function applyTheme(name) {
  const effective = name === 'auto' ? resolveAuto() : name;
  document.documentElement.setAttribute('data-theme', effective);
}

// --- helpers ---
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);

// --- SVG icons (Lucide-style, stroke-based) ---
const Icons = {
  link: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  image: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  list: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  settings: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  externalLink: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  arrowLeft: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  folder: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  file: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
  shield: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  key: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
  alert: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  database: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
};

function toast(msg, icon) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  const iconHtml = icon ? `<span style="display:inline-flex;vertical-align:middle;margin-right:6px">${icon}</span>` : '';
  t.innerHTML = iconHtml + esc(msg);
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 3000);
}

// --- image compression ---
function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// --- render ---
function render() {
  const params = new URLSearchParams(location.search);
  const sid = params.get('s');
  const user = params.get('user');
  const page = params.get('page');

  if (page === 'settings') return renderSettings();
  if (!configured) return renderSetup();
  if (sid) return renderView(sid);
  if (user) return renderList(user);
  return renderHome();
}

// -- setup page --
function renderSetup() {
  app.innerHTML = `
    <div class="card setup fade-in">
      <div class="logo">${Icons.link}<span>shortlink</span></div>
      <h2>配置 Supabase</h2>
      <p>去 <a class="link" href="https://app.supabase.com" target="_blank" rel="noopener">Supabase Dashboard ${Icons.externalLink}</a> 创建项目，<br>然后在 SQL Editor 运行 <code>migration.sql</code>，<br>再把 Project URL 和 Anon Key 粘贴到下面。</p>
      <label class="input-label" for="sb-url-input">Project URL</label>
      <input id="sb-url-input" type="text" placeholder="https://xxxxxxxxxxxx.supabase.co" autocomplete="off">
      <label class="input-label spacer-sm" for="sb-key-input">Anon Key</label>
      <input id="sb-key-input" type="password" placeholder="eyJhbGciOiJIUzI1NiIs..." autocomplete="off">
      <label class="input-label spacer-sm" for="sb-ns-input">Namespace（你的用户名，用于管理短链接）</label>
      <input id="sb-ns-input" type="text" placeholder="my-space" autocomplete="off" value="${esc(namespace)}">
      <p class="dim spacer-sm" style="display:flex;align-items:center;gap:6px">${Icons.shield} 配置只存在你浏览器里，不会上传到任何地方。</p>
      <button class="btn btn-primary spacer" id="save-config" style="width:100%">
        ${Icons.key} 保存配置
      </button>
    </div>
  `;
  $('#save-config').onclick = () => {
    const url = $('#sb-url-input').value.trim();
    const key = $('#sb-key-input').value.trim();
    const ns = $('#sb-ns-input').value.trim();
    if (!url || !key) {
      return toast('Project URL 和 Anon Key 不能为空', Icons.alert);
    }
    if (!ns) {
      return toast('Namespace 不能为空', Icons.alert);
    }
    localStorage.setItem('sb_url', url);
    localStorage.setItem('sb_anon_key', key);
    localStorage.setItem('sb_namespace', ns);
    toast('保存成功，重新加载中...', Icons.check);
    setTimeout(() => location.reload(), 500);
  };
}

// -- home page --
function renderHome() {
  app.innerHTML = `
    <div class="logo">${Icons.link}<span>shortlink</span></div>
    <div class="card fade-in">
      <label class="input-label" for="text-input">内容</label>
      <textarea id="text-input" placeholder="写点什么..."></textarea>
      <div class="flex spacer-sm">
        <label class="file-label" for="file-input" tabindex="0" aria-label="添加图片">
          ${Icons.image} 添加图片
        </label>
        <input type="file" id="file-input" accept="image/*" multiple hidden>
        <span class="muted" id="img-count"></span>
      </div>
      <div class="previews" id="previews"></div>
      <button class="btn btn-primary spacer" id="create-btn" style="width:100%">
        ${Icons.link} 创建短链接
      </button>
      <div class="result spacer" id="result">
        <div class="success-text">${Icons.check} 创建成功</div>
        <a class="result-url" id="result-url" href="" target="_blank" rel="noopener"></a>
        <div class="flex spacer-sm">
          <button class="btn-sm" id="copy-btn" aria-label="复制链接">${Icons.copy} 复制</button>
          <button class="btn-sm" id="new-btn">${Icons.plus} 再创建一个</button>
        </div>
      </div>
    </div>
    <div class="bg-actions">
      <button class="btn btn-ghost" id="list-btn">
        ${Icons.list} 我的短链接
      </button>
      <a class="btn btn-ghost" href="?page=settings" style="text-decoration:none" aria-label="设置">
        ${Icons.settings} 设置
      </a>
    </div>
  `;
  files = [];
  renderPreviews();
  bindHomeEvents();
}

function bindHomeEvents() {
  const fi = $('#file-input');
  fi.onchange = () => {
    files.push(...fi.files);
    fi.value = '';
    renderPreviews();
  };

  $('#create-btn').onclick = createShortlink;
  $('#list-btn').onclick = () => {
    location.search = '?user=' + encodeURIComponent(namespace);
  };
}

function renderPreviews() {
  const container = $('#previews');
  if (!container) return;
  container.innerHTML = '';
  const imgCount = $('#img-count');
  if (imgCount) imgCount.textContent = files.length ? `${files.length} 张` : '';

  files.forEach((f, i) => {
    const r = new FileReader();
    r.onload = e => {
      const wrap = document.createElement('div');
      wrap.className = 'wrap';
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('aria-label', `图片 ${i + 1}，点击删除`);
      wrap.innerHTML = `<img src="${e.target.result}" alt="预览图片 ${i + 1}"><button class="del" aria-label="删除图片">&times;</button>`;
      wrap.querySelector('.del').onclick = ev => {
        ev.stopPropagation();
        files.splice(i, 1);
        renderPreviews();
      };
      wrap.onclick = () => {
        files.splice(i, 1);
        renderPreviews();
      };
      container.appendChild(wrap);
    };
    r.readAsDataURL(f);
  });
}

async function createShortlink() {
  const btn = $('#create-btn');
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> 创建中...`;
  $('#result').style.display = 'none';

  try {
    const text = $('#text-input').value.trim();
    if (!text && !files.length) {
      btn.disabled = false;
      btn.innerHTML = origHTML;
      return toast('至少写点文字或传张图片', Icons.alert);
    }
    const images = await Promise.all(files.map(compressImage));

    const preview = text ? text.slice(0, 60).replace(/\n/g, ' ') : (images.length ? `[${images.length} images]` : '');
    const created = new Date().toISOString();

    const rows = await sb('shortlinks', 'POST', {
      text,
      images,
      description: preview,
      namespace,
      created,
      created_at: created
    });

    if (!rows) throw new Error('创建失败');

    addOptiCreate(rows[0].id, preview, created);

    const url = `${location.origin}${location.pathname}?s=${rows[0].id}`;
    $('#result-url').href = url;
    $('#result-url').textContent = url;
    $('#result').style.display = 'block';
    $('#text-input').value = '';
    files = [];
    renderPreviews();

    $('#copy-btn').onclick = () => { navigator.clipboard.writeText(url); toast('已复制', Icons.check); };
    $('#new-btn').onclick = () => { $('#result').style.display = 'none'; };
  } catch (err) {
    toast(err.message, Icons.alert);
    console.error(err);
  }
  btn.disabled = false;
  btn.innerHTML = origHTML;
}

// -- view page --
function skeletonView() {
  return `
    <div class="card fade-in">
      <div class="skeleton skeleton-text" style="width:50%;height:14px"></div>
      <div class="skeleton skeleton-text" style="width:30%;height:14px;margin-bottom:16px"></div>
      <div class="skeleton skeleton-block"></div>
    </div>
  `;
}

async function renderView(linkId) {
  app.innerHTML = skeletonView();

  try {
    const rows = await sb(`shortlinks?id=eq.${encodeURIComponent(linkId)}&limit=1`, 'GET');
    const data = rows?.[0];

    if (!data) {
      return (app.innerHTML = `
        <div class="card fade-in">
          <div class="empty-state">
            ${Icons.file}
            <p>内容不存在</p>
            <a class="btn btn-secondary" href=".">${Icons.arrowLeft} 返回</a>
          </div>
        </div>`);
    }

    incrementView(linkId);
    const date = data.created ? data.created.slice(0, 16).replace('T', ' ') : '';
    let editFiles = [];

    function renderViewMode() {
      let html = `
        <div class="card fade-in">
        <div class="view-meta">
          ${Icons.link}
          <span>s/</span><span class="gist-id">${esc(linkId)}</span>
          <span>&middot;</span>
          <span>${esc(date)}</span>
        </div>
      `;

      if (data.text) html += `<div class="view-text">${esc(data.text)}</div>`;
      if (data.images?.length) {
        html += `<div class="view-images">`;
        data.images.forEach((img, i) => {
          html += `<a href="${img}" target="_blank" rel="noopener" aria-label="查看原图 ${i + 1}"><img src="${img}" alt="图片 ${i + 1}" loading="lazy"></a>`;
        });
        html += `</div>`;
      }
      if (!data.text && !data.images?.length) {
        html += `<div class="empty-state"><p class="muted">没有内容</p></div>`;
      }

      html += `<div class="spacer view-actions">`;
      html += `<a class="btn btn-secondary btn-sm" href=".">${Icons.arrowLeft} 创建新的</a>`;
      html += `<button class="btn btn-ghost btn-sm" id="edit-btn">${Icons.settings} 编辑</button>`;
      html += `<button class="btn btn-danger btn-sm" id="delete-link" aria-label="删除此短链接">${Icons.trash} 删除</button>`;
      html += `</div></div>`;
      app.innerHTML = html;
      bindViewActions();
    }

    function renderEditMode() {
      editFiles = [];
      let html = `
        <div class="card fade-in">
        <div class="view-meta">
          ${Icons.settings}
          <span>编辑</span>
          <span>&middot;</span>
          <span class="gist-id">s/${esc(linkId).slice(0, 8)}</span>
        </div>
        <label class="input-label" for="edit-text">文字内容</label>
        <textarea id="edit-text" placeholder="写点什么...">${esc(data.text || '')}</textarea>
        <div class="flex spacer-sm">
          <label class="file-label" for="edit-file-input" tabindex="0" aria-label="添加新图片">
            ${Icons.image} 添加图片
          </label>
          <input type="file" id="edit-file-input" accept="image/*" multiple hidden>
          <span class="muted" id="edit-img-count"></span>
        </div>
        <div class="previews" id="edit-previews"></div>
      `;

      if (data.images?.length) {
        html += `<p class="dim spacer-sm">已有图片（点击删除）</p>`;
        html += `<div class="previews" id="existing-previews">`;
        data.images.forEach((img, i) => {
          html += `
            <div class="wrap edit-wrap" tabindex="0" data-idx="${i}" aria-label="删除已有图片 ${i + 1}">
              <img src="${img}" alt="已有图片 ${i + 1}">
              <button class="del" aria-label="删除图片">&times;</button>
            </div>`;
        });
        html += `</div>`;
      }

      html += `<div class="flex spacer" style="gap:8px">`;
      html += `<button class="btn btn-primary btn-sm" id="save-edit-btn">${Icons.check} 保存修改</button>`;
      html += `<button class="btn btn-secondary btn-sm" id="cancel-edit-btn">取消</button>`;
      html += `</div></div>`;
      app.innerHTML = html;
      bindEditActions();
    }

    function renderEditPreviews() {
      const c = $('#edit-previews');
      if (!c) return;
      c.innerHTML = '';
      const count = $('#edit-img-count');
      if (count) count.textContent = editFiles.length ? `${editFiles.length} 张新图片` : '';
      editFiles.forEach((f, i) => {
        const r = new FileReader();
        r.onload = e => {
          const wrap = document.createElement('div');
          wrap.className = 'wrap';
          wrap.setAttribute('tabindex', '0');
          wrap.setAttribute('aria-label', `新图片 ${i + 1}，点击删除`);
          wrap.innerHTML = `<img src="${e.target.result}" alt="新图片 ${i + 1}"><button class="del" aria-label="删除图片">&times;</button>`;
          wrap.querySelector('.del').onclick = ev => { ev.stopPropagation(); editFiles.splice(i, 1); renderEditPreviews(); };
          wrap.onclick = () => { editFiles.splice(i, 1); renderEditPreviews(); };
          c.appendChild(wrap);
        };
        r.readAsDataURL(f);
      });
    }

    function bindEditActions() {
      const efi = $('#edit-file-input');
      if (efi) {
        efi.onchange = () => {
          editFiles.push(...efi.files);
          efi.value = '';
          renderEditPreviews();
        };
      }

      $$('#existing-previews .edit-wrap').forEach(wrap => {
        wrap.onclick = () => {
          const idx = parseInt(wrap.dataset.idx);
          data.images.splice(idx, 1);
          renderEditMode();
        };
      });

      $('#save-edit-btn').onclick = async () => {
        const btn = $('#save-edit-btn');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> 保存中...`;

        try {
          const textVal = $('#edit-text').value.trim();
          if (!textVal && !data.images?.length && !editFiles.length) {
            btn.disabled = false;
            btn.innerHTML = `${Icons.check} 保存修改`;
            return toast('至少需要文字或图片', Icons.alert);
          }

          const newImages = editFiles.length ? await Promise.all(editFiles.map(compressImage)) : [];
          const newText = textVal;
          const newImagesArr = newImages.length ? [...(data.images || []), ...newImages] : (data.images || []);

          const desc = newText ? newText.slice(0, 60).replace(/\n/g, ' ') : (newImagesArr.length ? `[${newImagesArr.length} images]` : '');

          await sb(`shortlinks?id=eq.${encodeURIComponent(linkId)}`, 'PATCH', { text: newText, images: newImagesArr, description: desc });

          toast('已保存', Icons.check);
          renderViewMode();
        } catch (err) {
          toast(err.message, Icons.alert);
        }
        btn.disabled = false;
        btn.innerHTML = `${Icons.check} 保存修改`;
      };

      $('#cancel-edit-btn').onclick = () => renderViewMode();
    }

    function bindViewActions() {
      $('#edit-btn').onclick = () => renderEditMode();
      const del = $('#delete-link');
      if (del) {
        let deleteConfirming = false;
        del.onclick = async e => {
          e.preventDefault();
          if (!deleteConfirming) {
            deleteConfirming = true;
            del.classList.add('btn-danger-solid');
            del.innerHTML = `${Icons.alert} 确认删除`;
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-ghost btn-sm';
            cancelBtn.id = 'delete-cancel-btn';
            cancelBtn.innerHTML = '取消';
            cancelBtn.onclick = ev => {
              ev.preventDefault();
              ev.stopPropagation();
              deleteConfirming = false;
              del.classList.remove('btn-danger-solid');
              del.innerHTML = `${Icons.trash} 删除`;
              cancelBtn.remove();
            };
            del.parentNode.insertBefore(cancelBtn, del.nextSibling);
            return;
          }
          try {
            await sb(`shortlinks?id=eq.${encodeURIComponent(linkId)}`, 'DELETE');

            addOptiDelete(linkId);
            app.innerHTML = `
              <div class="card fade-in">
                <div class="empty-state">
                  ${Icons.check}
                  <p style="font-weight:600;color:var(--color-text)">已删除</p>
                  <p class="muted">s/${esc(linkId).slice(0, 12)} 已被永久删除</p>
                  <div class="flex" style="justify-content:center;flex-wrap:wrap">
                    <a class="btn btn-secondary btn-sm" href=".">${Icons.arrowLeft} 创建新的</a>
                    <button class="btn btn-ghost btn-sm" id="goto-list-btn">${Icons.list} 我的短链接</button>
                  </div>
                </div>
              </div>
            `;
            $('#goto-list-btn').onclick = () => {
              location.search = '?user=' + encodeURIComponent(namespace);
            };
          } catch (err) { toast(err.message, Icons.alert); }
        };
      }
    }

    renderViewMode();
  } catch (err) {
    app.innerHTML = `
      <div class="card fade-in">
        <div class="empty-state">
          ${Icons.alert}
          <p>${esc(err.message)}</p>
          <a class="btn btn-secondary" href=".">${Icons.arrowLeft} 返回</a>
        </div>
      </div>`;
  }
}

// -- list page --
function skeletonList() {
  return `
    <div class="card fade-in" style="padding-top:20px">
      ${Array.from({length: 5}, () => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--color-border)">
          <div class="skeleton" style="width:80px;height:12px;border-radius:4px"></div>
          <div class="skeleton" style="flex:1;height:12px;border-radius:4px"></div>
          <div class="skeleton" style="width:48px;height:12px;border-radius:4px"></div>
        </div>
      `).join('')}
    </div>
  `;
}

async function renderList(ns) {
  app.innerHTML = `
    <div class="logo">${Icons.link}<span>${esc(ns)} 的短链接</span></div>
    ${skeletonList()}
  `;

  try {
    const PER_PAGE = 20;
    let allApiItems = [];
    let allApiIds = new Set();
    let currentPage = 0;
    let hasMore = true;
    let merged = [];

    let selected = new Set();
    let batchConfirming = false;

    const searchIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

    function rebuildMerged() {
      const optiDeletes = new Set(loadOptiDeletes());
      const optiCreates = loadOptiCreates().filter(c => !allApiIds.has(c.id));
      merged = [...optiCreates.map(c => ({ id: c.id, desc: c.desc, date: c.date.slice(0, 10) })),
                ...allApiItems.filter(d => !optiDeletes.has(d.id))];
      cleanOptiState(allApiIds);
    }

    function renderListItems(filterText) {
      const q = (filterText || '').toLowerCase();
      const filtered = q ? merged.filter(d => d.desc.toLowerCase().includes(q)) : merged;
      if (!filtered.length) {
        return `<div class="empty-state" style="padding:24px 4px"><p>没有匹配 "${esc(q)}" 的短链接</p></div>`;
      }
      let h = `<ul class="shortlist">`;
      filtered.forEach(g => {
        const preview = g.desc || '(空)';
        const vc = getViewCount(g.id);
        const vBadge = vc ? `<span class="view-badge" title="访问 ${vc} 次">👁 ${vc}</span>` : '';
        h += `
          <li>
            <label class="list-check" data-id="${esc(g.id)}">
              <input type="checkbox" data-id="${esc(g.id)}" ${selected.has(g.id) ? 'checked' : ''}>
              <span class="checkmark"></span>
            </label>
            <span class="code">${esc(g.id).slice(0, 8)}</span>
            <div class="shortlist-info">
              <span class="preview-text">${esc(preview)}</span>
              <span class="date">${vBadge}${esc(g.date)}</span>
            </div>
            <a class="btn-sm" href="?s=${esc(g.id)}" style="text-decoration:none;flex-shrink:0">查看 ${Icons.externalLink}</a>
          </li>`;
      });
      h += `</ul>`;
      h += `<p class="dim spacer-sm">${filtered.length} / ${merged.length} 条</p>`;
      return h;
    }

    function updateBatchBar() {
      const bar = $('#batch-bar');
      if (!bar) return;
      const delBtn = $('#batch-delete-btn');
      const confBtn = $('#batch-confirm-btn');
      const cancBtn = $('#batch-cancel-btn');
      const count = $('#batch-count');
      if (batchConfirming && selected.size) {
        bar.style.display = 'flex';
        count.textContent = `确认删除 ${selected.size} 项？`;
        delBtn.style.display = 'none';
        confBtn.style.display = '';
        cancBtn.style.display = '';
      } else if (selected.size) {
        bar.style.display = 'flex';
        count.textContent = `已选 ${selected.size} 项`;
        delBtn.style.display = '';
        confBtn.style.display = 'none';
        cancBtn.style.display = 'none';
      } else {
        bar.style.display = 'none';
        batchConfirming = false;
      }
    }

    function buildHtml() {
      let html = `
        <div class="logo">${Icons.link}<span>${esc(ns)} 的短链接</span></div>
        <div class="card fade-in">
          <div class="search-bar">
            ${searchIcon}
            <input type="search" id="list-search" class="search-input" placeholder="搜索 ${merged.length} 条短链接..." autocomplete="off">
          </div>
          <div class="batch-bar" id="batch-bar" style="display:none">
            <span class="batch-count" id="batch-count"></span>
            <button class="btn-sm" id="batch-delete-btn" style="color:var(--color-danger)">${Icons.trash} 批量删除</button>
            <button class="btn-sm btn-danger-solid" id="batch-confirm-btn" style="display:none">确认删除</button>
            <button class="btn-sm" id="batch-cancel-btn" style="display:none">取消</button>
          </div>
          <div id="list-items">${renderListItems('')}</div>
          ${hasMore ? `<div class="spacer" style="text-align:center"><button class="btn btn-secondary" id="load-more-btn" style="width:100%">加载更多 (${merged.length} / ?)</button></div>` : `<p class="dim spacer" style="text-align:center">共 ${merged.length} 条</p>`}
        </div>
        <div class="spacer"><a class="link" href=".">${Icons.arrowLeft} 创建新的</a></div>`;
      return html;
    }

    function bindEvents() {
      updateBatchBar();

      $('#list-items').addEventListener('change', e => {
        if (e.target.type === 'checkbox' && e.target.dataset.id) {
          if (e.target.checked) selected.add(e.target.dataset.id);
          else selected.delete(e.target.dataset.id);
          updateBatchBar();
        }
      });

      $('#batch-delete-btn').onclick = () => { batchConfirming = true; updateBatchBar(); };
      $('#batch-cancel-btn').onclick = () => { batchConfirming = false; updateBatchBar(); };

      $('#batch-confirm-btn').onclick = async () => {
        const ids = [...selected];
        const total = ids.length;
        let deleted = 0;
        for (const id of ids) {
          try {
            await sb(`shortlinks?id=eq.${encodeURIComponent(id)}`, 'DELETE');
            addOptiDelete(id);
            deleted++;
          } catch (err) {
            toast(`删除 ${id.slice(0, 8)} 失败`, Icons.alert);
          }
        }
        if (deleted) toast(`已删除 ${deleted} / ${total} 项`, Icons.check);
        selected.clear();
        batchConfirming = false;
        renderList(ns);
      };

      $('#list-search').oninput = function() {
        $('#list-items').innerHTML = renderListItems(this.value);
      };

      const loadMore = $('#load-more-btn');
      if (loadMore) loadMore.onclick = () => loadNextPage();
    }

    async function loadNextPage() {
      const btn = $('#load-more-btn');
      if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> 加载中...`; }

      currentPage++;
      const from = (currentPage - 1) * PER_PAGE;
      const to = from + PER_PAGE - 1;

      const items = await sb(`shortlinks?select=*&namespace=eq.${encodeURIComponent(ns)}&order=created_at.desc&limit=${PER_PAGE}&offset=${from}`, 'GET');

      hasMore = (items || []).length === PER_PAGE;

      for (const item of (items || [])) {
        allApiIds.add(item.id);
        allApiItems.push({
          id: item.id,
          desc: item.description || '',
          date: item.created_at ? item.created_at.slice(0, 10) : ''
        });
      }
      rebuildMerged();

      if (!merged.length && currentPage === 1) {
        app.innerHTML = `
          <div class="logo">${Icons.link}<span>${esc(ns)} 的短链接</span></div>
          <div class="card fade-in">
            <div class="empty-state">
              ${Icons.folder}
              <p>还没有创建过短链接</p>
              <a class="btn btn-secondary" href=".">${Icons.arrowLeft} 创建新的</a>
            </div>
          </div>`;
        return;
      }

      app.innerHTML = buildHtml();
      bindEvents();
    }

    await loadNextPage();
  } catch (err) {
    app.innerHTML = `
      <div class="card fade-in">
        <div class="empty-state">
          ${Icons.alert}
          <p>${esc(err.message)}</p>
          <a class="btn btn-secondary" href=".">${Icons.arrowLeft} 返回</a>
        </div>
      </div>`;
  }
}

// -- settings page --
const THEME_PREVIEWS = {
  auto:     { dots: ['#0F172A','#F8FAFC','#22C55E'], label: '自动' },
  midnight: { dots: ['#0F172A','#1E293B','#22C55E'], label: '暗夜' },
  daylight: { dots: ['#F8FAFC','#E2E8F0','#16A34A'], label: '日光' },
  sepia:    { dots: ['#FDF6E3','#E6D5B8','#2E7D32'], label: '暖纸' },
  ocean:    { dots: ['#0B192C','#1E3A5F','#06B6D4'], label: '海洋' },
  cherry:   { dots: ['#1A0F14','#452632','#F472B6'], label: '樱桃' },
};

function renderSettings() {
  const current = getTheme();

  app.innerHTML = `
    <div class="logo">${Icons.settings}<span>设置</span></div>
    <div class="card fade-in">

      <div class="settings-section">
        <h3>主题</h3>
        <div class="theme-grid" id="theme-grid">
          ${THEMES.map(t => `
            <button class="theme-card ${t === current ? 'active' : ''}" data-theme="${t}" aria-label="${THEME_PREVIEWS[t].label} 主题" aria-pressed="${t === current}">
              <div class="dot-group">
                ${THEME_PREVIEWS[t].dots.map(c => `<span class="dot" style="background:${c}"></span>`).join('')}
              </div>
              <span class="swatch-name">${THEME_PREVIEWS[t].label}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <hr class="divider">

      <div class="settings-section">
        <h3>数据</h3>
        <button class="btn-sm" id="clear-data-btn" style="color:var(--color-danger)">
          ${Icons.alert} 清除全部本地数据
        </button>
      </div>

      <hr class="divider">

      <div class="settings-section">
        <h3>关于</h3>
        <p class="muted">shortlink — 轻量短链接工具</p>
      </div>

    </div>

    <div class="settings-back">
      <a class="btn btn-secondary" href=".">${Icons.arrowLeft} 返回首页</a>
    </div>
  `;

  // theme switch
  $$('.theme-card').forEach(card => {
    card.onclick = () => {
      const t = card.dataset.theme;
      setTheme(t);
      renderSettings();
    };
  });

  // clear all data
  $('#clear-data-btn').onclick = () => {
    const btn = $('#clear-data-btn');
    if (btn._confirming) {
      localStorage.clear();
      location.reload();
      return;
    }
    btn._confirming = true;
    btn.classList.add('btn-danger-solid');
    btn.innerHTML = `${Icons.alert} 确认清除`;
    const cancel = document.createElement('button');
    cancel.className = 'btn-sm';
    cancel.id = 'clear-data-cancel';
    cancel.innerHTML = '取消';
    cancel.onclick = ev => {
      ev.stopPropagation();
      btn._confirming = false;
      btn.classList.remove('btn-danger-solid');
      btn.innerHTML = `${Icons.alert} 清除全部本地数据`;
      cancel.remove();
    };
    btn.parentNode.insertBefore(cancel, btn.nextSibling);
  };
}

function maskToken(t) {
  if (t.length <= 8) return t;
  return t.slice(0, 4) + '…'.repeat(8) + t.slice(-4);
}

// --- init ---
applyTheme(getTheme());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getTheme() === 'auto') applyTheme('auto');
});
render();

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const result = $('#result');
  if (result && result.style.display !== 'none') {
    result.style.display = 'none';
    return;
  }
  const cancelBtn = $('#cancel-edit-btn');
  if (cancelBtn) {
    cancelBtn.click();
    return;
  }
});
