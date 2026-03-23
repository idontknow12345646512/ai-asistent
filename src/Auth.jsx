import { useState } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [mode, setMode] = useState('login') // login | register | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'ok'|'err', text }

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg({ type: 'ok', text: 'Registrace úspěšná! Zkontrolujte e-mail pro potvrzení.' })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMsg({ type: 'ok', text: 'Odkaz pro reset hesla byl odeslán na váš e-mail.' })
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
    if (error) setMsg({ type: 'err', text: error.message })
    setLoading(false)
  }

  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0f1117}
        input{outline:none;font-family:inherit}
        button{cursor:pointer;border:none;font-family:inherit}
        @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .card{animation:fadeIn .3s ease both}
      `}</style>

      <div className="card" style={S.card}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={S.logo}>✦</div>
          <h1 style={{ fontSize:22, fontWeight:600, color:'#e8eaf0', marginTop:12 }}>AI Asistent</h1>
          <p style={{ fontSize:13, color:'#5a6178', marginTop:4 }}>
            {mode === 'login' ? 'Přihlaste se ke svému účtu' : mode === 'register' ? 'Vytvořte nový účet' : 'Obnova hesla'}
          </p>
        </div>

        {/* OAuth */}
        {mode !== 'forgot' && (
          <>
            <button onClick={() => oauth('google')} disabled={loading} style={{ ...S.oauthBtn, marginBottom: 10 }}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.9 2.5 30.3 0 24 0 14.7 0 6.7 5.5 2.8 13.5l7.9 6.1C12.5 13.1 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.5 2.9-2.2 5.4-4.7 7l7.3 5.7c4.3-3.9 6.8-9.7 6.8-16.7z" /><path fill="#FBBC05" d="M10.7 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.7-4.5l-7.9-6.1A23.8 23.8 0 0 0 0 24c0 3.8.9 7.4 2.5 10.6l8.2-6z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.9 2.2-6.2 0-11.5-3.6-13.3-9.6l-8.2 6C6.7 42.5 14.7 48 24 48z"/></svg>
              Pokračovat s Google
            </button>
            <button onClick={() => oauth('discord')} disabled={loading} style={{ ...S.oauthBtn, background:'#5865F2', borderColor:'#5865F2', color:'#fff', marginBottom: 20 }}>
              <svg width="18" height="18" viewBox="0 0 71 55" fill="white"><path d="M60.1 4.9A58.6 58.6 0 0 0 45.6.4a.2.2 0 0 0-.2.1 41 41 0 0 0-1.8 3.7 54.1 54.1 0 0 0-16.2 0A37.9 37.9 0 0 0 25.5.5a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.8 4.9a.2.2 0 0 0-.1.1C1.6 18.1-.9 31 .3 43.6a.2.2 0 0 0 .1.2 58.9 58.9 0 0 0 17.7 8.9.2.2 0 0 0 .2-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.8 38.8 0 0 1-5.5-2.6.2.2 0 0 1 0-.4c.4-.3.7-.6 1.1-.9a.2.2 0 0 1 .2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 0 1 .2 0c.4.3.7.6 1.1.9a.2.2 0 0 1 0 .4 36.1 36.1 0 0 1-5.5 2.6.2.2 0 0 0-.1.3 47.1 47.1 0 0 0 3.6 5.9.2.2 0 0 0 .2.1 58.7 58.7 0 0 0 17.8-8.9.2.2 0 0 0 .1-.2c1.4-14.7-2.4-27.5-10.3-38.8a.2.2 0 0 0-.1 0zM23.7 35.8c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.6 0 6.5 3.2 6.4 7.1 0 3.9-2.8 7.1-6.4 7.1zm23.6 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.6 0 6.5 3.2 6.4 7.1 0 3.9-2.8 7.1-6.4 7.1z"/></svg>
              Pokračovat s Discord
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <div style={{ flex:1, height:1, background:'#1e2230' }}/>
              <span style={{ fontSize:12, color:'#5a6178' }}>nebo e-mailem</span>
              <div style={{ flex:1, height:1, background:'#1e2230' }}/>
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={handle}>
          <label style={S.label}>E-mail</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="vas@email.cz" style={S.input}/>

          {mode !== 'forgot' && (
            <>
              <label style={{ ...S.label, marginTop:14 }}>Heslo</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} placeholder="••••••••" style={S.input}/>
            </>
          )}

          {msg && (
            <div style={{ marginTop:14, padding:'9px 12px', borderRadius:8, background: msg.type==='ok'?'#22543d22':'#ff444418', border:`1px solid ${msg.type==='ok'?'#22543d':'#ff444440'}`, color: msg.type==='ok'?'#68d391':'#fc8181', fontSize:13 }}>
              {msg.text}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ ...S.mainBtn, marginTop:18, opacity: loading ? .6 : 1 }}>
            {loading ? 'Načítám…' : mode === 'login' ? 'Přihlásit se' : mode === 'register' ? 'Registrovat se' : 'Odeslat odkaz'}
          </button>
        </form>

        {/* Mode switchers */}
        <div style={{ marginTop:18, textAlign:'center', fontSize:13, color:'#5a6178' }}>
          {mode === 'login' && <>
            <span>Nemáte účet? </span>
            <button onClick={()=>{setMode('register');setMsg(null)}} style={{ color:'#6c8fff', background:'none', fontSize:13, fontWeight:500 }}>Registrovat se</button>
            <span style={{ display:'block', marginTop:8 }}>
              <button onClick={()=>{setMode('forgot');setMsg(null)}} style={{ color:'#5a6178', background:'none', fontSize:12 }}>Zapomenuté heslo?</button>
            </span>
          </>}
          {mode === 'register' && <>
            <span>Máte účet? </span>
            <button onClick={()=>{setMode('login');setMsg(null)}} style={{ color:'#6c8fff', background:'none', fontSize:13, fontWeight:500 }}>Přihlásit se</button>
          </>}
          {mode === 'forgot' && <>
            <button onClick={()=>{setMode('login');setMsg(null)}} style={{ color:'#6c8fff', background:'none', fontSize:13, fontWeight:500 }}>← Zpět na přihlášení</button>
          </>}
        </div>
      </div>
    </div>
  )
}

const S = {
  page: { display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0f1117', padding:20, fontFamily:"'DM Sans',sans-serif" },
  card: { width:'100%', maxWidth:420, background:'#13161f', borderRadius:16, padding:'32px 28px', border:'1px solid #1e2230' },
  logo: { width:52, height:52, borderRadius:14, background:'#6c8fff22', border:'1.5px solid #6c8fff44', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, color:'#6c8fff', margin:'0 auto' },
  label: { display:'block', fontSize:12, fontWeight:600, color:'#5a6178', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 },
  input: { width:'100%', padding:'10px 13px', background:'#0f1117', color:'#e8eaf0', border:'1.5px solid #2a2f42', borderRadius:9, fontSize:14, display:'block' },
  oauthBtn: { width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'10px 0', borderRadius:9, background:'#1a1d2a', border:'1px solid #2a2f42', color:'#e8eaf0', fontSize:14, fontWeight:500 },
  mainBtn: { width:'100%', padding:'11px 0', borderRadius:9, background:'#6c8fff', color:'#fff', fontSize:14, fontWeight:600 },
}
