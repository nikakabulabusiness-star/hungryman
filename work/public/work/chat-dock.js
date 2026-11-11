/* Shared by the public homepage and the signed-in workspace. No chat content is
   mounted until the server confirms staff access; every iframe API enforces it too. */
(() => {
  if (location.pathname.replace(/\/$/, '') === '/chat/embed' || window.__hmChatDockLoaded) return;
  const mobileSurface = () => !!(window.matchMedia?.('(max-width:760px)').matches || window.matchMedia?.('(display-mode: standalone)').matches || (typeof navigator !== 'undefined' && navigator.standalone));
  if(mobileSurface())return;
  window.__hmChatDockLoaded = true;
  const origin = location.origin;
  const validThread = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,180}$/.test(value);
  const icon = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  const bubble = icon('<path d="M21 11.5a8.5 8.5 0 0 1-12.7 7.4L3 21l1.7-5.3A8.5 8.5 0 1 1 21 11.5Z"/>');
  const root = document.createElement('div');
  root.className = 'hm-chat-dock'; root.hidden = true;
  root.innerHTML = `<section class="hm-dock-panel" id="hm-dock-panel" role="dialog" aria-label="Hungryman ჩატი" hidden>
    <header class="hm-dock-bar"><span class="hm-dock-brand">H<span>▾</span></span><strong>Hungryman ჩატი</strong>
      <a data-expand href="/chat" aria-label="ჩატის სრულ გვერდზე გახსნა" title="სრულ გვერდზე გახსნა">${icon('<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>')}</a>
      <button type="button" data-minimize aria-label="ჩატის ჩაკეცვა" title="ჩაკეცვა">${icon('<path d="M5 12h14"/>')}</button>
      <button type="button" data-close aria-label="ჩატის დახურვა" title="დახურვა">${icon('<path d="m6 6 12 12M6 18 18 6"/>')}</button>
    </header><div class="hm-dock-loading" role="status">ჩატი იტვირთება…</div>
  </section>
  <button type="button" class="hm-dock-launcher" aria-label="ჩატის გახსნა" aria-controls="hm-dock-panel" aria-expanded="false">${bubble}<span class="hm-dock-minimized-title">ჩატი</span><b hidden></b></button>`;
  document.body.appendChild(root);
  const find = selector => root.querySelector(selector);
  const panel = find('.hm-dock-panel'), launcher = find('.hm-dock-launcher'), badge = find('.hm-dock-launcher b');
  const expand = find('[data-expand]'), loading = find('.hm-dock-loading');
  let allowed = false, user = '', checked = 0, checkedUnread = 0, after = Date.now(), afterId = '';
  let opened = false, frame = null, frameReady = false, selected = 'team', pendingThread = null, readingThread = null;
  let pendingOpen = false, pendingFocus = false;
  const unread = new Map();
  const fullPage = () => location.pathname.replace(/\/$/, '') === '/chat';
  const post = data => frame?.contentWindow?.postMessage(data, origin);
  function updateBadge() {
    const count = [...unread.values()].reduce((total, n) => total + n, 0);
    badge.textContent = count > 99 ? '99+' : String(count); badge.hidden = !count;
    launcher.setAttribute('aria-label', count ? `ჩატის გახსნა · ${count} წაუკითხავი` : 'ჩატის გახსნა');
  }
  function syncRoute() {
    if(mobileSurface()){revoke();return;}
    if (fullPage() && opened) close(false, false);
    launcher.hidden = opened || fullPage();
    if (frameReady) post({type:'hmw:chat-visibility', visible:opened && !document.hidden});
  }
  function close(minimized = false, focus = true) {
    opened = false; readingThread = null; panel.hidden = true;
    root.classList.remove('is-open'); launcher.hidden = fullPage();
    launcher.classList.toggle('is-minimized', minimized); launcher.setAttribute('aria-expanded', 'false');
    post({type:'hmw:chat-visibility', visible:false});
    if (focus && !launcher.hidden) launcher.focus();
  }
  function open(id) {
    if (validThread(id)) selected = id;
    if (!allowed) { pendingOpen = true; return; }
    if (fullPage()) { window.dispatchEvent(new CustomEvent('hmw:chat-select', {detail:{conversationId:validThread(id)?id:null}})); return; }
    opened = true; pendingThread = selected; pendingFocus = true;
    root.classList.add('is-open'); panel.hidden = false; launcher.hidden = true;
    launcher.setAttribute('aria-expanded', 'true'); expand.href = '/chat?conversationId=' + encodeURIComponent(selected);
    if (!frame) {
      frame = document.createElement('iframe'); frame.className = 'hm-dock-frame'; frame.title = 'Hungryman ჩატი'; frame.allow = 'microphone';
      frame.src = '/chat/embed?conversationId=' + encodeURIComponent(selected);
      panel.appendChild(frame); loading.hidden = false;
    }
    if (frameReady) {
      post({type:'hmw:chat-open', conversationId:selected, focus:true});
      post({type:'hmw:chat-visibility', visible:!document.hidden});
    }
  }
  function revoke() {
    allowed = false; pendingOpen = false; root.hidden = true; close(false, false);
    frame?.remove(); frame = null; frameReady = false; readingThread = null; selected = 'team'; pendingThread = null; unread.clear(); updateBadge();
  }
  function showPhoto(id) {
    // Only this dock's authenticated iframe may request same-origin chat media.
    if (!/^[0-9a-f-]{36}$/i.test(id || '')) return;
    const dialog = document.createElement('dialog'); dialog.className = 'hm-photo-viewer'; dialog.setAttribute('aria-label', 'გაზიარებული ფოტო');
    dialog.innerHTML = '<div class="hm-photo-surface"><header><span>გაზიარებული ფოტო</span><button type="button" data-zoom aria-label="ფოტოს გადიდება">+</button><button type="button" data-exit aria-label="ფოტოს დახურვა" title="დახურვა · Esc" autofocus>×</button></header><button type="button" class="hm-photo-canvas" aria-label="ფოტოს გადიდება"><img alt="გაზიარებული ფოტო"></button><small>ფოტოზე დაჭერა — ზომის შეცვლა · Esc — დახურვა</small></div>';
    dialog.querySelector('img').src = '/api/chat/attachments?id=' + encodeURIComponent(id);
    const zoom = () => { const large = dialog.classList.toggle('is-zoomed'); dialog.querySelector('[data-zoom]').textContent = large ? '−' : '+'; for (const b of dialog.querySelectorAll('[data-zoom],.hm-photo-canvas')) b.setAttribute('aria-label', large ? 'ფოტოს დაპატარავება' : 'ფოტოს გადიდება'); };
    dialog.querySelector('[data-zoom]').addEventListener('click', zoom);
    dialog.querySelector('.hm-photo-canvas').addEventListener('click', zoom);
    dialog.querySelector('[data-exit]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { dialog.remove(); post({type:'hmw:photo-closed'}); }, {once:true});
    document.body.appendChild(dialog); dialog.showModal();
  }
  window.addEventListener('message', e => {
    if (e.origin !== origin || !frame || e.source !== frame.contentWindow || !allowed) return;
    const d = e.data; if (!d || typeof d !== 'object') return;
    if (d.type === 'hmw:chat-ready') {
      frameReady = true; loading.hidden = true;
      post({type:'hmw:chat-open', conversationId:selected, focus:pendingFocus});
      post({type:'hmw:chat-visibility', visible:opened && !document.hidden});
      pendingFocus = false;
    } else if (d.type === 'hmw:chat-thread' && validThread(d.conversationId)) {
      if (pendingThread && pendingThread !== d.conversationId) return;
      pendingThread = null; selected = d.conversationId;
      readingThread = opened && d.reading ? selected : null;
      expand.href = '/chat?conversationId=' + encodeURIComponent(selected);
      find('.hm-dock-minimized-title').textContent = typeof d.title === 'string' ? d.title : 'ჩატი';
    } else if (d.type === 'hmw:chat-read' && d.conversationId === readingThread) {
      unread.delete(d.conversationId); updateBadge();
    } else if (d.type === 'hmw:chat-close') close(true);
    else if (d.type === 'hmw:chat-photo' && opened) showPhoto(d.attachmentId);
  });
  window.addEventListener('hmw:open-chat', e => open(e.detail?.conversationId));
  window.addEventListener('hmw:chat-route', syncRoute);
  window.addEventListener('popstate', syncRoute);
  window.matchMedia?.('(max-width:760px)').addEventListener('change',syncRoute);
  window.matchMedia?.('(display-mode: standalone)').addEventListener('change',syncRoute);
  document.addEventListener('click', e => {
    if (!(e.target instanceof Element)) return;
    const trigger = e.target.closest('[data-chat-open]');
    if (trigger) { e.preventDefault(); open(trigger.dataset.conversationId); }
  });
  find('[data-minimize]').addEventListener('click', () => close(true));
  find('[data-close]').addEventListener('click', () => close(false));
  launcher.addEventListener('click', () => open());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && opened && !document.querySelector('dialog[open]')) close(true); });
  document.addEventListener('visibilitychange', syncRoute);

  async function poll() {
    try {
      if(mobileSurface()){revoke();return;}
      if(document.hidden)return;
      syncRoute();
      if (Date.now() - checked > 30000) {
        checked = Date.now();
        const response = await fetch('/api/mobile/me', {cache:'no-store'});
        const me = response.ok ? await response.json() : null;
        if(mobileSurface()){revoke();return;}
        if (!me?.permissions?.isApprovedStaff || !me.permissions.permissions?.includes('chat.view') || !me.permissions.permissions?.includes('workspace.view')) { revoke(); return; }
        if (user !== me.user?.userId) {
          const waiting = pendingOpen, requestedThread = selected; revoke(); pendingOpen = waiting; if(waiting)selected=requestedThread; user = me.user?.userId || ''; after = Date.now(); afterId = ''; checkedUnread = 0;
        }
        allowed = true; root.hidden = false;
        if (!document.hidden) void fetch('/api/chat/presence', {method:'POST'}).catch(() => {});
        if (pendingOpen) { pendingOpen = false; open(); }
      }
      if (!allowed) return;
      const response = await fetch('/api/chat/updates?after=' + after + '&afterId=' + encodeURIComponent(afterId), {cache:'no-store'});
      if (response.status === 401 || response.status === 403) { revoke(); return; }
      if (!response.ok) return;
      const data = await response.json();
      const messages = data.messages || [];
      for (const m of messages) { after = m.created; afterId = m.id; }
      // Looking at a list, a minimized panel, or a hidden tab does not mark a chat read.
      const active = !document.hidden ? fullPage() ? (document.documentElement.dataset.hmChatThread || null) : readingThread : null;
      for (const m of messages) if (m.conversationId !== active) unread.set(m.conversationId, (unread.get(m.conversationId) || 0) + 1);
      if (Date.now() - checkedUnread > 15000) {
        checkedUnread = Date.now();
        const response = await fetch('/api/chat/conversations', {cache:'no-store'});
        if (response.ok) { const data = await response.json(); unread.clear(); for (const c of data.conversations || []) if (c.unread > 0) unread.set(c.id, c.unread); updateBadge(); }
      }
      updateBadge();
      for (const m of messages) if (!m.muted || m.mentioned) {
        void window.hmDesktopNotify?.({id:'chat:'+m.id,userId:user,target:'chat',targetId:m.conversationId,chat:true});
      }

    } catch { /* Keep the last usable dock; the next poll retries a transient connection. */ }
    finally { setTimeout(poll, allowed ? (document.hidden ? 5000 : 2500) : 10000); }
  }
  void poll();
})();
