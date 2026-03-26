import { useState } from 'react'
import { supabase } from './supabase'

const ERR = {
  'Invalid login credentials': 'Nesprávný e-mail nebo heslo.',
  'Email not confirmed': 'E-mail nebyl potvrzen. Zkontrolujte schránku.',
  'User already registered': 'Tento e-mail je již zaregistrován.',
  'Password should be at least': 'Heslo musí mít alespoň 6 znaků.',
  'Email rate limit exceeded': 'Příliš mnoho pokusů. Zkuste za chvíli.',
  'Signups not allowed': 'Registrace je zakázána v nastavení.',
}
function xlat(m) { for (const [k, v] of Object.entries(ERR)) if (m.includes(k)) return v; return m; }

export default function AuthModal({ onClose, dark }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const t = dark
    ? { bg:'#13161f', border:'#1e2230', txt:'#e8eaf0', muted:'#5a6178', inBg:'#0f1117', inBrd:'#2a2f42', accent:'#6c8fff' }
    : { bg:'#fff', border:'#e2e6f0', txt:'#1a1d2a', muted:'#7a849a', inBg:'#f4f6fb', inBrd:'#d8dde8', accent:'#4c6ef5' }

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setMsg(null)
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw })
        if (error) throw error
        if (data?.session) onClose()
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        if (data?.session) onClose()
        else setMsg({ ok: true, text: '✅ Registrace úspěšná! Zkontrolujte e-mail.' })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMsg({ ok: true, text: '✅ Odkaz pro reset byl odeslán.' })
      }
    } catch (err) { setMsg({ ok: false, text: xlat(err.message) }) }
    finally { setLoading(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:99, backdropFilter:'blur(6px)' }}/>
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:100, width:'min(380px,94vw)', background:t.bg, border:`1px solid ${t.border}`, borderRadius:18, padding:'28px 24px', fontFamily:"'DM Sans',sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
          .auth-in{width:100%;padding:11px 13px;background:${t.inBg};color:${t.txt};border:1.5px solid ${t.inBrd};border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .15s}
          .auth-in:focus{border-color:${t.accent}}
          .auth-btn-primary{width:100%;padding:12px 0;border-radius:10px;background:${t.accent};color:#fff;font-size:14px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:opacity .15s}
          .auth-btn-primary:hover{opacity:.88}
          .auth-link{background:none;border:none;color:${t.accent};font-size:13px;font-weight:500;cursor:pointer;font-family:inherit}
        `}</style>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
          <div>
            <div style={{ width:36, height:36, borderRadius:10, background:t.accent+'22', border:`1.5px solid ${t.accent}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:t.accent, marginBottom:10 }}>✦</div>
            <h2 style={{ fontSize:17, fontWeight:600, color:t.txt, margin:0 }}>
              {mode==='login'?'Přihlásit se':mode==='register'?'Vytvořit účet':'Obnovit heslo'}
            </h2>
            <p style={{ fontSize:12, color:t.muted, marginTop:3 }}>
              {mode==='login'?'Historie konverzací se uloží':mode==='register'?'Zdarma · Vše se ukládá':'Pošleme odkaz na e-mail'}
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:t.muted, cursor:'pointer', fontSize:22, lineHeight:1, fontFamily:'inherit' }}>×</button>
        </div>

        {msg && (
          <div style={{ marginBottom:14, padding:'10px 13px', borderRadius:10, background:msg.ok?'#1a3a2a':'#2a1a1a', border:`1px solid ${msg.ok?'#2d6a4a':'#6a2d2d'}`, color:msg.ok?'#6ee7b7':'#fca5a5', fontSize:13, lineHeight:1.5 }}>
            {msg.text}
          </div>
        )}

        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:13 }}>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:t.muted, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>E-mail</label>
            <input className="auth-in" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="vas@email.cz"/>
          </div>
          {mode !== 'forgot' && (
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:t.muted, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>
                Heslo {mode==='register'&&<span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, color:t.muted }}>(min. 6 znaků)</span>}
              </label>
              <input className="auth-in" type="password" value={pw} onChange={e=>setPw(e.target.value)} required minLength={6} placeholder="••••••••"/>
            </div>
          )}
          <button type="submit" className="auth-btn-primary" disabled={loading} style={{ opacity:loading?.6:1, marginTop:4 }}>
            {loading?'⏳ Pracuji…':mode==='login'?'Přihlásit se':mode==='register'?'Registrovat se':'Odeslat odkaz'}
          </button>
        </form>

        <div style={{ marginTop:16, textAlign:'center', fontSize:13, color:t.muted }}>
          {mode==='login'&&<><span>Nemáte účet? </span><button className="auth-link" onClick={()=>{setMode('register');setMsg(null)}}>Registrovat se</button><br/><button className="auth-link" style={{ color:t.muted, marginTop:7, fontSize:12 }} onClick={()=>{setMode('forgot');setMsg(null)}}>Zapomenuté heslo?</button></>}
          {mode==='register'&&<><span>Máte účet? </span><button className="auth-link" onClick={()=>{setMode('login');setMsg(null)}}>Přihlásit se</button></>}
          {mode==='forgot'&&<button className="auth-link" onClick={()=>{setMode('login');setMsg(null)}}>← Zpět</button>}
        </div>
      </div>
    </>
  )
}
