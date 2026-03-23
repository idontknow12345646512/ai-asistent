import { useState } from 'react'
import { supabase } from './supabase'

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  // Přeloží anglické chyby ze Supabase do češtiny
  function translateError(msg) {
    if (msg.includes('Invalid login credentials')) return 'Nesprávný e-mail nebo heslo.'
    if (msg.includes('Email not confirmed')) return 'E-mail ještě nebyl potvrzen. Zkontrolujte schránku.'
    if (msg.includes('User already registered')) return 'Tento e-mail je již zaregistrován. Přihlaste se.'
    if (msg.includes('Password should be at least')) return 'Heslo musí mít alespoň 6 znaků.'
    if (msg.includes('Unable to validate email address')) return 'Neplatná e-mailová adresa.'
    if (msg.includes('Email rate limit exceeded')) return 'Příliš mnoho pokusů. Zkuste to za chvíli.'
    if (msg.includes('provider is not enabled')) return 'Tento způsob přihlášení není zapnutý v Supabase. Viz návod níže.'
    if (msg.includes('Signups not allowed')) return 'Registrace je zakázána v nastavení Supabase.'
    return msg
  }

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data?.session) onClose()
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // emailRedirectTo zajistí správné přesměrování po potvrzení e-mailu
            emailRedirectTo: window.location.origin,
          }
        })
        if (error) throw error
        // Pokud e-mail není potřeba potvrdit, rovnou přihlásíme
        if (data?.session) {
          onClose()
        } else {
          setMsg({ type: 'ok', text: '✅ Registrace úspěšná! Zkontrolujte e-mail a klikněte na potvrzovací odkaz.' })
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '?reset=true'
        })
        if (error) throw error
        setMsg({ type: 'ok', text: '✅ Odkaz pro reset hesla byl odeslán na váš e-mail.' })
      }
    } catch (err) {
      setMsg({ type: 'err', text: translateError(err.message) })
    } finally {
      setLoading(false)
    }
  }

  const oauth = async (provider) => {
    setLoading(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
        queryParams: provider === 'google' ? { access_type: 'offline', prompt: 'consent' } : undefined,
      }
    })
    if (error) {
      setMsg({ type: 'err', text: translateError(error.message) })
      setLoading(false)
    }
    // Pokud není chyba, prohlížeč nás přesměruje na OAuth stránku
  }

  const S = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99, backdropFilter: 'blur(5px)' },
    modal: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 100, width: 'min(400px,93vw)', background: '#13161f', border: '1px solid #1e2230', borderRadius: 16, padding: '26px 22px', fontFamily: "'DM Sans',sans-serif" },
    label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#5a6178', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 },
    input: { width: '100%', padding: '10px 13px', background: '#0f1117', color: '#e8eaf0', border: '1.5px solid #2a2f42', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
    oauthBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '9px 0', borderRadius: 9, background: '#1a1d2a', border: '1px solid #2a2f42', color: '#e8eaf0', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 },
    mainBtn: { width: '100%', padding: '11px 0', borderRadius: 9, background: '#6c8fff', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit' },
    link: { background: 'none', border: 'none', color: '#6c8fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
    divider: { display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' },
  }

  return (
    <>
      <div onClick={onClose} style={S.overlay} />
      <div style={S.modal}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
          *{box-sizing:border-box}
          .ai-inp:focus{border-color:#6c8fff!important}
          .ob:hover{background:#22263a!important}
          .ob-discord:hover{background:#4752c4!important}
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#6c8fff22', border: '1.5px solid #6c8fff55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: '#6c8fff', marginBottom: 10 }}>✦</div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e8eaf0', margin: 0 }}>
              {mode === 'login' ? 'Přihlásit se' : mode === 'register' ? 'Vytvořit účet' : 'Obnovit heslo'}
            </h2>
            <p style={{ fontSize: 12, color: '#5a6178', marginTop: 3 }}>
              {mode === 'login' ? 'Konverzace se budou ukládat' : mode === 'register' ? 'Zdarma · Konverzace se ukládají' : 'Pošleme odkaz na váš e-mail'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5a6178', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 2px', fontFamily: 'inherit' }}>×</button>
        </div>

        {/* OAuth */}
        {mode !== 'forgot' && (
          <>
            <button className="ob" onClick={() => oauth('google')} disabled={loading} style={S.oauthBtn}>
              <svg width="17" height="17" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.9 2.5 30.3 0 24 0 14.7 0 6.7 5.5 2.8 13.5l7.9 6.1C12.5 13.1 17.8 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.5 2.9-2.2 5.4-4.7 7l7.3 5.7c4.3-3.9 6.8-9.7 6.8-16.7z"/>
                <path fill="#FBBC05" d="M10.7 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.7-4.5l-7.9-6.1A23.8 23.8 0 0 0 0 24c0 3.8.9 7.4 2.5 10.6l8.2-6z"/>
                <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.9 2.2-6.2 0-11.5-3.6-13.3-9.6l-8.2 6C6.7 42.5 14.7 48 24 48z"/>
              </svg>
              Pokračovat s Google
            </button>
            <button className="ob ob-discord" onClick={() => oauth('discord')} disabled={loading} style={{ ...S.oauthBtn, background: '#5865F2', borderColor: '#5865F2', color: '#fff' }}>
              <svg width="17" height="17" viewBox="0 0 71 55" fill="white">
                <path d="M60.1 4.9A58.6 58.6 0 0 0 45.6.4a.2.2 0 0 0-.2.1 41 41 0 0 0-1.8 3.7 54.1 54.1 0 0 0-16.2 0A37.9 37.9 0 0 0 25.5.5a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.8 4.9a.2.2 0 0 0-.1.1C1.6 18.1-.9 31 .3 43.6a.2.2 0 0 0 .1.2 58.9 58.9 0 0 0 17.7 8.9.2.2 0 0 0 .2-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.8 38.8 0 0 1-5.5-2.6.2.2 0 0 1 0-.4c.4-.3.7-.6 1.1-.9a.2.2 0 0 1 .2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 0 1 .2 0c.4.3.7.6 1.1.9a.2.2 0 0 1 0 .4 36.1 36.1 0 0 1-5.5 2.6.2.2 0 0 0-.1.3 47.1 47.1 0 0 0 3.6 5.9.2.2 0 0 0 .2.1 58.7 58.7 0 0 0 17.8-8.9.2.2 0 0 0 .1-.2c1.4-14.7-2.4-27.5-10.3-38.8a.2.2 0 0 0-.1 0zM23.7 35.8c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.6 0 6.5 3.2 6.4 7.1 0 3.9-2.8 7.1-6.4 7.1zm23.6 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.6 0 6.5 3.2 6.4 7.1 0 3.9-2.8 7.1-6.4 7.1z"/>
              </svg>
              Pokračovat s Discord
            </button>

            <div style={S.divider}>
              <div style={{ flex: 1, height: 1, background: '#1e2230' }} />
              <span style={{ fontSize: 12, color: '#5a6178' }}>nebo e-mailem</span>
              <div style={{ flex: 1, height: 1, background: '#1e2230' }} />
            </div>
          </>
        )}

        {/* Chybová / úspěšná zpráva */}
        {msg && (
          <div style={{ marginBottom: 14, padding: '10px 13px', borderRadius: 9, background: msg.type === 'ok' ? '#1a3a2a' : '#2a1a1a', border: `1px solid ${msg.type === 'ok' ? '#2d6a4a' : '#6a2d2d'}`, color: msg.type === 'ok' ? '#6ee7b7' : '#fca5a5', fontSize: 13, lineHeight: 1.5 }}>
            {msg.text}
            {msg.text.includes('není zapnutý') && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#0f1117', borderRadius: 6, fontSize: 12, color: '#94a3b8' }}>
                💡 <strong>Jak zapnout:</strong> Supabase → Authentication → Providers → vyberte Google nebo Discord → zapněte a vyplňte Client ID + Secret
              </div>
            )}
          </div>
        )}

        {/* Formulář */}
        <form onSubmit={handle}>
          <label style={S.label}>E-mail</label>
          <input
            className="ai-inp"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="vas@email.cz"
            style={{ ...S.input, marginBottom: 13 }}
          />

          {mode !== 'forgot' && (
            <>
              <label style={S.label}>Heslo {mode === 'register' && <span style={{ color: '#3a4160', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(min. 6 znaků)</span>}</label>
              <input
                className="ai-inp"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                style={S.input}
              />
            </>
          )}

          <button type="submit" disabled={loading} style={{ ...S.mainBtn, marginTop: 16, opacity: loading ? 0.6 : 1 }}>
            {loading ? '⏳ Načítám…' : mode === 'login' ? 'Přihlásit se' : mode === 'register' ? 'Registrovat se' : 'Odeslat odkaz'}
          </button>
        </form>

        {/* Přepínání režimů */}
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#5a6178' }}>
          {mode === 'login' && (
            <>
              <span>Nemáte účet? </span>
              <button style={S.link} onClick={() => { setMode('register'); setMsg(null) }}>Registrovat se</button>
              <br />
              <button style={{ ...S.link, color: '#5a6178', marginTop: 7, fontSize: 12 }} onClick={() => { setMode('forgot'); setMsg(null) }}>
                Zapomenuté heslo?
              </button>
            </>
          )}
          {mode === 'register' && (
            <>
              <span>Máte účet? </span>
              <button style={S.link} onClick={() => { setMode('login'); setMsg(null) }}>Přihlásit se</button>
            </>
          )}
          {mode === 'forgot' && (
            <button style={S.link} onClick={() => { setMode('login'); setMsg(null) }}>← Zpět na přihlášení</button>
          )}
        </div>
      </div>
    </>
  )
}
