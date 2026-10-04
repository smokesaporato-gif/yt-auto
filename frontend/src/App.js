import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const API = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : '/api';

// ─── Login ────────────────────────────────────────────────────
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
  const [files, setFiles] = useState([]);
  const [titles, setTitles] = useState([]);
  const [descriptions, setDescriptions] = useState([]);
  const [privacy, setPrivacy] = useState('private');
  const [startTime, setStartTime] = useState('');
  const [intervalHours, setIntervalHours] = useState(24);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const handleFiles = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(selected);
    setTitles(selected.map((f, i) => titles[i] || f.name.replace(/\.[^/.]+$/, '')));
    setDescriptions(selected.map((f, i) => descriptions[i] || ''));
    setSuccess('');
    setError('');
  };

  const updateTitle = (idx, value) => {
    const newTitles = [...titles];
    newTitles[idx] = value;
    setTitles(newTitles);
  };

  const updateDesc = (idx, value) => {
    const newDescs = [...descriptions];
    newDescs[idx] = value;
    setDescriptions(newDescs);
  };

  const removeFile = (idx) => {
    const newFiles = files.filter((_, i) => i !== idx);
    setFiles(newFiles);
    setTitles(titles.filter((_, i) => i !== idx));
    setDescriptions(descriptions.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) return setError('Selecione pelo menos um vídeo');

    // Validate all titles
    for (let i = 0; i < titles.length; i++) {
      if (!titles[i]?.trim()) return setError(`Título obrigatório para o vídeo ${i + 1}`);
    }

    setUploading(true);
    setError('');
    setSuccess('');
    setProgress(0);

    const formData = new FormData();
    files.forEach(f => formData.append('videos', f));
    formData.append('titles', JSON.stringify(titles));
    formData.append('descriptions', JSON.stringify(descriptions));
    formData.append('privacy', privacy);

    if (startTime) {
      formData.append('startTime', new Date(startTime).toISOString());
    }
    formData.append('intervalHours', intervalHours);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}/videos/upload-bulk`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status === 200) {
            setSuccess(`✅ ${data.videos.length} vídeos agendados! Pode fechar o site.`);
            setFiles([]); setTitles([]); setDescriptions([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
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

  // Default start time: now
  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setStartTime(now.toISOString().slice(0, 16));
  }, []);

  return (
    <div className="upload-form">
      <h2>📤 Enviar Vídeos</h2>
      <p className="subtitle">Envie vários vídeos de uma vez. Eles serão postados automaticamente no horário agendado.</p>

      <form onSubmit={handleSubmit}>
        <div className="file-drop" onClick={() => fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" accept="video/*" multiple hidden onChange={handleFiles} />
          {files.length > 0 ? (
            <span className="file-name">🎬 {files.length} vídeo(s) selecionado(s)</span>
          ) : (
            <span>Clique para selecionar vídeos (pode selecionar vários)</span>
          )}
        </div>

        {files.length > 0 && (
          <div className="video-list-editor">
            {files.map((f, i) => (
              <div key={i} className="video-item-editor">
                <div className="video-item-header">
                  <span className="video-number">#{i + 1}</span>
                  <span className="video-filename">{f.name} ({(f.size / 1024 / 1024).toFixed(1)}MB)</span>
                  <button type="button" className="btn-remove" onClick={() => removeFile(i)}>✕</button>
                </div>
                <input
                  type="text"
                  placeholder="Título do vídeo"
                  value={titles[i] || ''}
                  onChange={e => updateTitle(i, e.target.value)}
                />
                <textarea
                  placeholder="Descrição (opcional)"
                  value={descriptions[i] || ''}
                  onChange={e => updateDesc(i, e.target.value)}
                  rows={2}
                />
              </div>
            ))}
          </div>
        )}

        <div className="schedule-section">
          <h3>⏰ Agendamento</h3>
          <div className="schedule-row">
            <div className="schedule-field">
              <label>Começar a postar em:</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
            <div className="schedule-field">
              <label>Intervalo entre posts:</label>
              <select value={intervalHours} onChange={e => setIntervalHours(Number(e.target.value))}>
                <option value={1}>A cada 1 hora</option>
                <option value={3}>A cada 3 horas</option>
                <option value={6}>A cada 6 horas</option>
                <option value={12}>A cada 12 horas</option>
                <option value={24}>A cada 24 horas (1/dia)</option>
                <option value={48}>A cada 48 horas (2/dias)</option>
                <option value={72}>A cada 72 horas (3/dias)</option>
                <option value={168}>A cada semana</option>
              </select>
            </div>
          </div>
          <p className="schedule-hint">
            {files.length > 0 && startTime && (
              <>Último vídeo será postado em: {
                new Date(new Date(startTime).getTime() + ((files.length - 1) * intervalHours * 60 * 60 * 1000))
                  .toLocaleString('pt-BR')
              }</>
            )}
          </p>
        </div>

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
        {success && <div className="success-msg">{success}</div>}

        <button type="submit" disabled={uploading}>
          {uploading ? 'Enviando...' : `🚀 Agendar ${files.length || ''} vídeo(s)`}
        </button>
      </form>
    </div>
  );
}

// ─── Queue ────────────────────────────────────────────────────
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
    const interval = setInterval(loadVideos, 10000);
    return () => clearInterval(interval);
  }, [loadVideos]);

  const deleteVideo = async (id) => {
    if (!window.confirm('Deletar este vídeo?')) return;
    await fetch(`${API}/videos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    loadVideos();
  };

  const statusMap = {
    scheduled: { icon: '⏰', label: 'Agendado', color: '#a78bfa' },
    uploading: { icon: '⬆️', label: 'Enviando...', color: '#60a5fa' },
    done: { icon: '✅', label: 'Publicado', color: '#34d399' },
    error: { icon: '❌', label: 'Erro', color: '#f87171' }
  };

  if (loading) return <div className="queue-loading">Carregando...</div>;

  return (
    <div className="video-queue">
      <h2>📋 Fila ({videos.length})</h2>
      {videos.length === 0 && <p className="empty">Nenhum vídeo na fila</p>}
      {videos.map(v => {
        const st = statusMap[v.status] || statusMap.scheduled;
        const scheduledDate = v.scheduledTime ? new Date(v.scheduledTime) : null;
        return (
          <div key={v.id} className={`video-card status-${v.status}`}>
            <div className="video-info">
              <div className="video-title">{v.title}</div>
              <div className="video-meta">
                <span className="status-badge" style={{ color: st.color }}>{st.icon} {st.label}</span>
                {v.fileSize && <span className="file-size">{v.fileSize}</span>}
                {scheduledDate && v.status === 'scheduled' && (
                  <span className="scheduled-time">
                    📅 {scheduledDate.toLocaleDateString('pt-BR')} às {scheduledDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {v.postedAt && (
                  <span className="posted-time">
                    Postado: {new Date(v.postedAt).toLocaleString('pt-BR')}
                  </span>
                )}
                {v.youtubeId && (
                  <a href={`https://youtube.com/watch?v=${v.youtubeId}`} target="_blank" rel="noreferrer" className="yt-link">
                    ▶ YouTube
                  </a>
                )}
                {v.error && <span className="video-error">{v.error}</span>}
              </div>
            </div>
            <div className="video-actions">
              {v.status === 'error' && (
                <button onClick={async () => {
                  await fetch(`${API}/videos/${v.id}/retry`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                  loadVideos();
                }} className="btn-retry">🔄</button>
              )}
              <button onClick={() => deleteVideo(v.id)} className="btn-delete">🗑️</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────
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