import { useState } from 'react'
import { supabase } from './supabase'

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
      } else if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg({ type: 'ok', text: 'Registrace úspěšná! Zkontrolujte e-mail.' })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMsg({ type: 'ok', text: 'Odkaz pro reset hesla byl odeslán.' })
      }
    } catch (err) {
      setMsg({ type: 'err', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  const oauth = async (provider) => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    })
    if (error) { setMsg({ type: 'err', text: error.message }); setLoading(false) }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 99, backdropFilter: 'blur(4px)' }} />

      {/* Modal */}
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 100, width: 'min(400px, 92vw)', background: '#13161f', border: '1px solid #1e2230', borderRadius: 16, padding: '28px 24px', fontFamily: "'DM Sans', sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
          .auth-input { width:100%; padding:10px 13px; background:#0f1117; color:#e8eaf0; border:1.5px solid #2a2f42; border-radius:9px; font-size:14px; font-family:inherit; outline:none; box-sizing:border-box; }
          .auth-input:focus { border-color: #6c8fff; }
          .oauth-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:10px; padding:10px 0; border-radius:9px; background:#1a1d2a; border:1px solid #2a2f42; color:#e8eaf0; font-size:14px; font-weight:500; cursor:pointer; font-family:inherit; }
          .oauth-btn:hover { background:#22263a; }
          .auth-link { background:none; border:none; color:#6c8fff; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#6c8fff22', border: '1.5px solid #6c8fff44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#6c8fff', marginBottom: 10 }}>✦</div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: '#e8eaf0', margin: 0 }}>
              {mode === 'login' ? 'Přihlásit se' : mode === 'register' ? 'Vytvořit účet' : 'Obnovit heslo'}
            </h2>
            <p style={{ fontSize: 12, color: '#5a6178', marginTop: 3 }}>
              {mode === 'login' ? 'Pro uložení historie konverzací' : mode === 'register' ? 'Zdarma, konverzace se ukládají' : 'Zašleme vám odkaz na e-mail'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5a6178', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 2 }}>×</button>
        </div>

        {/* OAuth buttons */}
        {mode !== 'forgot' && (
          <>
            <button className="oauth-btn" onClick={() => oauth('google')} disabled={loading} style={{ marginBottom: 8 }}>
              <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.9 2.5 30.3 0 24 0 14.7 0 6.7 5.5 2.8 13.5l7.9 6.1C12.5 13.1 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.5 2.9-2.2 5.4-4.7 7l7.3 5.7c4.3-3.9 6.8-9.7 6.8-16.7z"/><path fill="#FBBC05" d="M10.7 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.7-4.5l-7.9-6.1A23.8 23.8 0 0 0 0 24c0 3.8.9 7.4 2.5 10.6l8.2-6z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.9 2.2-6.2 0-11.5-3.6-13.3-9.6l-8.2 6C6.7 42.5 14.7 48 24 48z"/></svg>
              Pokračovat s Google
            </button>
            <button className="oauth-btn" onClick={() => oauth('discord')} disabled={loading} style={{ marginBottom: 18, background: '#5865F2', borderColor: '#5865F2', color: '#fff' }}>
              <svg width="17" height="17" viewBox="0 0 71 55" fill="white"><path d="M60.1 4.9A58.6 58.6 0 0 0 45.6.4a.2.2 0 0 0-.2.1 41 41 0 0 0-1.8 3.7 54.1 54.1 0 0 0-16.2 0A37.9 37.9 0 0 0 25.5.5a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.8 4.9a.2.2 0 0 0-.1.1C1.6 18.1-.9 31 .3 43.6a.2.2 0 0 0 .1.2 58.9 58.9 0 0 0 17.7 8.9.2.2 0 0 0 .2-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.8 38.8 0 0 1-5.5-2.6.2.2 0 0 1 0-.4c.4-.3.7-.6 1.1-.9a.2.2 0 0 1 .2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 0 1 .2 0c.4.3.7.6 1.1.9a.2.2 0 0 1 0 .4 36.1 36.1 0 0 1-5.5 2.6.2.2 0 0 0-.1.3 47.1 47.1 0 0 0 3.6 5.9.2.2 0 0 0 .2.1 58.7 58.7 0 0 0 17.8-8.9.2.2 0 0 0 .1-.2c1.4-14.7-2.4-27.5-10.3-38.8a.2.2 0 0 0-.1 0zM23.7 35.8c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.6 0 6.5 3.2 6.4 7.1 0 3.9-2.8 7.1-6.4 7.1zm23.6 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.6 0 6.5 3.2 6.4 7.1 0 3.9-2.8 7.1-6.4 7.1z"/></svg>
              Pokračovat s Discord
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: '#1e2230' }} />
              <span style={{ fontSize: 12, color: '#5a6178' }}>nebo e-mailem</span>
              <div style={{ flex: 1, height: 1, background: '#1e2230' }} />
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={handle}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#5a6178', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>E-mail</label>
          <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="vas@email.cz" style={{ marginBottom: 14 }} />

          {mode !== 'forgot' && (
            <>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#5a6178', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Heslo</label>
              <input className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
            </>
          )}

          {msg && (
            <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 8, background: msg.type === 'ok' ? '#22543d22' : '#ff444418', border: `1px solid ${msg.type === 'ok' ? '#22543d' : '#ff444440'}`, color: msg.type === 'ok' ? '#68d391' : '#fc8181', fontSize: 13 }}>
              {msg.text}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 16, padding: '11px 0', borderRadius: 9, background: '#6c8fff', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Načítám…' : mode === 'login' ? 'Přihlásit se' : mode === 'register' ? 'Registrovat se' : 'Odeslat odkaz'}
          </button>
        </form>

        {/* Switchers */}
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#5a6178' }}>
          {mode === 'login' && <>
            <span>Nemáte účet? </span><button className="auth-link" onClick={() => { setMode('register'); setMsg(null) }}>Registrovat se</button>
            <br /><button className="auth-link" style={{ color: '#5a6178', marginTop: 6 }} onClick={() => { setMode('forgot'); setMsg(null) }}>Zapomenuté heslo?</button>
          </>}
          {mode === 'register' && <>
            <span>Máte účet? </span><button className="auth-link" onClick={() => { setMode('login'); setMsg(null) }}>Přihlásit se</button>
          </>}
          {mode === 'forgot' && <button className="auth-link" onClick={() => { setMode('login'); setMsg(null) }}>← Zpět na přihlášení</button>}
        </div>
      </div>
    </>
  )
}
