import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import AuthModal from './AuthModal'

const SYS_DEFAULT = 'Jsi profesionální AI asistent. Odpovídáš vždy formálně, přesně a věcně. Pomáháš uživatelům s jejich dotazy co nejefektivněji.'
const EDGE_URL = 'https://sjdvgkdvezzfazexzfrf.supabase.co/functions/v1/claude-chat'

function gid() { return Math.random().toString(36).slice(2) }
function fmtTime(ts) { return new Date(ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) }
function fmtDate(ts) { return new Date(ts).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' }) }

const Ic = {
  send: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  moon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  sun: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  set: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  img: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  clip: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  x: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  menu: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  out: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  user: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
}

const T = {
  dark: { bg: '#0f1117', side: '#13161f', hdr: 'rgba(15,17,23,0.94)', txt: '#e8eaf0', muted: '#5a6178', border: '#1e2230', accent: '#6c8fff', active: '#1c2035', aiB: '#1a1d2a', inBg: '#13161f', iaBg: '#0f1117', inBrd: '#2a2f42', btn: '#1a1d2a', modal: '#13161f', pill: '#1a1d2a', ua: '#3d4460', scrl: '#2a2f42', tag: '#1c2035' },
  light: { bg: '#f4f6fb', side: '#fff', hdr: 'rgba(244,246,251,0.94)', txt: '#1a1d2a', muted: '#7a849a', border: '#e2e6f0', accent: '#4c6ef5', active: '#eef1ff', aiB: '#fff', inBg: '#fff', iaBg: '#f4f6fb', inBrd: '#d8dde8', btn: '#edf0f7', modal: '#fff', pill: '#edf0f7', ua: '#8898b0', scrl: '#c8cdd8', tag: '#eef1ff' },
}

function mkLocalConv() {
  return { id: gid(), title: 'Nová konverzace', messages: [], createdAt: Date.now(), local: true }
}

export default function Chat({ session }) {
  const [dark, setDark] = useState(true)
  const [showAuth, setShowAuth] = useState(false)
  const [showSet, setShowSet] = useState(false)
  const [sysPmt, setSysPmt] = useState(SYS_DEFAULT)
  const [tmpPmt, setTmpPmt] = useState(SYS_DEFAULT)
  const [imgMode, setImgMode] = useState(false)
  const [sideOpen, setSideOpen] = useState(true)
  const [input, setInput] = useState('')
  const [atts, setAtts] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  // Konverzace — buď lokální (host) nebo ze Supabase (přihlášený)
  const [convs, setConvs] = useState([mkLocalConv()])
  const [aid, setAid] = useState(null)
  const [msgs, setMsgs] = useState([]) // zprávy aktivní konverzace
  const [dbLoading, setDbLoading] = useState(false)

  const endRef = useRef(null)
  const fileRef = useRef(null)
  const taRef = useRef(null)
  const t = dark ? T.dark : T.light

  const isLoggedIn = !!session

  // Při přihlášení načti konverzace z DB
  useEffect(() => {
    if (isLoggedIn) {
      loadDbConvs()
    } else {
      // Nepřihlášený — lokální konverzace
      const first = mkLocalConv()
      setConvs([first])
      setAid(first.id)
      setMsgs([])
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (aid && isLoggedIn) loadDbMsgs(aid)
  }, [aid])

  useEffect(() => {
    if (!aid && convs.length > 0) setAid(convs[0].id)
  }, [convs])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length, loading])

  async function loadDbConvs() {
    setDbLoading(true)
    const { data } = await supabase.from('conversations').select('*').order('updated_at', { ascending: false })
    if (data && data.length > 0) {
      setConvs(data.map(c => ({ ...c, local: false })))
      setAid(data[0].id)
    } else {
      // Žádné konverzace v DB — vytvoř novou
      const c = await createDbConv()
      if (c) { setConvs([{ ...c, local: false }]); setAid(c.id) }
    }
    setDbLoading(false)
  }

  async function loadDbMsgs(convId) {
    const conv = convs.find(c => c.id === convId)
    if (!conv || conv.local) return
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true })
    setMsgs(data || [])
  }

  async function createDbConv(title = 'Nová konverzace') {
    const { data, error } = await supabase.from('conversations').insert({ user_id: session.user.id, title }).select().single()
    if (error) return null
    return data
  }

  const activeConv = convs.find(c => c.id === aid)

  // Lokální konverzace — zprávy v paměti
  const localMsgs = activeConv?.local ? (activeConv.messages || []) : msgs

  function newConv() {
    if (isLoggedIn) {
      createDbConv().then(c => {
        if (c) { setConvs(p => [{ ...c, local: false }, ...p]); setAid(c.id); setMsgs([]) }
      })
    } else {
      const c = mkLocalConv()
      setConvs(p => [c, ...p])
      setAid(c.id)
    }
    setInput('')
    setAtts([])
    setErr(null)
  }

  function delConv(id, e) {
    e.stopPropagation()
    if (isLoggedIn) supabase.from('conversations').delete().eq('id', id)
    const next = convs.filter(c => c.id !== id)
    setConvs(next.length ? next : [isLoggedIn ? null : mkLocalConv()].filter(Boolean))
    if (id === aid) {
      if (next.length) { setAid(next[0].id); if (!isLoggedIn) setMsgs([]) }
      else { const c = mkLocalConv(); setConvs([c]); setAid(c.id); setMsgs([]) }
    }
  }

  const onFile = async (e) => {
    const files = Array.from(e.target.files)
    const res = await Promise.all(files.map(f => new Promise(r => {
      const rd = new FileReader()
      rd.onload = () => r({ id: gid(), name: f.name, type: f.type, data: rd.result.split(',')[1], preview: f.type.startsWith('image/') ? rd.result : null })
      rd.readAsDataURL(f)
    })))
    setAtts(p => [...p, ...res])
    fileRef.current.value = ''
  }

  async function send() {
    if ((!input.trim() && !atts.length) || loading) return

    const convId = aid
    const userText = input.trim() || atts.map(a => a.name).join(', ')
    setInput('')
    setAtts([])
    setLoading(true)
    setErr(null)

    const apiContent = []
    atts.forEach(a => {
      if (a.type.startsWith('image/')) apiContent.push({ type: 'image', source: { type: 'base64', media_type: a.type, data: a.data } })
    })
    if (input.trim()) apiContent.push({ type: 'text', text: input.trim() })

    const newUserMsg = { id: gid(), role: 'user', content: userText, type: 'text', created_at: new Date().toISOString(), ts: Date.now() }

    // Aktualizuj zobrazení okamžitě
    let prevMsgs
    if (activeConv?.local) {
      prevMsgs = activeConv.messages || []
      const updatedMsgs = [...prevMsgs, newUserMsg]
      const newTitle = activeConv.title === 'Nová konverzace' ? userText.slice(0, 38) + (userText.length > 38 ? '…' : '') : activeConv.title
      setConvs(p => p.map(c => c.id === convId ? { ...c, messages: updatedMsgs, title: newTitle } : c))
    } else {
      prevMsgs = msgs
      setMsgs(p => [...p, newUserMsg])
      // Ulož do DB
      supabase.from('messages').insert({ conversation_id: convId, role: 'user', content: userText, type: 'text' })
      if (activeConv?.title === 'Nová konverzace') {
        const t2 = userText.slice(0, 38) + (userText.length > 38 ? '…' : '')
        supabase.from('conversations').update({ title: t2 }).eq('id', convId)
        setConvs(p => p.map(c => c.id === convId ? { ...c, title: t2 } : c))
      }
    }

    try {
      const history = [...(activeConv?.local ? (activeConv.messages || []) : prevMsgs), newUserMsg].map((m, i, arr) => ({
        role: m.role,
        content: m.id === newUserMsg.id && apiContent.length > 0
          ? apiContent
          : [{ type: 'text', text: m.content }]
      }))

      let headers = { 'Content-Type': 'application/json' }

      if (isLoggedIn) {
        const { data: { session: s } } = await supabase.auth.getSession()
        headers['Authorization'] = `Bearer ${s.access_token}`
      }
      // Nepřihlášení volají API přímo (bez Edge Function — nebo přes Edge Function bez JWT)
      // Pro jednoduchost voláme Anthropic přímo pro nepřihlášené uživatele
      let result

      if (isLoggedIn) {
        const res = await fetch(EDGE_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({ messages: history, system: sysPmt, mode: imgMode ? 'image' : 'chat' }),
        })
        result = await res.json()
        if (result.error) throw new Error(result.error)
      } else {
        // Nepřihlášený — volá Anthropic API přímo
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: sysPmt, messages: history }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error.message)
        result = { type: 'text', text: data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '' }
      }

      const aContent = result.type === 'image' ? '🎨 Vygenerovaný obrázek' : (result.text || '')
      const aType = result.type === 'image' ? 'image' : 'text'
      const imageUrl = result.type === 'image' ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(result.svg || '') : null
      const aMsg = { id: gid(), role: 'assistant', content: aContent, type: aType, image_url: imageUrl, created_at: new Date().toISOString() }

      if (activeConv?.local) {
        setConvs(p => p.map(c => c.id === convId ? { ...c, messages: [...(c.messages || []), newUserMsg.id ? c.messages?.find(m => m.id === newUserMsg.id) ? c.messages : [...(c.messages || []), aMsg] : [...(c.messages || []), aMsg]] } : c))
        // Jednodušší přístup:
        setConvs(p => p.map(c => {
          if (c.id !== convId) return c
          const already = c.messages?.find(m => m.id === newUserMsg.id)
          const base = already ? c.messages : [...(c.messages || []), newUserMsg]
          return { ...c, messages: [...base.filter(m => m.id !== aMsg.id), aMsg] }
        }))
      } else {
        setMsgs(p => [...p, aMsg])
        supabase.from('messages').insert({ conversation_id: convId, role: 'assistant', content: aContent, type: aType, image_url: imageUrl })
        supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
      }
    } catch (e) {
      setErr('Chyba: ' + e.message)
      // Vrať zprávu zpět
      if (activeConv?.local) {
        setConvs(p => p.map(c => c.id === convId ? { ...c, messages: prevMsgs } : c))
      } else {
        setMsgs(prevMsgs)
      }
      setInput(userText)
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
  const canSend = (input.trim() || atts.length > 0) && !loading
  const displayMsgs = activeConv?.local ? (activeConv.messages || []) : msgs
  const userInitial = session ? (session.user.user_metadata?.full_name || session.user.email || 'U')[0].toUpperCase() : '?'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: t.bg, color: t.txt, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${t.scrl};border-radius:2px}
        textarea{resize:none;outline:none;border:none;font-family:inherit;background:transparent}
        button{cursor:pointer;border:none;background:none;font-family:inherit}
        @keyframes fu{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pu{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        .fi{animation:fu .2s ease both}
        .dot span{display:inline-block;width:6px;height:6px;border-radius:50%;background:${t.accent};margin:0 2px;animation:pu 1.2s infinite ease-in-out}
        .dot span:nth-child(2){animation-delay:.18s}.dot span:nth-child(3){animation-delay:.36s}
        .cr:hover{background:${t.active}!important}.cr:hover .delbtn{opacity:1!important}
        .ib:hover{opacity:.65}
      `}</style>

      {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
      {sideOpen && (
        <aside style={{ width: 256, background: t.side, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Top */}
          <div style={{ padding: '13px 11px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>A</div>
              <span style={{ fontWeight: 600, fontSize: 13, color: t.txt }}>AI Asistent</span>
            </div>
            <button onClick={newConv} style={{ background: t.accent, color: '#fff', borderRadius: 7, padding: '5px 9px', display: 'flex', alignItems: 'center' }} title="Nová konverzace">{Ic.plus}</button>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '5px' }}>
            {dbLoading ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: t.muted }}>Načítám…</div>
            ) : convs.map(c => (
              <div key={c.id} className="cr" onClick={() => { setAid(c.id); setErr(null); if (isLoggedIn && !c.local) loadDbMsgs(c.id) }}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 9px', borderRadius: 7, cursor: 'pointer', marginBottom: 2, transition: 'background .1s', background: c.id === aid ? t.active : 'transparent', borderLeft: c.id === aid ? `2px solid ${t.accent}` : '2px solid transparent' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: c.id === aid ? t.txt : t.muted }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{c.local ? 'Dočasná' : fmtDate(c.updated_at)}</div>
                </div>
                <button className="delbtn ib" onClick={(e) => delConv(c.id, e)} style={{ opacity: 0, color: t.muted, display: 'flex', padding: 4, borderRadius: 5, transition: 'opacity .15s', flexShrink: 0 }}>{Ic.trash}</button>
              </div>
            ))}
          </div>

          {/* Bottom: user or login prompt */}
          <div style={{ padding: '10px 11px', borderTop: `1px solid ${t.border}` }}>
            {isLoggedIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: t.accent + '33', border: `1px solid ${t.accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: t.accent, flexShrink: 0 }}>{userInitial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.user_metadata?.full_name || session.user.email}</div>
                  <div style={{ fontSize: 11, color: t.muted }}>Přihlášen</div>
                </div>
                <button className="ib" onClick={() => supabase.auth.signOut()} style={{ color: t.muted, display: 'flex', padding: 4 }} title="Odhlásit se">{Ic.out}</button>
              </div>
            ) : (
              <button onClick={() => setShowAuth(true)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9, background: t.btn, border: `1px solid ${t.border}`, color: t.muted, fontSize: 13, fontWeight: 500, transition: 'all .15s' }}>
                <span style={{ color: t.accent }}>{Ic.user}</span>
                <span>Přihlásit se</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: t.muted, background: t.tag, padding: '2px 6px', borderRadius: 4 }}>Uloží historii</span>
              </button>
            )}
          </div>
        </aside>
      )}

      {/* ── MAIN ────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', height: 52, background: t.hdr, borderBottom: `1px solid ${t.border}`, backdropFilter: 'blur(12px)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="ib" onClick={() => setSideOpen(o => !o)} style={{ color: t.muted, display: 'flex', padding: 5 }}>{Ic.menu}</button>
            <span style={{ fontWeight: 600, fontSize: 14, color: t.txt }}>{activeConv?.title || 'AI Asistent'}</span>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <button className="ib" onClick={() => { setTmpPmt(sysPmt); setShowSet(true) }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, background: t.btn, color: t.muted, fontSize: 12 }}>{Ic.set}<span>Nastavení</span></button>
            <button className="ib" onClick={() => setDark(d => !d)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, background: t.btn, color: t.muted, fontSize: 12 }}>{dark ? Ic.sun : Ic.moon}<span>{dark ? 'Světlý' : 'Tmavý'}</span></button>
            {/* Login button in top right corner */}
            {!isLoggedIn && (
              <button onClick={() => setShowAuth(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, background: t.accent, color: '#fff', fontSize: 12, fontWeight: 600 }}>
                {Ic.user}<span>Přihlásit se</span>
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Guest banner */}
          {!isLoggedIn && displayMsgs.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '9vh' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: t.accent + '22', border: `1.5px solid ${t.accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 14px', color: t.accent }}>✦</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Jak Vám mohu pomoci?</div>
              <div style={{ fontSize: 13, color: t.muted, marginBottom: 18 }}>Začněte psát — přihlášení není potřeba</div>
              <button onClick={() => setShowAuth(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, background: t.btn, border: `1px solid ${t.border}`, color: t.muted, fontSize: 13 }}>
                {Ic.user} <span>Přihlásit se pro uložení historie</span>
              </button>
            </div>
          )}

          {isLoggedIn && displayMsgs.length === 0 && !loading && (
            <div style={{ textAlign: 'center', marginTop: '9vh' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: t.accent + '22', border: `1.5px solid ${t.accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 14px', color: t.accent }}>✦</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Jak Vám mohu pomoci?</div>
              <div style={{ fontSize: 13, color: t.muted }}>Napište dotaz nebo aktivujte generování obrázků 🎨</div>
            </div>
          )}

          {displayMsgs.map(msg => (
            <div key={msg.id} className="fi" style={{ display: 'flex', gap: 8, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 28, height: 28, borderRadius: 8, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 2 }}>A</div>
              )}
              <div style={{ maxWidth: '72%' }}>
                {msg.type === 'image' && msg.image_url ? (
                  <div>
                    <img src={msg.image_url} alt="Vygenerovaný obrázek" style={{ maxWidth: '100%', maxHeight: 380, borderRadius: 12, display: 'block', border: `1px solid ${t.border}` }} />
                    <div style={{ fontSize: 10, color: t.muted, marginTop: 4, textAlign: 'right' }}>{fmtTime(msg.created_at)}</div>
                  </div>
                ) : (
                  <div style={{ padding: '10px 14px', background: msg.role === 'user' ? t.accent : t.aiB, color: msg.role === 'user' ? '#fff' : t.txt, borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', border: msg.role === 'assistant' ? `1px solid ${t.border}` : 'none' }}>
                    <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    <div style={{ fontSize: 10, color: msg.role === 'user' ? 'rgba(255,255,255,.5)' : t.muted, marginTop: 4, textAlign: 'right' }}>{fmtTime(msg.created_at)}</div>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div style={{ width: 28, height: 28, borderRadius: 8, background: isLoggedIn ? t.accent + '88' : t.ua, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0, marginTop: 2 }}>
                  {isLoggedIn ? userInitial : '?'}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="fi" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>A</div>
              <div style={{ padding: '12px 16px', background: t.aiB, borderRadius: '16px 16px 16px 4px', border: `1px solid ${t.border}` }}>
                {imgMode ? <span style={{ fontSize: 13, color: t.muted }}>🎨 Generuji obrázek…</span> : <div className="dot"><span /><span /><span /></div>}
              </div>
            </div>
          )}

          {err && <div style={{ padding: '9px 13px', background: '#ff444418', border: '1px solid #ff444440', borderRadius: 9, fontSize: 13, color: '#ff6b6b' }}>⚠️ {err}</div>}
          <div ref={endRef} />
        </div>

        {/* Input area */}
        <div style={{ padding: '10px 14px 14px', background: t.iaBg, borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
          {/* Controls row */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {isLoggedIn && (
              <button onClick={() => setImgMode(m => !m)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: imgMode ? t.accent : t.btn, color: imgMode ? '#fff' : t.muted, fontSize: 12, border: `1px solid ${imgMode ? t.accent : t.border}`, fontWeight: imgMode ? 600 : 400 }}>
                {Ic.img} {imgMode ? '🎨 Obrázky ZAP' : 'Generovat obrázky'}
              </button>
            )}
          </div>

          {/* Attachments */}
          {atts.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {atts.map(a => (
                <div key={a.id} style={{ position: 'relative' }}>
                  {a.preview
                    ? <img src={a.preview} alt={a.name} style={{ height: 46, width: 46, objectFit: 'cover', borderRadius: 7, border: `1px solid ${t.border}`, display: 'block' }} />
                    : <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', background: t.pill, borderRadius: 7, fontSize: 12, color: t.txt }}>{Ic.clip}{a.name.length > 14 ? a.name.slice(0, 12) + '…' : a.name}</div>}
                  <button onClick={() => setAtts(p => p.filter(x => x.id !== a.id))} style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#e53e3e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Ic.x}</button>
                </div>
              ))}
            </div>
          )}

          {/* Input box */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '9px 11px', background: t.inBg, border: `1.5px solid ${t.inBrd}`, borderRadius: 14 }}>
            <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
              placeholder={imgMode ? '🎨 Popište obrázek…' : 'Napište zprávu… (Enter = odeslat)'}
              rows={1} style={{ flex: 1, fontSize: 14, lineHeight: 1.5, color: t.txt, caretColor: t.accent, maxHeight: 130, overflowY: 'auto', paddingTop: 2 }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px' }} />
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button className="ib" onClick={() => fileRef.current.click()} style={{ color: t.muted, display: 'flex', padding: 5 }} title="Přidat soubor">{Ic.clip}</button>
              <button onClick={send} disabled={!canSend}
                style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: canSend ? t.accent : t.btn, color: canSend ? '#fff' : t.muted, transition: 'all .15s', flexShrink: 0 }}>
                {Ic.send}
              </button>
            </div>
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt" style={{ display: 'none' }} onChange={onFile} />
          <div style={{ fontSize: 11, color: t.muted, textAlign: 'center', marginTop: 6 }}>
            Powered by Claude AI{isLoggedIn ? ' · Historie uložena v Supabase' : ' · Přihlaste se pro uložení historie'}
          </div>
        </div>
      </main>

      {/* ── AUTH MODAL ──────────────────────────────────────────────── */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {/* ── SETTINGS MODAL ──────────────────────────────────────────── */}
      {showSet && (
        <div onClick={() => setShowSet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(450px,90vw)', borderRadius: 13, padding: 20, background: t.modal, border: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>Nastavení asistenta</h2>
              <button className="ib" onClick={() => setShowSet(false)} style={{ color: t.muted, display: 'flex', padding: 4 }}>{Ic.x}</button>
            </div>
            <label style={{ fontSize: 11, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>Systémový prompt</label>
            <textarea value={tmpPmt} onChange={e => setTmpPmt(e.target.value)} rows={6}
              style={{ width: '100%', padding: '10px 12px', background: t.inBg, color: t.txt, border: `1.5px solid ${t.inBrd}`, borderRadius: 8, fontSize: 13, lineHeight: 1.6, outline: 'none', resize: 'vertical' }} />
            <p style={{ fontSize: 12, color: t.muted, marginTop: 6 }}>Definuje chování asistenta.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowSet(false)} style={{ padding: '7px 14px', borderRadius: 7, background: t.btn, color: t.txt, fontSize: 13, fontWeight: 500 }}>Zrušit</button>
              <button onClick={() => { setSysPmt(tmpPmt); setShowSet(false) }} style={{ padding: '7px 14px', borderRadius: 7, background: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}>Uložit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
