import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const SYS_DEFAULT = 'Jsi profesionální AI asistent. Odpovídáš vždy formálně, přesně a věcně.'
const EDGE_URL = 'https://sjdvgkdvezzfazexzfrf.supabase.co/functions/v1/claude-chat'

function gid() { return Math.random().toString(36).slice(2) }
function fmtTime(ts) { return new Date(ts).toLocaleTimeString('cs-CZ', { hour:'2-digit', minute:'2-digit' }) }
function fmtDate(ts) { return new Date(ts).toLocaleDateString('cs-CZ', { day:'numeric', month:'short' }) }

// ── tiny icons ──────────────────────────────────────────────────────────────
const I = {
  send: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  plus: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  moon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  sun: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  set: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  img: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  att: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
  x: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  menu: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  out: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
}

const T = {
  dark: { bg:'#0f1117', side:'#13161f', hdr:'rgba(15,17,23,0.93)', txt:'#e8eaf0', muted:'#5a6178', border:'#1e2230', accent:'#6c8fff', active:'#1c2035', aiB:'#1a1d2a', inBg:'#13161f', iaBg:'#0f1117', inBrd:'#2a2f42', btn:'#1a1d2a', modal:'#13161f', pill:'#1a1d2a', ua:'#3d4460', scrl:'#2a2f42' },
  light: { bg:'#f4f6fb', side:'#fff', hdr:'rgba(244,246,251,0.93)', txt:'#1a1d2a', muted:'#7a849a', border:'#e2e6f0', accent:'#4c6ef5', active:'#eef1ff', aiB:'#fff', inBg:'#fff', iaBg:'#f4f6fb', inBrd:'#d8dde8', btn:'#edf0f7', modal:'#fff', pill:'#edf0f7', ua:'#8898b0', scrl:'#c8cdd8' },
}

