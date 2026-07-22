/* =========================================================
   Сора — лисьи архивы. Весь сайт собирается из data/*.json
   ========================================================= */

const PALETTES = ['foxfire', 'moonlit', 'momiji', 'washi'];
const app = document.getElementById('app');
let DATA = { site: {}, bots: { lines: [], items: [] }, themes: { items: [] }, ext: { items: [] } };
let filter = { line: 'all', q: '', nsfw: true };

/* ------------------------- утилиты ------------------------- */
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Обложка-заглушка, пока картинка не залита: градиент из имени + первая буква. */
function cover(src, name, cls = '') {
  if (src) return `<img src="${esc(src)}" alt="${esc(name)}" loading="lazy" class="${cls}">`;
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return `<div class="ph ${cls}" style="background:
      radial-gradient(120% 90% at 30% 15%, hsl(${h} 45% 26% / .85), transparent 60%),
      linear-gradient(160deg, hsl(${(h + 40) % 360} 30% 14%), hsl(${h} 25% 8%))">
      <span>${esc(String(name).trim()[0] || '?')}</span></div>`;
}

const plural = (n, a, b, c) => {
  const m = n % 100, k = n % 10;
  return m > 4 && m < 21 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c;
};

const dateRu = iso => iso
  ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  : '';

/* ------------------------- палитра ------------------------- */
function setPalette(name) {
  document.documentElement.dataset.palette = name;
  try { localStorage.setItem('sora-palette', name); } catch {}
}
document.getElementById('paletteBtn').onclick = () => {
  const i = PALETTES.indexOf(document.documentElement.dataset.palette || 'foxfire');
  setPalette(PALETTES[(i + 1) % PALETTES.length]);
};
try { setPalette(localStorage.getItem('sora-palette') || 'foxfire'); } catch { setPalette('foxfire'); }

/* ------------------------- искры --------------------------- */
(function embers() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.getElementById('embers');
  for (let i = 0; i < 26; i++) {
    const e = document.createElement('i');
    e.className = 'ember';
    e.style.left = Math.random() * 100 + 'vw';
    e.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
    e.style.animationDuration = (14 + Math.random() * 16) + 's';
    e.style.animationDelay = (-Math.random() * 25) + 's';
    e.style.opacity = .3 + Math.random() * .6;
    box.appendChild(e);
  }
})();

/* ------------------------- меню ---------------------------- */
const nav = document.getElementById('nav');
document.getElementById('burger').onclick = () => nav.classList.toggle('is-open');
nav.addEventListener('click', e => { if (e.target.tagName === 'A') nav.classList.remove('is-open'); });

