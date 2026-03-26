import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import AuthModal from './AuthModal'
import { themes, I, uid, fmtTime, fmtDate, getFreshToken, callEdge, detectMode, EMOTION_EMOJI, SYS_DEFAULT, ANON } from './utils.js'

const mkLocal = () => ({ id: uid(), title: 'Nová konverzace', messages: [], createdAt: Date.now(), local: true })

// ── Unsplash Grid ──────────────────────────────────────────────────────────────
function ImgSearchResults({ images, query, t }) {
  const [errs, setErrs] = useState({})
  if (!images?.length) return <div style={{ fontSize:13, color:t.muted }}>Žádné fotografie pro „{query}"</div>
  return (
    <div>
      <div style={{ fontSize:12, color:t.muted, marginBottom:9, display:'flex', alignItems:'center', gap:6 }}>{I.imgSrch} Výsledky: <strong style={{ color:t.txt }}>„{query}"</strong></div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
        {images.map((img, i) => !errs[i] && (
          <a key={img.id||i} href={img.source} target="_blank" rel="noopener noreferrer"
            style={{ display:'block', borderRadius:8, overflow:'hidden', border:`1px solid ${t.border}`, textDecoration:'none', background:t.card, transition:'transform .15s,opacity .15s' }}
            onMouseOver={e=>{e.currentTarget.style.opacity='0.85';e.currentTarget.style.transform='scale(1.02)'}}
            onMouseOut={e=>{e.currentTarget.style.opacity='1';e.currentTarget.style.transform='scale(1)'}}>
            <div style={{ position:'relative', paddingBottom:'66%', overflow:'hidden' }}>
              <img src={img.thumbnail||img.url} alt={img.title||query} onError={()=>setErrs(p=>({...p,[i]:true}))}
                style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}/>
            </div>
            <div style={{ padding:'4px 7px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:10, color:t.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📷 {img.author||'Unsplash'}</span>
              {I.extLink}
            </div>
          </a>
        ))}
      </div>
      <div style={{ fontSize:10, color:t.muted, marginTop:7 }}>
        Fotografie z <a href="https://unsplash.com?utm_source=ai_asistent&utm_medium=referral" target="_blank" rel="noopener noreferrer" style={{ color:t.accent, textDecoration:'none' }}>Unsplash</a>
      </div>
    </div>
  )
}

// ── Generated Image ──────────────────────────────────────────────────────────
function GenImage({ imageData, mimeType, prompt, t }) {
  const src = `data:${mimeType||'image/png'};base64,${imageData}`
  const dl = () => { const a = document.createElement('a'); a.href=src; a.download=`imagen-${Date.now()}.png`; a.click() }
  return (
    <div>
      <div style={{ fontSize:12, color:t.muted, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
        {I.magic} Vygenerováno pomocí <strong style={{ color:t.purple }}>Imagen</strong>
      </div>
      <div style={{ position:'relative', display:'inline-block', maxWidth:'100%' }}>
        <img src={src} alt={prompt} style={{ maxWidth:'100%', maxHeight:400, borderRadius:12, display:'block', border:`1px solid ${t.border}` }}/>
        <button onClick={dl} style={{ position:'absolute', top:8, right:8, display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:7, background:'rgba(0,0,0,0.65)', color:'#fff', fontSize:11, border:'none', cursor:'pointer', backdropFilter:'blur(4px)', fontFamily:'inherit' }}>
          {I.download} Stáhnout
        </button>
      </div>
    </div>
  )
}

// ── Quiz Component ────────────────────────────────────────────────────────────
function QuizCard({ data, t }) {
  const [selected, setSelected] = useState(null)
  const [showExp, setShowExp] = useState(false)
  if (!data) return null
  return (
    <div style={{ padding:'14px 16px', background:t.aiB, borderRadius:'16px 16px 16px 4px', border:`1px solid ${t.border}`, maxWidth:'100%' }}>
      <div style={{ fontSize:13, fontWeight:600, color:t.txt, marginBottom:12 }}>🎓 {data.question}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {data.options?.map((opt, i) => {
          const isCorrect = i === data.correct
          const isSelected = selected === i
          let bg = t.btn, color = t.txt, border = t.border
          if (selected !== null) {
            if (isCorrect) { bg = t.success; color = t.successTxt; border = t.successTxt }
            else if (isSelected) { bg = '#2a1a1a'; color = '#fca5a5'; border = '#6a2d2d' }
          }
          return (
            <button key={i} onClick={()=>{ if(selected===null){setSelected(i);setShowExp(true)} }}
              disabled={selected !== null}
              style={{ padding:'9px 13px', borderRadius:8, background:bg, color, border:`1.5px solid ${border}`, fontSize:13, textAlign:'left', cursor:selected===null?'pointer':'default', fontFamily:'inherit', transition:'all .2s', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, flexShrink:0 }}>{String.fromCharCode(65+i)}</span>
              {opt}
            </button>
          )
        })}
      </div>
      {showExp && data.explanation && (
        <div style={{ marginTop:12, padding:'10px 12px', borderRadius:8, background:t.tag, border:`1px solid ${t.border}`, fontSize:12, color:t.muted, lineHeight:1.5 }}>
          💡 {data.explanation}
        </div>
      )}
    </div>
  )
}

// ── Live Voice Chat ───────────────────────────────────────────────────────────
function LiveVoiceBar({ t, onTranscript, isLoggedIn }) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [supported, setSupported] = useState(false)
  const recRef = useRef(null)

  useEffect(() => {
    setSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  }, [])

  const toggle = () => {
    if (!supported) return
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'cs-CZ'
    rec.onresult = (e) => {
      const t2 = Array.from(e.results).map(r => r[0].transcript).join('')
      setTranscript(t2)
      if (e.results[e.results.length-1].isFinal) {
        onTranscript(t2)
        setTranscript('')
        setListening(false)
      }
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  if (!supported) return null

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <button onClick={toggle}
        style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20, background:listening?'#ef4444':t.btn, color:listening?'#fff':t.muted, border:`1px solid ${listening?'#ef4444':t.border}`, fontSize:12, fontWeight:listening?600:400, fontFamily:'inherit', cursor:'pointer', transition:'all .2s' }}>
        {listening ? <><span style={{ width:8, height:8, borderRadius:'50%', background:'#fff', animation:'pulse2 1s infinite' }}/>{I.micOff} Zastavit</> : <>{I.mic} Hlasový vstup</>}
      </button>
      {transcript && <span style={{ fontSize:12, color:t.muted, fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }}>„{transcript}"</span>}
    </div>
  )
}

// ── Settings Modal ─────────────────────────────────────────────────────────────
function SettingsModal({ t, themeName, setThemeName, sysPmt, setSysPmt, onClose, isLoggedIn, userId, memory, setMemory }) {
  const [tmpPmt, setTmpPmt] = useState(sysPmt)
  const [memList, setMemList] = useState([])
  const [tab, setTab] = useState('appearance')

  useEffect(() => {
    if (tab === 'memory' && isLoggedIn) {
      supabase.from('user_memory').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
        .then(({ data }) => setMemList(data || []))
    }
  }, [tab, isLoggedIn, userId])

  const delMemory = async (id) => {
    await supabase.from('user_memory').delete().eq('id', id)
    setMemList(p => p.filter(m => m.id !== id))
  }

  const themeOpts = [{ id:'dark', label:'Tmavý', icon:'🌙' }, { id:'light', label:'Světlý', icon:'☀️' }, { id:'midnight', label:'Midnight', icon:'🌌' }]
  const personas = [
    { label:'Profesionální asistent', val: SYS_DEFAULT },
    { label:'Přátelský pomocník', val:'Jsi přátelský a uvolněný AI pomocník. Komunikuješ neformálně a s humorem. Píšeš v češtině.' },
    { label:'Expert programátor', val:'Jsi expert na programování. Odpovídáš přesně s kódovými příklady. Preferuješ stručnost a technickou přesnost.' },
    { label:'Kreativní spisovatel', val:'Jsi kreativní spisovatel a básník. Pomáháš s tvorbou textů, příběhů a básní s bohatým jazykem.' },
    { label:'Lektor / učitel', val:'Jsi trpělivý lektor. Vysvětluješ vše jednoduše, používáš příklady a analogie. Přizpůsobuješ se tempu studenta.' },
  ]

  const tabs = [{ id:'appearance', label:'Vzhled', icon:'🎨' }, { id:'behavior', label:'Chování', icon:'🤖' }, { id:'memory', label:'Paměť', icon:'🧠' }, { id:'about', label:'O aplikaci', icon:'ℹ️' }]

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:49, backdropFilter:'blur(4px)' }}/>
      <div onClick={e=>e.stopPropagation()} style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:50, width:'min(520px,96vw)', maxHeight:'88vh', display:'flex', flexDirection:'column', background:t.modal, border:`1px solid ${t.border}`, borderRadius:18, fontFamily:"'DM Sans',sans-serif", overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'18px 20px 0', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <h2 style={{ fontSize:16, fontWeight:600, color:t.txt }}>⚙️ Nastavení</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:t.muted, cursor:'pointer', fontSize:20, display:'flex', padding:4 }}>{I.x}</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, padding:'12px 20px 0', flexShrink:0 }}>
          {tabs.map(tab2 => (
            <button key={tab2.id} onClick={()=>setTab(tab2.id)}
              style={{ padding:'6px 12px', borderRadius:8, background:tab===tab2.id?t.accent:t.btn, color:tab===tab2.id?'#fff':t.muted, fontSize:12, fontWeight:tab===tab2.id?600:400, border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}>
              {tab2.icon} {tab2.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px 20px' }}>

          {tab === 'appearance' && (
            <>
              <div style={{ fontSize:11, fontWeight:600, color:t.muted, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Barevné téma</div>
              <div style={{ display:'flex', gap:8, marginBottom:20 }}>
                {themeOpts.map(th => (
                  <button key={th.id} onClick={()=>setThemeName(th.id)}
                    style={{ flex:1, padding:'12px 8px', borderRadius:10, border:`2px solid ${themeName===th.id?t.accent:t.border}`, background:themeName===th.id?t.accent+'22':t.btn, color:themeName===th.id?t.accent:t.muted, fontSize:12, fontWeight:themeName===th.id?600:400, cursor:'pointer', fontFamily:'inherit', transition:'all .15s', textAlign:'center' }}>
                    <div style={{ fontSize:22, marginBottom:5 }}>{th.icon}</div>
                    {th.label}
                    {themeName===th.id && <div style={{ marginTop:4 }}>{I.check}</div>}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'behavior' && (
            <>
              <div style={{ fontSize:11, fontWeight:600, color:t.muted, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Osobnost asistenta</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:18 }}>
                {personas.map(p => (
                  <button key={p.label} onClick={()=>setTmpPmt(p.val)}
                    style={{ padding:'10px 13px', borderRadius:9, border:`1.5px solid ${tmpPmt===p.val?t.accent:t.border}`, background:tmpPmt===p.val?t.accent+'18':t.btn, color:tmpPmt===p.val?t.accent:t.txt, fontSize:13, textAlign:'left', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all .15s' }}>
                    {p.label}
                    {tmpPmt===p.val && <span style={{ color:t.accent }}>{I.check}</span>}
                  </button>
                ))}
              </div>
              <div style={{ fontSize:11, fontWeight:600, color:t.muted, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>Vlastní systémový prompt</div>
              <textarea value={tmpPmt} onChange={e=>setTmpPmt(e.target.value)} rows={4}
                style={{ width:'100%', padding:'10px 12px', background:t.inBg, color:t.txt, border:`1.5px solid ${t.inBrd}`, borderRadius:9, fontSize:13, lineHeight:1.6, outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box', marginBottom:6 }}/>
              <p style={{ fontSize:12, color:t.muted }}>Definuje osobnost a chování asistenta v každé konverzaci.</p>

              <div style={{ marginTop:16, padding:'12px 14px', borderRadius:10, background:t.tag, border:`1px solid ${t.border}` }}>
                <div style={{ fontSize:12, fontWeight:600, color:t.txt, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>{I.brain} Epizodická paměť</div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, color:t.muted }}>AI si pamatuje kontext z minulých chatů</span>
                  <button onClick={()=>setMemory(m=>!m)}
                    style={{ width:42, height:24, borderRadius:12, background:memory?t.accent:t.btn, border:`1px solid ${memory?t.accent:t.border}`, cursor:'pointer', position:'relative', transition:'all .2s', flexShrink:0 }}>
                    <span style={{ position:'absolute', top:3, left:memory?20:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left .2s', display:'block' }}/>
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === 'memory' && (
            <>
              <div style={{ fontSize:11, fontWeight:600, color:t.muted, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Uložená paměť {memList.length > 0 && `(${memList.length})`}</div>
              {!isLoggedIn && <p style={{ fontSize:13, color:t.muted }}>Pro správu paměti se přihlaste.</p>}
              {isLoggedIn && memList.length === 0 && <p style={{ fontSize:13, color:t.muted }}>Paměť je prázdná. AI si bude ukládat důležité informace z konverzací.</p>}
              {memList.map(m => (
                <div key={m.id} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'9px 12px', borderRadius:9, background:t.tag, border:`1px solid ${t.border}`, marginBottom:7 }}>
                  <span style={{ fontSize:10, color:t.muted, background:t.btn, padding:'2px 6px', borderRadius:4, flexShrink:0, marginTop:1 }}>{m.category}</span>
                  <span style={{ fontSize:13, color:t.txt, flex:1, lineHeight:1.4 }}>{m.content}</span>
                  <button onClick={()=>delMemory(m.id)} style={{ color:t.muted, display:'flex', padding:3, flexShrink:0 }}>{I.trash}</button>
                </div>
              ))}
            </>
          )}

          {tab === 'about' && (
            <div style={{ fontSize:13, color:t.muted, lineHeight:1.7 }}>
              <div style={{ width:52, height:52, borderRadius:14, background:t.accent+'22', border:`1.5px solid ${t.accent}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, margin:'0 auto 16px', color:t.accent }}>✦</div>
              <p style={{ textAlign:'center', fontWeight:600, color:t.txt, fontSize:15, marginBottom:6 }}>AI Asistent v1.0</p>
              <p style={{ textAlign:'center', marginBottom:16 }}>Powered by Google Gemini AI</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[['🤖 Chat', 'Gemini 3.1 Flash / 2.5 Flash'], ['🎨 Generování obrázků', 'Google Imagen 4'], ['📷 Vyhledávání fotek', 'Unsplash API'], ['🎙️ Hlasový vstup', 'Web Speech API (prohlížeč)'], ['🧠 Paměť', 'Supabase PostgreSQL'], ['🔒 Přihlášení', 'Supabase Auth']].map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', borderRadius:8, background:t.tag, border:`1px solid ${t.border}` }}>
                    <span>{k}</span><span style={{ color:t.accent, fontSize:12 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {(tab === 'appearance' || tab === 'behavior') && (
          <div style={{ padding:'0 20px 20px', display:'flex', gap:8, justifyContent:'flex-end', flexShrink:0 }}>
            <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:8, background:t.btn, color:t.txt, fontSize:13, fontWeight:500, cursor:'pointer', border:'none', fontFamily:'inherit' }}>Zrušit</button>
            <button onClick={()=>{ setSysPmt(tmpPmt); onClose() }} style={{ padding:'8px 16px', borderRadius:8, background:t.accent, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', border:'none', fontFamily:'inherit' }}>Uložit</button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Message Actions (feedback, explain, save memory) ────────────────────────
function MsgActions({ msg, t, isLoggedIn, token, onExplain, onSaveMemory }) {
  const [rating, setRating] = useState(null)
  const [showCorrect, setShowCorrect] = useState(false)
  const [correction, setCorrection] = useState('')

  const sendFeedback = async (r) => {
    setRating(r)
    if (token && msg.dbId) {
      try { await callEdge('feedback', { messageId: msg.dbId, rating: r, correction: correction||null }, token) } catch {}
    }
    setShowCorrect(false)
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:4, opacity:0.7 }}>
      <button onClick={()=>onExplain(msg)} style={{ display:'flex', alignItems:'center', gap:3, padding:'3px 7px', borderRadius:5, background:t.btn, color:t.muted, fontSize:11, border:`1px solid ${t.border}`, cursor:'pointer', fontFamily:'inherit' }} title="Jak jsem k tomu dospěl?">
        {I.explain} Vysvětlit
      </button>
      {isLoggedIn && (
        <button onClick={()=>onSaveMemory(msg.content)} style={{ display:'flex', alignItems:'center', gap:3, padding:'3px 7px', borderRadius:5, background:t.btn, color:t.muted, fontSize:11, border:`1px solid ${t.border}`, cursor:'pointer', fontFamily:'inherit' }} title="Uložit do paměti">
          {I.memory} Zapamatovat
        </button>
      )}
      <button onClick={()=>sendFeedback(1)} style={{ display:'flex', padding:'3px 6px', borderRadius:5, background:rating===1?t.success:t.btn, color:rating===1?t.successTxt:t.muted, border:`1px solid ${rating===1?t.successTxt:t.border}`, cursor:'pointer' }}>
        {I.thumb_up}
      </button>
      <button onClick={()=>{ if(rating===-1){setShowCorrect(true)}else{sendFeedback(-1)} }} style={{ display:'flex', padding:'3px 6px', borderRadius:5, background:rating===-1?'#2a1a1a':t.btn, color:rating===-1?'#fca5a5':t.muted, border:`1px solid ${rating===-1?'#6a2d2d':t.border}`, cursor:'pointer' }}>
        {I.thumb_dn}
      </button>
      {showCorrect && (
        <div style={{ position:'absolute', zIndex:10, bottom:'100%', left:0, right:0, background:t.modal, border:`1px solid ${t.border}`, borderRadius:10, padding:12, marginBottom:4 }}>
          <div style={{ fontSize:12, color:t.txt, marginBottom:7 }}>Jak by správná odpověď měla znít?</div>
          <textarea value={correction} onChange={e=>setCorrection(e.target.value)} rows={3} placeholder="Napište opravu…"
            style={{ width:'100%', padding:'8px 10px', background:t.inBg, color:t.txt, border:`1px solid ${t.inBrd}`, borderRadius:7, fontSize:12, outline:'none', resize:'none', fontFamily:'inherit', boxSizing:'border-box' }}/>
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <button onClick={()=>setShowCorrect(false)} style={{ padding:'5px 12px', borderRadius:7, background:t.btn, color:t.txt, fontSize:12, border:'none', cursor:'pointer', fontFamily:'inherit' }}>Zrušit</button>
            <button onClick={()=>sendFeedback(-1)} style={{ padding:'5px 12px', borderRadius:7, background:t.accent, color:'#fff', fontSize:12, border:'none', cursor:'pointer', fontFamily:'inherit' }}>Odeslat</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Chat Component ──────────────────────────────────────────────────────
export default function Chat({ session }) {
  const [themeName, setThemeName] = useState(() => localStorage.getItem('theme') || 'dark')
  const [showAuth, setShowAuth]   = useState(false)
  const [showSet, setShowSet]     = useState(false)
  const [sysPmt, setSysPmt]       = useState(() => localStorage.getItem('syspmt') || SYS_DEFAULT)
  const [imgMode, setImgMode]     = useState('chat')
  const [thinking, setThinking]   = useState(false)
  const [memory, setMemory]       = useState(true)
  const [sideOpen, setSideOpen]   = useState(() => typeof window !== 'undefined' && window.innerWidth > 768)
  const [input, setInput]         = useState('')
  const [atts, setAtts]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [err, setErr]             = useState(null)
  const [convs, setConvs]         = useState([mkLocal()])
  const [activeId, setActiveId]   = useState(null)
  const [msgs, setMsgs]           = useState([])
  const [dbLoading, setDbLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ]     = useState('')
  const [searchRes, setSearchRes] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [emotion, setEmotion]     = useState(null) // { emotion, confidence, suggestion }
  const [quizMode, setQuizMode]   = useState(false)
  const [quizTopic, setQuizTopic] = useState('')
  const [explainText, setExplainText] = useState(null)
  const [token, setToken]         = useState(null)

  const endRef   = useRef(null)
  const fileRef  = useRef(null)
  const taRef    = useRef(null)
  const searchRef= useRef(null)

  const t          = themes[themeName] || themes.dark
  const isLoggedIn = !!session
  const activeConv = convs.find(c => c.id === activeId) ?? convs[0] ?? null

  useEffect(() => { localStorage.setItem('theme', themeName) }, [themeName])
  useEffect(() => { localStorage.setItem('syspmt', sysPmt) }, [sysPmt])

  useEffect(() => {
    if (isLoggedIn) { getFreshToken().then(setToken); loadDbConvs() }
    else { const c = mkLocal(); setConvs([c]); setActiveId(c.id); setMsgs([]) }
  }, [isLoggedIn]) // eslint-disable-line

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [msgs.length, activeConv?.messages?.length, loading])
  useEffect(() => { if (activeId && typeof window !== 'undefined' && window.innerWidth <= 768) setSideOpen(false) }, [activeId])

  // Detect emotion in last user message
  useEffect(() => {
    const last = msgs.filter(m=>m.role==='user').at(-1)
    if (!last?.content || last.content.length < 20) return
    const tk = token || ANON
    callEdge('detect_emotion', { messages:[{ role:'user', content: last.content }] }, tk)
      .then(d => { if (d.emotion && d.emotion !== 'neutral') setEmotion(d) })
      .catch(() => {})
  }, [msgs.length]) // eslint-disable-line

  // ── DB ──────────────────────────────────────────────────────────────────────
  async function loadDbConvs() {
    setDbLoading(true)
    const { data } = await supabase.from('conversations').select('*').order('updated_at', { ascending: false })
    if (data?.length > 0) { setConvs(data.map(c=>({...c,local:false}))); setActiveId(data[0].id); await loadDbMsgs(data[0].id) }
    else { const c = await createDbConv(); if(c){setConvs([{...c,local:false}]);setActiveId(c.id);setMsgs([])} }
    setDbLoading(false)
  }
  async function loadDbMsgs(convId) {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true })
    setMsgs(data ?? [])
  }
  async function createDbConv(title = 'Nová konverzace') {
    const { data } = await supabase.from('conversations').insert({ user_id: session.user.id, title }).select().single()
    return data
  }
  async function saveDbMsg(convId, role, content, type = 'text', meta = null) {
    const { data } = await supabase.from('messages').insert({ conversation_id: convId, role, content, type, image_url: meta ? JSON.stringify(meta) : null }).select().single()
    return data
  }

  // ── Conversations ────────────────────────────────────────────────────────────
  async function newConv() {
    setErr(null); setInput(''); setAtts([]); setEmotion(null)
    if (isLoggedIn) { const c = await createDbConv(); if(c){setConvs(p=>[{...c,local:false},...p]);setActiveId(c.id);setMsgs([])} }
    else { const c = mkLocal(); setConvs(p=>[c,...p]); setActiveId(c.id) }
    if (typeof window !== 'undefined' && window.innerWidth <= 768) setSideOpen(false)
  }
  async function selectConv(id) { setActiveId(id); setErr(null); setEmotion(null); if(isLoggedIn) await loadDbMsgs(id) }
  async function delConv(id, e) {
    e.stopPropagation()
    if (isLoggedIn) await supabase.from('conversations').delete().eq('id', id)
    setConvs(prev => {
      const next = prev.filter(c=>c.id!==id)
      const list = next.length>0?next:[mkLocal()]
      if(id===activeId){setActiveId(list[0].id);if(isLoggedIn&&next.length>0)loadDbMsgs(list[0].id);else setMsgs([])}
      return list
    })
  }
  async function renameConv(id, title) {
    if (!title.trim()) return
    if (isLoggedIn) await supabase.from('conversations').update({ title }).eq('id', id)
    setConvs(p => p.map(c => c.id===id?{...c,title}:c))
    setEditingId(null)
  }

  // ── Auto-title ────────────────────────────────────────────────────────────────
  async function autoTitle(convId, firstMsg) {
    try {
      const tk = token || ANON
      const d = await callEdge('auto_title', { messages:[{ role:'user', content:[{ type:'text', text: firstMsg }] }] }, tk)
      if (d.title) { if(isLoggedIn) await supabase.from('conversations').update({ title: d.title }).eq('id', convId); setConvs(p=>p.map(c=>c.id===convId?{...c,title:d.title}:c)) }
    } catch {}
  }

  // ── Search ────────────────────────────────────────────────────────────────────
  async function doSearch(q) {
    setSearchQ(q)
    if (!q.trim()) { setSearchRes([]); return }
    if (isLoggedIn) {
      const { data } = await supabase.from('conversations').select('id,title,updated_at').ilike('title', `%${q}%`).limit(8)
      setSearchRes(data ?? [])
    } else { setSearchRes(convs.filter(c=>c.title.toLowerCase().includes(q.toLowerCase()))) }
  }

  // ── File attachment ───────────────────────────────────────────────────────────
  const onFile = async e => {
    const files = Array.from(e.target.files)
    const res = await Promise.all(files.map(f => new Promise(r => {
      const rd = new FileReader()
      rd.onload = () => r({ id:uid(), name:f.name, type:f.type, size:f.size, data:rd.result.split(',')[1], preview:f.type.startsWith('image/')?rd.result:null })
      rd.readAsDataURL(f)
    })))
    setAtts(p=>[...p,...res]); fileRef.current.value = ''
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────────
  const sendQuiz = async () => {
    if (!quizTopic.trim()) return
    setLoading(true); setErr(null)
    const convId = activeConv?.id; const isLocal = activeConv?.local
    const tmpA = { id:uid(), role:'user', content:`🎓 Kvíz: ${quizTopic}`, type:'text', created_at:new Date().toISOString(), _tmp:true }
    if (isLocal) setConvs(p=>p.map(c=>c.id!==convId?c:{...c,messages:[...(c.messages??[]),tmpA]}))
    else setMsgs(p=>[...p,tmpA])
    try {
      const tk = token || ANON
      const d = await callEdge('quiz', { topic: quizTopic, language:'Czech' }, tk)
      const aMsg = { id:uid(), role:'assistant', type:'quiz', content:'🎓 Kvíz', _quizData:d, created_at:new Date().toISOString() }
      if (isLocal) setConvs(p=>p.map(c=>c.id!==convId?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      else { await saveDbMsg(convId,'user',tmpA.content,'text',null); await saveDbMsg(convId,'assistant',JSON.stringify(d),'text',null); setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmpA,_tmp:false},aMsg]) }
    } catch(e) { setErr('Chyba kvízu: '+e.message) }
    finally { setLoading(false); setQuizMode(false); setQuizTopic('') }
  }

  // ── Save memory ───────────────────────────────────────────────────────────────
  const saveMemory = async (content) => {
    if (!isLoggedIn || !content) return
    try { await callEdge('save_memory', { content: content.slice(0, 500), category: 'fact' }, token) } catch {}
  }

  // ── Explain ───────────────────────────────────────────────────────────────────
  const explainMsg = async (msg) => {
    setExplainText('Načítám vysvětlení…')
    try {
      const tk = token || ANON
      const d = await callEdge('explain', { messages:[{ role:'assistant', content: msg.content }], language:'Czech' }, tk)
      setExplainText(d.explanation || 'Nepodařilo se získat vysvětlení.')
    } catch(e) { setExplainText('Chyba: '+e.message) }
  }

  // ── Send ──────────────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    if ((!input.trim() && !atts.length) || loading || !activeConv) return
    const convId   = activeConv.id
    const userText = input.trim() || atts.map(a=>a.name).join(', ')
    const isLocal  = activeConv.local
    const apiMode  = isLoggedIn ? detectMode(userText, imgMode) : 'chat'
    const isFirstMsg = (isLocal ? activeConv.messages?.length : msgs.length) === 0

    const apiContent = []
    atts.forEach(a => {
      if (a.type.startsWith('image/')) apiContent.push({ type:'image', source:{ type:'base64', media_type:a.type, data:a.data } })
      else apiContent.push({ type:'text', text:`[Soubor: ${a.name}]` })
    })
    if (input.trim()) apiContent.push({ type:'text', text:input.trim() })

    const tmpUser = { id:uid(), role:'user', content:userText, type:'text', created_at:new Date().toISOString(), _tmp:true, _atts:atts.map(a=>({id:a.id,name:a.name,type:a.type,preview:a.preview})) }
    setInput(''); setAtts([]); setLoading(true); setErr(null); setEmotion(null)

    const prevMsgs = isLocal ? (activeConv.messages??[]) : msgs

    if (isLocal) {
      setConvs(p=>p.map(c=>{if(c.id!==convId)return c;const title=isFirstMsg?userText.slice(0,38)+(userText.length>38?'…':''):c.title;return{...c,title,messages:[...(c.messages??[]),tmpUser]}}))
    } else {
      setMsgs(p=>[...p,tmpUser])
      if (isFirstMsg && activeConv.title==='Nová konverzace') autoTitle(convId, userText)
    }

    try {
      const history = [...prevMsgs, tmpUser].map(m => ({
        role: m.role,
        content: m.id===tmpUser.id&&apiContent.length>0 ? apiContent : [{ type:'text', text:m.content }]
      }))
      const tk = isLoggedIn ? (await getFreshToken() || ANON) : ANON
      const result = await callEdge(apiMode, { messages:history, system:sysPmt, thinking, memory }, tk)

      let aMsg
      if (result.type==='image_search') {
        aMsg = { id:uid(), role:'assistant', type:'image_search', content:`📷 ${result.images?.length??0} fotografií`, _images:result.images, _query:result.query, image_url:JSON.stringify(result.images), created_at:new Date().toISOString() }
      } else if (result.type==='generated_image') {
        aMsg = { id:uid(), role:'assistant', type:'generated_image', content:'🎨 Vygenerovaný obrázek', _imageData:result.imageData, _mimeType:result.mimeType, _prompt:userText, image_url:JSON.stringify({imageData:result.imageData,mimeType:result.mimeType,prompt:userText}), created_at:new Date().toISOString() }
      } else {
        aMsg = { id:uid(), role:'assistant', type:'text', content:result.text??'(prázdná odpověď)', created_at:new Date().toISOString() }
      }

      if (isLocal) {
        setConvs(p=>p.map(c=>c.id!==convId?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      } else {
        const uRow = await saveDbMsg(convId,'user',userText,'text',null)
        if (aMsg.type==='image_search') await saveDbMsg(convId,'assistant',aMsg.content,'image_search',aMsg._images)
        else if (aMsg.type==='generated_image') await saveDbMsg(convId,'assistant',aMsg.content,'image',{imageData:aMsg._imageData,mimeType:aMsg._mimeType,prompt:userText})
        else { const aRow = await saveDbMsg(convId,'assistant',aMsg.content,'text',null); if(aRow) aMsg.dbId = aRow.id }
        await supabase.from('conversations').update({ updated_at:new Date().toISOString() }).eq('id',convId)
        setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmpUser,_tmp:false,dbId:uRow?.id},aMsg])
      }
    } catch(e) {
      setErr('Chyba: '+e.message)
      if (isLocal) setConvs(p=>p.map(c=>c.id===convId?{...c,messages:prevMsgs}:c))
      else setMsgs(prevMsgs)
      setInput(userText)
    } finally { setLoading(false) }
  }, [input, atts, loading, activeConv, msgs, isLoggedIn, imgMode, sysPmt, thinking, memory, token]) // eslint-disable-line

  const onKey = e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }
  const displayMsgs = activeConv?.local ? (activeConv.messages??[]) : msgs
  const canSend = (input.trim()||atts.length>0) && !loading
  const userInitial = session ? (session.user.user_metadata?.full_name||session.user.email||'U')[0].toUpperCase() : '?'

  function getImgData(msg) {
    if (msg._images||msg._imageData||msg._quizData) return msg
    if (msg.image_url) { try { const p=JSON.parse(msg.image_url); return {...msg,_images:Array.isArray(p)?p:undefined,_imageData:p.imageData,_mimeType:p.mimeType,_prompt:p.prompt,_query:msg.content} } catch { return msg } }
    return msg
  }

  const modeColor = imgMode==='generate_image' ? t.purple : t.accent
  const loadingTxt = { chat:null, image_search:'🔍 Hledám fotografie…', generate_image:'🎨 Generuji obrázek…' }
  const placeholders = { chat: thinking?'💭 Hluboké přemýšlení zapnuto… (Enter = odeslat)':'Napište zprávu… (Enter = odeslat)', image_search:'🔍 Popište co hledáte…', generate_image:'🎨 Popište obrázek…' }

  return (
    <div style={{ display:'flex', height:'100dvh', overflow:'hidden', background:t.bg, color:t.txt, fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${t.scrl};border-radius:2px}
        textarea,input{font-family:inherit}textarea{resize:none;outline:none;border:none;background:transparent}input{outline:none;border:none;background:transparent}
        button{cursor:pointer;border:none;background:none;font-family:inherit}
        @keyframes fu{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pu{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        @keyframes pulse2{0%,100%{opacity:.5;transform:scale(.9)}50%{opacity:1;transform:scale(1.1)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .fi{animation:fu .2s ease both}
        .dot span{display:inline-block;width:6px;height:6px;border-radius:50%;background:${t.accent};margin:0 2px;animation:pu 1.2s infinite ease-in-out}
        .dot span:nth-child(2){animation-delay:.18s}.dot span:nth-child(3){animation-delay:.36s}
        .cr:hover{background:${t.active}!important}.cr:hover .cr-act{opacity:1!important}
        .ib:hover{opacity:.65}
        .mode-btn{transition:all .15s}
        @media(max-width:768px){.sidebar{position:fixed!important;top:0;left:0;bottom:0;z-index:30;box-shadow:4px 0 24px rgba(0,0,0,.5)}.sidebar-ov{display:block!important}}
      `}</style>

      {/* Mobile sidebar overlay */}
      {sideOpen && <div className="sidebar-ov" onClick={()=>setSideOpen(false)} style={{ display:'none', position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:29 }}/>}

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      {sideOpen && (
        <aside className="sidebar" style={{ width:272, background:t.side, borderRight:`1px solid ${t.border}`, display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'13px 12px', borderBottom:`1px solid ${t.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:27, height:27, borderRadius:8, background:t.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>A</div>
              <span style={{ fontWeight:600, fontSize:13, color:t.txt }}>AI Asistent</span>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              <button className="ib" onClick={()=>{setSearchOpen(o=>!o);setTimeout(()=>searchRef.current?.focus(),100)}} style={{ color:t.muted, display:'flex', padding:6, borderRadius:6, background:searchOpen?t.active:'transparent' }}>{I.search}</button>
              <button onClick={newConv} style={{ background:t.accent, color:'#fff', borderRadius:7, padding:'5px 9px', display:'flex', alignItems:'center' }}>{I.plus}</button>
            </div>
          </div>

          {searchOpen && (
            <div style={{ padding:'8px 10px', borderBottom:`1px solid ${t.border}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 10px', background:t.inBg, border:`1px solid ${t.inBrd}`, borderRadius:9 }}>
                <span style={{ color:t.muted, flexShrink:0 }}>{I.search}</span>
                <input ref={searchRef} value={searchQ} onChange={e=>doSearch(e.target.value)} placeholder="Hledat v chatech…" style={{ flex:1, fontSize:13, color:t.txt }}/>
                {searchQ && <button onClick={()=>{setSearchQ('');setSearchRes([])}} style={{ color:t.muted, display:'flex', padding:2 }}>{I.x}</button>}
              </div>
              {searchRes.map(c => (
                <div key={c.id} onClick={()=>{selectConv(c.id);setSearchOpen(false);setSearchQ('');setSearchRes([])}}
                  style={{ padding:'7px 9px', borderRadius:7, cursor:'pointer', fontSize:13, color:t.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:4 }}
                  onMouseOver={e=>e.currentTarget.style.background=t.active} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  🔍 {c.title}
                </div>
              ))}
            </div>
          )}

          <div style={{ flex:1, overflowY:'auto', padding:'5px' }}>
            {dbLoading ? <div style={{ padding:16, textAlign:'center', fontSize:12, color:t.muted }}>Načítám…</div>
              : convs.map(c => (
                <div key={c.id} className="cr" onClick={()=>selectConv(c.id)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 9px', borderRadius:8, cursor:'pointer', marginBottom:2, transition:'background .1s', background:c.id===activeId?t.active:'transparent', borderLeft:c.id===activeId?`2px solid ${t.accent}`:'2px solid transparent' }}>
                  {editingId===c.id ? (
                    <form onSubmit={e=>{e.preventDefault();renameConv(c.id,editTitle)}} style={{ flex:1 }} onClick={e=>e.stopPropagation()}>
                      <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} onBlur={()=>renameConv(c.id,editTitle)} autoFocus
                        style={{ width:'100%', fontSize:13, color:t.txt, background:t.inBg, border:`1px solid ${t.accent}`, borderRadius:5, padding:'3px 7px' }}/>
                    </form>
                  ) : (
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:c.id===activeId?t.txt:t.muted }}>{c.title}</div>
                      <div style={{ fontSize:10, color:t.muted, marginTop:2 }}>{c.local?'Dočasná':fmtDate(c.updated_at)}</div>
                    </div>
                  )}
                  <div className="cr-act" style={{ display:'flex', gap:2, opacity:0, transition:'opacity .15s', flexShrink:0 }}>
                    <button className="ib" onClick={e=>{e.stopPropagation();setEditingId(c.id);setEditTitle(c.title)}} style={{ color:t.muted, display:'flex', padding:4, borderRadius:5 }}>{I.edit}</button>
                    <button className="ib" onClick={e=>delConv(c.id,e)} style={{ color:t.muted, display:'flex', padding:4, borderRadius:5 }}>{I.trash}</button>
                  </div>
                </div>
              ))
            }
          </div>

          <div style={{ padding:'10px 11px', borderTop:`1px solid ${t.border}` }}>
            {isLoggedIn ? (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:30, height:30, borderRadius:8, background:t.accent+'33', border:`1px solid ${t.accent}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:t.accent, flexShrink:0 }}>{userInitial}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:t.txt, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{session.user.user_metadata?.full_name||session.user.email}</div>
                  <div style={{ fontSize:11, color:t.muted }}>Přihlášen</div>
                </div>
                <button className="ib" onClick={()=>supabase.auth.signOut()} style={{ color:t.muted, display:'flex', padding:4 }}>{I.out}</button>
              </div>
            ) : (
              <button onClick={()=>setShowAuth(true)} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderRadius:9, background:t.btn, border:`1px solid ${t.border}`, color:t.muted, fontSize:13, fontWeight:500 }}>
                <span style={{ color:t.accent }}>{I.user}</span><span>Přihlásit se</span>
                <span style={{ marginLeft:'auto', fontSize:10, background:t.tag, padding:'2px 7px', borderRadius:4 }}>Uloží historii</span>
              </button>
            )}
          </div>
        </aside>
      )}

      {/* ── MAIN ─────────────────────────────────────────────────────────────── */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px', height:52, background:t.hdr, borderBottom:`1px solid ${t.border}`, backdropFilter:'blur(12px)', flexShrink:0, gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
            <button className="ib" onClick={()=>setSideOpen(o=>!o)} style={{ color:t.muted, display:'flex', padding:5, flexShrink:0 }}>{I.menu}</button>
            <span style={{ fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{activeConv?.title||'AI Asistent'}</span>
          </div>
          <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
            {/* Thinking mode toggle */}
            {isLoggedIn && (
              <button className="ib" onClick={()=>setThinking(t2=>!t2)}
                style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 9px', borderRadius:7, background:thinking?t.purple+'33':t.btn, color:thinking?t.purple:t.muted, border:`1px solid ${thinking?t.purple:t.border}`, fontSize:11 }}
                title="Hluboké přemýšlení (pomalejší, přesnější)">
                {I.brain}{thinking?'ON':''}
              </button>
            )}
            <button className="ib" onClick={()=>setShowSet(true)} style={{ display:'flex', padding:'5px 9px', borderRadius:7, background:t.btn, color:t.muted }}>{I.gear}</button>
            <button className="ib" onClick={()=>setThemeName(n=>n==='dark'?'light':n==='light'?'midnight':'dark')} style={{ display:'flex', padding:'5px 9px', borderRadius:7, background:t.btn, color:t.muted }}>
              {themeName==='dark'?I.moon:themeName==='light'?I.sun:'🌌'}
            </button>
            {!isLoggedIn && <button onClick={()=>setShowAuth(true)} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:7, background:t.accent, color:'#fff', fontSize:12, fontWeight:600 }}>{I.user}<span>Přihlásit</span></button>}
          </div>
        </header>

        {/* Emotion indicator */}
        {emotion && emotion.emotion !== 'neutral' && (
          <div style={{ padding:'7px 14px', background:t.tag, borderBottom:`1px solid ${t.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12 }}>
            <span style={{ color:t.muted }}>{EMOTION_EMOJI[emotion.emotion]} Detekovaná nálada: <strong style={{ color:t.txt }}>{emotion.emotion}</strong> · {emotion.suggestion}</span>
            <button onClick={()=>setEmotion(null)} style={{ color:t.muted, display:'flex', padding:3 }}>{I.x}</button>
          </div>
        )}

        {/* Explain panel */}
        {explainText && (
          <div style={{ padding:'10px 14px', background:t.purple+'18', borderBottom:`1px solid ${t.purple}44`, display:'flex', alignItems:'flex-start', gap:8, fontSize:13 }}>
            <span style={{ color:t.purple, flexShrink:0, marginTop:1 }}>{I.explain}</span>
            <span style={{ color:t.txt, flex:1, lineHeight:1.5 }}>{explainText}</span>
            <button onClick={()=>setExplainText(null)} style={{ color:t.muted, display:'flex', padding:3, flexShrink:0 }}>{I.x}</button>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 14px', display:'flex', flexDirection:'column', gap:12 }}>
          {displayMsgs.length===0 && !loading && (
            <div style={{ textAlign:'center', marginTop:'7vh', padding:'0 16px' }}>
              <div style={{ width:52, height:52, borderRadius:14, background:t.accent+'22', border:`1.5px solid ${t.accent}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, margin:'0 auto 14px', color:t.accent }}>✦</div>
              <div style={{ fontSize:20, fontWeight:600, marginBottom:6 }}>Jak Vám mohu pomoci?</div>
              <div style={{ fontSize:13, color:t.muted, marginBottom:18 }}>
                {isLoggedIn ? 'Chat · Imagen · Fotografie · Kvízy · Hlasový vstup' : 'Začněte psát — přihlášení není potřeba'}
              </div>
              <div style={{ display:'flex', gap:7, justifyContent:'center', flexWrap:'wrap', maxWidth:500, margin:'0 auto' }}>
                {(isLoggedIn
                  ? ['Jak funguje kvantové počítání?', 'Najdi mi fotky Prahy', 'Vygeneruj obrázek lesa', 'Kvíz o historii', 'Vysvětli mi AI']
                  : ['Jak funguje AI?', 'Napiš mi báseň', 'Co je strojové učení?', 'Pomoz mi s kódem']
                ).map(hint => (
                  <button key={hint} onClick={()=>setInput(hint)}
                    style={{ padding:'7px 13px', borderRadius:20, background:t.btn, border:`1px solid ${t.border}`, color:t.muted, fontSize:12, transition:'all .15s' }}
                    onMouseOver={e=>{e.currentTarget.style.borderColor=t.accent;e.currentTarget.style.color=t.txt}}
                    onMouseOut={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.color=t.muted}}>
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayMsgs.map(msg => {
            const m = getImgData(msg)
            const isWide = ['image_search','generated_image','quiz'].includes(msg.type)
            return (
              <div key={msg.id} className="fi" style={{ display:'flex', gap:8, justifyContent:msg.role==='user'?'flex-end':'flex-start', alignItems:'flex-start' }}>
                {msg.role==='assistant' && (
                  <div style={{ width:28, height:28, borderRadius:8, background:t.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0, marginTop:2 }}>A</div>
                )}
                <div style={{ maxWidth:isWide?'94%':'80%', minWidth:40, position:'relative' }}>
                  {msg._atts?.length>0 && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6, justifyContent:'flex-end' }}>
                      {msg._atts.map(a => a.preview
                        ? <img key={a.id} src={a.preview} alt={a.name} style={{ height:60, width:60, objectFit:'cover', borderRadius:8, border:`1px solid ${t.border}` }}/>
                        : <div key={a.id} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px', background:t.pill, borderRadius:7, fontSize:12, color:t.txt }}>{I.file}{a.name.length>14?a.name.slice(0,12)+'…':a.name}</div>
                      )}
                    </div>
                  )}
                  {msg.type==='image_search' ? (
                    <div style={{ padding:'12px 14px', background:t.aiB, borderRadius:'16px 16px 16px 4px', border:`1px solid ${t.border}` }}>
                      <ImgSearchResults images={m._images} query={m._query||msg.content} t={t}/>
                      <div style={{ fontSize:10, color:t.muted, marginTop:8, textAlign:'right' }}>{fmtTime(msg.created_at)}</div>
                    </div>
                  ) : msg.type==='generated_image' ? (
                    <div style={{ padding:'12px 14px', background:t.aiB, borderRadius:'16px 16px 16px 4px', border:`1px solid ${t.border}` }}>
                      <GenImage imageData={m._imageData} mimeType={m._mimeType} prompt={m._prompt} t={t}/>
                      <div style={{ fontSize:10, color:t.muted, marginTop:8, textAlign:'right' }}>{fmtTime(msg.created_at)}</div>
                    </div>
                  ) : msg.type==='quiz' ? (
                    <QuizCard data={m._quizData || (() => { try { return JSON.parse(msg.content) } catch { return null } })()} t={t}/>
                  ) : (
                    <div>
                      <div style={{ padding:'10px 14px', background:msg.role==='user'?t.accent:t.aiB, color:msg.role==='user'?'#fff':t.txt, borderRadius:msg.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px', border:msg.role==='assistant'?`1px solid ${t.border}`:'none', opacity:msg._tmp?0.7:1 }}>
                        <div style={{ fontSize:14, lineHeight:1.65, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{msg.content}</div>
                        <div style={{ fontSize:10, color:msg.role==='user'?'rgba(255,255,255,.5)':t.muted, marginTop:4, textAlign:'right' }}>{fmtTime(msg.created_at)}</div>
                      </div>
                      {msg.role==='assistant' && !msg._tmp && (
                        <MsgActions msg={msg} t={t} isLoggedIn={isLoggedIn} token={token} onExplain={explainMsg} onSaveMemory={saveMemory}/>
                      )}
                    </div>
                  )}
                </div>
                {msg.role==='user' && (
                  <div style={{ width:28, height:28, borderRadius:8, background:isLoggedIn?t.accent+'88':t.ua, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#fff', flexShrink:0, marginTop:2 }}>
                    {isLoggedIn?userInitial:'?'}
                  </div>
                )}
              </div>
            )
          })}

          {loading && (
            <div className="fi" style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
              <div style={{ width:28, height:28, borderRadius:8, background:t.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>A</div>
              <div style={{ padding:'12px 16px', background:t.aiB, borderRadius:'16px 16px 16px 4px', border:`1px solid ${t.border}` }}>
                {loadingTxt[imgMode]
                  ? <span style={{ fontSize:13, color:t.muted }}>{loadingTxt[imgMode]}</span>
                  : thinking ? <span style={{ fontSize:13, color:t.purple }}>💭 Přemýšlím…</span>
                  : <div className="dot"><span/><span/><span/></div>
                }
              </div>
            </div>
          )}

          {err && <div style={{ padding:'9px 13px', background:'#ff444418', border:'1px solid #ff444440', borderRadius:9, fontSize:13, color:'#ff6b6b', display:'flex', gap:8, wordBreak:'break-word' }}><span style={{flexShrink:0}}>⚠️</span><span>{err}</span></div>}
          <div ref={endRef}/>
        </div>

        {/* ── Input Area ──────────────────────────────────────────────────────── */}
        <div style={{ padding:'8px 12px 12px', background:t.iaBg, borderTop:`1px solid ${t.border}`, flexShrink:0 }}>

          {/* Mode buttons */}
          {isLoggedIn && (
            <div style={{ display:'flex', gap:5, marginBottom:8, flexWrap:'wrap', alignItems:'center' }}>
              <button className="mode-btn" onClick={()=>setImgMode(m=>m==='generate_image'?'chat':'generate_image')}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:6, fontSize:12, fontWeight:imgMode==='generate_image'?600:400, background:imgMode==='generate_image'?t.purple:t.btn, color:imgMode==='generate_image'?'#fff':t.muted, border:`1px solid ${imgMode==='generate_image'?t.purple:t.border}` }}>
                {I.magic}{imgMode==='generate_image'?'🎨 Imagen':'Generovat obrázek'}
              </button>
              <button className="mode-btn" onClick={()=>setImgMode(m=>m==='image_search'?'chat':'image_search')}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:6, fontSize:12, fontWeight:imgMode==='image_search'?600:400, background:imgMode==='image_search'?t.accent:t.btn, color:imgMode==='image_search'?'#fff':t.muted, border:`1px solid ${imgMode==='image_search'?t.accent:t.border}` }}>
                {I.imgSrch}{imgMode==='image_search'?'🔍 Hledání':'Hledat fotky'}
              </button>
              <button className="mode-btn" onClick={()=>setQuizMode(m=>!m)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:6, fontSize:12, fontWeight:quizMode?600:400, background:quizMode?'#f59e0b':t.btn, color:quizMode?'#fff':t.muted, border:`1px solid ${quizMode?'#f59e0b':t.border}` }}>
                {I.quiz}{quizMode?'🎓 Kvíz':'Kvíz'}
              </button>
            </div>
          )}

          {/* Quiz input */}
          {quizMode && (
            <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
              <input value={quizTopic} onChange={e=>setQuizTopic(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendQuiz()} placeholder="Téma kvízu (např. Historie, Matematika, AI…)" style={{ flex:1, padding:'8px 12px', background:t.inBg, color:t.txt, border:`1.5px solid #f59e0b`, borderRadius:9, fontSize:13 }}/>
              <button onClick={sendQuiz} disabled={!quizTopic.trim()||loading} style={{ padding:'8px 14px', borderRadius:9, background:'#f59e0b', color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit', opacity:!quizTopic.trim()?0.5:1 }}>Start</button>
            </div>
          )}

          {/* Attachments */}
          {atts.length>0 && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {atts.map(a => (
                <div key={a.id} style={{ position:'relative' }}>
                  {a.preview ? <img src={a.preview} alt={a.name} style={{ height:46, width:46, objectFit:'cover', borderRadius:7, border:`1px solid ${t.border}`, display:'block' }}/>
                    : <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px', background:t.pill, borderRadius:7, fontSize:12, color:t.txt }}>{I.file}{a.name.length>16?a.name.slice(0,14)+'…':a.name}</div>}
                  <button onClick={()=>setAtts(p=>p.filter(x=>x.id!==a.id))} style={{ position:'absolute', top:-5, right:-5, width:16, height:16, borderRadius:'50%', background:t.danger, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>{I.x}</button>
                </div>
              ))}
            </div>
          )}

          {/* Live voice bar */}
          <div style={{ marginBottom:8 }}>
            <LiveVoiceBar t={t} isLoggedIn={isLoggedIn} onTranscript={txt=>{ setInput(txt); setTimeout(()=>taRef.current?.focus(),100) }}/>
          </div>

          {/* Input box */}
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, padding:'9px 11px', background:t.inBg, border:`1.5px solid ${imgMode!=='chat'?modeColor:thinking?t.purple:t.inBrd}`, borderRadius:14, transition:'border-color .2s' }}>
            <textarea ref={taRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
              placeholder={placeholders[imgMode]}
              rows={1} style={{ flex:1, fontSize:14, lineHeight:1.5, color:t.txt, caretColor:t.accent, maxHeight:120, overflowY:'auto', paddingTop:2 }}
              onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'}}/>
            <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
              <button className="ib" onClick={()=>fileRef.current.click()} style={{ color:t.muted, display:'flex', padding:5 }}>{I.clip}</button>
              <button onClick={send} disabled={!canSend}
                style={{ width:34, height:34, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', background:canSend?(imgMode==='generate_image'?t.purple:thinking?t.purple:t.accent):t.btn, color:canSend?'#fff':t.muted, transition:'all .15s', flexShrink:0 }}>
                {I.send}
              </button>
            </div>
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.docx" style={{ display:'none' }} onChange={onFile}/>
          <div style={{ fontSize:10, color:t.muted, textAlign:'center', marginTop:5 }}>
            Gemini AI · Imagen · Unsplash{isLoggedIn?' · Paměť + Historie v Supabase':' · Přihlaste se pro plné funkce'}
          </div>
        </div>
      </main>

      {showAuth && <AuthModal onClose={()=>setShowAuth(false)} dark={themeName!=='light'}/>}
      {showSet && <SettingsModal t={t} themeName={themeName} setThemeName={setThemeName} sysPmt={sysPmt} setSysPmt={setSysPmt} onClose={()=>setShowSet(false)} isLoggedIn={isLoggedIn} userId={session?.user?.id} memory={memory} setMemory={setMemory}/>}
    </div>
  )
}
