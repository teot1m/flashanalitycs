export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      res.status(200).json({ ok: true, status: 'ready' });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method Not Allowed' });
      return;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    const dashboardUrl = (process.env.DASHBOARD_URL || 'https://teot1m.github.io/flashanalitycs/').replace(/\/+$/, '');
    const apiUrl = process.env.APPS_SCRIPT_API_URL || '';

    if (!botToken || !apiUrl) {
      res.status(200).json({ ok: false, error: 'missing_env' });
      return;
    }

    const update = req.body && typeof req.body === 'object' ? req.body : {};
    const message = update.message || update.edited_message || null;
    if (!message || !message.chat) {
      res.status(200).json({ ok: true });
      return;
    }

    const chatId = message.chat.id;
    const userId = message.from ? message.from.id : null;
    const text = String(message.text || '').trim();
    const webAppData = message.web_app_data && message.web_app_data.data ? String(message.web_app_data.data) : '';

    if (webAppData) {
      await handleRegistration(chatId, userId, webAppData, botToken, apiUrl);
      res.status(200).json({ ok: true });
      return;
    }

    if (text.startsWith('/start') || text.startsWith('/stats')) {
      await handleStart(chatId, userId, botToken, apiUrl, dashboardUrl);
      res.status(200).json({ ok: true });
      return;
    }

    if (text.startsWith('/id')) {
      await sendMessage(botToken, chatId, `Ваш userId: ${userId || '—'}`);
      res.status(200).json({ ok: true });
      return;
    }

    await sendMessage(botToken, chatId, 'Команди: /start або /stats (посилання), /id (ваш userId).');
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

async function handleStart(chatId, userId, botToken, apiUrl, dashboardUrl) {
  if (!userId) {
    await sendMessage(botToken, chatId, 'Не вдалося визначити userId. Спробуйте ще раз.');
    return;
  }

  let access = null;
  try {
    access = await apiGet(apiUrl, { action: 'getAccess', userId: String(userId), force: '1' });
  } catch (e) {
    await sendMessage(botToken, chatId, 'Помилка доступу. Спробуйте пізніше.');
    return;
  }

  if (access && access.error === 'not_found') {
    const registerUrl = `${dashboardUrl}/?register=1&userid=${encodeURIComponent(String(userId))}`;
    const replyMarkup = {
      keyboard: [[{ text: 'Реєстрація', web_app: { url: registerUrl } }]],
      resize_keyboard: true,
      one_time_keyboard: true
    };
    await sendMessage(botToken, chatId, 'Вас ще немає в системі. Натисніть кнопку Реєстрація та оберіть менеджера.', replyMarkup);
    return;
  }

  if (!access || access.error) {
    await sendMessage(botToken, chatId, 'Помилка доступу. Спробуйте пізніше.');
    return;
  }

  if (!access.role) {
    await sendMessage(botToken, chatId, 'Ваш запит на розглядi. Очікуйте підтвердження.', { remove_keyboard: true });
    return;
  }

  const link = `${dashboardUrl}/?userid=${encodeURIComponent(String(userId))}`;
  const replyMarkup = {
    keyboard: [[{ text: 'Відкрити звіт', web_app: { url: link } }]],
    resize_keyboard: true
  };
  await sendMessage(botToken, chatId, `Ваш доступ: ${access.role}`, replyMarkup);
}

async function handleRegistration(chatId, userId, rawData, botToken, apiUrl) {
  let payload = null;
  try {
    payload = JSON.parse(rawData);
  } catch (e) {
    payload = { manager: rawData };
  }

  const manager = String(payload.manager || payload.value || '').trim();
  const payloadUserId = payload.userId ? String(payload.userId).trim() : '';
  if (payloadUserId && String(userId) !== payloadUserId) {
    await sendMessage(botToken, chatId, 'Помилка: невідповідність userId. Спробуйте ще раз.', { remove_keyboard: true });
    return;
  }
  if (!manager) {
    await sendMessage(botToken, chatId, 'Не вдалося визначити менеджера. Спробуйте ще раз.', { remove_keyboard: true });
    return;
  }

  const res = await apiGet(apiUrl, { action: 'register', userId: String(userId), manager: manager });
  if (res && res.ok) {
    await sendMessage(botToken, chatId, 'Ваш запит на розглядi. Очікуйте підтвердження.', { remove_keyboard: true });
    return;
  }

  if (res && res.error === 'manager_taken') {
    await sendMessage(botToken, chatId, 'Менеджер вже зайнятий. Оберіть іншого.', { remove_keyboard: true });
    return;
  }

  await sendMessage(botToken, chatId, 'Помилка реєстрації. Спробуйте пізніше.', { remove_keyboard: true });
}

async function apiGet(apiUrl, params) {
  const qs = new URLSearchParams(params).toString();
  const url = `${apiUrl}?${qs}`;
  const res = await fetch(url, { method: 'GET' });
  return await res.json();
}

async function sendMessage(botToken, chatId, text, replyMarkup) {
  if (!botToken || !chatId) return;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = { chat_id: chatId, text: text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    // ignore
  }
}
