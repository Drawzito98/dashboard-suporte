// Chat privado 1:1 — requer migration_v33.sql no Supabase.
(function () {
  'use strict';
  let currentConversation = null;
  let realtimeChannel = null;
  let notificationChannel = null;
  let unreadChatCount = 0;
  let reactionsAvailable = true;
  const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const originalTitle = document.title;
  function updateTabIndicator() { document.title = unreadChatCount ? '🟢 ' + unreadChatCount + ' · Nova mensagem · ' + originalTitle : originalTitle; }
  function playChatBeep() { try { const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return; const ctx = new Ctx(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.frequency.value = 880; gain.gain.setValueAtTime(0.045, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16); osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.16); } catch {} }
  const esc = value => typeof escapeHtml === 'function' ? escapeHtml(value) : String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const currentUser = async () => (await sbClient.auth.getUser()).data.user;
  const isAdminChat = () => typeof isAdmin === 'function' && isAdmin();
  function closeChat() { if (!isAdminChat()) return; document.body.classList.remove('chat-page'); document.getElementById('chatOverlay')?.classList.remove('open'); if (realtimeChannel) { sbClient.removeChannel(realtimeChannel); realtimeChannel = null; } }
  function minimizeChat() { document.getElementById('chatOverlay')?.classList.add('minimized'); }
  function restoreChat() { document.getElementById('chatOverlay')?.classList.remove('minimized'); }
  function openChat() { if (isAdminChat() && !new URLSearchParams(location.search).has('chat')) { window.open(location.pathname + '?chat=1', '_blank', 'noopener'); return; } initChatNotifications(); unreadChatCount = 0; updateChatBadge(); document.body.classList.toggle('chat-page', !isAdminChat() || new URLSearchParams(location.search).has('chat')); if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); document.getElementById('chatOverlay')?.classList.add('open'); renderChatHome(); }
  function notice(text, type = 'info') { if (typeof showToast === 'function') showToast(text, type, 'Chat'); }
  function favoriteKey(userId) { return 'chat_favoritos_' + userId; }
  function getFavorites(userId) { try { return JSON.parse(localStorage.getItem(favoriteKey(userId)) || '[]'); } catch { return []; } }
  function isFavorite(userId, contactId) { return getFavorites(userId).includes(contactId); }
  function toggleFavorite(userId, contactId) { const list = getFavorites(userId); const next = list.includes(contactId) ? list.filter(id => id !== contactId) : [...list, contactId]; localStorage.setItem(favoriteKey(userId), JSON.stringify(next)); return next.includes(contactId); }
  function updateChatBadge() { updateTabIndicator(); document.querySelectorAll('.chat-unread-badge').forEach(el => { el.textContent = unreadChatCount ? String(unreadChatCount) : ''; el.classList.toggle('visible', unreadChatCount > 0); }); }
  async function initChatNotifications() {
    const user = await currentUser(); if (!user || notificationChannel) return;
    const { count } = await sbClient.from('chat_notificacoes').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('lida', false);
    unreadChatCount = count || 0; updateChatBadge();
    notificationChannel = sbClient.channel('chat-notifications-' + user.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_notificacoes', filter: 'recipient_id=eq.' + user.id }, payload => {
      if (payload?.new?.recipient_id !== user.id) return;
      unreadChatCount += 1; updateChatBadge(); playChatBeep(); notice('Você recebeu uma nova mensagem no chat.', 'info'); if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') { new Notification('Nova mensagem no chat', { body: 'Você recebeu uma nova mensagem.', icon: 'static/icons/icon-192.png', tag: 'chat-nova-mensagem' }); }
    }).subscribe();
  }
  async function markChatNotificationsRead(conversationId) {
    const user = await currentUser(); if (!user) return;
    await sbClient.from('chat_notificacoes').update({ lida: true }).eq('recipient_id', user.id).eq('conversa_id', conversationId).eq('lida', false);
    const { count } = await sbClient.from('chat_notificacoes').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('lida', false);
    unreadChatCount = count || 0; updateChatBadge();
  }
  async function loadMessages() {
    let query = sbClient.from('chat_mensagens').select('*').eq('conversa_id', currentConversation.id).order('created_at', { ascending: true });
    query = isAdminChat() ? query.eq('apagada_para_admin', false) : query.eq('apagada_para_colaborador', false);
    const { data, error } = await query;
    if (error) throw error;
    const messages = data || [];
    const reactions = await sbClient.from('chat_reacoes').select('mensagem_id,user_id,emoji').eq('conversa_id', currentConversation.id);
    reactionsAvailable = !reactions.error;
    if (reactionsAvailable) {
      messages.forEach(message => { message._reactions = (reactions.data || []).filter(reaction => reaction.mensagem_id === message.id); });
    }
    return messages;
  }
  function reactionsMarkup(message, userId) {
    if (!reactionsAvailable) return '';
    const reactions = message._reactions || [];
    const grouped = reactionEmojis.map(emoji => ({ emoji, items: reactions.filter(item => item.emoji === emoji) })).filter(group => group.items.length);
    const chips = grouped.map(group => `<button class="chat-reaction-chip${group.items.some(item => item.user_id === userId) ? ' is-mine' : ''}" type="button" data-reaction-emoji="${group.emoji}" aria-label="Reagir com ${group.emoji}">${group.emoji}<span>${group.items.length}</span></button>`).join('');
    const picker = reactionEmojis.map(emoji => `<button type="button" data-reaction-emoji="${emoji}" aria-label="Reagir com ${emoji}">${emoji}</button>`).join('');
    return `<div class="chat-reactions">${chips}<span class="chat-reaction-picker-wrap"><button class="chat-reaction-add" type="button" aria-label="Adicionar reação">☺+</button><span class="chat-reaction-picker">${picker}</span></span></div>`;
  }
  function messagesMarkup(messages, userId, conversation = currentConversation) {
    return messages.length ? messages.map(m => `<div data-chat-message-id="${esc(m.id)}" class="chat-message ${m.sender_id === userId ? 'is-mine' : ''} ${conversation && m.sender_id === conversation.admin_id ? 'from-admin' : 'from-colaborador'}">${m.imagem_url ? `<img class="chat-image" src="${esc(m.imagem_url)}" alt="Imagem enviada" loading="lazy">` : ''}${m.mensagem ? `<p>${esc(m.mensagem)}</p>` : ''}<small>${new Date(m.created_at).toLocaleString('pt-BR')}</small>${reactionsMarkup(m, userId)}</div>`).join('') : '<p class="chat-empty">Nenhuma mensagem ainda. Inicie a conversa.</p>';
  }
  function appendMessageOnce(box, message, userId, conversation = currentConversation) {
    if (!box || !message?.id) return false;
    const alreadyRendered = Array.from(box.querySelectorAll('[data-chat-message-id]'))
      .some(element => element.dataset.chatMessageId === String(message.id));
    if (alreadyRendered) return false;
    box.querySelector('.chat-empty')?.remove();
    const html = messagesMarkup([message], userId, conversation);
    box.insertAdjacentHTML('beforeend', html);
    box.scrollTop = box.scrollHeight;
    return true;
  }
  function bindReactionEvents(root, user) {
    root.querySelector('#chatMessages')?.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.classList.contains('chat-reaction-add')) {
        event.stopPropagation();
        button.closest('.chat-reaction-picker-wrap')?.classList.toggle('is-open');
        return;
      }
      if (!button.dataset.reactionEmoji) return;
      const message = button.closest('[data-chat-message-id]');
      const emoji = button.dataset.reactionEmoji;
      if (!message || !reactionEmojis.includes(emoji)) return;
      const key = { conversa_id: currentConversation.id, mensagem_id: message.dataset.chatMessageId, user_id: user.id, emoji };
      const existing = await sbClient.from('chat_reacoes').select('id').match(key).maybeSingle();
      const result = existing.data
        ? await sbClient.from('chat_reacoes').delete().eq('id', existing.data.id)
        : await sbClient.from('chat_reacoes').insert(key);
      if (result.error) { notice('Não foi possível salvar a reação.', 'error'); return; }
      await renderConversation();
    });
  }
  async function renderConversation() {
    const root = document.getElementById('chatContent'); if (!root || !currentConversation) return;
    const user = await currentUser();
    let nickname = '';
    try { const profile = await sbClient.from('chat_perfis').select('apelido').eq('user_id', user.id).maybeSingle(); nickname = profile.data?.apelido || ''; } catch {}
    let messages; try { messages = await loadMessages(); } catch (error) { root.innerHTML = `<div class="chat-error">A tabela do chat ainda não foi criada. Execute <strong>migration_v33.sql</strong> no Supabase.</div>`; return; }
    root.innerHTML = `<div class="chat-header"><div><span class="page-eyebrow">Conversa privada</span><h2><button class="chat-profile-name" id="chatProfileName" type="button" title="Alterar seu apelido">${esc(nickname || 'Conversa privada')}</button></h2></div><button class="chat-minimize" type="button" title="Minimizar" aria-label="Minimizar">−</button><button class="btn-small chat-icon-btn" id="chatFavoriteBtn" title="Favoritar contato" aria-label="Favoritar contato">☆</button><button class="btn-small chat-icon-btn" id="chatBackBtn" title="Voltar para conversas" aria-label="Voltar para conversas">←</button><button class="btn-small chat-clear chat-icon-btn" id="chatClearBtn" title="Limpar conversa para mim" aria-label="Limpar conversa para mim">🗑</button></div><div id="chatMessages" class="chat-messages">${messagesMarkup(messages, user.id)}</div><form id="chatForm" class="chat-compose"><input id="chatMessageInput" maxlength="4000" placeholder="Escreva uma mensagem..." autocomplete="off"><label class="chat-attach" title="Enviar imagem">📎<input id="chatImageInput" type="file" accept="image/*" hidden></label><button class="btn-primary chat-send-btn" type="submit" title="Enviar mensagem" aria-label="Enviar mensagem">➤</button></form>`;
    bindReactionEvents(root, user);
    root.querySelector('.chat-minimize')?.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); minimizeChat(); });
    const contactId = isAdminChat() ? currentConversation.colaborador_id : currentConversation.admin_id;
    const favoriteBtn = root.querySelector('#chatFavoriteBtn');
    if (favoriteBtn) { favoriteBtn.textContent = isFavorite(user.id, contactId) ? '★' : '☆'; favoriteBtn.classList.toggle('is-favorite', isFavorite(user.id, contactId)); favoriteBtn.addEventListener('click', () => { const active = toggleFavorite(user.id, contactId); favoriteBtn.textContent = active ? '★' : '☆'; favoriteBtn.classList.toggle('is-favorite', active); }); }
    root.querySelector('#chatProfileName')?.addEventListener('click', async () => { const apelido = prompt('Digite o apelido que aparecerá no chat:', nickname || ''); if (apelido === null) return; const novo = apelido.trim().slice(0, 40); const { error } = await sbClient.from('chat_perfis').upsert({ user_id: user.id, apelido: novo, updated_at: new Date().toISOString() }); if (error) { notice(error.message, 'error'); return; } notice('Apelido atualizado.', 'success'); renderConversation(); });
    root.querySelector('#chatBackBtn').addEventListener('click', renderChatHome);
    const messageInput = root.querySelector('#chatMessageInput');
    const attachmentInput = root.querySelector('#chatImageInput');
    const defaultPlaceholder = messageInput.placeholder;
    messageInput.addEventListener('paste', event => {
      const imageItem = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith('image/'));
      if (!imageItem) return;
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { notice('A imagem colada deve ter no máximo 2 MB.', 'error'); return; }
      const transfer = new DataTransfer();
      transfer.items.add(new File([file], file.name || `captura-${Date.now()}.png`, { type: file.type || 'image/png' }));
      attachmentInput.files = transfer.files;
      messageInput.placeholder = 'Imagem anexada — pressione Enter para enviar';
      messageInput.focus();
    });
    attachmentInput.addEventListener('change', () => {
      messageInput.placeholder = attachmentInput.files?.length ? 'Imagem anexada — pressione Enter para enviar' : defaultPlaceholder;
    });
    root.querySelector('#chatForm').addEventListener('submit', async event => {
      event.preventDefault();
      const input = root.querySelector('#chatMessageInput');
      const mensagem = input.value.trim();
      const imageInput = root.querySelector('#chatImageInput');
      const file = imageInput?.files?.[0];
      if (!mensagem && !file) return;
      let imagem_url = null;
      if (file) { if (file.size > 2 * 1024 * 1024) { notice('A imagem deve ter no máximo 2 MB.', 'error'); return; } imagem_url = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }); }
      input.disabled = true;
      const { data: sent, error } = await sbClient.from('chat_mensagens').insert({ conversa_id: currentConversation.id, sender_id: user.id, mensagem: mensagem || '', imagem_url }).select().single();
      input.disabled = false;
      input.focus();
      if (error) { notice(error.message, 'error'); return; }
      input.value = ''; input.placeholder = defaultPlaceholder; if (imageInput) imageInput.value = '';
      const recipientId = currentConversation.admin_id === user.id ? currentConversation.colaborador_id : currentConversation.admin_id;
      await sbClient.from('chat_notificacoes').insert({ recipient_id: recipientId, conversa_id: currentConversation.id, mensagem_id: sent.id });
      const box = root.querySelector('#chatMessages');
      appendMessageOnce(box, sent, user.id);
    });
    root.querySelector('#chatClearBtn')?.addEventListener('click', async () => { if (!confirm(isAdminChat() ? 'Apagar todas as mensagens para você e para o colaborador?' : 'Limpar o histórico apenas para você? A outra pessoa continuará vendo as mensagens.')) return; let updated, error; if (isAdminChat()) { const result = await sbClient.from('chat_mensagens').delete().eq('conversa_id', currentConversation.id).select('id'); updated = result.data; error = result.error; } else { const valores = { apagada_para_colaborador: true }; const result = await sbClient.from('chat_mensagens').update(valores).eq('conversa_id', currentConversation.id).select('id'); updated = result.data; error = result.error; } if (error) { notice(error.message, 'error'); return; } if (!updated?.length) { notice('Não foi possível salvar a limpeza. Tente novamente.', 'error'); return; } await renderConversation(); notice(isAdminChat() ? 'Conversa apagada para os dois.' : 'Histórico limpo apenas para você.', 'success'); });
    
    if (realtimeChannel) sbClient.removeChannel(realtimeChannel);
    realtimeChannel = sbClient.channel('chat-' + currentConversation.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens', filter: 'conversa_id=eq.' + currentConversation.id }, payload => {
      // Use o payload do realtime diretamente: uma consulta logo após o INSERT
      // pode ficar atrasada pela replicação e só exibir no próximo evento.
      const message = payload?.new;
      const box = root.querySelector('#chatMessages');
      if (!message || !box || message.conversa_id !== currentConversation.id) return;
      appendMessageOnce(box, message, user.id);
    }).on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_mensagens', filter: 'conversa_id=eq.' + currentConversation.id }, () => {
      const box = root.querySelector('#chatMessages');
      if (box) box.innerHTML = messagesMarkup([], user.id, currentConversation);
    }).on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reacoes', filter: 'conversa_id=eq.' + currentConversation.id }, () => {
      renderConversation();
    }).subscribe();
    const box = root.querySelector('#chatMessages'); box.scrollTop = box.scrollHeight;
    markChatNotificationsRead(currentConversation.id);
  }
  async function openConversation(collaborator) {
    const user = await currentUser();
    let query = sbClient.from('chat_conversas').select('*').eq('admin_id', isAdminChat() ? user.id : collaborator.admin_id).eq('colaborador_id', isAdminChat() ? collaborator.id : user.id).maybeSingle();
    let { data, error } = await query;
    if (error) { notice('Execute a migration_v33.sql no Supabase.', 'error'); return; }
    if (!data && isAdminChat()) { const created = await sbClient.from('chat_conversas').upsert({ admin_id: user.id, colaborador_id: collaborator.id }, { onConflict: 'admin_id,colaborador_id', ignoreDuplicates: false }).select().single(); data = created.data; error = created.error; }
    if (error || !data) { notice(error?.message || 'Conversa não encontrada.', 'error'); return; }
    currentConversation = { ...data, label: collaborator.label }; renderConversation();
  }
  async function renderChatHome() {
    const root = document.getElementById('chatContent'); if (!root) return;
    const user = await currentUser();
    if (isAdminChat()) {
      root.innerHTML = '<div class="chat-header"><div><span class="page-eyebrow">Comunicação interna</span><h2>💬 Conversas</h2><p>Mensagens privadas</p></div><button class="chat-minimize" type="button" title="Minimizar">−</button></div><div id="chatPeople" class="chat-people">Carregando colaboradores...</div>';
      root.querySelector('.chat-minimize')?.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); minimizeChat(); });
      try { const response = await fetch('/api/users', { headers: { Authorization: 'Bearer ' + (await sbClient.auth.getSession()).data.session?.access_token } }); const users = await response.json(); const list = (Array.isArray(users) ? users : users.users || []).filter(u => { const name = String(u.app_metadata?.csv_nome || u.user_metadata?.name || u.email || '').toLowerCase(); return u.app_metadata?.role !== 'admin' && u.app_metadata?.ativo !== false && name.includes('dayane'); }); const favorites = getFavorites(user.id); list.sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id))); root.querySelector('#chatPeople').innerHTML = list.length ? list.map(u => `<button class="chat-person" data-id="${esc(u.id)}"><span class="chat-person-title"><strong>Conversa privada</strong><span class="chat-person-star">${favorites.includes(u.id) ? '★' : ''}</span></span><small>Contato protegido</small></button>`).join('') : '<p class="chat-empty">Nenhum colaborador ativo.</p>'; root.querySelectorAll('.chat-person').forEach(button => button.addEventListener('click', () => openConversation({ id: button.dataset.id, label: button.querySelector('strong').textContent }))); } catch (error) { root.querySelector('#chatPeople').textContent = error.message; }
    } else {
      const { data, error } = await sbClient.from('chat_conversas').select('*').eq('colaborador_id', user.id).order('created_at', { ascending: false }).limit(1);
      if (error) { root.innerHTML = '<div class="chat-error">Execute migration_v33.sql para ativar o chat.</div>'; return; }
      if (!data?.[0]) { root.innerHTML = '<div class="chat-empty">A administração ainda não iniciou uma conversa com você.</div>'; return; }
      currentConversation = data[0]; renderConversation();
    }
  }
  document.addEventListener('app-role-ready', () => { initChatNotifications(); if (new URLSearchParams(location.search).has('chat')) setTimeout(openChat, 80); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && unreadChatCount) { unreadChatCount = 0; updateChatBadge(); } });
  initChatNotifications();
  document.getElementById('chatBtn')?.addEventListener('click', openChat);
  document.getElementById('chatOverlay')?.addEventListener('click', event => { if (event.target.closest('.chat-minimize')) minimizeChat(); else if (event.target.id === 'chatOverlay' && event.currentTarget.classList.contains('minimized')) restoreChat(); });
  document.getElementById('chatBtnTop')?.addEventListener('click', openChat);
  window.openChat = openChat;
  document.getElementById('chatOverlayClose')?.addEventListener('click', event => { event.preventDefault(); closeChat(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.classList.contains('chat-page')) closeChat(); });

})();
