// Chat privado 1:1 — requer migration_v33.sql no Supabase.
(function () {
  'use strict';
  let currentConversation = null;
  let realtimeChannel = null;
  let notificationChannel = null;
  let unreadChatCount = 0;
  const esc = value => typeof escapeHtml === 'function' ? escapeHtml(value) : String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const currentUser = async () => (await sbClient.auth.getUser()).data.user;
  const isAdminChat = () => typeof isAdmin === 'function' && isAdmin();
  function closeChat() { document.getElementById('chatOverlay')?.classList.remove('open'); if (realtimeChannel) { sbClient.removeChannel(realtimeChannel); realtimeChannel = null; } }
  function minimizeChat() { document.getElementById('chatOverlay')?.classList.add('minimized'); }
  function restoreChat() { document.getElementById('chatOverlay')?.classList.remove('minimized'); }
  function openChat() { document.getElementById('chatOverlay')?.classList.add('open'); renderChatHome(); }
  function notice(text, type = 'info') { if (typeof showToast === 'function') showToast(text, type, 'Chat'); }
  function favoriteKey(userId) { return 'chat_favoritos_' + userId; }
  function getFavorites(userId) { try { return JSON.parse(localStorage.getItem(favoriteKey(userId)) || '[]'); } catch { return []; } }
  function isFavorite(userId, contactId) { return getFavorites(userId).includes(contactId); }
  function toggleFavorite(userId, contactId) { const list = getFavorites(userId); const next = list.includes(contactId) ? list.filter(id => id !== contactId) : [...list, contactId]; localStorage.setItem(favoriteKey(userId), JSON.stringify(next)); return next.includes(contactId); }
  function updateChatBadge() { document.querySelectorAll('.chat-unread-badge').forEach(el => { el.textContent = unreadChatCount ? String(unreadChatCount) : ''; el.classList.toggle('visible', unreadChatCount > 0); }); }
  async function initChatNotifications() {
    const user = await currentUser(); if (!user || notificationChannel) return;
    const { count } = await sbClient.from('chat_notificacoes').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('lida', false);
    unreadChatCount = count || 0; updateChatBadge();
    notificationChannel = sbClient.channel('chat-notifications-' + user.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_notificacoes', filter: 'recipient_id=eq.' + user.id }, payload => {
      if (payload?.new?.recipient_id !== user.id) return;
      unreadChatCount += 1; updateChatBadge(); notice('Você recebeu uma nova mensagem no chat.', 'info');
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
    return data || [];
  }
  function messagesMarkup(messages, userId) {
    return messages.length ? messages.map(m => `<div class="chat-message ${m.sender_id === userId ? 'is-mine' : ''}">${m.imagem_url ? `<img class="chat-image" src="${esc(m.imagem_url)}" alt="Imagem enviada" loading="lazy">` : ''}${m.mensagem ? `<p>${esc(m.mensagem)}</p>` : ''}<small>${new Date(m.created_at).toLocaleString('pt-BR')}</small></div>`).join('') : '<p class="chat-empty">Nenhuma mensagem ainda. Inicie a conversa.</p>';
  }
  async function renderConversation() {
    const root = document.getElementById('chatContent'); if (!root || !currentConversation) return;
    const user = await currentUser();
    let nickname = '';
    try { const profile = await sbClient.from('chat_perfis').select('apelido').eq('user_id', user.id).maybeSingle(); nickname = profile.data?.apelido || ''; } catch {}
    let messages; try { messages = await loadMessages(); } catch (error) { root.innerHTML = `<div class="chat-error">A tabela do chat ainda não foi criada. Execute <strong>migration_v33.sql</strong> no Supabase.</div>`; return; }
    root.innerHTML = `<div class="chat-header"><div><span class="page-eyebrow">Conversa privada</span><h2>💬 Conversa</h2></div><button class="chat-minimize" type="button" title="Minimizar">−</button><button class="btn-small" id="chatFavoriteBtn" title="Favoritar contato">☆</button><button class="btn-small" id="chatBackBtn">← Conversas</button><button class="btn-small chat-clear" id="chatClearBtn" title="Apagar mensagens desta conversa">🗑 Limpar</button></div>${!isAdminChat() ? `<div class="chat-nickname"><label>Seu apelido (opcional) <input id="chatNicknameInput" maxlength="40" value="${esc(nickname)}" placeholder="Como quer aparecer no chat?"></label><button class="btn-small" id="chatNicknameSave">Salvar apelido</button></div>` : ''}<div id="chatMessages" class="chat-messages">${messagesMarkup(messages, user.id)}</div><form id="chatForm" class="chat-compose"><input id="chatMessageInput" maxlength="4000" placeholder="Escreva uma mensagem..." autocomplete="off"><label class="chat-attach" title="Enviar imagem">📎<input id="chatImageInput" type="file" accept="image/*" hidden></label><button class="btn-primary" type="submit">Enviar</button></form>`;
    root.querySelector('.chat-minimize')?.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); minimizeChat(); });
    const contactId = isAdminChat() ? currentConversation.colaborador_id : currentConversation.admin_id;
    const favoriteBtn = root.querySelector('#chatFavoriteBtn');
    if (favoriteBtn) { favoriteBtn.textContent = isFavorite(user.id, contactId) ? '★' : '☆'; favoriteBtn.classList.toggle('is-favorite', isFavorite(user.id, contactId)); favoriteBtn.addEventListener('click', () => { const active = toggleFavorite(user.id, contactId); favoriteBtn.textContent = active ? '★' : '☆'; favoriteBtn.classList.toggle('is-favorite', active); }); }
    root.querySelector('#chatBackBtn').addEventListener('click', renderChatHome);
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
      if (error) { notice(error.message, 'error'); return; }
      input.value = ''; if (imageInput) imageInput.value = '';
      const recipientId = currentConversation.admin_id === user.id ? currentConversation.colaborador_id : currentConversation.admin_id;
      await sbClient.from('chat_notificacoes').insert({ recipient_id: recipientId, conversa_id: currentConversation.id, mensagem_id: sent.id });
      const box = root.querySelector('#chatMessages');
      if (sent && box) { const empty = box.querySelector('.chat-empty'); if (empty) empty.remove(); const html = messagesMarkup([sent], user.id).replace('<div class="chat-message ', `<div data-chat-message-id="${esc(sent.id)}" class="chat-message `); box.insertAdjacentHTML('beforeend', html); box.scrollTop = box.scrollHeight; }
    });
    root.querySelector('#chatClearBtn')?.addEventListener('click', async () => { if (!confirm('Limpar o histórico apenas para você? A outra pessoa continuará vendo as mensagens.')) return; const campoLimpeza = isAdminChat() ? 'apagada_para_admin' : 'apagada_para_colaborador'; const valores = { [campoLimpeza]: true }; const { data: updated, error } = await sbClient.from('chat_mensagens').update(valores).eq('conversa_id', currentConversation.id).select('id'); if (error) { notice(error.message, 'error'); return; } if (!updated?.length) { notice('Não foi possível salvar a limpeza. Tente novamente.', 'error'); return; } await renderConversation(); notice('Histórico limpo apenas para você.', 'success'); });
    root.querySelector('#chatNicknameSave')?.addEventListener('click', async () => { const apelido = root.querySelector('#chatNicknameInput').value.trim(); const { error } = await sbClient.from('chat_perfis').upsert({ user_id: user.id, apelido, updated_at: new Date().toISOString() }); notice(error ? error.message : 'Apelido salvo.', error ? 'error' : 'success'); });
    if (realtimeChannel) sbClient.removeChannel(realtimeChannel);
    realtimeChannel = sbClient.channel('chat-' + currentConversation.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens', filter: 'conversa_id=eq.' + currentConversation.id }, payload => {
      // Use o payload do realtime diretamente: uma consulta logo após o INSERT
      // pode ficar atrasada pela replicação e só exibir no próximo evento.
      const message = payload?.new;
      const box = root.querySelector('#chatMessages');
      if (!message || !box || message.conversa_id !== currentConversation.id) return;
      if (box.querySelector(`[data-chat-message-id=\"${message.id}\"]`)) return;
      const empty = box.querySelector('.chat-empty'); if (empty) empty.remove();
      const html = messagesMarkup([message], user.id).replace('<div class=\"chat-message ', `<div data-chat-message-id=\"${esc(message.id)}\" class=\"chat-message `);
      box.insertAdjacentHTML('beforeend', html); box.scrollTop = box.scrollHeight;
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
      try { const response = await fetch('/api/users', { headers: { Authorization: 'Bearer ' + (await sbClient.auth.getSession()).data.session?.access_token } }); const users = await response.json(); const list = (Array.isArray(users) ? users : users.users || []).filter(u => u.app_metadata?.role === 'colaborador' && u.app_metadata?.ativo !== false); const favorites = getFavorites(user.id); list.sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id))); root.querySelector('#chatPeople').innerHTML = list.length ? list.map(u => `<button class="chat-person" data-id="${esc(u.id)}"><span class="chat-person-title"><strong>${esc(u.app_metadata?.csv_nome || u.user_metadata?.name || u.email)}</strong><span class="chat-person-star">${favorites.includes(u.id) ? '★' : ''}</span></span><small>${esc(u.email || '')}</small></button>`).join('') : '<p class="chat-empty">Nenhum colaborador ativo.</p>'; root.querySelectorAll('.chat-person').forEach(button => button.addEventListener('click', () => openConversation({ id: button.dataset.id, label: button.querySelector('strong').textContent }))); } catch (error) { root.querySelector('#chatPeople').textContent = error.message; }
    } else {
      const { data, error } = await sbClient.from('chat_conversas').select('*').eq('colaborador_id', user.id).order('created_at', { ascending: false }).limit(1);
      if (error) { root.innerHTML = '<div class="chat-error">Execute migration_v33.sql para ativar o chat.</div>'; return; }
      if (!data?.[0]) { root.innerHTML = '<div class="chat-empty">A administração ainda não iniciou uma conversa com você.</div>'; return; }
      currentConversation = data[0]; renderConversation();
    }
  }
  initChatNotifications();
  document.getElementById('chatBtn')?.addEventListener('click', openChat);
  document.getElementById('chatOverlay')?.addEventListener('click', event => { if (event.target.closest('.chat-minimize')) minimizeChat(); else if (event.target.id === 'chatOverlay' && event.currentTarget.classList.contains('minimized')) restoreChat(); });
  document.getElementById('chatBtnTop')?.addEventListener('click', openChat);
  document.getElementById('chatOverlayClose')?.addEventListener('click', closeChat);

})();
