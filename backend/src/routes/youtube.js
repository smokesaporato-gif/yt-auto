const express = require('express');
const { getAuthUrl, getTokensFromCode } = require('../services/youtube');
const router = express.Router();

// Step 1: Redirect to Google OAuth
router.get('/login', (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

// Step 2: Google callback with code
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Código não recebido');

  try {
    const tokens = await getTokensFromCode(code);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>YT Auto - Conectado!</title>
        <style>
          body { font-family: 'Inter', sans-serif; background: #0a0a0a; color: #34d399; padding: 40px; display: flex; justify-content: center; }
          .card { background: #141414; border: 1px solid #2c2c2e; border-radius: 16px; padding: 40px; max-width: 600px; }
          h2 { margin-bottom: 16px; }
          pre { background: #1c1c1e; padding: 16px; border-radius: 10px; color: #f5f5f7; font-size: 13px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
          p { color: #98989d; margin-top: 16px; font-size: 14px; }
          .copy-btn { margin-top: 12px; padding: 10px 20px; background: #ff0000; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
          .copy-btn:hover { background: #cc0000; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>✅ YouTube conectado com sucesso!</h2>
          <p>Copie e cole estas linhas no arquivo <b>.env</b> do backend:</p>
          <pre id="tokens">GOOGLE_ACCESS_TOKEN=${tokens.access_token}
GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</pre>
          <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('tokens').textContent).then(()=>this.textContent='✅ Copiado!')">📋 Copiar</button>
          <p>Depois reinicie o servidor no Render.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><style>body { font-family: sans-serif; background: #0a0a0a; color: #f87171; padding: 40px; }</style></head>
      <body><h2>❌ Erro ao conectar</h2><p>${err.message}</p><p><a href="/auth/login" style="color:#60a5fa">Tentar novamente</a></p></body>
      </html>
    `);
  }
});

module.exports = router;