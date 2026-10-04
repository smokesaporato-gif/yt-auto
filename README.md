# YT Auto Upload

Site para upload automático de vídeos no YouTube. Hospedado no Render.

## Setup

### 1. Google Cloud (YouTube API)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto novo
3. Ative a **YouTube Data API v3**
4. Vá em **Credenciais** → **Criar Credencial** → **ID do cliente OAuth**
5. Tipo: **Aplicativo Web**
6. **URI de redirecionamento:** `https://SEU-APP.onrender.com/auth/callback`
7. Copie o **Client ID** e **Client Secret**

### 2. Deploy no Render

1. Crie uma conta no [render.com](https://render.com)
2. Conecte seu repositório GitHub
3. Crie um **Web Service** com as configs:
   - **Build Command:** `cd backend && npm install && cd ../frontend && npm install && npm run build`
   - **Start Command:** `cd backend && node src/server.js`
   - **Environment Variables:**
     ```
     NODE_ENV=production
     PORT=3001
     JWT_SECRET=uma_string_aleatoria_grande
     ADMIN_USER=admin
     ADMIN_PASS=sua_senha
     GOOGLE_CLIENT_ID=seu_client_id
     GOOGLE_CLIENT_SECRET=seu_client_secret
     GOOGLE_REDIRECT_URI=https://SEU-APP.onrender.com/auth/callback
     ```
4. Adicione um **Disk** (1-2GB) montado em `/opt/render/project/src/backend/uploads`

### 3. Conectar YouTube

1. Acesse `https://SEU-APP.onrender.com/auth/login`
2. Faça login com sua conta Google
3. Autorize o acesso ao YouTube
4. Copie os tokens e adicione nas env vars do Render:
   ```
   GOOGLE_ACCESS_TOKEN=token_da_pagina
   GOOGLE_REFRESH_TOKEN=token_da_pagina
   ```
5. Reinicie o serviço no Render

### 4. Uso

1. Acesse o site
2. Login com usuário/senha
3. Selecione o vídeo, preencha título/descrição
4. Clique em "Enviar para YouTube"
5. Acompanhe o status na fila