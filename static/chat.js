// Chat privado 1:1 — mensagens, anexos privados, reações e presença em tempo real.
(function () {
  'use strict';
  const PAGE_SIZE = 50;
  const quickReactionEmojis = ['👍', '❤️', '😂', '🤤', '🔥', '🙏'];
  const extraReactionEmojis = ['😮', '😢', '🎉', '👏', '🤔', '👀', '💯', '🚀'];
  const reactionEmojis = [...quickReactionEmojis, ...extraReactionEmojis];
  const originalTitle = document.title;
  let currentConversation = null;
  let realtimeChannel = null;
  let notificationChannel = null;
  let unreadChatCount = 0;
  let loadedMessages = [];
  let messagePage = 0;
  let hasOlderMessages = false;
  let reactionsAvailable = true;
  let replyTarget = null;
  let typingTimer = null;

  const esc = value => typeof escapeHtml === 'function' ? escapeHtml(value) : String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const currentUser = async () => (await sbClient.auth.getUser()).data.user;
  const isAdminChat = () => typeof isAdmin === 'function' && isAdmin();
  const notice = (text, type = 'info') => typeof showToast === 'function' && showToast(text, type, 'Chat');
  const favoriteKey = userId => 'chat_favoritos_' + userId;
  const getFavorites = userId => { try { return JSON.parse(localStorage.getItem(favoriteKey(userId)) || '[]'); } catch { return []; } };
  const isFavorite = (userId, contactId) => getFavorites(userId).includes(contactId);
  function toggleFavorite(userId, contactId) { const list = getFavorites(userId); const next = list.includes(contactId) ? list.filter(id => id !== contactId) : [...list, contactId]; localStorage.setItem(favoriteKey(userId), JSON.stringify(next)); return next.includes(contactId); }
  function updateChatBadge() { document.title = unreadChatCount ? `🟢 ${unreadChatCount} · Nova mensagem · ${originalTitle}` : originalTitle; document.querySelectorAll('.chat-unread-badge').forEach(el => { el.textContent = unreadChatCount ? String(unreadChatCount) : ''; el.classList.toggle('visible', unreadChatCount > 0); }); }
  function playChatBeep() { try { const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return; const ctx = new Ctx(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.frequency.value = 880; gain.gain.setValueAtTime(.045, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .16); osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .16); } catch {} }

  async function initChatNotifications() {
    const user = await currentUser(); if (!user || notificationChannel) return;
    const { count } = await sbClient.from('chat_notificacoes').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('lida', false);
    unreadChatCount = count || 0; updateChatBadge();
    notificationChannel = sbClient.channel('chat-notifications-' + user.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_notificacoes', filter: 'recipient_id=eq.' + user.id }, payload => {
      if (payload?.new?.recipient_id !== user.id) return;
      unreadChatCount += 1; updateChatBadge(); playChatBeep(); notice('Você recebeu uma nova mensagem no chat.');
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') new Notification('Nova mensagem no chat', { body: 'Você recebeu uma nova mensagem.', icon: 'static/icons/icon-192.png', tag: 'chat-nova-mensagem' });
    }).subscribe();
  }
  async function markConversationRead(user) {
    if (!currentConversation) return;
    await sbClient.from('chat_notificacoes').update({ lida: true }).eq('recipient_id', user.id).eq('conversa_id', currentConversation.id).eq('lida', false);
    await sbClient.from('chat_mensagens').update({ lida_em: new Date().toISOString() }).eq('conversa_id', currentConversation.id).neq('sender_id', user.id).is('lida_em', null);
    const { count } = await sbClient.from('chat_notificacoes').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('lida', false);
    unreadChatCount = count || 0; updateChatBadge();
  }

  async function attachPrivateImageUrls(messages) {
    const paths = [...new Set(messages.map(message => message.imagem_url).filter(path => path && !/^(data:|https?:)/.test(path)))];
    if (!paths.length) return;
    const { data } = await sbClient.storage.from('chat-imagens').createSignedUrls(paths, 3600);
    const urls = new Map((data || []).map(item => [item.path, item.signedUrl]));
    messages.forEach(message => { if (urls.has(message.imagem_url)) message._imageSrc = urls.get(message.imagem_url); });
  }
  async function enrichMessages(messages) {
    await attachPrivateImageUrls(messages);
    const ids = messages.map(message => message.id);
    if (!ids.length) return messages;
    const reactions = await sbClient.from('chat_reacoes').select('mensagem_id,user_id,emoji').eq('conversa_id', currentConversation.id).in('mensagem_id', ids);
    reactionsAvailable = !reactions.error;
    messages.forEach(message => { message._reactions = reactionsAvailable ? (reactions.data || []).filter(reaction => reaction.mensagem_id === message.id) : []; });
    const replies = [...new Set(messages.map(message => message.reply_to_id).filter(Boolean))];
    if (replies.length) {
      const { data } = await sbClient.from('chat_mensagens').select('id,mensagem,imagem_url,sender_id').in('id', replies);
      const byId = new Map((data || []).map(message => [message.id, message]));
      messages.forEach(message => { message._reply = byId.get(message.reply_to_id) || null; });
    }
    return messages;
  }
  async function fetchMessagePage(page) {
    const from = page * PAGE_SIZE;
    let query = sbClient.from('chat_mensagens').select('*').eq('conversa_id', currentConversation.id).order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
    query = isAdminChat() ? query.eq('apagada_para_admin', false) : query.eq('apagada_para_colaborador', false);
    const { data, error } = await query; if (error) throw error;
    hasOlderMessages = (data || []).length === PAGE_SIZE;
    return enrichMessages((data || []).reverse());
  }

  function reactionsMarkup(message, userId) {
    if (!reactionsAvailable) return '';
    const reactions = message._reactions || [];
    const chips = reactionEmojis.map(emoji => ({ emoji, items: reactions.filter(item => item.emoji === emoji) })).filter(group => group.items.length).map(group => `<button class="chat-reaction-chip${group.items.some(item => item.user_id === userId) ? ' is-mine' : ''}" type="button" data-reaction-emoji="${group.emoji}">${group.emoji}<span>${group.items.length}</span></button>`).join('');
    const quick = quickReactionEmojis.map(emoji => `<button type="button" data-reaction-emoji="${emoji}">${emoji}</button>`).join('');
    const extra = extraReactionEmojis.map(emoji => `<button class="chat-reaction-extra" type="button" data-reaction-emoji="${emoji}">${emoji}</button>`).join('');
    return `<div class="chat-reactions">${chips}<span class="chat-reaction-picker"><span>${quick}<button class="chat-reaction-more" type="button">+</button>${extra}</span></span></div>`;
  }
  function dayLabel(dateValue) { const date = new Date(dateValue); const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1); const key = value => value.toDateString(); if (key(date) === key(today)) return 'Hoje'; if (key(date) === key(yesterday)) return 'Ontem'; return date.toLocaleDateString('pt-BR'); }
  function messageMarkup(message, userId) {
    const mine = message.sender_id === userId;
    const image = message._imageSrc || (/^(data:|https?:)/.test(message.imagem_url || '') ? message.imagem_url : '');
    const reply = message._reply ? `<div class="chat-reply-quote"><strong>${message._reply.sender_id === userId ? 'Você' : 'Contato'}</strong><span>${esc(message._reply.mensagem || (message._reply.imagem_url ? '📷 Imagem' : 'Mensagem'))}</span></div>` : '';
    return `<div data-chat-message-id="${esc(message.id)}" class="chat-message ${mine ? 'is-mine' : ''}">${reply}${image ? `<img class="chat-image" src="${esc(image)}" alt="Imagem enviada" loading="lazy">` : ''}${message.mensagem ? `<p>${esc(message.mensagem)}</p>` : ''}<div class="chat-message-meta">${message.editada_em ? '<span title="Mensagem editada">editada</span>' : ''}<time>${new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>${mine ? `<span title="${message.lida_em ? 'Lida' : 'Enviada'}">${message.lida_em ? '✓✓' : '✓'}</span>` : ''}</div><div class="chat-message-actions"><button type="button" data-chat-action="reply" title="Responder">↩</button>${mine ? '<button type="button" data-chat-action="edit" title="Editar">✎</button><button type="button" data-chat-action="delete" title="Excluir">🗑</button>' : ''}</div>${reactionsMarkup(message, userId)}</div>`;
  }
  function messagesMarkup(messages, userId) {
    if (!messages.length) return '<p class="chat-empty">Nenhuma mensagem ainda. Inicie a conversa.</p>';
    let lastDay = '';
    return messages.map(message => { const day = dayLabel(message.created_at); const separator = day !== lastDay ? `<div class="chat-day-separator"><span>${day}</span></div>` : ''; lastDay = day; return separator + messageMarkup(message, userId); }).join('');
  }
  function openImageViewer(src) {
    document.getElementById('chatImageViewer')?.remove();
    const viewer = document.createElement('div');
    viewer.id = 'chatImageViewer'; viewer.className = 'chat-image-viewer';
    viewer.innerHTML = `<button type="button" aria-label="Fechar imagem">✕</button><img src="${esc(src)}" alt="Imagem ampliada">`;
    document.body.appendChild(viewer);
    const close = () => viewer.remove();
    viewer.querySelector('button').onclick = close;
    viewer.onclick = event => { if (event.target === viewer) close(); };
    const escapeClose = event => { if (event.key === 'Escape') { close(); document.removeEventListener('keydown', escapeClose); } };
    document.addEventListener('keydown', escapeClose);
  }
  function renderMessageList(root, user, keepBottom = true) {
    const box = root.querySelector('#chatMessages'); if (!box) return;
    box.innerHTML = `${hasOlderMessages ? '<button class="chat-load-older" type="button">Carregar mensagens anteriores</button>' : ''}${messagesMarkup(loadedMessages, user.id)}`;
    if (keepBottom) box.scrollTop = box.scrollHeight;
  }

  async function compressImage(file) {
    if (!file || file.type === 'image/gif') return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, .82));
    return blob && blob.size < file.size ? new File([blob], file.name, { type }) : file;
  }
  async function uploadChatImage(file, user) {
    const optimized = await compressImage(file);
    if (optimized.size > 2 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 2 MB após a compactação.');
    const extension = optimized.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const path = `${currentConversation.id}/${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await sbClient.storage.from('chat-imagens').upload(path, optimized, { contentType: optimized.type, upsert: false });
    if (error) throw error; return path;
  }

  function bindMessageEvents(root, user) {
    const box = root.querySelector('#chatMessages');
    box.addEventListener('click', async event => {
      const older = event.target.closest('.chat-load-older');
      if (older) { const previousHeight = box.scrollHeight; messagePage += 1; const olderMessages = await fetchMessagePage(messagePage); loadedMessages = [...olderMessages, ...loadedMessages]; renderMessageList(root, user, false); box.scrollTop = box.scrollHeight - previousHeight; return; }
      const button = event.target.closest('button');
      const messageEl = event.target.closest('[data-chat-message-id]');
      if (!messageEl) { box.querySelectorAll('.reaction-open').forEach(item => item.classList.remove('reaction-open')); return; }
      const clickedImage = event.target.closest('.chat-image');
      if (clickedImage) { event.stopPropagation(); openImageViewer(clickedImage.src); return; }
      const message = loadedMessages.find(item => item.id === messageEl.dataset.chatMessageId);
      if (!message) return;
      if (!button) { box.querySelectorAll('.reaction-open').forEach(item => item !== messageEl && item.classList.remove('reaction-open')); messageEl.classList.toggle('reaction-open'); return; }
      if (button.classList.contains('chat-reaction-more')) { const picker = button.closest('.chat-reaction-picker'); picker.classList.toggle('show-more'); button.textContent = picker.classList.contains('show-more') ? '−' : '+'; return; }
      if (button.dataset.reactionEmoji) { const emoji = button.dataset.reactionEmoji; const base = { conversa_id: currentConversation.id, mensagem_id: message.id, user_id: user.id }; const existing = await sbClient.from('chat_reacoes').select('id,emoji').match(base); if (existing.error) { notice('Não foi possível consultar a reação.', 'error'); return; } const sameReaction = (existing.data || []).some(item => item.emoji === emoji); if (existing.data?.length) { const removal = await sbClient.from('chat_reacoes').delete().in('id', existing.data.map(item => item.id)); if (removal.error) { notice('Não foi possível trocar a reação.', 'error'); return; } } if (!sameReaction) { const insertion = await sbClient.from('chat_reacoes').insert({ ...base, emoji }); if (insertion.error) { notice('Não foi possível salvar a reação.', 'error'); return; } } await refreshLoadedMessages(root, user); return; }
      if (button.dataset.chatAction === 'reply') { replyTarget = message; const preview = root.querySelector('#chatReplyPreview'); preview.hidden = false; preview.querySelector('span').textContent = message.mensagem || '📷 Imagem'; root.querySelector('#chatMessageInput').focus(); return; }
      if (button.dataset.chatAction === 'edit') { const editedText = prompt('Editar mensagem:', message.mensagem || ''); if (editedText === null) return; const normalized = editedText.trim(); if (!normalized && !message.imagem_url) { notice('A mensagem não pode ficar vazia.', 'error'); return; } if (normalized === (message.mensagem || '')) return; const { error } = await sbClient.from('chat_mensagens').update({ mensagem: normalized }).eq('id', message.id); if (error) notice(error.message, 'error'); else await refreshLoadedMessages(root, user); return; }
      if (button.dataset.chatAction === 'delete' && confirm('Excluir esta mensagem para todos?')) { if (message.imagem_url && !/^(data:|https?:)/.test(message.imagem_url)) await sbClient.storage.from('chat-imagens').remove([message.imagem_url]); const { error } = await sbClient.from('chat_mensagens').delete().eq('id', message.id); if (error) notice(error.message, 'error'); }
    });
  }
  async function refreshLoadedMessages(root, user) { const pages = messagePage; let oldestHasMore = false; loadedMessages = []; for (let page = pages; page >= 0; page -= 1) { const pageMessages = await fetchMessagePage(page); if (page === pages) oldestHasMore = hasOlderMessages; loadedMessages.push(...pageMessages); } hasOlderMessages = oldestHasMore; renderMessageList(root, user); }

  async function renderConversation() {
    const root = document.getElementById('chatContent'); if (!root || !currentConversation) return;
    const user = await currentUser(); messagePage = 0; replyTarget = null;
    try { loadedMessages = await fetchMessagePage(0); } catch (error) { root.innerHTML = `<div class="chat-error">Não foi possível carregar o chat: ${esc(error.message)}</div>`; return; }
    const contactId = isAdminChat() ? currentConversation.colaborador_id : currentConversation.admin_id;
    root.innerHTML = `<div class="chat-header"><div><span class="page-eyebrow">Conversa privada</span><h2>${esc(currentConversation.label || 'Conversa privada')}</h2><small class="chat-peace-note">Proibido brigar.</small><p id="chatTyping" class="chat-typing"></p></div><button class="chat-minimize" type="button">−</button><button class="btn-small chat-icon-btn" id="chatSearchBtn" title="Pesquisar">⌕</button><button class="btn-small chat-icon-btn" id="chatFavoriteBtn" title="Favoritar">${isFavorite(user.id, contactId) ? '★' : '☆'}</button><button class="btn-small chat-icon-btn" id="chatBackBtn" title="Voltar">←</button><button class="btn-small chat-clear chat-icon-btn" id="chatClearBtn" title="Limpar para mim">🗑</button></div><div class="chat-search" id="chatSearch" hidden><input placeholder="Pesquisar nesta conversa"><button type="button">Fechar</button></div><div id="chatMessages" class="chat-messages"></div><form id="chatForm" class="chat-compose"><div id="chatReplyPreview" class="chat-compose-preview" hidden><strong>Respondendo</strong><span></span><button type="button">✕</button></div><div id="chatImagePreview" class="chat-image-preview" hidden><img alt="Prévia da imagem anexada"><button id="chatImageRemove" type="button">✕</button></div><input id="chatMessageInput" maxlength="4000" placeholder="Escreva uma mensagem..." autocomplete="off"><label class="chat-attach" title="Enviar imagem">📎<input id="chatImageInput" type="file" accept="image/*" hidden></label><button class="btn-primary chat-send-btn" type="submit">➤</button></form>`;
    renderMessageList(root, user); bindMessageEvents(root, user); markConversationRead(user);
    root.querySelector('.chat-minimize').onclick = minimizeChat;
    root.querySelector('#chatBackBtn').onclick = renderChatHome;
    root.querySelector('#chatFavoriteBtn').onclick = event => { const active = toggleFavorite(user.id, contactId); event.currentTarget.textContent = active ? '★' : '☆'; };
    root.querySelector('#chatClearBtn').onclick = async () => { if (!confirm('Limpar o histórico apenas para você?')) return; const values = isAdminChat() ? { apagada_para_admin: true } : { apagada_para_colaborador: true }; const { error } = await sbClient.from('chat_mensagens').update(values).eq('conversa_id', currentConversation.id); if (error) notice(error.message, 'error'); else renderConversation(); };
    let searchBackup = null;
    const search = root.querySelector('#chatSearch'); root.querySelector('#chatSearchBtn').onclick = () => { search.hidden = !search.hidden; if (!search.hidden) search.querySelector('input').focus(); };
    const restoreSearch = () => { if (searchBackup) { loadedMessages = searchBackup.messages; messagePage = searchBackup.page; hasOlderMessages = searchBackup.hasOlder; searchBackup = null; } renderMessageList(root, user, false); };
    search.querySelector('button').onclick = () => { search.hidden = true; search.querySelector('input').value = ''; restoreSearch(); };
    search.querySelector('input').oninput = async event => { const term = event.target.value.trim(); if (!term) { restoreSearch(); return; } if (!searchBackup) searchBackup = { messages: loadedMessages, page: messagePage, hasOlder: hasOlderMessages }; let query = sbClient.from('chat_mensagens').select('*').eq('conversa_id', currentConversation.id).ilike('mensagem', `%${term}%`).order('created_at', { ascending: false }).limit(100); query = isAdminChat() ? query.eq('apagada_para_admin', false) : query.eq('apagada_para_colaborador', false); const { data } = await query; loadedMessages = await enrichMessages((data || []).reverse()); hasOlderMessages = false; renderMessageList(root, user, false); };
    const input = root.querySelector('#chatMessageInput'); const imageInput = root.querySelector('#chatImageInput'); const imagePreview = root.querySelector('#chatImagePreview'); const previewImage = imagePreview.querySelector('img'); let previewUrl = null;
    function updatePreview(file) { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = file ? URL.createObjectURL(file) : null; imagePreview.hidden = !file; if (previewUrl) previewImage.src = previewUrl; else previewImage.removeAttribute('src'); input.placeholder = file ? 'Imagem anexada — pressione Enter para enviar' : 'Escreva uma mensagem...'; }
    input.onpaste = event => { const item = Array.from(event.clipboardData?.items || []).find(value => value.type.startsWith('image/')); if (!item) return; event.preventDefault(); const file = item.getAsFile(); const transfer = new DataTransfer(); transfer.items.add(file); imageInput.files = transfer.files; updatePreview(file); };
    imageInput.onchange = () => updatePreview(imageInput.files?.[0] || null); root.querySelector('#chatImageRemove').onclick = () => { imageInput.value = ''; updatePreview(null); input.focus(); };
    root.querySelector('#chatReplyPreview button').onclick = () => { replyTarget = null; root.querySelector('#chatReplyPreview').hidden = true; input.focus(); };
    input.oninput = () => { realtimeChannel?.send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id, typing: true } }); clearTimeout(typingTimer); typingTimer = setTimeout(() => realtimeChannel?.send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id, typing: false } }), 1200); };
    root.querySelector('#chatForm').onsubmit = async event => { event.preventDefault(); const text = input.value.trim(); const file = imageInput.files?.[0]; if (!text && !file) return; input.disabled = true; let imagePath = null; try { if (file) imagePath = await uploadChatImage(file, user); const payload = { conversa_id: currentConversation.id, sender_id: user.id, mensagem: text, imagem_url: imagePath, reply_to_id: replyTarget?.id || null }; const { data: sent, error } = await sbClient.from('chat_mensagens').insert(payload).select().single(); if (error) throw error; const recipientId = currentConversation.admin_id === user.id ? currentConversation.colaborador_id : currentConversation.admin_id; await sbClient.from('chat_notificacoes').insert({ recipient_id: recipientId, conversa_id: currentConversation.id, mensagem_id: sent.id }); input.value = ''; imageInput.value = ''; updatePreview(null); replyTarget = null; root.querySelector('#chatReplyPreview').hidden = true; await refreshLoadedMessages(root, user); } catch (error) { if (imagePath) await sbClient.storage.from('chat-imagens').remove([imagePath]); notice(error.message || 'Não foi possível enviar.', 'error'); } finally { input.disabled = false; input.focus(); } };
    subscribeConversation(root, user);
  }
  const boxFor = root => root.querySelector('#chatMessages');
  function subscribeConversation(root, user) {
    if (realtimeChannel) sbClient.removeChannel(realtimeChannel);
    realtimeChannel = sbClient.channel('chat-' + currentConversation.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_mensagens', filter: 'conversa_id=eq.' + currentConversation.id }, async () => { await refreshLoadedMessages(root, user); await markConversationRead(user); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reacoes', filter: 'conversa_id=eq.' + currentConversation.id }, () => refreshLoadedMessages(root, user))
      .on('broadcast', { event: 'typing' }, ({ payload }) => { if (payload?.user_id === user.id) return; const typing = root.querySelector('#chatTyping'); if (typing) typing.textContent = payload?.typing ? 'digitando…' : ''; })
      .subscribe();
  }
  async function openConversation(collaborator) {
    const user = await currentUser(); const adminId = isAdminChat() ? user.id : collaborator.admin_id;
    let { data, error } = await sbClient.from('chat_conversas').select('*').eq('admin_id', adminId).eq('colaborador_id', isAdminChat() ? collaborator.id : user.id).maybeSingle();
    if (!data && isAdminChat()) { const created = await sbClient.from('chat_conversas').upsert({ admin_id: user.id, colaborador_id: collaborator.id }, { onConflict: 'admin_id,colaborador_id' }).select().single(); data = created.data; error = created.error; }
    if (error || !data) { notice(error?.message || 'Conversa não encontrada.', 'error'); return; }
    currentConversation = { ...data, label: collaborator.label }; renderConversation();
  }
  async function renderChatHome() {
    const root = document.getElementById('chatContent'); if (!root) return; const user = await currentUser();
    if (!isAdminChat()) { const { data, error } = await sbClient.from('chat_conversas').select('*').eq('colaborador_id', user.id).order('created_at', { ascending: false }).limit(1); if (error || !data?.[0]) { root.innerHTML = '<div class="chat-empty">A administração ainda não iniciou uma conversa com você.</div>'; return; } currentConversation = { ...data[0], label: 'Administração' }; renderConversation(); return; }
    root.innerHTML = '<div class="chat-header"><div><span class="page-eyebrow">Comunicação interna</span><h2>💬 Conversas</h2><p>Mensagens privadas <small class="chat-peace-note">· Proibido brigar.</small></p></div><button class="chat-minimize" type="button">−</button></div><div id="chatPeople" class="chat-people">Carregando...</div>';
    root.querySelector('.chat-minimize').onclick = minimizeChat;
    try {
      const token = (await sbClient.auth.getSession()).data.session?.access_token; const response = await fetch('/api/users', { headers: { Authorization: 'Bearer ' + token } }); const payload = await response.json();
      const users = (Array.isArray(payload) ? payload : payload.users || []).filter(item => {
        const name = String(item.app_metadata?.csv_nome || item.user_metadata?.name || item.email || '').toLowerCase();
        return item.app_metadata?.role !== 'admin' && item.app_metadata?.ativo !== false && name.includes('dayane');
      });
      const { data: conversations } = await sbClient.from('chat_conversas').select('id,colaborador_id').eq('admin_id', user.id); const conversationByUser = new Map((conversations || []).map(item => [item.colaborador_id, item]));
      const conversationIds = (conversations || []).map(item => item.id); let latest = [], unread = [];
      if (conversationIds.length) { latest = (await sbClient.from('chat_mensagens').select('conversa_id,mensagem,created_at').in('conversa_id', conversationIds).order('created_at', { ascending: false })).data || []; unread = (await sbClient.from('chat_notificacoes').select('conversa_id').eq('recipient_id', user.id).eq('lida', false)).data || []; }
      const firstByConversation = new Map(); latest.forEach(item => { if (!firstByConversation.has(item.conversa_id)) firstByConversation.set(item.conversa_id, item); }); const unreadCounts = unread.reduce((map, item) => map.set(item.conversa_id, (map.get(item.conversa_id) || 0) + 1), new Map()); const favorites = getFavorites(user.id);
      users.sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) || String(a.user_metadata?.name || a.email).localeCompare(String(b.user_metadata?.name || b.email)));
      const people = root.querySelector('#chatPeople'); people.innerHTML = users.length ? users.map(item => { const conversation = conversationByUser.get(item.id); const last = conversation && firstByConversation.get(conversation.id); const preview = last ? (last.mensagem || '📷 Imagem') : 'Iniciar conversa'; const count = conversation ? unreadCounts.get(conversation.id) || 0 : 0; return `<button class="chat-person" data-id="${esc(item.id)}" data-label="Conversa privada"><span class="chat-person-title"><strong>Conversa privada</strong><span>${favorites.includes(item.id) ? '★' : ''}${count ? `<b class="chat-person-unread">${count}</b>` : ''}</span></span><small>${esc(preview.slice(0, 70))}${last ? ` · ${new Date(last.created_at).toLocaleDateString('pt-BR')}` : ''}</small></button>`; }).join('') : '<p class="chat-empty">Conversa privada indisponível.</p>';
      people.querySelectorAll('.chat-person').forEach(button => button.onclick = () => openConversation({ id: button.dataset.id, label: button.dataset.label }));
    } catch (error) { root.querySelector('#chatPeople').textContent = error.message; }
  }
  function minimizeChat() { document.getElementById('chatOverlay')?.classList.add('minimized'); }
  function restoreChat() { document.getElementById('chatOverlay')?.classList.remove('minimized'); }
  function closeChat() { if (!isAdminChat()) return; document.body.classList.remove('chat-page'); document.getElementById('chatOverlay')?.classList.remove('open'); if (realtimeChannel) sbClient.removeChannel(realtimeChannel); realtimeChannel = null; }
  function openChat() { if (isAdminChat() && !new URLSearchParams(location.search).has('chat')) { window.open(location.pathname + '?chat=1', '_blank', 'noopener'); return; } initChatNotifications(); document.body.classList.toggle('chat-page', !isAdminChat() || new URLSearchParams(location.search).has('chat')); document.getElementById('chatOverlay')?.classList.add('open'); renderChatHome(); }
  document.addEventListener('app-role-ready', () => { initChatNotifications(); if (new URLSearchParams(location.search).has('chat')) setTimeout(openChat, 80); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && currentConversation) currentUser().then(markConversationRead); });
  document.getElementById('chatBtn')?.addEventListener('click', openChat); document.getElementById('chatBtnTop')?.addEventListener('click', openChat); document.getElementById('chatOverlayClose')?.addEventListener('click', closeChat); document.getElementById('chatOverlay')?.addEventListener('click', event => { if (event.target.id === 'chatOverlay' && event.currentTarget.classList.contains('minimized')) restoreChat(); });
  window.openChat = openChat; initChatNotifications();
})();