/* ------------------------- модалка ------------------------- */
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
function openModal(html) {
  modalBody.innerHTML = html;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
  if (location.hash.split('/').length > 2) history.replaceState(null, '', '#/' + location.hash.split('/')[1]);
}
modal.addEventListener('click', e => { if (e.target.dataset.close !== undefined) closeModal(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

/* ------------------------- блоки --------------------------- */
function botCard(b) {
  const line = DATA.bots.lines.find(l => l.id === b.line);
  return `<article class="card" data-bot="${esc(b.id)}">
    ${b.nsfw ? '<span class="badge">18+</span>' : ''}
    <div class="card__cover">${cover(b.cover, b.name)}</div>
    <div class="card__body">
      <h3>${esc(b.name)}</h3>
      <p class="card__meta">${esc(b.tagline || (line ? line.title : ''))}</p>
      <div class="card__tags">${(b.tags || []).slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    </div>
  </article>`;
}

function themeCard(t) {
  return `<article class="theme">
    <div class="theme__shot">${cover(t.shot, t.name)}</div>
    <div class="theme__body">
      <h3>${esc(t.name)}</h3>
      <p>${esc(t.tagline)}</p>
      <div class="swatches">${(t.swatches || []).map(c => `<i class="sw" style="background:${esc(c)}" title="${esc(c)}"></i>`).join('')}</div>
      <div class="row">
        <button class="btn btn--acc" data-theme="${esc(t.id)}">Подробнее</button>
        ${t.files && t.files.json ? `<a class="btn" href="${esc(t.files.json)}" download>Скачать JSON</a>` : ''}
      </div>
    </div>
  </article>`;
}

function extCard(x) {
  return `<article class="ext">
    <h3>${esc(x.name)}</h3>
    <p>${esc(x.tagline)}</p>
    <ul>${(x.features || []).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    <div class="install"><code>${esc(x.install)}</code><button class="copy" data-copy="${esc(x.install)}">копировать</button></div>
    <div class="row">
      ${x.repo ? `<a class="btn btn--acc" href="${esc(x.repo)}" target="_blank" rel="noopener">Репозиторий</a>` : ''}
    </div>
    ${x.howto ? `<p class="ext__howto">${esc(x.howto)}</p>` : ''}
  </article>`;
}

function toolbar() {
  const lines = DATA.bots.lines;
  return `<div class="toolbar">
    <label class="search">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="q" type="search" placeholder="Искать по имени, тегу, описанию…" value="${esc(filter.q)}">
    </label>
    <div class="chips">
      <button class="chip ${filter.line === 'all' ? 'is-on' : ''}" data-line="all">Все</button>
      ${lines.map(l => `<button class="chip ${filter.line === l.id ? 'is-on' : ''}" data-line="${esc(l.id)}">${esc(l.title)}</button>`).join('')}
      <button class="chip ${filter.nsfw ? '' : 'is-on'}" data-nsfw="1">${filter.nsfw ? 'Скрыть 18+' : 'Показаны без 18+'}</button>
    </div>
  </div>`;
}

function filtered() {
  const q = filter.q.trim().toLowerCase();
  return DATA.bots.items.filter(b => {
    if (filter.line !== 'all' && b.line !== filter.line) return false;
    if (!filter.nsfw && b.nsfw) return false;
    if (!q) return true;
    return [b.name, b.tagline, b.description, ...(b.tags || [])].join(' ').toLowerCase().includes(q);
  });
}

/* ------------------------- страницы ------------------------ */
function pageHome() {
  const s = DATA.site, b = DATA.bots.items, t = DATA.themes.items, x = DATA.ext.items;
  const featured = b.filter(i => i.featured).slice(0, 5);
  return `
  <section class="hero"><div class="wrap"><div class="hero__in">
    <div class="portrait">
      ${cover(s.portrait, 'Сора')}
      <span class="portrait__tag">九尾 · kitsune</span>
    </div>
    <div>
      <span class="kicker">архив кицунэ</span>
      <h1>${esc(s.nick || 'Сора')}<em>.</em></h1>
      <p class="hero__sub">${esc(s.tagline || '')}</p>
      <div class="hero__cta">
        <a class="btn btn--acc" href="#/bots">Смотреть ботов</a>
        <a class="btn" href="#/themes">Темы оформления</a>
        <a class="btn" href="#/ext">Расширения</a>
      </div>
      <div class="stats">
        <div class="stat"><b>${b.length}</b><span>${plural(b.length, 'персонаж', 'персонажа', 'персонажей')}</span></div>
        <div class="stat"><b>${DATA.bots.lines.length}</b><span>${plural(DATA.bots.lines.length, 'линейка', 'линейки', 'линеек')}</span></div>
        <div class="stat"><b>${t.length}</b><span>${plural(t.length, 'тема', 'темы', 'тем')}</span></div>
        <div class="stat"><b>${x.length}</b><span>${plural(x.length, 'расширение', 'расширения', 'расширений')}</span></div>
      </div>
    </div>
  </div></div></section>

  <section class="section"><div class="wrap">
    <div class="section__head">
      <div><span class="kicker">миры</span><h2>Линейки</h2>
      <p>Персонажи из одной линейки живут в общем мире и знают друг друга.</p></div>
    </div>
    <div class="lines">${DATA.bots.lines.map(l => {
      const n = b.filter(i => i.line === l.id).length;
      return `<article class="line" data-line-go="${esc(l.id)}">
        ${l.cover ? `<img class="line__bg" src="${esc(l.cover)}" alt="" loading="lazy">` : ''}
        <span class="line__n">${n} ${plural(n, 'карточка', 'карточки', 'карточек')}</span>
        <h3>${esc(l.title)}</h3><p>${esc(l.sub)}</p>
      </article>`;
    }).join('')}</div>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="section__head">
      <div><span class="kicker">свежее</span><h2>Избранные карточки</h2></div>
      <a class="btn" href="#/bots">Все боты →</a>
    </div>
    <div class="grid">${featured.map(botCard).join('')}</div>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="section__head">
      <div><span class="kicker">оформление</span><h2>Темы</h2>
      <p>Готовые темы для SillyTavern — ставятся одним JSON.</p></div>
      <a class="btn" href="#/themes">Все темы →</a>
    </div>
    <div class="themes">${t.slice(0, 3).map(themeCard).join('')}</div>
  </div></section>`;
}

function pageBots() {
  const list = filtered();
  return `<section class="section"><div class="wrap">
    <div class="section__head"><div><span class="kicker">карточки персонажей</span><h2>Боты</h2>
      <p>Нажми на карточку, чтобы увидеть описание, приветствие и ссылку на скачивание.</p></div></div>
    ${toolbar()}
    ${list.length
      ? `<div class="grid">${list.map(botCard).join('')}</div>`
      : `<p class="empty">Ничего не нашлось. Попробуй другой запрос.</p>`}
  </div></section>`;
}

function pageThemes() {
  return `<section class="section"><div class="wrap">
    <div class="section__head"><div><span class="kicker">оформление</span><h2>Темы</h2>
      <p>Скачай JSON → в SillyTavern: <b>User Settings → Themes → Import</b>.</p></div></div>
    <div class="themes">${DATA.themes.items.map(themeCard).join('')}</div>
  </div></section>`;
}

function pageExt() {
  return `<section class="section"><div class="wrap">
    <div class="section__head"><div><span class="kicker">код</span><h2>Расширения</h2>
      <p>Ставятся через <b>Extensions → Install extension</b> по ссылке на репозиторий.</p></div></div>
    <div class="exts">${DATA.ext.items.map(extCard).join('')}</div>
  </div></section>`;
}

function pageAbout() {
  const s = DATA.site;
  return `<section class="section"><div class="wrap"><div class="about">
    <div class="portrait">${cover(s.portrait, 'Сора')}<span class="portrait__tag">九尾 · kitsune</span></div>
    <div class="prose">
      <span class="kicker">кто это вообще</span>
      <h2 style="font-size:clamp(32px,5vw,52px);margin-bottom:14px">${esc(s.nick || 'Сора')}</h2>
      ${(s.about || []).map(p => `<p>${esc(p)}</p>`).join('')}
      <div class="links">${(s.links || []).map(l => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</div>
    </div>
  </div></div></section>`;
}

function botSheet(b) {
  const line = DATA.bots.lines.find(l => l.id === b.line);
  return `<div class="sheet">
    <div><div class="sheet__cover">${cover(b.cover, b.name)}</div></div>
    <div>
      <span class="kicker">${esc(line ? line.title : 'вне линеек')}</span>
      <h2>${esc(b.name)}</h2>
      <p class="sheet__meta">${esc(b.tagline || '')}</p>
      <div class="card__tags">${(b.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}${b.nsfw ? '<span class="tag" style="color:var(--acc);border-color:rgba(var(--glow),.5)">18+</span>' : ''}</div>
      <p class="sheet__desc">${esc(b.description || '')}</p>
      ${b.greeting ? `<blockquote class="quote">${esc(b.greeting)}</blockquote>` : ''}
      <dl class="dl">
        ${b.tokens ? `<dt>Объём</dt><dd>~${b.tokens} токенов</dd>` : ''}
        ${b.updated ? `<dt>Обновлён</dt><dd>${esc(dateRu(b.updated))}</dd>` : ''}
      </dl>
      <div class="row">
        ${b.files && b.files.card
          ? `<a class="btn btn--acc" href="${esc(b.files.card)}" download>Скачать карточку PNG</a>`
          : `<span class="btn" style="opacity:.55;cursor:default">Файл ещё не залит</span>`}
        ${b.files && b.files.lorebook ? `<a class="btn" href="${esc(b.files.lorebook)}" download>Лорбук</a>` : ''}
      </div>
    </div>
  </div>`;
}

function themeSheet(t) {
  return `<div class="sheet">
    <div><div class="sheet__cover" style="aspect-ratio:9/16">${cover(t.shot, t.name)}</div></div>
    <div>
      <span class="kicker">${esc(t.platform || 'тема')}</span>
      <h2>${esc(t.name)}</h2>
      <p class="sheet__meta">${esc(t.tagline)}</p>
      <p class="sheet__desc">${esc(t.description || '')}</p>
      <div class="swatches">${(t.swatches || []).map(c => `<i class="sw" style="background:${esc(c)}"></i>`).join('')}</div>
      <div class="card__tags">${(t.palettes || []).map(p => `<span class="tag">${esc(p)}</span>`).join('')}</div>
      <div class="row" style="margin-top:18px">
        ${t.files && t.files.json
          ? `<a class="btn btn--acc" href="${esc(t.files.json)}" download>Скачать JSON</a>`
          : `<span class="btn" style="opacity:.55;cursor:default">Файл ещё не залит</span>`}
        ${t.files && t.files.readme ? `<a class="btn" href="${esc(t.files.readme)}" target="_blank" rel="noopener">Как поставить</a>` : ''}
      </div>
    </div>
  </div>`;
}

/* ------------------------- роутер -------------------------- */
const ROUTES = { home: pageHome, bots: pageBots, themes: pageThemes, ext: pageExt, about: pageAbout };

function render() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const route = ROUTES[parts[0]] ? parts[0] : 'home';

  app.innerHTML = ROUTES[route]();
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('is-active', a.dataset.route === route));
  scrollTo({ top: 0, behavior: parts[1] ? 'auto' : 'smooth' });

  // детальная карточка открывается поверх списка: #/bots/mori
  if (parts[1]) {
    const b = DATA.bots.items.find(i => i.id === parts[1]);
    const t = DATA.themes.items.find(i => i.id === parts[1]);
    if (b) openModal(botSheet(b));
    else if (t) openModal(themeSheet(t));
  } else if (!modal.hidden) {
    modal.hidden = true;
    document.body.style.overflow = '';
  }
}

/* ------------------------- события ------------------------- */
app.addEventListener('click', e => {
  const botEl = e.target.closest('[data-bot]');
  if (botEl) { location.hash = '#/bots/' + botEl.dataset.bot; return; }

  const themeEl = e.target.closest('[data-theme]');
  if (themeEl) { location.hash = '#/themes/' + themeEl.dataset.theme; return; }

  const lineGo = e.target.closest('[data-line-go]');
  if (lineGo) { filter.line = lineGo.dataset.lineGo; location.hash = '#/bots'; return; }

  const chip = e.target.closest('[data-line]');
  if (chip) { filter.line = chip.dataset.line; render(); return; }

  const nsfwBtn = e.target.closest('[data-nsfw]');
  if (nsfwBtn) { filter.nsfw = !filter.nsfw; render(); return; }

  const copyBtn = e.target.closest('[data-copy]');
  if (copyBtn) {
    navigator.clipboard.writeText(copyBtn.dataset.copy).then(() => {
      copyBtn.textContent = 'скопировано';
      setTimeout(() => (copyBtn.textContent = 'копировать'), 1600);
    });
  }
});

app.addEventListener('input', e => {
  if (e.target.id !== 'q') return;
  filter.q = e.target.value;
  const list = filtered();
  const grid = app.querySelector('.grid');
  if (grid) grid.innerHTML = list.length ? list.map(botCard).join('') : '';
});

addEventListener('hashchange', render);

/* ------------------------- загрузка ------------------------ */
const json = p => fetch(p).then(r => { if (!r.ok) throw new Error(p); return r.json(); });

Promise.all([json('data/site.json'), json('data/bots.json'), json('data/themes.json'), json('data/extensions.json')])
  .then(([site, bots, themes, ext]) => {
    DATA = { site, bots, themes, ext };
    document.getElementById('year').textContent = new Date().getFullYear();
    document.getElementById('footerLinks').innerHTML =
      (site.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('');
    render();
  })
  .catch(err => {
    app.innerHTML = `<section class="section"><div class="wrap"><p class="empty">
      Не получилось загрузить <code>data/*.json</code> (${esc(err.message)}).<br>
      Сайт нужно открывать через сервер или GitHub Pages, а не двойным кликом по файлу.</p></div></section>`;
  });
