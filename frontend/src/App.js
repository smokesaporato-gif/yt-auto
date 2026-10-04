import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

// Use relative URL in production, localhost in dev
const API = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : '/api';

// ─── Login Page ───────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('token', data.token);
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">▶</div>
        <h1>YT Auto Upload</h1>
        <p>Faça login para continuar</p>
        <form onSubmit={handleLogin}>
          <input type="text" placeholder="Usuário" value={user} onChange={e => setUser(e.target.value)} autoFocus />
          <input type="password" placeholder="Senha" value={pass} onChange={e => setPass(e.target.value)} />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  );
}

// ─── Upload Form ──────────────────────────────────────────────
function UploadForm({ token, onUploaded }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [privacy, setPrivacy] = useState('private');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Selecione um vídeo');
    if (!title) return setError('Título é obrigatório');

    setUploading(true);
    setError('');
    setProgress(0);

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('tags', tags);
    formData.append('privacy', privacy);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}/videos/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status === 200) {
            setFile(null); setTitle(''); setDescription(''); setTags(''); setProgress(0);
            onUploaded();
          } else {
            setError(data.error || 'Erro no upload');
          }
        } catch {
          setError('Erro ao processar resposta');
        }
        setUploading(false);
      };

      xhr.onerror = () => { setError('Erro de conexão'); setUploading(false); };
      xhr.send(formData);
    } catch (err) {
      setError(err.message);
      setUploading(false);
    }
  };

  return (
    <div className="upload-form">
      <h2>📤 Enviar Vídeo</h2>
      <form onSubmit={handleSubmit}>
        <div className="file-drop" onClick={() => document.getElementById('fileInput').click()}>
          <input id="fileInput" type="file" accept="video/*" hidden onChange={e => setFile(e.target.files[0])} />
          {file ? (
            <span className="file-name">🎬 {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
          ) : (
            <span>Clique para selecionar um vídeo (max 256MB)</span>
          )}
        </div>

        <input type="text" placeholder="Título do vídeo" value={title} onChange={e => setTitle(e.target.value)} />
        <textarea placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)} rows={4} />
        <input type="text" placeholder="Tags (separadas por vírgula)" value={tags} onChange={e => setTags(e.target.value)} />

        <select value={privacy} onChange={e => setPrivacy(e.target.value)}>
          <option value="private">🔒 Privado</option>
          <option value="unlisted">🔗 Não listado</option>
          <option value="public">🌍 Público</option>
        </select>

        {uploading && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            <span>{progress}%</span>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <button type="submit" disabled={uploading}>
          {uploading ? 'Enviando...' : '🚀 Enviar para YouTube'}
        </button>
      </form>
    </div>
  );
}

// ─── Video Queue ──────────────────────────────────────────────
function VideoQueue({ token, refreshKey }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadVideos = useCallback(async () => {
    try {
      const res = await fetch(`${API}/videos/queue`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setVideos(data.reverse());
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { loadVideos(); }, [loadVideos, refreshKey]);

  useEffect(() => {
    const interval = setInterval(loadVideos, 5000);
    return () => clearInterval(interval);
  }, [loadVideos]);

  const deleteVideo = async (id) => {
    if (!window.confirm('Deletar este vídeo da fila?')) return;
    await fetch(`${API}/videos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    loadVideos();
  };

  const retryVideo = async (id) => {
    await fetch(`${API}/videos/${id}/retry`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    loadVideos();
  };

  const statusMap = {
    pending: { icon: '⏳', label: 'Na fila', color: '#fbbf24' },
    uploading: { icon: '⬆️', label: 'Enviando...', color: '#60a5fa' },
    done: { icon: '✅', label: 'Publicado', color: '#34d399' },
    error: { icon: '❌', label: 'Erro', color: '#f87171' }
  };

  if (loading) return <div className="queue-loading">Carregando...</div>;

  return (
    <div className="video-queue">
      <h2>📋 Fila de Vídeos ({videos.length})</h2>
      {videos.length === 0 && <p className="empty">Nenhum vídeo na fila</p>}
      {videos.map(v => {
        const st = statusMap[v.status] || statusMap.pending;
        return (
          <div key={v.id} className="video-card">
            <div className="video-info">
              <div className="video-title">{v.title}</div>
              <div className="video-meta">
                <span className="status-badge" style={{ color: st.color }}>{st.icon} {st.label}</span>
                <span className="file-size">{v.fileSize}</span>
                {v.youtubeId && (
                  <a href={`https://youtube.com/watch?v=${v.youtubeId}`} target="_blank" rel="noreferrer" className="yt-link">
                    ▶ Ver no YouTube
                  </a>
                )}
                {v.error && <span className="video-error">{v.error}</span>}
              </div>
            </div>
            <div className="video-actions">
              {v.status === 'error' && <button onClick={() => retryVideo(v.id)} className="btn-retry">🔄 Retry</button>}
              <button onClick={() => deleteVideo(v.id)} className="btn-delete">🗑️</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────
function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  if (!token) return <LoginPage onLogin={setToken} />;

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <span className="logo">▶</span>
          <h1>YT Auto Upload</h1>
        </div>
        <button onClick={handleLogout} className="btn-logout">Sair</button>
      </header>
      <main>
        <UploadForm token={token} onUploaded={() => setRefreshKey(k => k + 1)} />
        <VideoQueue token={token} refreshKey={refreshKey} />
      </main>
    </div>
  );
}

export default App;