import { useState } from 'react'
import { supabase } from './supabase'

function translateError(msg) {
  if (msg.includes('Invalid login credentials')) return 'Nesprávný e-mail nebo heslo.'
  if (msg.includes('Email not confirmed')) return 'E-mail ještě nebyl potvrzen. Zkontrolujte schránku.'
  if (msg.includes('User already registered')) return 'Tento e-mail je již zaregistrován. Přihlaste se.'
  if (msg.includes('Password should be at least')) return 'Heslo musí mít alespoň 6 znaků.'
  if (msg.includes('Unable to validate email address')) return 'Neplatná e-mailová adresa.'
  if (msg.includes('Email rate limit exceeded')) return 'Příliš mnoho pokusů. Zkuste to za chvíli.'
  if (msg.includes('Signups not allowed')) return 'Registrace je zakázána v nastavení Supabase.'
  return msg
}

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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data?.session) onClose()
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        if (data?.session) { onClose() }
        else setMsg({ type: 'ok', text: '✅ Registrace úspěšná! Zkontrolujte e-mail a klikněte na potvrzovací odkaz.' })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMsg({ type: 'ok', text: '✅ Odkaz pro reset hesla byl odeslán na váš e-mail.' })
      }
    } catch (err) {
      setMsg({ type: 'err', text: translateError(err.message) })
    } finally {
      setLoading(false)
    }
  }

  const S = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99, backdropFilter: 'blur(5px)' },
    modal:   { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 100, width: 'min(380px,93vw)', background: '#13161f', border: '1px solid #1e2230', borderRadius: 16, padding: '26px 22px', fontFamily: "'DM Sans',sans-serif" },
    label:   { display: 'block', fontSize: 11, fontWeight: 600, color: '#5a6178', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 },
    input:   { width: '100%', padding: '10px 13px', background: '#0f1117', color: '#e8eaf0', border: '1.5px solid #2a2f42', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
    mainBtn: { width: '100%', padding: '11px 0', borderRadius: 9, background: '#6c8fff', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit' },
    link:    { background: 'none', border: 'none', color: '#6c8fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  }

  return (
    <>
      <div onClick={onClose} style={S.overlay} />
      <div style={S.modal}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
          *{box-sizing:border-box}
          .ai-inp:focus{border-color:#6c8fff!important}
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
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

        {/* Zpráva */}
        {msg && (
          <div style={{ marginBottom: 14, padding: '10px 13px', borderRadius: 9, background: msg.type === 'ok' ? '#1a3a2a' : '#2a1a1a', border: `1px solid ${msg.type === 'ok' ? '#2d6a4a' : '#6a2d2d'}`, color: msg.type === 'ok' ? '#6ee7b7' : '#fca5a5', fontSize: 13, lineHeight: 1.5 }}>
            {msg.text}
          </div>
        )}

        {/* Formulář */}
        <form onSubmit={handle}>
          <label style={S.label}>E-mail</label>
          <input className="ai-inp" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="vas@email.cz" style={{ ...S.input, marginBottom: 13 }} />
          {mode !== 'forgot' && (
            <>
              <label style={S.label}>Heslo {mode === 'register' && <span style={{ color: '#3a4160', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(min. 6 znaků)</span>}</label>
              <input className="ai-inp" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" style={S.input} />
            </>
          )}
          <button type="submit" disabled={loading} style={{ ...S.mainBtn, marginTop: 16, opacity: loading ? 0.6 : 1 }}>
            {loading ? '⏳ Načítám…' : mode === 'login' ? 'Přihlásit se' : mode === 'register' ? 'Registrovat se' : 'Odeslat odkaz'}
          </button>
        </form>

        {/* Přepínání */}
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#5a6178' }}>
          {mode === 'login' && <>
            <span>Nemáte účet? </span>
            <button style={S.link} onClick={() => { setMode('register'); setMsg(null) }}>Registrovat se</button>
            <br />
            <button style={{ ...S.link, color: '#5a6178', marginTop: 7, fontSize: 12 }} onClick={() => { setMode('forgot'); setMsg(null) }}>Zapomenuté heslo?</button>
          </>}
          {mode === 'register' && <>
            <span>Máte účet? </span>
            <button style={S.link} onClick={() => { setMode('login'); setMsg(null) }}>Přihlásit se</button>
          </>}
          {mode === 'forgot' && <button style={S.link} onClick={() => { setMode('login'); setMsg(null) }}>← Zpět na přihlášení</button>}
        </div>
      </div>
    </>
  )
}