export default function Chat({ session }) {
  const [dark, setDark] = useState(true)
  const [convs, setConvs] = useState([])
  const [aid, setAid] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [convsLoading, setConvsLoading] = useState(true)
  const [showSet, setShowSet] = useState(false)
  const [sysPmt, setSysPmt] = useState(SYS_DEFAULT)
  const [tmpPmt, setTmpPmt] = useState(SYS_DEFAULT)
  const [imgMode, setImgMode] = useState(false)
  const [atts, setAtts] = useState([])
  const [sideOpen, setSideOpen] = useState(true)
  const [err, setErr] = useState(null)

  const endRef = useRef(null)
  const fileRef = useRef(null)
  const taRef = useRef(null)
  const t = dark ? T.dark : T.light

  // Load conversations
  useEffect(() => {
    loadConvs()
  }, [])

  // Load messages when conversation changes
  useEffect(() => {
    if (aid) loadMsgs(aid)
  }, [aid])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [msgs.length, loading])

  async function loadConvs() {
    setConvsLoading(true)
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
    setConvs(data || [])
    if (data?.length > 0 && !aid) setAid(data[0].id)
    setConvsLoading(false)
  }

  async function loadMsgs(convId) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    setMsgs(data || [])
  }

  async function newConv() {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: session.user.id, title: 'Nová konverzace' })
      .select()
      .single()
    if (!error) {
      setConvs(p => [data, ...p])
      setAid(data.id)
      setMsgs([])
      setAtts([])
      setErr(null)
      setInput('')
    }
  }

  async function delConv(id, e) {
    e.stopPropagation()
    await supabase.from('conversations').delete().eq('id', id)
    const next = convs.filter(c => c.id !== id)
    setConvs(next)
    if (id === aid) {
      if (next.length > 0) { setAid(next[0].id) }
      else { setAid(null); setMsgs([]) }
    }
  }

  async function send() {
    if ((!input.trim() && !atts.length) || loading) return
    if (!aid) { await newConv(); return }

    const convId = aid
    const userText = input.trim() || (imgMode ? '🎨 Generuji obrázek…' : atts.map(a=>a.name).join(', '))
    setInput('')
    setAtts([])
    setLoading(true)
    setErr(null)

    // Build API content
    const apiContent = []
    atts.forEach(a => {
      if (a.type.startsWith('image/')) apiContent.push({ type:'image', source:{ type:'base64', media_type:a.type, data:a.data } })
    })
    if (input.trim()) apiContent.push({ type:'text', text:input.trim() })

    // Save user msg to DB
    const { data: uMsg } = await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'user',
      content: userText,
      type: 'text',
    }).select().single()

    // Update title if first message
    const conv = convs.find(c => c.id === convId)
    if (conv?.title === 'Nová konverzace' && userText) {
      const newTitle = userText.slice(0, 40) + (userText.length > 40 ? '…' : '')
      await supabase.from('conversations').update({ title: newTitle }).eq('id', convId)
      setConvs(p => p.map(c => c.id === convId ? { ...c, title: newTitle } : c))
    }

    if (uMsg) setMsgs(p => [...p, uMsg])

    try {
      // Build history for API
      const history = [...msgs, uMsg || { role:'user', content: userText }].map(m => ({
        role: m.role,
        content: m.role === 'user' && apiContent.length > 0 && m.id === uMsg?.id
          ? apiContent
          : [{ type:'text', text: m.content }]
      }))

      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${s.access_token}` },
        body: JSON.stringify({ messages: history, system: sysPmt, mode: imgMode ? 'image' : 'chat' }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)

      let aContent = result.text || ''
      let aType = 'text'
      let imageUrl = null

      if (result.type === 'image' && result.svg) {
        aType = 'image'
        imageUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(result.svg)
        aContent = '🎨 Vygenerovaný obrázek'
      }

      const { data: aMsg } = await supabase.from('messages').insert({
        conversation_id: convId,
        role: 'assistant',
        content: aContent,
        type: aType,
        image_url: imageUrl,
      }).select().single()

      if (aMsg) setMsgs(p => [...p, aMsg])
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
    } catch (e) {
      setErr('Chyba: ' + e.message)
      if (uMsg) {
        await supabase.from('messages').delete().eq('id', uMsg.id)
        setMsgs(p => p.filter(m => m.id !== uMsg.id))
      }
      setInput(userText)
    } finally {
      setLoading(false)
    }
  }

  const onFile = async (e) => {
    const files = Array.from(e.target.files)
    const res = await Promise.all(files.map(f => new Promise(r => {
      const rd = new FileReader()
      rd.onload = () => r({ id: gid(), name:f.name, type:f.type, data:rd.result.split(',')[1], preview:f.type.startsWith('image/')?rd.result:null })
      rd.readAsDataURL(f)
    })))
    setAtts(p => [...p, ...res])
    fileRef.current.value = ''
  }

  const onKey = (e) => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }
  const canSend = (input.trim() || atts.length > 0) && !loading
  const conv = convs.find(c => c.id === aid)
  const userInitial = (session.user.user_metadata?.full_name || session.user.email || 'U')[0].toUpperCase()

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:t.bg, color:t.txt, fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${t.scrl};border-radius:2px}
        textarea{resize:none;outline:none;border:none;font-family:inherit;background:transparent}
        button{cursor:pointer;border:none;background:none;font-family:inherit}
        @keyframes fu{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pu{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        .fi{animation:fu .2s ease both}
        .dot span{display:inline-block;width:7px;height:7px;border-radius:50%;background:${t.accent};margin:0 2px;animation:pu 1.2s infinite ease-in-out}
        .dot span:nth-child(2){animation-delay:.18s}.dot span:nth-child(3){animation-delay:.36s}
        .cr:hover{background:${t.active} !important}.cr:hover .delbtn{opacity:1 !important}
        .ib:hover{opacity:.65}
        .img-mode-btn{transition:all .15s}
      `}</style>

      {/* Sidebar */}
      {sideOpen && (
        <aside style={{ width:256, background:t.side, borderRight:`1px solid ${t.border}`, display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'13px 11px', borderBottom:`1px solid ${t.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontWeight:600, fontSize:11, letterSpacing:'.1em', textTransform:'uppercase', color:t.muted }}>Konverzace</span>
            <button onClick={newConv} style={{ background:t.accent, color:'#fff', borderRadius:7, padding:'5px 9px', display:'flex', alignItems:'center' }}>{I.plus}</button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'5px' }}>
            {convsLoading ? (
              <div style={{ padding:16, textAlign:'center', fontSize:12, color:t.muted }}>Načítám…</div>
            ) : convs.length === 0 ? (
              <div style={{ padding:16, textAlign:'center', fontSize:12, color:t.muted }}>Žádné konverzace.<br/>Klikněte na + pro novou.</div>
            ) : convs.map(c => (
              <div key={c.id} className="cr" onClick={() => { setAid(c.id); setErr(null) }}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 9px', borderRadius:7, cursor:'pointer', marginBottom:2, transition:'background .1s', background:c.id===aid?t.active:'transparent', borderLeft:c.id===aid?`2px solid ${t.accent}`:'2px solid transparent' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:c.id===aid?t.txt:t.muted }}>{c.title}</div>
                  <div style={{ fontSize:11, color:t.muted, marginTop:2 }}>{fmtDate(c.updated_at)}</div>
                </div>
                <button className="delbtn ib" onClick={(e)=>delConv(c.id,e)} style={{ opacity:0, color:t.muted, display:'flex', padding:4, borderRadius:5, transition:'opacity .15s', flexShrink:0 }}>{I.trash}</button>
              </div>
            ))}
          </div>
          {/* User info */}
          <div style={{ padding:'11px 12px', borderTop:`1px solid ${t.border}`, display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:t.accent+'33', border:`1px solid ${t.accent}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:t.accent, flexShrink:0 }}>{userInitial}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:500, color:t.txt, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{session.user.user_metadata?.full_name || session.user.email}</div>
              <div style={{ fontSize:11, color:t.muted }}>Přihlášen</div>
            </div>
            <button className="ib" onClick={() => supabase.auth.signOut()} style={{ color:t.muted, display:'flex', padding:4 }} title="Odhlásit se">{I.out}</button>
          </div>
        </aside>
      )}

      {/* Main */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', height:52, background:t.hdr, borderBottom:`1px solid ${t.border}`, backdropFilter:'blur(12px)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <button className="ib" onClick={()=>setSideOpen(o=>!o)} style={{ color:t.muted, display:'flex', padding:5 }}>{I.menu}</button>
            <div style={{ width:27, height:27, borderRadius:7, background:t.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff' }}>A</div>
            <span style={{ fontWeight:600, fontSize:14 }}>{conv?.title || 'AI Asistent'}</span>
          </div>
          <div style={{ display:'flex', gap:5 }}>
            <button className="ib" onClick={()=>{ setTmpPmt(sysPmt); setShowSet(true) }} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:7, background:t.btn, color:t.muted, fontSize:12 }}>{I.set}<span>Nastavení</span></button>
            <button className="ib" onClick={()=>setDark(d=>!d)} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:7, background:t.btn, color:t.muted, fontSize:12 }}>{dark?I.sun:I.moon}<span>{dark?'Světlý':'Tmavý'}</span></button>
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px 14px', display:'flex', flexDirection:'column', gap:12 }}>
          {!aid || msgs.length === 0 ? (
            !loading && (
              <div style={{ textAlign:'center', marginTop:'10vh' }}>
                <div style={{ width:50, height:50, borderRadius:13, background:t.accent+'22', border:`1.5px solid ${t.accent}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, margin:'0 auto 13px', color:t.accent }}>✦</div>
                <div style={{ fontSize:19, fontWeight:600, marginBottom:5 }}>Jak Vám mohu pomoci?</div>
                <div style={{ fontSize:13, color:t.muted }}>Napište dotaz nebo aktivujte generování obrázků pomocí 🎨</div>
              </div>
            )
          ) : msgs.map(msg => (
            <div key={msg.id} className="fi" style={{ display:'flex', gap:8, justifyContent:msg.role==='user'?'flex-end':'flex-start', alignItems:'flex-start' }}>
              {msg.role==='assistant' && <div style={{ width:27, height:27, borderRadius:7, background:t.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0, marginTop:2 }}>A</div>}
              <div style={{ maxWidth:'72%' }}>
                {msg.type === 'image' && msg.image_url ? (
                  <div>
                    <img src={msg.image_url} alt="Vygenerovaný obrázek" style={{ maxWidth:'100%', maxHeight:380, borderRadius:12, display:'block', border:`1px solid ${t.border}` }}/>
                    <div style={{ fontSize:10, color:t.muted, marginTop:4, textAlign:'right' }}>{fmtTime(msg.created_at)}</div>
                  </div>
                ) : (
                  <div style={{ padding:'10px 13px', background:msg.role==='user'?t.accent:t.aiB, color:msg.role==='user'?'#fff':t.txt, borderRadius:msg.role==='user'?'15px 15px 4px 15px':'15px 15px 15px 4px', border:msg.role==='assistant'?`1px solid ${t.border}`:'none' }}>
                    <div style={{ fontSize:14, lineHeight:1.65, whiteSpace:'pre-wrap' }}>{msg.content}</div>
                    <div style={{ fontSize:10, color:msg.role==='user'?'rgba(255,255,255,.5)':t.muted, marginTop:4, textAlign:'right' }}>{fmtTime(msg.created_at)}</div>
                  </div>
                )}
              </div>
              {msg.role==='user' && <div style={{ width:27, height:27, borderRadius:7, background:t.ua, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:'#fff', flexShrink:0, marginTop:2 }}>{userInitial}</div>}
            </div>
          ))}

          {loading && (
            <div className="fi" style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
              <div style={{ width:27, height:27, borderRadius:7, background:t.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>A</div>
              <div style={{ padding:'11px 15px', background:t.aiB, borderRadius:'15px 15px 15px 4px', border:`1px solid ${t.border}` }}>
                {imgMode ? <span style={{ fontSize:13, color:t.muted }}>🎨 Generuji obrázek…</span> : <div className="dot"><span/><span/><span/></div>}
              </div>
            </div>
          )}

          {err && <div style={{ padding:'9px 13px', background:'#ff444418', border:'1px solid #ff444440', borderRadius:9, fontSize:13, color:'#ff6b6b' }}>⚠️ {err}</div>}
          <div ref={endRef}/>
        </div>

        {/* Input area */}
        <div style={{ padding:'11px 14px 15px', background:t.iaBg, borderTop:`1px solid ${t.border}`, flexShrink:0 }}>
          {/* Image mode toggle */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
            <button
              className="img-mode-btn"
              onClick={() => setImgMode(m=>!m)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 11px', borderRadius:7, background:imgMode?t.accent:t.btn, color:imgMode?'#fff':t.muted, fontSize:12, fontWeight:imgMode?600:400, border:`1px solid ${imgMode?t.accent:t.border}` }}>
              {I.img} {imgMode ? '🎨 Generování obrázků ZAP' : 'Generování obrázků'}
            </button>
          </div>

          {atts.length > 0 && (
            <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:9 }}>
              {atts.map(a => (
                <div key={a.id} style={{ position:'relative' }}>
                  {a.preview ? <img src={a.preview} alt={a.name} style={{ height:48, width:48, objectFit:'cover', borderRadius:7, border:`1px solid ${t.border}`, display:'block' }}/>
                    : <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px', background:t.pill, borderRadius:7, fontSize:12, color:t.txt }}>{I.att}{a.name.length>14?a.name.slice(0,12)+'…':a.name}</div>}
                  <button onClick={()=>setAtts(p=>p.filter(x=>x.id!==a.id))} style={{ position:'absolute', top:-5, right:-5, width:16, height:16, borderRadius:'50%', background:'#e53e3e', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>{I.x}</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:'flex', alignItems:'flex-end', gap:7, padding:'9px 11px', background:t.inBg, border:`1.5px solid ${t.inBrd}`, borderRadius:13 }}>
            <textarea ref={taRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
              placeholder={imgMode ? '🎨 Popište obrázek který chcete vygenerovat…' : 'Napište zprávu… (Enter = odeslat)'}
              rows={1} style={{ flex:1, fontSize:14, lineHeight:1.5, color:t.txt, caretColor:t.accent, maxHeight:130, overflowY:'auto', paddingTop:2 }}
              onInput={e=>{ e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,130)+'px' }}/>
            <div style={{ display:'flex', gap:5, alignItems:'center' }}>
              {!imgMode && <button className="ib" onClick={()=>fileRef.current.click()} style={{ color:t.muted, display:'flex', padding:5 }} title="Přidat soubor">{I.att}</button>}
              <button onClick={send} disabled={!canSend} style={{ width:33, height:33, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:canSend?t.accent:t.btn, color:canSend?'#fff':t.muted, transition:'all .15s', flexShrink:0 }}>{I.send}</button>
            </div>
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt" style={{ display:'none' }} onChange={onFile}/>
          <div style={{ fontSize:11, color:t.muted, textAlign:'center', marginTop:6 }}>Powered by Claude AI · Data uložena v Supabase</div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSet && (
        <div onClick={()=>setShowSet(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, backdropFilter:'blur(4px)' }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'min(450px,90vw)', borderRadius:13, padding:20, background:t.modal, border:`1px solid ${t.border}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ fontSize:15, fontWeight:600 }}>Nastavení asistenta</h2>
              <button className="ib" onClick={()=>setShowSet(false)} style={{ color:t.muted, display:'flex', padding:4 }}>{I.x}</button>
            </div>
            <label style={{ fontSize:11, fontWeight:600, color:t.muted, textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:6 }}>Systémový prompt</label>
            <textarea value={tmpPmt} onChange={e=>setTmpPmt(e.target.value)} rows={6}
              style={{ width:'100%', padding:'10px 12px', background:t.inBg, color:t.txt, border:`1.5px solid ${t.inBrd}`, borderRadius:8, fontSize:13, lineHeight:1.6, outline:'none', resize:'vertical' }}/>
            <p style={{ fontSize:12, color:t.muted, marginTop:6 }}>Definuje chování asistenta.</p>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button onClick={()=>setShowSet(false)} style={{ padding:'7px 14px', borderRadius:7, background:t.btn, color:t.txt, fontSize:13, fontWeight:500 }}>Zrušit</button>
              <button onClick={()=>{ setSysPmt(tmpPmt); setShowSet(false) }} style={{ padding:'7px 14px', borderRadius:7, background:t.accent, color:'#fff', fontSize:13, fontWeight:600 }}>Uložit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
