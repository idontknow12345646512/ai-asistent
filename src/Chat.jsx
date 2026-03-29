import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import AuthModal from './AuthModal'
import LiveModal from './LiveModal'
import {
  EDGE, ANON, SYS_DEFAULT, EMOTION_EMOJI, CONV_COLORS, IMG_MODELS, AI_MODELS,
  PERSONAS, QUIZ_COUNTS, QUIZ_DIFFS, THEMES, THEME_LIST, Ic,
  uid, fmtTime, fmtDate, getFreshToken, callEdge, detectAutoMode, mkLocal, renderMD
} from './constants.jsx'

// ── Typing animation ──────────────────────────────────────────────────────────
function TypingText({ text, isDark, useMarkdown, onDone }) {
  const [shown, setShown]       = useState('')
  const [finished, setFinished] = useState(false)
  useEffect(() => {
    setShown(''); setFinished(false)
    if (!text) { setFinished(true); onDone && onDone(); return }
    let i = 0
    const speed = text.length > 600 ? 3 : text.length > 200 ? 5 : 7
    const id = setInterval(() => {
      i += speed
      if (i >= text.length) { setShown(text); setFinished(true); clearInterval(id); onDone && onDone() }
      else setShown(text.slice(0, i))
    }, 16)
    return () => clearInterval(id)
  }, [text]) // eslint-disable-line
  if (finished && useMarkdown) {
    return <div style={{fontSize:14,lineHeight:1.7,wordBreak:'break-word'}} dangerouslySetInnerHTML={{__html:renderMD(text,isDark)}}/>
  }
  return (
    <div style={{fontSize:14,lineHeight:1.65,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
      {shown}
      {!finished && <span style={{animation:'blink 1s infinite',display:'inline-block',width:2,height:14,background:'currentColor',marginLeft:1,verticalAlign:'text-bottom'}}/>}
    </div>
  )
}

// ── Image search grid ─────────────────────────────────────────────────────────
function ImgGrid({ images, query, t }) {
  const [errs, setErrs] = useState({})
  if (!images?.length) return <div style={{fontSize:13,color:t.muted}}>Žádné fotografie pro „{query}"</div>
  return (
    <div>
      <div style={{fontSize:12,color:t.muted,marginBottom:9,display:'flex',alignItems:'center',gap:6}}>
        {Ic.imgSrch} <strong style={{color:t.txt}}>„{query}"</strong>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
        {images.map((img,i) => !errs[i] && (
          <a key={img.id||i} href={img.source} target="_blank" rel="noopener noreferrer"
            style={{display:'block',borderRadius:8,overflow:'hidden',border:`1px solid ${t.border}`,textDecoration:'none',background:t.card,transition:'transform .15s,opacity .15s'}}
            onMouseOver={e=>{e.currentTarget.style.opacity='.85';e.currentTarget.style.transform='scale(1.02)'}}
            onMouseOut={e=>{e.currentTarget.style.opacity='1';e.currentTarget.style.transform='scale(1)'}}>
            <div style={{position:'relative',paddingBottom:'66%',overflow:'hidden'}}>
              <img src={img.thumbnail||img.url} alt={img.title||query}
                onError={()=>setErrs(p=>({...p,[i]:true}))}
                style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
            </div>
            <div style={{padding:'4px 7px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:10,color:t.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>📷 {img.author||'Unsplash'}</span>
              {Ic.extLink}
            </div>
          </a>
        ))}
      </div>
      <div style={{fontSize:10,color:t.muted,marginTop:7}}>
        Fotografie z <a href="https://unsplash.com?utm_source=ai_asistent&utm_medium=referral" target="_blank" rel="noopener noreferrer" style={{color:t.accent,textDecoration:'none'}}>Unsplash</a>
      </div>
    </div>
  )
}

// ── Generated image ───────────────────────────────────────────────────────────
function GenImg({ imageData, mimeType, prompt, modelId, t }) {
  const src       = `data:${mimeType||'image/jpeg'};base64,${imageData}`
  const modelName = IMG_MODELS.find(m=>m.id===modelId)?.name || modelId || 'FLUX'
  const dl = () => { const a=document.createElement('a');a.href=src;a.download=`ai-${Date.now()}.jpg`;a.click() }
  return (
    <div>
      <div style={{fontSize:12,color:t.muted,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
        {Ic.magic} Pollinations AI · <strong style={{color:t.purple}}>{modelName}</strong>
      </div>
      <div style={{position:'relative',display:'inline-block',maxWidth:'100%'}}>
        <img src={src} alt={prompt} style={{maxWidth:'100%',maxHeight:440,borderRadius:12,display:'block',border:`1px solid ${t.border}`}}/>
        <button onClick={dl} style={{position:'absolute',top:8,right:8,display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:7,background:'rgba(0,0,0,.65)',color:'#fff',fontSize:11,border:'none',cursor:'pointer',backdropFilter:'blur(4px)',fontFamily:'inherit'}}>
          {Ic.dl} Stáhnout
        </button>
      </div>
      {prompt && <div style={{fontSize:11,color:t.muted,marginTop:6,fontStyle:'italic'}}>„{prompt}"</div>}
    </div>
  )
}

// ── Quiz ──────────────────────────────────────────────────────────────────────
function QuizCard({ questions, t }) {
  const [cur,     setCur]     = useState(0)
  const [answers, setAnswers] = useState({})
  const [done,    setDone]    = useState(false)

  if (!questions?.length) return (
    <div style={{padding:'12px 14px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`,fontSize:13,color:t.muted}}>
      Kvíz nemá žádné otázky.
    </div>
  )

  const q     = questions[cur]
  const total = questions.length
  const score = Object.entries(answers).filter(([i,a]) => Number(a)===questions[Number(i)]?.correct).length

  if (done) {
    const pct   = Math.round((score/total)*100)
    const emoji = pct>=80?'🏆':pct>=60?'👍':pct>=40?'😊':'📚'
    const msg   = pct>=80?'Výborně! Skvělý výkon!':pct>=60?'Dobrá práce!':pct>=40?'Slušný výsledek!':'Příště to půjde lépe!'
    return (
      <div style={{padding:'20px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`,textAlign:'center'}}>
        <div style={{fontSize:44,marginBottom:10}}>{emoji}</div>
        <div style={{fontSize:24,fontWeight:700,color:t.txt}}>{score}/{total}</div>
        <div style={{fontSize:14,color:t.muted,marginTop:4}}>{pct}% správně</div>
        <div style={{width:'100%',height:8,background:t.btn,borderRadius:4,marginTop:14,overflow:'hidden'}}>
          <div style={{width:`${pct}%`,height:'100%',background:pct>=80?t.succ:pct>=60?t.accent:'#f59e0b',borderRadius:4,transition:'width 1.2s ease'}}/>
        </div>
        <div style={{fontSize:13,color:t.muted,marginTop:10,marginBottom:18}}>{msg}</div>
        <button onClick={()=>{setAnswers({});setCur(0);setDone(false)}}
          style={{padding:'10px 24px',borderRadius:9,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>
          🔄 Zkusit znovu
        </button>
      </div>
    )
  }

  return (
    <div style={{padding:'14px 16px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <div style={{flex:1,height:4,background:t.btn,borderRadius:2,overflow:'hidden'}}>
          <div style={{width:`${((cur+1)/total)*100}%`,height:'100%',background:t.accent,transition:'width .4s ease'}}/>
        </div>
        <span style={{fontSize:11,color:t.muted,flexShrink:0}}>{cur+1}/{total}</span>
      </div>
      <div style={{fontSize:13,fontWeight:600,color:t.txt,marginBottom:12,lineHeight:1.4}}>🎓 {q.question}</div>
      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {q.options?.map((opt,i) => {
          const sel=answers[cur], isC=i===q.correct, isSel=sel===i
          let bg=t.btn, clr=t.txt, brd=t.border
          if (sel!==undefined) {
            if (isC)        { bg=t.success; clr=t.succ; brd=t.succ }
            else if (isSel) { bg='rgba(239,68,68,.15)'; clr='#fca5a5'; brd='#f87171' }
          }
          return (
            <button key={i} onClick={()=>sel===undefined&&setAnswers(p=>({...p,[cur]:i}))} disabled={sel!==undefined}
              style={{padding:'9px 13px',borderRadius:8,background:bg,color:clr,border:`1.5px solid ${brd}`,fontSize:13,textAlign:'left',cursor:sel===undefined?'pointer':'default',fontFamily:'inherit',transition:'all .2s',display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:22,height:22,borderRadius:'50%',background:'rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{String.fromCharCode(65+i)}</span>
              <span>{opt}</span>
              {sel!==undefined&&isC&&<span style={{marginLeft:'auto',fontWeight:700}}>✓</span>}
              {sel!==undefined&&isSel&&!isC&&<span style={{marginLeft:'auto'}}>✗</span>}
            </button>
          )
        })}
      </div>
      {answers[cur]!==undefined && q.explanation && (
        <div style={{marginTop:10,padding:'10px 12px',borderRadius:8,background:t.tag,border:`1px solid ${t.border}`,fontSize:12,color:t.muted,lineHeight:1.5}}>
          💡 {q.explanation}
        </div>
      )}
      {answers[cur]!==undefined && (
        <div style={{marginTop:12}}>
          {cur<total-1
            ? <button onClick={()=>setCur(c=>c+1)} style={{width:'100%',padding:'9px',borderRadius:8,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Další otázka →</button>
            : <button onClick={()=>setDone(true)}  style={{width:'100%',padding:'9px',borderRadius:8,background:'#f59e0b',color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Zobrazit výsledky 🏆</button>
          }
        </div>
      )}
    </div>
  )
}

// ── Voice button ──────────────────────────────────────────────────────────────
function VoiceBtn({ t, onTranscript }) {
  const [on,setOn]   = useState(false)
  const [txt,setTxt] = useState('')
  const ref          = useRef(null)
  const ok = typeof window!=='undefined'&&('SpeechRecognition' in window||'webkitSpeechRecognition' in window)
  if (!ok) return null
  const toggle = () => {
    if (on) { ref.current?.stop(); setOn(false); return }
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition
    const r  = new SR(); r.continuous=false; r.interimResults=true; r.lang='cs-CZ'
    r.onresult = e => {
      const t2=Array.from(e.results).map(r=>r[0].transcript).join('')
      setTxt(t2)
      if (e.results[e.results.length-1].isFinal) { onTranscript(t2); setTxt(''); setOn(false) }
    }
    r.onerror=()=>setOn(false); r.onend=()=>setOn(false)
    ref.current=r; r.start(); setOn(true)
  }
  return (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <button onClick={toggle}
        style={{display:'flex',alignItems:'center',gap:6,padding:'5px 11px',borderRadius:20,background:on?'#ef4444':t.btn,color:on?'#fff':t.muted,border:`1px solid ${on?'#ef4444':t.border}`,fontSize:12,fontWeight:on?600:400,fontFamily:'inherit',cursor:'pointer',transition:'all .2s'}}>
        {on ? <>{Ic.mic} Stop</> : <>{Ic.mic} Hlas</>}
      </button>
      {txt && <span style={{fontSize:12,color:t.muted,fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:130}}>„{txt}"</span>}
    </div>
  )
}

// ── Message actions ───────────────────────────────────────────────────────────
function MsgActions({ msg, t, isLoggedIn, token, onExplain, onSaveMemory, onStar, starred }) {
  const [rat,    setRat]    = useState(null)
  const [showFix,setShowFix]= useState(false)
  const [fix,    setFix]    = useState('')
  const [copied, setCopied] = useState(false)

  const copy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(()=>setCopied(false),1500) }
  const feedback = async r => {
    setRat(r)
    if (token&&msg.dbId) { try { await callEdge('feedback',{messageId:msg.dbId,rating:r,correction:fix||null},token) } catch {} }
    setShowFix(false)
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:4,marginTop:5,flexWrap:'wrap'}}>
        <button onClick={copy}
          style={{display:'flex',alignItems:'center',gap:3,padding:'3px 7px',borderRadius:5,background:copied?t.success:t.btn,color:copied?t.succ:t.muted,fontSize:11,border:`1px solid ${copied?t.succ:t.border}`,cursor:'pointer',fontFamily:'inherit',transition:'all .2s'}}>
          {Ic.copy}{copied?' Zkopírováno!':' Kopírovat'}
        </button>
        <button onClick={()=>onExplain(msg)}
          style={{display:'flex',alignItems:'center',gap:3,padding:'3px 7px',borderRadius:5,background:t.btn,color:t.muted,fontSize:11,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit'}}>
          {Ic.info} Jak jsem to zjistil?
        </button>
        {isLoggedIn && <>
          <button onClick={()=>onSaveMemory(msg.content)}
            style={{display:'flex',alignItems:'center',gap:3,padding:'3px 7px',borderRadius:5,background:t.btn,color:t.muted,fontSize:11,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit'}}>
            {Ic.memory} Zapamatovat
          </button>
          <button onClick={()=>onStar(msg)}
            style={{display:'flex',padding:'3px 6px',borderRadius:5,background:starred?'#f59e0b22':t.btn,color:starred?'#f59e0b':t.muted,border:`1px solid ${starred?'#f59e0b':t.border}`,cursor:'pointer',transition:'all .2s'}}>
            {starred?Ic.starF:Ic.star}
          </button>
        </>}
        <button onClick={()=>feedback(1)}
          style={{display:'flex',padding:'3px 6px',borderRadius:5,background:rat===1?t.success:t.btn,color:rat===1?t.succ:t.muted,border:`1px solid ${rat===1?t.succ:t.border}`,cursor:'pointer'}}>
          {Ic.thumbUp}
        </button>
        <button onClick={()=>rat===-1?setShowFix(true):feedback(-1)}
          style={{display:'flex',padding:'3px 6px',borderRadius:5,background:rat===-1?'rgba(239,68,68,.15)':t.btn,color:rat===-1?'#fca5a5':t.muted,border:`1px solid ${rat===-1?'#f87171':t.border}`,cursor:'pointer'}}>
          {Ic.thumbDn}
        </button>
      </div>
      {showFix && (
        <div style={{marginTop:6,padding:12,background:t.modal,border:`1px solid ${t.border}`,borderRadius:10}}>
          <div style={{fontSize:12,color:t.txt,marginBottom:7}}>Jak by správná odpověď měla znít?</div>
          <textarea value={fix} onChange={e=>setFix(e.target.value)} rows={3} placeholder="Napište opravu…"
            style={{width:'100%',padding:'8px 10px',background:t.inBg,color:t.txt,border:`1px solid ${t.inBrd}`,borderRadius:7,fontSize:12,outline:'none',resize:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:6,marginTop:8}}>
            <button onClick={()=>setShowFix(false)} style={{padding:'5px 12px',borderRadius:7,background:t.btn,color:t.txt,fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Zrušit</button>
            <button onClick={()=>feedback(-1)}       style={{padding:'5px 12px',borderRadius:7,background:t.accent,color:'#fff',fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Odeslat</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Toolbar dropdown ──────────────────────────────────────────────────────────
function ToolDropdown({ t, label, icon, children, accent }) {
  const [open, setOpen] = useState(false)
  const ref             = useRef(null)
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div ref={ref} style={{position:'relative'}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:8,background:open?(accent||t.accent)+'22':t.btn,color:open?(accent||t.accent):t.muted,border:`1px solid ${open?(accent||t.accent):t.border}`,fontSize:12,fontWeight:open?600:400,fontFamily:'inherit',cursor:'pointer',transition:'all .15s'}}>
        {icon} {label} {open?Ic.chevUp:Ic.chevDn}
      </button>
      {open && (
        <div style={{position:'absolute',bottom:'calc(100% + 6px)',left:0,minWidth:200,background:t.modal,border:`1px solid ${t.border}`,borderRadius:12,padding:6,zIndex:40,boxShadow:'0 8px 32px rgba(0,0,0,.3)',animation:'fadeIn .15s ease'}}>
          {children}
          <button onClick={()=>setOpen(false)} style={{position:'absolute',top:6,right:6,color:t.muted,display:'flex',padding:3}}>{Ic.x}</button>
        </div>
      )}
    </div>
  )
}

// ── Settings modal ────────────────────────────────────────────────────────────
function SettingsModal({ t, themeName, setThemeName, sysPmt, setSysPmt, onClose, isLoggedIn, userId, memory, setMemory, aiModel, setAiModel }) {
  const [tmp,    setTmp]    = useState(sysPmt)
  const [tmpAI,  setTmpAI]  = useState(aiModel)
  const [memList,setMemList]= useState([])
  const [tab,    setTab]    = useState('appearance')

  useEffect(() => {
    if (tab==='memory'&&isLoggedIn) {
      supabase.from('user_memory').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(30)
        .then(({data})=>setMemList(data||[]))
    }
  },[tab,isLoggedIn,userId])

  const delMem = async id => { await supabase.from('user_memory').delete().eq('id',id); setMemList(p=>p.filter(m=>m.id!==id)) }
  const delAll = async () => { if(!isLoggedIn) return; await supabase.from('user_memory').delete().eq('user_id',userId); setMemList([]) }
  const save   = () => { setSysPmt(tmp); setAiModel(tmpAI); onClose() }

  const tabs = [
    {id:'appearance',l:'Vzhled',   e:'🎨'},
    {id:'model',     l:'Model',    e:'🤖'},
    {id:'behavior',  l:'Chování',  e:'⚙️'},
    {id:'memory',    l:'Paměť',    e:'🧠'},
    {id:'about',     l:'O aplikaci',e:'ℹ️'},
  ]

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:49,backdropFilter:'blur(4px)'}}/>
      <div onClick={e=>e.stopPropagation()}
        style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:50,width:'min(560px,96vw)',maxHeight:'90vh',display:'flex',flexDirection:'column',background:t.modal,border:`1px solid ${t.border}`,borderRadius:18,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
        <div style={{padding:'18px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <h2 style={{fontSize:16,fontWeight:600,color:t.txt}}>⚙️ Nastavení</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:t.muted,cursor:'pointer',fontSize:20,display:'flex',padding:4}}>{Ic.x}</button>
        </div>
        <div style={{display:'flex',gap:4,padding:'12px 20px 0',flexShrink:0,flexWrap:'wrap'}}>
          {tabs.map(tb => (
            <button key={tb.id} onClick={()=>setTab(tb.id)}
              style={{padding:'6px 11px',borderRadius:8,background:tab===tb.id?t.accent:t.btn,color:tab===tb.id?'#fff':t.muted,fontSize:12,fontWeight:tab===tb.id?600:400,border:'none',cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>
              {tb.e} {tb.l}
            </button>
          ))}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'16px 20px 20px'}}>

          {/* Appearance */}
          {tab==='appearance' && (
            <>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>Barevné téma</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                {THEME_LIST.map(th => (
                  <button key={th.id} onClick={()=>setThemeName(th.id)}
                    style={{padding:'12px 8px',borderRadius:10,border:`2px solid ${themeName===th.id?t.accent:t.border}`,background:themeName===th.id?t.accent+'22':t.btn,color:themeName===th.id?t.accent:t.muted,fontSize:12,fontWeight:themeName===th.id?600:400,cursor:'pointer',fontFamily:'inherit',textAlign:'center',transition:'all .15s'}}>
                    <div style={{fontSize:22,marginBottom:5}}>{th.icon}</div>
                    {th.label}
                    {themeName===th.id && <div style={{marginTop:4,color:t.accent}}>{Ic.check}</div>}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Model */}
          {tab==='model' && (
            <>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>AI Model pro chat</div>
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
                {AI_MODELS.map(m => (
                  <button key={m.id} onClick={()=>setTmpAI(m.id)}
                    style={{padding:'12px 14px',borderRadius:10,border:`1.5px solid ${tmpAI===m.id?t.accent:t.border}`,background:tmpAI===m.id?t.accent+'18':t.btn,color:t.txt,fontSize:13,textAlign:'left',cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <strong style={{color:tmpAI===m.id?t.accent:t.txt}}>{m.name}</strong>
                      {tmpAI===m.id && <span style={{color:t.accent}}>{Ic.check}</span>}
                    </div>
                    <div style={{fontSize:12,color:t.muted,marginTop:3}}>{m.desc}</div>
                  </button>
                ))}
              </div>
              <div style={{padding:'12px 14px',borderRadius:10,background:t.tag,border:`1px solid ${t.border}`,fontSize:12,color:t.muted,lineHeight:1.6}}>
                💡 <strong style={{color:t.txt}}>Gemma</strong> jsou open-source modely od Google. Mají vlastní kontext — nepamatují si předchozí zprávy bez kontextu v konverzaci. <strong style={{color:t.txt}}>Gemma 3 27B</strong> je největší veřejně dostupný model od Google.
              </div>
            </>
          )}

          {/* Behavior */}
          {tab==='behavior' && (
            <>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>Osobnost asistenta</div>
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:18}}>
                {PERSONAS.map(p => (
                  <button key={p.label} onClick={()=>setTmp(p.val)}
                    style={{padding:'10px 13px',borderRadius:9,border:`1.5px solid ${tmp===p.val?t.accent:t.border}`,background:tmp===p.val?t.accent+'18':t.btn,color:tmp===p.val?t.accent:t.txt,fontSize:13,textAlign:'left',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'space-between',transition:'all .15s'}}>
                    {p.label}
                    {tmp===p.val && <span style={{color:t.accent,flexShrink:0}}>{Ic.check}</span>}
                  </button>
                ))}
              </div>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Vlastní systémový prompt</div>
              <textarea value={tmp} onChange={e=>setTmp(e.target.value)} rows={4}
                style={{width:'100%',padding:'10px 12px',background:t.inBg,color:t.txt,border:`1.5px solid ${t.inBrd}`,borderRadius:9,fontSize:13,lineHeight:1.6,outline:'none',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box',marginBottom:12}}/>
              <div style={{padding:'12px 14px',borderRadius:10,background:t.tag,border:`1px solid ${t.border}`}}>
                <div style={{fontSize:12,fontWeight:600,color:t.txt,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>{Ic.brain} Epizodická paměť</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:12,color:t.muted}}>AI si pamatuje kontext z minulých chatů</span>
                  <button onClick={()=>setMemory(m=>!m)}
                    style={{width:42,height:24,borderRadius:12,background:memory?t.accent:t.btn,border:`1px solid ${memory?t.accent:t.border}`,cursor:'pointer',position:'relative',transition:'all .2s',flexShrink:0}}>
                    <span style={{position:'absolute',top:3,left:memory?20:3,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left .2s',display:'block'}}/>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Memory */}
          {tab==='memory' && (
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em'}}>
                  Uložená paměť {memList.length>0&&`(${memList.length})`}
                </div>
                {memList.length>0 && (
                  <button onClick={delAll} style={{fontSize:11,color:t.danger,cursor:'pointer',background:'none',border:'none',fontFamily:'inherit'}}>Smazat vše</button>
                )}
              </div>
              {!isLoggedIn && <p style={{fontSize:13,color:t.muted}}>Pro správu paměti se přihlaste.</p>}
              {isLoggedIn&&memList.length===0 && <p style={{fontSize:13,color:t.muted}}>Paměť je prázdná. AI si bude ukládat důležité informace z konverzací.</p>}
              {memList.map(m => (
                <div key={m.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'9px 12px',borderRadius:9,background:t.tag,border:`1px solid ${t.border}`,marginBottom:7}}>
                  <span style={{fontSize:10,color:t.muted,background:t.btn,padding:'2px 6px',borderRadius:4,flexShrink:0,marginTop:1}}>{m.category}</span>
                  <span style={{fontSize:13,color:t.txt,flex:1,lineHeight:1.4}}>{m.content}</span>
                  <button onClick={()=>delMem(m.id)} style={{color:t.muted,display:'flex',padding:3,flexShrink:0}}>{Ic.trash}</button>
                </div>
              ))}
            </>
          )}

          {/* About */}
          {tab==='about' && (
            <div style={{fontSize:13,color:t.muted,lineHeight:1.7}}>
              <div style={{width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${t.gradA}33,${t.gradB}33)`,border:`1.5px solid ${t.gradA}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,margin:'0 auto 16px',color:t.accent}}>✦</div>
              <p style={{textAlign:'center',fontWeight:600,color:t.txt,fontSize:15,marginBottom:4}}>AI Asistent</p>
              <div style={{textAlign:'center',marginBottom:16}}>
                <span style={{background:'#f59e0b22',color:'#f59e0b',padding:'2px 10px',borderRadius:4,fontWeight:600,fontSize:12}}>BETA</span>
              </div>
              {[['🤖 Chat','Gemini 3.1 Flash'],['💭 Deep Thinking','Gemini 2.5 Flash/Pro'],['🔶 Gemma','Gemma 3 12B / 27B'],['🔴 Live','Gemini 2.0 Flash Live'],['🎨 AI Obrázky','Pollinations.ai (zdarma)'],['📷 Fotografie','Unsplash API'],['🎙️ Hlas','Web Speech API'],['🧠 Paměť','Supabase PostgreSQL'],['🔒 Auth','Supabase Auth']].map(([k,v]) => (
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',borderRadius:8,background:t.tag,border:`1px solid ${t.border}`,marginBottom:6}}>
                  <span>{k}</span><span style={{color:t.accent,fontSize:12}}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {(tab==='appearance'||tab==='behavior'||tab==='model') && (
          <div style={{padding:'0 20px 20px',display:'flex',gap:8,justifyContent:'flex-end',flexShrink:0}}>
            <button onClick={onClose} style={{padding:'8px 16px',borderRadius:8,background:t.btn,color:t.txt,fontSize:13,fontWeight:500,cursor:'pointer',border:'none',fontFamily:'inherit'}}>Zrušit</button>
            <button onClick={save}    style={{padding:'8px 16px',borderRadius:8,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',border:'none',fontFamily:'inherit'}}>Uložit</button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Main Chat ─────────────────────────────────────────────────────────────────
export default function Chat({ session }) {
  const [themeName,  setThemeName]  = useState(()=>localStorage.getItem('theme')||'dark')
  const [showAuth,   setShowAuth]   = useState(false)
  const [showSet,    setShowSet]    = useState(false)
  const [showLive,   setShowLive]   = useState(false)
  const [sysPmt,     setSysPmt]     = useState(()=>localStorage.getItem('syspmt')||SYS_DEFAULT)
  const [aiModel,    setAiModel]    = useState(()=>localStorage.getItem('aiModel')||'default')
  const [imgMode,    setImgMode]    = useState('chat')
  const [imgModel,   setImgModel]   = useState(IMG_MODELS[0].id)
  const [thinking,   setThinking]   = useState(false)
  const [memory,     setMemory]     = useState(true)
  const [mdMode,     setMdMode]     = useState(true)
  const [sideOpen,   setSideOpen]   = useState(()=>typeof window!=='undefined'&&window.innerWidth>768)
  const [input,      setInput]      = useState('')
  const [atts,       setAtts]       = useState([])
  const [loading,    setLoading]    = useState(false)
  const [err,        setErr]        = useState(null)
  const [convs,      setConvs]      = useState([mkLocal()])
  const [activeId,   setActiveId]   = useState(null)
  const [msgs,       setMsgs]       = useState([])
  const [dbLoad,     setDbLoad]     = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ,    setSearchQ]    = useState('')
  const [searchRes,  setSearchRes]  = useState([])
  const [editId,     setEditId]     = useState(null)
  const [editTitle,  setEditTitle]  = useState('')
  const [emotion,    setEmotion]    = useState(null)
  const [quizMode,   setQuizMode]   = useState(false)
  const [quizTopic,  setQuizTopic]  = useState('')
  const [quizCount,  setQuizCount]  = useState(5)
  const [quizDiff,   setQuizDiff]   = useState('medium')
  const [explainTxt, setExplainTxt] = useState(null)
  const [token,      setToken]      = useState(null)
  const [starred,    setStarred]    = useState(new Set())
  const [showStarred,setShowStarred]= useState(false)
  const [newIds,     setNewIds]     = useState(new Set())
  const [typingIds,  setTypingIds]  = useState(new Set())
  const [userMsgCount,setUserMsgCount]=useState(0)

  const endRef    = useRef(null)
  const fileRef   = useRef(null)
  const taRef     = useRef(null)
  const searchRef = useRef(null)

  const t          = THEMES[themeName] || THEMES.dark
  const isLoggedIn = !!session
  const activeConv = useMemo(()=>convs.find(c=>c.id===activeId)??convs[0]??null,[convs,activeId])

  useEffect(()=>{localStorage.setItem('theme',themeName)},[themeName])
  useEffect(()=>{localStorage.setItem('syspmt',sysPmt)},[sysPmt])
  useEffect(()=>{localStorage.setItem('aiModel',aiModel)},[aiModel])

  useEffect(()=>{
    if(isLoggedIn){getFreshToken().then(setToken);loadConvs()}
    else{const c=mkLocal();setConvs([c]);setActiveId(c.id);setMsgs([])}
  },[isLoggedIn]) // eslint-disable-line

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[msgs.length,activeConv?.messages?.length,loading])
  useEffect(()=>{if(activeId&&typeof window!=='undefined'&&window.innerWidth<=768)setSideOpen(false)},[activeId])

  useEffect(()=>{
    const last=msgs.filter(m=>m.role==='user').at(-1)
    if(!last?.content||last.content.length<20) return
    const timer=setTimeout(()=>{
      callEdge('detect_emotion',{messages:[{role:'user',content:last.content}]},token||ANON)
        .then(d=>{if(d.emotion&&d.emotion!=='neutral')setEmotion(d)}).catch(()=>{})
    },600)
    return()=>clearTimeout(timer)
  },[msgs.length]) // eslint-disable-line

  // ── DB ──────────────────────────────────────────────────────────────────────
  async function loadConvs() {
    setDbLoad(true)
    const{data}=await supabase.from('conversations').select('*').order('updated_at',{ascending:false})
    if(data?.length>0){setConvs(data.map(c=>({...c,local:false})));setActiveId(data[0].id);await loadMsgs(data[0].id)}
    else{const c=await createConv();if(c){setConvs([{...c,local:false}]);setActiveId(c.id);setMsgs([])}}
    setDbLoad(false)
  }
  async function loadMsgs(cid) {
    const{data}=await supabase.from('messages').select('*').eq('conversation_id',cid).order('created_at',{ascending:true})
    setMsgs(data??[])
    setStarred(new Set((data??[]).filter(m=>m.starred).map(m=>m.id)))
    // Počítej pouze uživatelské zprávy
    setUserMsgCount((data??[]).filter(m=>m.role==='user').length)
  }
  async function createConv(title='Nová konverzace') {
    const{data}=await supabase.from('conversations').insert({user_id:session.user.id,title}).select().single()
    return data
  }
  async function saveMsg(cid,role,content,type='text',meta=null) {
    const{data}=await supabase.from('messages').insert({
      conversation_id:cid,role,content,type,
      image_url:meta?JSON.stringify(meta):null
    }).select().single()
    return data
  }

  // ── Conversation actions ────────────────────────────────────────────────────
  async function newConv() {
    setErr(null);setInput('');setAtts([]);setEmotion(null)
    if(isLoggedIn){const c=await createConv();if(c){setConvs(p=>[{...c,local:false},...p]);setActiveId(c.id);setMsgs([]);setUserMsgCount(0)}}
    else{const c=mkLocal();setConvs(p=>[c,...p]);setActiveId(c.id)}
    if(typeof window!=='undefined'&&window.innerWidth<=768)setSideOpen(false)
  }
  async function selectConv(id){setActiveId(id);setErr(null);setEmotion(null);if(isLoggedIn)await loadMsgs(id)}
  async function delConv(id,e) {
    e.stopPropagation()
    if(isLoggedIn)await supabase.from('conversations').delete().eq('id',id)
    setConvs(prev=>{
      const next=prev.filter(c=>c.id!==id)
      const list=next.length>0?next:[mkLocal()]
      if(id===activeId){setActiveId(list[0].id);if(isLoggedIn&&next.length>0)loadMsgs(list[0].id);else setMsgs([])}
      return list
    })
  }
  async function renameConv(id,title) {
    if(!title.trim())return
    if(isLoggedIn)await supabase.from('conversations').update({title}).eq('id',id)
    setConvs(p=>p.map(c=>c.id===id?{...c,title}:c));setEditId(null)
  }
  async function setConvColor(id,color) {
    if(isLoggedIn)await supabase.from('conversations').update({color}).eq('id',id)
    setConvs(p=>p.map(c=>c.id===id?{...c,color}:c))
  }
  async function autoTitle(cid,msg) {
    try{
      const d=await callEdge('auto_title',{messages:[{role:'user',content:[{type:'text',text:msg}]}]},token||ANON)
      if(d.title){if(isLoggedIn)await supabase.from('conversations').update({title:d.title}).eq('id',cid);setConvs(p=>p.map(c=>c.id===cid?{...c,title:d.title}:c))}
    }catch{}
  }
  const starMsg=async msg=>{
    const ns=!starred.has(msg.id)
    setStarred(p=>{const n=new Set(p);ns?n.add(msg.id):n.delete(msg.id);return n})
    if(isLoggedIn&&(msg.dbId||msg.id))await supabase.from('messages').update({starred:ns}).eq('id',msg.dbId||msg.id)
  }
  const exportChat=()=>{
    const lines=displayMsgs.map(m=>`[${m.role==='user'?'Vy':'AI'}] ${fmtTime(m.created_at)}\n${m.content}\n`)
    const b=new Blob([`Chat: ${activeConv?.title}\nExport: ${new Date().toLocaleString('cs-CZ')}\n\n`+lines.join('\n---\n\n')],{type:'text/plain;charset=utf-8'})
    const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`chat-${activeConv?.title||'export'}.txt`;a.click()
  }
  async function doSearch(q) {
    setSearchQ(q)
    if(!q.trim()){setSearchRes([]);return}
    if(isLoggedIn){const{data}=await supabase.from('conversations').select('id,title,updated_at').ilike('title',`%${q}%`).limit(8);setSearchRes(data??[])}
    else setSearchRes(convs.filter(c=>c.title.toLowerCase().includes(q.toLowerCase())))
  }
  const onFile=async e=>{
    const files=Array.from(e.target.files)
    const res=await Promise.all(files.map(f=>new Promise(r=>{
      const rd=new FileReader()
      rd.onload=()=>r({id:uid(),name:f.name,type:f.type,size:f.size,data:rd.result.split(',')[1],preview:f.type.startsWith('image/')?rd.result:null})
      rd.readAsDataURL(f)
    })))
    setAtts(p=>[...p,...res]);fileRef.current.value=''
  }

  // ── Quiz send ───────────────────────────────────────────────────────────────
  const sendQuiz=async()=>{
    if(!quizTopic.trim())return
    setLoading(true);setErr(null)
    const cid=activeConv?.id,isLocal=activeConv?.local
    const tmp={id:uid(),role:'user',content:`🎓 Kvíz: ${quizTopic} (${quizCount}×, ${quizDiff})`,type:'text',created_at:new Date().toISOString(),_tmp:true}
    if(isLocal)setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),tmp]}))
    else setMsgs(p=>[...p,tmp])
    try{
      const d=await callEdge('quiz',{topic:quizTopic,difficulty:quizDiff,questionCount:quizCount,language:'Czech'},token||ANON)
      const qs=d.questions||[]
      if(!qs.length) throw new Error('Kvíz neobsahuje otázky. Zkuste jiné téma.')
      // Uložíme data do image_url, content = pěkný text
      const aMsg={id:uid(),role:'assistant',type:'quiz',content:'🎓 Kvíz',_quizData:qs,created_at:new Date().toISOString()}
      if(isLocal)setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      else{
        // Uloží do DB správně - quiz data v image_url, content = '🎓 Kvíz'
        await saveMsg(cid,'user',tmp.content,'text',null)
        await saveMsg(cid,'assistant','🎓 Kvíz','quiz',qs)
        setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmp,_tmp:false},aMsg])
        await supabase.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',cid)
      }
      setNewIds(s=>{const n=new Set(s);n.add(aMsg.id);setTimeout(()=>setNewIds(s2=>{const n2=new Set(s2);n2.delete(aMsg.id);return n2}),800);return n})
    }catch(e){setErr('Kvíz: '+e.message)}
    finally{setLoading(false);setQuizMode(false);setQuizTopic('')}
  }

  const saveMemory=async c=>{if(!isLoggedIn||!c)return;try{await callEdge('save_memory',{content:c.slice(0,500),category:'fact'},token)}catch{}}
  const explainMsg=async msg=>{
    setExplainTxt('Načítám…')
    try{const d=await callEdge('explain',{messages:[{role:'assistant',content:msg.content}],language:'Czech'},token||ANON);setExplainTxt(d.explanation||'Nepodařilo se.')}
    catch(e){setExplainTxt('Chyba: '+e.message)}
  }

  // ── Send message ────────────────────────────────────────────────────────────
  const send=useCallback(async()=>{
    if((!input.trim()&&!atts.length)||loading||!activeConv)return
    const cid      =activeConv.id
    const userText =input.trim()||atts.map(a=>a.name).join(', ')
    const isLocal  =activeConv.local
    const apiMode  =isLoggedIn?detectAutoMode(userText,imgMode):'chat'
    const isFirst  =(isLocal?activeConv.messages?.length:msgs.length)===0

    const api=[]
    atts.forEach(a=>{
      if(a.type.startsWith('image/'))api.push({type:'image',source:{type:'base64',media_type:a.type,data:a.data}})
      else api.push({type:'text',text:`[Soubor: ${a.name}]`})
    })
    if(input.trim())api.push({type:'text',text:input.trim()})

    const tmpUser={id:uid(),role:'user',content:userText,type:'text',created_at:new Date().toISOString(),_tmp:true,_atts:atts.map(a=>({id:a.id,name:a.name,type:a.type,preview:a.preview}))}
    setInput('');setAtts([]);setLoading(true);setErr(null);setEmotion(null)
    const prev=isLocal?(activeConv.messages??[]):msgs

    if(isLocal){
      setConvs(p=>p.map(c=>{
        if(c.id!==cid)return c
        const title=isFirst?userText.slice(0,38)+(userText.length>38?'…':''):c.title
        return{...c,title,messages:[...(c.messages??[]),tmpUser]}
      }))
    }else{
      setMsgs(p=>[...p,tmpUser])
      if(isFirst&&activeConv.title==='Nová konverzace')autoTitle(cid,userText)
    }

    try{
      const history=[...prev,tmpUser].map(m=>({
        role:m.role,
        content:m.id===tmpUser.id&&api.length>0?api:[{type:'text',text:m.content}],
      }))
      const tk=isLoggedIn?(await getFreshToken()||ANON):ANON
      const payload={messages:history,system:sysPmt,thinking,memory}
      if(apiMode==='generate_image')payload.imgModel=imgModel
      if(aiModel!=='default')payload.preferredModel=aiModel
      const result=await callEdge(apiMode,payload,tk)

      const nid=uid()
      let aMsg
      if(result.type==='image_search'){
        aMsg={id:nid,role:'assistant',type:'image_search',content:`📷 ${result.images?.length??0} fotografií`,_images:result.images,_query:result.query,image_url:JSON.stringify(result.images),created_at:new Date().toISOString()}
      }else if(result.type==='generated_image'){
        // Uložíme imageData do image_url, content = popis
        aMsg={id:nid,role:'assistant',type:'generated_image',content:'🎨 Vygenerovaný obrázek',_imageData:result.imageData,_mimeType:result.mimeType,_prompt:result.prompt||userText,_modelId:imgModel,image_url:JSON.stringify({imageData:result.imageData,mimeType:result.mimeType,prompt:result.prompt||userText,modelId:imgModel}),created_at:new Date().toISOString()}
      }else{
        aMsg={id:nid,role:'assistant',type:'text',content:result.text??'(prázdná odpověď)',created_at:new Date().toISOString()}
        setTypingIds(s=>{const n=new Set(s);n.add(nid);return n})
        const dur=Math.min(Math.max((result.text?.length||100)*10,1000),10000)
        setTimeout(()=>setTypingIds(s=>{const n=new Set(s);n.delete(nid);return n}),dur)
      }

      setNewIds(s=>{const n=new Set(s);n.add(nid);setTimeout(()=>setNewIds(s2=>{const n2=new Set(s2);n2.delete(nid);return n2}),800);return n})

      if(isLocal){
        setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      }else{
        const uRow=await saveMsg(cid,'user',userText,'text',null)
        if(aMsg.type==='image_search')await saveMsg(cid,'assistant',aMsg.content,'image_search',aMsg._images)
        else if(aMsg.type==='generated_image')await saveMsg(cid,'assistant','🎨 Vygenerovaný obrázek','generated_image',{imageData:aMsg._imageData,mimeType:aMsg._mimeType,prompt:aMsg._prompt,modelId:imgModel})
        else{const ar=await saveMsg(cid,'assistant',aMsg.content,'text',null);if(ar)aMsg.dbId=ar.id}
        await supabase.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',cid)
        setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmpUser,_tmp:false,dbId:uRow?.id},aMsg])
        setUserMsgCount(c=>c+1)
      }
    }catch(e){
      setErr('Chyba: '+e.message)
      if(isLocal)setConvs(p=>p.map(c=>c.id===cid?{...c,messages:prev}:c))
      else setMsgs(prev)
      setInput(userText)
    }finally{setLoading(false)}
  },[input,atts,loading,activeConv,msgs,isLoggedIn,imgMode,sysPmt,thinking,memory,token,imgModel,aiModel]) // eslint-disable-line

  const onKey=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}
  const displayMsgs=showStarred
    ?(activeConv?.local?(activeConv.messages??[]):msgs).filter(m=>starred.has(m.id))
    :(activeConv?.local?(activeConv.messages??[]):msgs)
  const canSend=(input.trim()||atts.length>0)&&!loading
  const userInitial=session?(session.user.user_metadata?.full_name||session.user.email||'U')[0].toUpperCase():'?'
  const currentAILabel=AI_MODELS.find(m=>m.id===aiModel)?.name||'Gemini'

  // Načti data z image_url pro zobrazení
  function getImgData(msg) {
    if(msg._images||msg._imageData||msg._quizData)return msg
    if(msg.image_url){
      try{
        const p=JSON.parse(msg.image_url)
        if(msg.type==='quiz')return{...msg,_quizData:Array.isArray(p)?p:[p]}
        if(msg.type==='generated_image')return{...msg,_imageData:p.imageData,_mimeType:p.mimeType,_prompt:p.prompt,_modelId:p.modelId}
        if(msg.type==='image_search')return{...msg,_images:Array.isArray(p)?p:undefined,_query:msg.content}
        // Legacy fallback
        if(Array.isArray(p))return{...msg,_images:p,_query:msg.content}
        if(p.imageData)return{...msg,_imageData:p.imageData,_mimeType:p.mimeType,_prompt:p.prompt,_modelId:p.modelId}
      }catch{return msg}
    }
    return msg
  }

  const modeColor=imgMode==='generate_image'?t.purple:t.accent
  const ltxt={chat:null,image_search:'🔍 Hledám fotografie…',generate_image:'🎨 Generuji obrázek (30–60 s)…'}
  const phs={chat:thinking?'💭 Hluboké přemýšlení…':'Napište zprávu… (Enter = odeslat)',image_search:'🔍 Popište co hledáte…',generate_image:'🎨 Popište obrázek co nejdetailněji…'}

  const css=`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${t.scrl};border-radius:2px}
    textarea,input{font-family:inherit}textarea{resize:none;outline:none;border:none;background:transparent}input{outline:none;border:none;background:transparent}button{cursor:pointer;border:none;background:none;font-family:inherit}
    @keyframes slideUp{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes pu{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    @keyframes livePulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}
    @keyframes thinkPulse{0%,100%{opacity:.5}50%{opacity:1}}
    @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
    .msg-new{animation:slideUp .4s cubic-bezier(.34,1.56,.64,1) both}
    .msg-old{animation:fadeIn .2s ease both}
    .dot span{display:inline-block;width:6px;height:6px;border-radius:50%;background:${t.accent};margin:0 2px;animation:pu 1.2s infinite ease-in-out}
    .dot span:nth-child(2){animation-delay:.18s}.dot span:nth-child(3){animation-delay:.36s}
    .cr:hover{background:${t.active}!important}.cr:hover .cr-act{opacity:1!important}
    .ib:hover{opacity:.65}
    .err-shake{animation:shake .4s ease}
    @media(max-width:768px){.sidebar{position:fixed!important;top:0;left:0;bottom:0;z-index:30;box-shadow:4px 0 24px rgba(0,0,0,.5)}.sov{display:block!important}}
  `

  return (
    <div style={{display:'flex',height:'100dvh',overflow:'hidden',background:t.bg,color:t.txt,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <style>{css}</style>

      {sideOpen&&<div className="sov" onClick={()=>setSideOpen(false)} style={{display:'none',position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:29}}/>}

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      {sideOpen&&(
        <aside className="sidebar" style={{width:272,background:t.side,borderRight:`1px solid ${t.border}`,display:'flex',flexDirection:'column',flexShrink:0}}>
          <div style={{padding:'13px 12px',borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${t.gradA},${t.gradB})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#fff',flexShrink:0}}>A</div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontWeight:600,fontSize:13,color:t.txt}}>AI Asistent</span>
                <span style={{fontSize:10,background:'#f59e0b22',color:'#f59e0b',padding:'1px 5px',borderRadius:3,fontWeight:700}}>BETA</span>
              </div>
            </div>
            <div style={{display:'flex',gap:4}}>
              <button className="ib" onClick={()=>{setSearchOpen(o=>!o);setTimeout(()=>searchRef.current?.focus(),100)}}
                style={{color:t.muted,display:'flex',padding:6,borderRadius:6,background:searchOpen?t.active:'transparent'}} title="Hledat">{Ic.search}</button>
              <button onClick={newConv}
                style={{background:t.accent,color:'#fff',borderRadius:7,padding:'5px 9px',display:'flex',alignItems:'center'}} title="Nová konverzace">{Ic.plus}</button>
            </div>
          </div>

          {searchOpen&&(
            <div style={{padding:'8px 10px',borderBottom:`1px solid ${t.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:7,padding:'7px 10px',background:t.inBg,border:`1px solid ${t.inBrd}`,borderRadius:9}}>
                <span style={{color:t.muted,flexShrink:0}}>{Ic.search}</span>
                <input ref={searchRef} value={searchQ} onChange={e=>doSearch(e.target.value)} placeholder="Hledat v chatech…" style={{flex:1,fontSize:13,color:t.txt}}/>
                {searchQ&&<button onClick={()=>{setSearchQ('');setSearchRes([])}} style={{color:t.muted,display:'flex',padding:2}}>{Ic.x}</button>}
              </div>
              {searchRes.map(c=>(
                <div key={c.id} onClick={()=>{selectConv(c.id);setSearchOpen(false);setSearchQ('');setSearchRes([])}}
                  style={{padding:'7px 9px',borderRadius:7,cursor:'pointer',fontSize:13,color:t.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:4}}
                  onMouseOver={e=>e.currentTarget.style.background=t.active}
                  onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  🔍 {c.title}
                </div>
              ))}
            </div>
          )}

          <div style={{flex:1,overflowY:'auto',padding:'5px'}}>
            {dbLoad?<div style={{padding:16,textAlign:'center',fontSize:12,color:t.muted}}>Načítám…</div>
              :convs.map(c=>(
                <div key={c.id} className="cr" onClick={()=>selectConv(c.id)}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'7px 9px',borderRadius:8,cursor:'pointer',marginBottom:2,transition:'background .1s',background:c.id===activeId?t.active:'transparent',borderLeft:`3px solid ${c.id===activeId?(c.color||t.accent):(c.color||'transparent')}`}}>
                  {editId===c.id?(
                    <form onSubmit={e=>{e.preventDefault();renameConv(c.id,editTitle)}} style={{flex:1}} onClick={e=>e.stopPropagation()}>
                      <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} onBlur={()=>renameConv(c.id,editTitle)} autoFocus
                        style={{width:'100%',fontSize:13,color:t.txt,background:t.inBg,border:`1px solid ${t.accent}`,borderRadius:5,padding:'3px 7px'}}/>
                    </form>
                  ):(
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:c.id===activeId?t.txt:t.muted}}>{c.title}</div>
                      <div style={{fontSize:10,color:t.muted,marginTop:2}}>{c.local?'Dočasná':fmtDate(c.updated_at)}</div>
                    </div>
                  )}
                  <div className="cr-act" style={{display:'flex',gap:2,opacity:0,transition:'opacity .15s',flexShrink:0}}>
                    <div style={{display:'flex',gap:2,alignItems:'center'}}>
                      {CONV_COLORS.slice(1,5).map(col=>(
                        <button key={col} onClick={e=>{e.stopPropagation();setConvColor(c.id,col)}}
                          style={{width:10,height:10,borderRadius:'50%',background:col,border:`1.5px solid ${c.color===col?'#fff':t.border}`,cursor:'pointer'}}/>
                      ))}
                    </div>
                    <button className="ib" onClick={e=>{e.stopPropagation();setEditId(c.id);setEditTitle(c.title)}} style={{color:t.muted,display:'flex',padding:4,borderRadius:5}} title="Přejmenovat">{Ic.edit}</button>
                    <button className="ib" onClick={e=>delConv(c.id,e)} style={{color:t.muted,display:'flex',padding:4,borderRadius:5}} title="Smazat">{Ic.trash}</button>
                  </div>
                </div>
              ))
            }
          </div>

          <div style={{padding:'10px 11px',borderTop:`1px solid ${t.border}`}}>
            {isLoggedIn?(
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${t.gradA}33,${t.gradB}33)`,border:`1px solid ${t.gradA}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:t.accent,flexShrink:0}}>{userInitial}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:t.txt,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{session.user.user_metadata?.full_name||session.user.email}</div>
                  <div style={{fontSize:10,color:t.muted}}>
                    {userMsgCount > 0 ? `${userMsgCount} ${userMsgCount===1?'zpráva':userMsgCount<5?'zprávy':'zpráv'}` : 'Přihlášen'}
                  </div>
                </div>
                <button className="ib" onClick={()=>supabase.auth.signOut()} style={{color:t.muted,display:'flex',padding:4}} title="Odhlásit">{Ic.out}</button>
              </div>
            ):(
              <button onClick={()=>setShowAuth(true)}
                style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'9px 12px',borderRadius:9,background:t.btn,border:`1px solid ${t.border}`,color:t.muted,fontSize:13,fontWeight:500}}>
                <span style={{color:t.accent}}>{Ic.user}</span>
                <span>Přihlásit se</span>
                <span style={{marginLeft:'auto',fontSize:10,background:t.tag,padding:'2px 7px',borderRadius:4}}>Uloží historii</span>
              </button>
            )}
          </div>
        </aside>
      )}

      {/* ── MAIN ─────────────────────────────────────────────────────────────── */}
      <main style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>

        {/* Header */}
        <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 14px',height:52,background:t.hdr,borderBottom:`1px solid ${t.border}`,backdropFilter:'blur(12px)',flexShrink:0,gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
            <button className="ib" onClick={()=>setSideOpen(o=>!o)} style={{color:t.muted,display:'flex',padding:5,flexShrink:0}}>{Ic.menu}</button>
            <span style={{fontWeight:600,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activeConv?.title||'AI Asistent'}</span>
            {aiModel!=='default'&&<span style={{fontSize:10,background:t.purple+'22',color:t.purple,padding:'2px 7px',borderRadius:4,flexShrink:0,fontWeight:600}}>{currentAILabel}</span>}
          </div>
          <div style={{display:'flex',gap:3,alignItems:'center',flexShrink:0}}>
            <button className="ib" onClick={()=>setShowStarred(s=>!s)} title="Oblíbené"
              style={{display:'flex',padding:'5px 8px',borderRadius:7,background:showStarred?'#f59e0b22':t.btn,color:showStarred?'#f59e0b':t.muted,border:`1px solid ${showStarred?'#f59e0b':t.border}`}}>
              {showStarred?Ic.starF:Ic.star}
            </button>
            <button className="ib" onClick={exportChat} title="Export chatu"
              style={{display:'flex',padding:'5px 8px',borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`}}>
              {Ic.export}
            </button>
            <button className="ib" onClick={()=>setMdMode(m=>!m)} title="Markdown formátování"
              style={{display:'flex',alignItems:'center',gap:2,padding:'5px 8px',borderRadius:7,background:mdMode?t.accent+'22':t.btn,color:mdMode?t.accent:t.muted,border:`1px solid ${mdMode?t.accent:t.border}`,fontSize:11}}>
              MD
            </button>
            {isLoggedIn&&(
              <button className="ib" onClick={()=>setThinking(x=>!x)} title="Hluboké přemýšlení (Gemini 2.5)"
                style={{display:'flex',alignItems:'center',gap:3,padding:'5px 8px',borderRadius:7,background:thinking?t.purple+'33':t.btn,color:thinking?t.purple:t.muted,border:`1px solid ${thinking?t.purple:t.border}`,fontSize:11}}>
                {Ic.brain}{thinking&&<span style={{animation:'thinkPulse 1.5s infinite'}}> ON</span>}
              </button>
            )}
            <button className="ib" onClick={()=>setShowSet(true)} title="Nastavení"
              style={{display:'flex',padding:'5px 8px',borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`}}>
              {Ic.gear}
            </button>
            <button className="ib" onClick={()=>setThemeName(n=>{const keys=Object.keys(THEMES);return keys[(keys.indexOf(n)+1)%keys.length]})} title="Změnit téma"
              style={{display:'flex',padding:'5px 8px',borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`}}>
              {THEME_LIST.find(th=>th.id===themeName)?.icon||'🌙'}
            </button>
            {!isLoggedIn&&(
              <button onClick={()=>setShowAuth(true)}
                style={{display:'flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:7,background:t.accent,color:'#fff',fontSize:12,fontWeight:600,border:'none',cursor:'pointer'}}>
                {Ic.user}<span>Přihlásit</span>
              </button>
            )}
          </div>
        </header>

        {/* Emotion bar */}
        {emotion&&emotion.emotion!=='neutral'&&(
          <div style={{padding:'7px 14px',background:t.tag,borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12,animation:'fadeIn .3s ease'}}>
            <span style={{color:t.muted}}>{EMOTION_EMOJI[emotion.emotion]} <strong style={{color:t.txt}}>{emotion.emotion}</strong> · {emotion.suggestion}</span>
            <button onClick={()=>setEmotion(null)} style={{color:t.muted,display:'flex',padding:3}}>{Ic.x}</button>
          </div>
        )}
        {explainTxt&&(
          <div style={{padding:'10px 14px',background:t.purple+'18',borderBottom:`1px solid ${t.purple}44`,display:'flex',alignItems:'flex-start',gap:8,fontSize:13,animation:'fadeIn .3s ease'}}>
            <span style={{color:t.purple,flexShrink:0,marginTop:1}}>{Ic.info}</span>
            <span style={{color:t.txt,flex:1,lineHeight:1.5}}>{explainTxt}</span>
            <button onClick={()=>setExplainTxt(null)} style={{color:t.muted,display:'flex',padding:3,flexShrink:0}}>{Ic.x}</button>
          </div>
        )}
        {showStarred&&(
          <div style={{padding:'7px 14px',background:'#f59e0b22',borderBottom:`1px solid #f59e0b44`,display:'flex',alignItems:'center',gap:8,fontSize:12,animation:'fadeIn .3s ease'}}>
            <span style={{color:'#f59e0b'}}>⭐</span>
            <span style={{color:t.txt}}>Oblíbené zprávy ({displayMsgs.length})</span>
            <button onClick={()=>setShowStarred(false)} style={{color:t.muted,display:'flex',padding:3,marginLeft:'auto'}}>{Ic.x}</button>
          </div>
        )}

        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:'16px 14px',display:'flex',flexDirection:'column',gap:12}}>
          {displayMsgs.length===0&&!loading&&(
            <div style={{textAlign:'center',marginTop:'7vh',padding:'0 16px',animation:'fadeIn .5s ease'}}>
              <div style={{width:56,height:56,borderRadius:16,background:`linear-gradient(135deg,${t.gradA}33,${t.gradB}33)`,border:`1.5px solid ${t.gradA}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,margin:'0 auto 16px',color:t.accent}}>✦</div>
              <div style={{fontSize:21,fontWeight:600,marginBottom:8}}>{showStarred?'Žádné oblíbené zprávy':'Jak Vám mohu pomoci?'}</div>
              {!showStarred&&(
                <>
                  <div style={{fontSize:13,color:t.muted,marginBottom:20,lineHeight:1.6}}>{isLoggedIn?'Chat · AI Obrázky · Fotografie · Kvízy · Live · Hlasový vstup':'Začněte psát — přihlášení není potřeba'}</div>
                  <div style={{display:'flex',gap:7,justifyContent:'center',flexWrap:'wrap',maxWidth:520,margin:'0 auto'}}>
                    {(isLoggedIn?['Jak funguje kvantové počítání?','Najdi fotky Prahy','Vygeneruj: forest at sunset','Kvíz o historii ČR']:['Jak funguje AI?','Napiš mi báseň','Co je strojové učení?','Pomoz mi s kódem']).map(hint=>(
                      <button key={hint} onClick={()=>setInput(hint)}
                        style={{padding:'7px 14px',borderRadius:20,background:t.btn,border:`1px solid ${t.border}`,color:t.muted,fontSize:12,transition:'all .2s',cursor:'pointer'}}
                        onMouseOver={e=>{e.currentTarget.style.borderColor=t.accent;e.currentTarget.style.color=t.txt;e.currentTarget.style.transform='translateY(-1px)'}}
                        onMouseOut={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.color=t.muted;e.currentTarget.style.transform='translateY(0)'}}>
                        {hint}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {displayMsgs.map(msg=>{
            const m      =getImgData(msg)
            const isWide =['image_search','generated_image','quiz'].includes(msg.type)
            const isStar =starred.has(msg.id)
            const isNew  =newIds.has(msg.id)
            const isTyp  =typingIds.has(msg.id)
            return (
              <div key={msg.id} className={isNew?'msg-new':'msg-old'}
                style={{display:'flex',gap:8,justifyContent:msg.role==='user'?'flex-end':'flex-start',alignItems:'flex-start'}}>
                {msg.role==='assistant'&&(
                  <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${t.gradA},${t.gradB})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff',flexShrink:0,marginTop:2}}>A</div>
                )}
                <div style={{maxWidth:isWide?'94%':'80%',minWidth:40}}>
                  {msg._atts?.length>0&&(
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6,justifyContent:'flex-end'}}>
                      {msg._atts.map(a=>a.preview
                        ?<img key={a.id} src={a.preview} alt={a.name} style={{height:60,width:60,objectFit:'cover',borderRadius:8,border:`1px solid ${t.border}`}}/>
                        :<div key={a.id} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 9px',background:t.pill,borderRadius:7,fontSize:12,color:t.txt}}>{Ic.file}{a.name.length>14?a.name.slice(0,12)+'…':a.name}</div>
                      )}
                    </div>
                  )}
                  {msg.type==='image_search'?(
                    <div style={{padding:'12px 14px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
                      <ImgGrid images={m._images} query={m._query||msg.content} t={t}/>
                      <div style={{fontSize:10,color:t.muted,marginTop:8,textAlign:'right'}}>{fmtTime(msg.created_at)}</div>
                    </div>
                  ):msg.type==='generated_image'?(
                    <div style={{padding:'12px 14px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
                      <GenImg imageData={m._imageData} mimeType={m._mimeType} prompt={m._prompt} modelId={m._modelId||imgModel} t={t}/>
                      <div style={{fontSize:10,color:t.muted,marginTop:8,textAlign:'right'}}>{fmtTime(msg.created_at)}</div>
                    </div>
                  ):msg.type==='quiz'?(
                    <QuizCard questions={m._quizData} t={t}/>
                  ):(
                    <div>
                      <div style={{padding:'10px 14px',background:msg.role==='user'?t.accent:t.aiB,color:msg.role==='user'?'#fff':t.txt,borderRadius:msg.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',border:msg.role==='assistant'?`1px solid ${isStar?'#f59e0b':t.border}`:'none',opacity:msg._tmp?0.7:1}}>
                        {msg.role==='assistant'&&(isTyp||(!msg._tmp&&mdMode))
                          ?isTyp
                            ?<TypingText text={msg.content} isDark={t.isDark} useMarkdown={mdMode} onDone={()=>setTypingIds(s=>{const n=new Set(s);n.delete(msg.id);return n})}/>
                            :<div style={{fontSize:14,lineHeight:1.7,wordBreak:'break-word'}} dangerouslySetInnerHTML={{__html:renderMD(msg.content,t.isDark)}}/>
                          :<div style={{fontSize:14,lineHeight:1.65,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{msg.content}</div>
                        }
                        <div style={{fontSize:10,color:msg.role==='user'?'rgba(255,255,255,.5)':t.muted,marginTop:4,textAlign:'right',display:'flex',alignItems:'center',justifyContent:'flex-end',gap:6}}>
                          {isStar&&<span style={{color:'#f59e0b'}}>⭐</span>}
                          {fmtTime(msg.created_at)}
                        </div>
                      </div>
                      {msg.role==='assistant'&&!msg._tmp&&(
                        <MsgActions msg={msg} t={t} isLoggedIn={isLoggedIn} token={token} onExplain={explainMsg} onSaveMemory={saveMemory} onStar={starMsg} starred={isStar}/>
                      )}
                    </div>
                  )}
                </div>
                {msg.role==='user'&&(
                  <div style={{width:28,height:28,borderRadius:8,background:isLoggedIn?t.accent+'88':t.ua,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:600,color:'#fff',flexShrink:0,marginTop:2}}>
                    {isLoggedIn?userInitial:'?'}
                  </div>
                )}
              </div>
            )
          })}

          {loading&&(
            <div style={{display:'flex',gap:8,alignItems:'flex-start',animation:'fadeIn .2s ease'}}>
              <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${t.gradA},${t.gradB})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff',flexShrink:0}}>A</div>
              <div style={{padding:'12px 16px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
                {ltxt[imgMode]?<span style={{fontSize:13,color:t.muted}}>{ltxt[imgMode]}</span>
                  :thinking?<span style={{fontSize:13,color:t.purple,animation:'thinkPulse 1.5s infinite'}}>💭 Gemini 2.5 přemýšlí…</span>
                  :<div className="dot"><span/><span/><span/></div>}
              </div>
            </div>
          )}
          {err&&<div className="err-shake" style={{padding:'9px 13px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:9,fontSize:13,color:'#fca5a5',display:'flex',gap:8,wordBreak:'break-word'}}>
            <span style={{flexShrink:0}}>⚠️</span><span>{err}</span>
          </div>}
          <div ref={endRef}/>
        </div>

        {/* ── INPUT AREA ────────────────────────────────────────────────────── */}
        <div style={{padding:'8px 12px 10px',background:t.iaBg,borderTop:`1px solid ${t.border}`,flexShrink:0}}>

          {/* Toolbar - Nástroje + Model dropdown */}
          {isLoggedIn&&(
            <div style={{display:'flex',gap:5,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>

              {/* Live */}
              <button onClick={()=>setShowLive(true)}
                style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:8,fontSize:12,fontWeight:600,background:'#ef4444',color:'#fff',border:'none',animation:'livePulse 2s infinite',cursor:'pointer',fontFamily:'inherit'}}>
                {Ic.live} Live
              </button>

              {/* Nástroje dropdown */}
              <ToolDropdown t={t} label="Nástroje" icon={Ic.wand} accent={t.accent}>
                <div style={{padding:'6px 0'}}>
                  {[
                    {id:'chat',    icon:'💬', label:'Chat',               color:t.accent},
                    {id:'generate_image',icon:'🎨',label:'Generovat obrázek',color:t.purple},
                    {id:'image_search',icon:'📷',label:'Hledat fotografie',color:t.green},
                  ].map(item=>(
                    <button key={item.id} onClick={()=>setImgMode(item.id)}
                      style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:imgMode===item.id?item.color+'22':'transparent',color:imgMode===item.id?item.color:t.txt,fontSize:13,fontFamily:'inherit',textAlign:'left',cursor:'pointer',borderRadius:8,border:'none',transition:'all .15s'}}>
                      <span style={{fontSize:16}}>{item.icon}</span>
                      <div>
                        <div style={{fontWeight:imgMode===item.id?600:400}}>{item.label}</div>
                      </div>
                      {imgMode===item.id&&<span style={{marginLeft:'auto',color:item.color}}>{Ic.check}</span>}
                    </button>
                  ))}
                  <div style={{margin:'6px 12px',borderTop:`1px solid ${t.border}`}}/>
                  <button onClick={()=>{setQuizMode(m=>!m)}}
                    style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:quizMode?'#f59e0b22':'transparent',color:quizMode?'#f59e0b':t.txt,fontSize:13,fontFamily:'inherit',textAlign:'left',cursor:'pointer',borderRadius:8,border:'none',transition:'all .15s'}}>
                    <span style={{fontSize:16}}>🎓</span>
                    <div style={{fontWeight:quizMode?600:400}}>Kvíz</div>
                    {quizMode&&<span style={{marginLeft:'auto',color:'#f59e0b'}}>{Ic.check}</span>}
                  </button>
                </div>
              </ToolDropdown>

              {/* Model dropdown */}
              <ToolDropdown t={t} label="Model" icon={Ic.model} accent={t.purple}>
                <div style={{padding:'6px 0'}}>
                  <div style={{fontSize:10,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',padding:'4px 12px 8px'}}>AI Model</div>
                  {AI_MODELS.map(m=>(
                    <button key={m.id} onClick={()=>setAiModel(m.id)}
                      style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:aiModel===m.id?t.purple+'22':'transparent',color:aiModel===m.id?t.purple:t.txt,fontSize:12,fontFamily:'inherit',textAlign:'left',cursor:'pointer',borderRadius:8,border:'none',transition:'all .15s'}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:aiModel===m.id?600:400}}>{m.name}</div>
                        <div style={{fontSize:10,color:t.muted,marginTop:1}}>{m.desc}</div>
                      </div>
                      {aiModel===m.id&&<span style={{color:t.purple,flexShrink:0}}>{Ic.check}</span>}
                    </button>
                  ))}
                  <div style={{margin:'6px 12px',borderTop:`1px solid ${t.border}`}}/>
                  <div style={{fontSize:10,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',padding:'4px 12px 8px'}}>Přemýšlení</div>
                  <button onClick={()=>setThinking(x=>!x)}
                    style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:thinking?t.purple+'22':'transparent',color:thinking?t.purple:t.txt,fontSize:12,fontFamily:'inherit',textAlign:'left',cursor:'pointer',borderRadius:8,border:'none',transition:'all .15s'}}>
                    <span style={{fontSize:16}}>💭</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:thinking?600:400}}>Deep Thinking</div>
                      <div style={{fontSize:10,color:t.muted,marginTop:1}}>Gemini 2.5 — pomalejší, přesnější</div>
                    </div>
                    {thinking&&<span style={{color:t.purple,flexShrink:0}}>{Ic.check}</span>}
                  </button>
                  {imgMode==='generate_image'&&(
                    <>
                      <div style={{margin:'6px 12px',borderTop:`1px solid ${t.border}`}}/>
                      <div style={{fontSize:10,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',padding:'4px 12px 8px'}}>AI Obrázky (Pollinations.ai)</div>
                      {IMG_MODELS.map(m=>(
                        <button key={m.id} onClick={()=>setImgModel(m.id)}
                          style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:imgModel===m.id?t.purple+'22':'transparent',color:imgModel===m.id?t.purple:t.txt,fontSize:12,fontFamily:'inherit',textAlign:'left',cursor:'pointer',borderRadius:8,border:'none',transition:'all .15s'}}>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:imgModel===m.id?600:400}}>{m.name}</div>
                            <div style={{fontSize:10,color:t.muted,marginTop:1}}>{m.desc}</div>
                          </div>
                          {imgModel===m.id&&<span style={{color:t.purple,flexShrink:0}}>{Ic.check}</span>}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </ToolDropdown>

              {/* Aktivní mód badge */}
              {imgMode!=='chat'&&(
                <span style={{fontSize:11,padding:'3px 8px',borderRadius:5,background:imgMode==='generate_image'?t.purple+'22':'rgba(34,197,94,.15)',color:imgMode==='generate_image'?t.purple:t.green,fontWeight:600}}>
                  {imgMode==='generate_image'?`🎨 ${IMG_MODELS.find(m=>m.id===imgModel)?.name||'FLUX'}`:' 📷 Hledání fotek'}
                </span>
              )}
            </div>
          )}

          {/* Quiz settings panel */}
          {quizMode&&(
            <div style={{marginBottom:8,padding:'12px',background:t.tag,borderRadius:10,border:`1px solid #f59e0b44`,animation:'fadeIn .2s ease'}}>
              <input value={quizTopic} onChange={e=>setQuizTopic(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendQuiz()}
                placeholder="Téma kvízu (např. Fyzika, AI, Praha, Programování…)"
                style={{width:'100%',padding:'8px 12px',background:t.inBg,color:t.txt,border:`1.5px solid #f59e0b`,borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit',marginBottom:10,boxSizing:'border-box'}}/>
              <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12,color:t.muted,flexShrink:0}}>Počet:</span>
                  <div style={{display:'flex',gap:4}}>
                    {QUIZ_COUNTS.map(n=>(
                      <button key={n} onClick={()=>setQuizCount(n)}
                        style={{padding:'4px 8px',borderRadius:6,background:quizCount===n?'#f59e0b':t.btn,color:quizCount===n?'#fff':t.muted,fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:quizCount===n?700:400,minWidth:28,transition:'all .15s'}}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12,color:t.muted,flexShrink:0}}>Obtížnost:</span>
                  <div style={{display:'flex',gap:4}}>
                    {QUIZ_DIFFS.map(([v,l])=>(
                      <button key={v} onClick={()=>setQuizDiff(v)}
                        style={{padding:'4px 9px',borderRadius:6,background:quizDiff===v?'#f59e0b':t.btn,color:quizDiff===v?'#fff':t.muted,fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:quizDiff===v?700:400,transition:'all .15s'}}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={sendQuiz} disabled={!quizTopic.trim()||loading}
                  style={{padding:'6px 16px',borderRadius:8,background:'#f59e0b',color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit',opacity:!quizTopic.trim()?0.5:1,marginLeft:'auto',transition:'opacity .15s'}}>
                  Start 🎓
                </button>
              </div>
            </div>
          )}

          {/* Attachments */}
          {atts.length>0&&(
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
              {atts.map(a=>(
                <div key={a.id} style={{position:'relative',animation:'fadeIn .2s ease'}}>
                  {a.preview?<img src={a.preview} alt={a.name} style={{height:46,width:46,objectFit:'cover',borderRadius:7,border:`1px solid ${t.border}`,display:'block'}}/>
                    :<div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 9px',background:t.pill,borderRadius:7,fontSize:12,color:t.txt}}>{Ic.file}{a.name.length>16?a.name.slice(0,14)+'…':a.name}</div>}
                  <button onClick={()=>setAtts(p=>p.filter(x=>x.id!==a.id))}
                    style={{position:'absolute',top:-5,right:-5,width:16,height:16,borderRadius:'50%',background:t.danger,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',border:'none',cursor:'pointer'}}>
                    {Ic.x}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Voice */}
          <div style={{marginBottom:8}}>
            <VoiceBtn t={t} onTranscript={txt=>{setInput(txt);setTimeout(()=>taRef.current?.focus(),100)}}/>
          </div>

          {/* Input box */}
          <div style={{display:'flex',alignItems:'flex-end',gap:6,padding:'9px 11px',background:t.inBg,border:`1.5px solid ${imgMode!=='chat'?modeColor:thinking?t.purple:t.inBrd}`,borderRadius:14,transition:'border-color .2s'}}>
            <textarea ref={taRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
              placeholder={phs[imgMode]} rows={1}
              style={{flex:1,fontSize:14,lineHeight:1.5,color:t.txt,caretColor:t.accent,maxHeight:120,overflowY:'auto',paddingTop:2}}
              onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'}}/>
            <div style={{display:'flex',gap:4,alignItems:'center',flexShrink:0}}>
              {input.length>80&&<span style={{fontSize:10,color:input.length>1800?t.danger:input.length>1200?'#f59e0b':t.muted,flexShrink:0}}>{input.length}</span>}
              <button className="ib" onClick={()=>fileRef.current.click()} style={{color:t.muted,display:'flex',padding:5}} title="Přidat soubor">{Ic.clip}</button>
              <button onClick={send} disabled={!canSend}
                style={{width:34,height:34,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',background:canSend?(imgMode==='generate_image'||thinking?t.purple:t.accent):t.btn,color:canSend?'#fff':t.muted,transition:'all .15s',flexShrink:0,border:'none',cursor:canSend?'pointer':'default'}}>
                {Ic.send}
              </button>
            </div>
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.docx" style={{display:'none'}} onChange={onFile}/>

          {/* Beta disclaimer */}
          <div style={{fontSize:10,color:t.muted,textAlign:'center',marginTop:6,lineHeight:1.5}}>
            <span style={{background:'#f59e0b22',color:'#f59e0b',padding:'1px 5px',borderRadius:3,fontWeight:700,marginRight:5}}>BETA</span>
            AI Asistent může dělat chyby — vždy ověřte důležité informace
            {isLoggedIn?' · Paměť + Historie v Supabase':' · Přihlaste se pro plné funkce'}
          </div>
        </div>
      </main>

      {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} dark={t.isDark}/>}
      {showSet&&<SettingsModal t={t} themeName={themeName} setThemeName={setThemeName} sysPmt={sysPmt} setSysPmt={setSysPmt} onClose={()=>setShowSet(false)} isLoggedIn={isLoggedIn} userId={session?.user?.id} memory={memory} setMemory={setMemory} aiModel={aiModel} setAiModel={setAiModel}/>}
      {showLive&&<LiveModal t={t} onClose={()=>setShowLive(false)} sysPmt={sysPmt} token={token}/>}
    </div>
  )
}
