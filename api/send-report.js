export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!botToken) {
    res.status(200).json({ ok: false, error: 'missing_env' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const userId = body.userId ? String(body.userId).trim() : '';
  const text = body.text ? String(body.text) : '';
  if (!userId || !text) {
    res.status(200).json({ ok: false, error: 'bad_request' });
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: userId,
      text: text
    };
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}
