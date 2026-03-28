import { useState } from 'react'
import { supabase } from './supabase'

const ERR_MAP = {
  'Invalid login credentials': 'Nesprávný e-mail nebo heslo.',
  'Email not confirmed': 'E-mail nebyl potvrzen. Zkontrolujte schránku.',
  'User already registered': 'Tento e-mail je již zaregistrován.',
  'Password should be at least': 'Heslo musí mít alespoň 6 znaků.',
  'Email rate limit exceeded': 'Příliš mnoho pokusů. Zkuste za chvíli.',
  'Signups not allowed': 'Registrace je zakázána v nastavení.',
}
const xlat = m => { for (const [k,v] of Object.entries(ERR_MAP)) if (m.includes(k)) return v; return m }

export default function AuthModal({ onClose, dark }) {
  const [mode, setMode]       = useState('login')
  const [email, setEmail]     = useState('')
  const [pw, setPw]           = useState('')
  const [name, setName]       = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState(null)

  const t = dark
    ? { bg:'#13161f', border:'#1e2230', txt:'#e8eaf0', muted:'#5a6178', inBg:'#0f1117', inBrd:'#2a2f42', accent:'#6c8fff', success:'#1a3a2a', successTxt:'#6ee7b7', err:'#2a1a1a', errTxt:'#fca5a5' }
    : { bg:'#fff', border:'#e2e6f0', txt:'#1a1d2a', muted:'#7a849a', inBg:'#f4f6fb', inBrd:'#d8dde8', accent:'#4c6ef5', success:'#f0fff4', successTxt:'#276749', err:'#fff5f5', errTxt:'#c53030' }

  const submit = async e => {
    e.preventDefault(); setLoading(true); setMsg(null)
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw })
        if (error) throw error
        if (data?.session) onClose()
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email, password: pw,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name || email.split('@')[0] } }
        })
        if (error) throw error
        if (data?.session) onClose()
        else setMsg({ ok: true, text: '✅ Registrace úspěšná! Zkontrolujte e-mail pro potvrzení.' })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMsg({ ok: true, text: '✅ Odkaz pro reset hesla byl odeslán.' })
      }
    } catch (err) { setMsg({ ok: false, text: xlat(err.message) }) }
    finally { setLoading(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:99, backdropFilter:'blur(6px)' }}/>
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:100, width:'min(400px,94vw)', background:t.bg, border:`1px solid ${t.border}`, borderRadius:18, padding:'28px 24px', fontFamily:"'DM Sans',sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
          .auth-in{width:100%;padding:11px 13px;background:${t.inBg};color:${t.txt};border:1.5px solid ${t.inBrd};border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .15s}
          .auth-in:focus{border-color:${t.accent}!important}
          .auth-btn{width:100%;padding:12px;border-radius:10px;background:${t.accent};color:#fff;font-size:14px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:opacity .15s}
          .auth-btn:hover{opacity:.88}.auth-btn:disabled{opacity:.5;cursor:default}
          .auth-link{background:none;border:none;color:${t.accent};font-size:13px;font-weight:500;cursor:pointer;font-family:inherit}
        `}</style>

        {/* Logo + title */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
          <div>
            <div style={{ width:40, height:40, borderRadius:11, background:t.accent+'22', border:`1.5px solid ${t.accent}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:t.accent, marginBottom:12 }}>✦</div>
            <h2 style={{ fontSize:17, fontWeight:600, color:t.txt, margin:0 }}>
              {mode==='login'?'Přihlásit se':mode==='register'?'Vytvořit účet':'Obnovit heslo'}
            </h2>
            <p style={{ fontSize:12, color:t.muted, marginTop:3 }}>
              {mode==='login'?'Vítejte zpět!':mode==='register'?'Připojte se zdarma':'Pošleme vám odkaz na e-mail'}
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:t.muted, cursor:'pointer', fontSize:22, lineHeight:1, fontFamily:'inherit', padding:'0 2px' }}>×</button>
        </div>

        {msg && (
          <div style={{ marginBottom:16, padding:'10px 13px', borderRadius:10, background:msg.ok?t.success:t.err, border:`1px solid ${msg.ok?t.successTxt+'44':t.errTxt+'44'}`, color:msg.ok?t.successTxt:t.errTxt, fontSize:13, lineHeight:1.5 }}>
            {msg.text}
          </div>
        )}

        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {mode==='register' && (
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:t.muted, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>Jméno (volitelné)</label>
              <input className="auth-in" type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Vaše jméno"/>
            </div>
          )}
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:t.muted, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>E-mail</label>
            <input className="auth-in" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="vas@email.cz"/>
          </div>
          {mode!=='forgot' && (
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:t.muted, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>
                Heslo {mode==='register'&&<span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>(min. 6 znaků)</span>}
              </label>
              <input className="auth-in" type="password" value={pw} onChange={e=>setPw(e.target.value)} required minLength={6} placeholder="••••••••"/>
            </div>
          )}
          <button type="submit" className="auth-btn" disabled={loading} style={{ marginTop:4 }}>
            {loading ? '⏳ Pracuji…' : mode==='login'?'Přihlásit se':mode==='register'?'Registrovat se':'Odeslat odkaz'}
          </button>
        </form>

        <div style={{ marginTop:16, textAlign:'center', fontSize:13, color:t.muted }}>
          {mode==='login'&&<>
            <span>Nemáte účet? </span><button className="auth-link" onClick={()=>{setMode('register');setMsg(null)}}>Registrovat se</button>
            <br/><button className="auth-link" style={{ color:t.muted, marginTop:6, fontSize:12 }} onClick={()=>{setMode('forgot');setMsg(null)}}>Zapomenuté heslo?</button>
          </>}
          {mode==='register'&&<><span>Máte účet? </span><button className="auth-link" onClick={()=>{setMode('login');setMsg(null)}}>Přihlásit se</button></>}
          {mode==='forgot'&&<button className="auth-link" onClick={()=>{setMode('login');setMsg(null)}}>← Zpět</button>}
        </div>
      </div>
    </>
  )
}
