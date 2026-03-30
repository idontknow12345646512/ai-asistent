import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import AuthModal from './AuthModal'
import LiveModal from './LiveModal'
import {
  EDGE, ANON, APP_NAME, SYS_DEFAULT,
  CONV_COLORS, IMG_MODELS, AI_MODELS, PERSONAS, QUIZ_COUNTS, QUIZ_DIFFS, MEM_CATEGORIES,
  THEMES, THEME_LIST, Ic, LumiAvatar,
  uid, fmtTime, fmtDate, callEdge, detectAutoMode, mkLocal, renderMD,
  checkImgRateLimit, recordImgUsage,
} from './constants.jsx'

async function getFreshToken() {
  const { data } = await supabase.auth.refreshSession()
  if (data?.session) return data.session.access_token
  const { data: d2 } = await supabase.auth.getSession()
  return d2?.session?.access_token ?? null
}

// ── Typing animation ──────────────────────────────────────────────────────────
function TypingText({ text, isDark, useMarkdown, onDone }) {
  const [shown, setShown]       = useState('')
  const [finished, setFinished] = useState(false)
  useEffect(() => {
    setShown(''); setFinished(false)
    if (!text) { setFinished(true); onDone?.(); return }
    let i = 0
    const speed = text.length > 600 ? 3 : text.length > 200 ? 5 : 7
    const id = setInterval(() => {
      i += speed
      if (i >= text.length) { setShown(text); setFinished(true); clearInterval(id); onDone?.() }
      else setShown(text.slice(0, i))
    }, 16)
    return () => clearInterval(id)
  }, [text]) // eslint-disable-line
  if (finished && useMarkdown) return (
    <div style={{fontSize:14,lineHeight:1.7,wordBreak:'break-word'}} dangerouslySetInnerHTML={{__html:renderMD(text,isDark)}}/>
  )
  return (
    <div style={{fontSize:14,lineHeight:1.65,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
      {shown}
      {!finished && <span style={{animation:'blink 1s infinite',display:'inline-block',width:2,height:14,background:'currentColor',marginLeft:1,verticalAlign:'text-bottom'}}/>}
    </div>
  )
}

// ── Cookie banner ─────────────────────────────────────────────────────────────
function CookieBanner({ t, onAccept }) {
  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:80,padding:'14px 20px',background:t.isDark?'rgba(13,16,25,.97)':'rgba(255,255,255,.97)',backdropFilter:'blur(16px)',borderTop:`1px solid ${t.border}`,display:'flex',alignItems:'center',gap:14,flexWrap:'wrap',boxShadow:'0 -4px 32px rgba(0,0,0,.25)',animation:'slideUpBanner .4s ease'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:200}}>
        <span style={{fontSize:20}}>🍪</span>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:t.txt,marginBottom:2}}>Lumi používá cookies</div>
          <div style={{fontSize:11,color:t.muted}}>Ukládáme rate limity pro generování obrázků a vaše preference (téma, nastavení). Žádné sledovací cookies třetích stran.</div>
        </div>
      </div>
      <button onClick={onAccept}
        style={{padding:'9px 20px',borderRadius:9,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit',flexShrink:0,transition:'all .15s'}}>
        Rozumím, přijmout
      </button>
    </div>
  )
}

// ── Aurora beam — ambientní světelný efekt ──────────────────────────────────
function AuroraBeam({ t }) {
  return (
    <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:0}}>
      {/* Hlavní záře */}
      <div style={{position:'absolute',top:'-15%',left:'50%',transform:'translateX(-50%)',width:'75%',height:'65%',background:`radial-gradient(ellipse at center, ${t.gradA}20 0%, ${t.gradB}12 40%, transparent 70%)`,animation:'auroraFloat 9s ease-in-out infinite',borderRadius:'50%',filter:'blur(48px)'}}/>
      {/* Sekundární záře vlevo */}
      <div style={{position:'absolute',top:'5%',left:'10%',width:'35%',height:'45%',background:`radial-gradient(ellipse at center, ${t.gradB}12 0%, transparent 70%)`,animation:'auroraFloat2 13s ease-in-out infinite',borderRadius:'50%',filter:'blur(56px)'}}/>
      {/* Sekundární záře vpravo */}
      <div style={{position:'absolute',top:'15%',right:'8%',width:'28%',height:'35%',background:`radial-gradient(ellipse at center, ${t.gradA}10 0%, transparent 70%)`,animation:'auroraFloat2 11s ease-in-out infinite reverse',borderRadius:'50%',filter:'blur(44px)'}}/>
      {/* Jemné hvězdičky */}
      {[...Array(6)].map((_,i)=>(
        <div key={i} style={{position:'absolute',width:2,height:2,borderRadius:'50%',background:t.gradA,opacity:.4,top:`${15+i*12}%`,left:`${20+i*11}%`,animation:`auroraFloat2 ${6+i*1.5}s ease-in-out infinite`,animationDelay:`${i*0.8}s`}}/>
      ))}
    </div>
  )
}

// ── Img rate limit badge ──────────────────────────────────────────────────────
function ImgLimitBadge({ t }) {
  const [info, setInfo] = useState(null)
  useEffect(() => {
    const { remaining } = checkImgRateLimit()
    setInfo(remaining)
    const id = setInterval(() => setInfo(checkImgRateLimit().remaining), 30000)
    return () => clearInterval(id)
  }, [])
  if (info === null || info >= 6) return null
  const clr = info <= 1 ? t.danger : info <= 3 ? '#f59e0b' : t.green
  return (
    <span style={{fontSize:10,padding:'2px 7px',borderRadius:4,background:clr+'22',color:clr,fontWeight:600,flexShrink:0}}>
      {info === 0 ? '⏳ Limit' : `🎨 ${info}/6`}
    </span>
  )
}

// ── Sparkle button (nová věc — generuje obrázek z výběru textu) ──────────────
function SparkleBtn({ t, selectedText, onGenerate }) {
  if (!selectedText) return null
  return (
    <button onClick={()=>onGenerate(selectedText)}
      style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:20,background:`linear-gradient(135deg,${t.gradA},${t.gradB})`,color:'#fff',fontSize:12,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit',boxShadow:`0 4px 16px ${t.gradA}44`,animation:'sparkleIn .25s cubic-bezier(.34,1.56,.64,1)',position:'fixed',zIndex:70}}>
      {Ic.spark} Vizualizovat výběr
    </button>
  )
}

// ── Image search grid ─────────────────────────────────────────────────────────
function ImgGrid({ images, query, t }) {
  const [errs, setErrs] = useState({})
  if (!images?.length) return <div style={{fontSize:13,color:t.muted}}>Žádné fotografie pro „{query}"</div>
  return (
    <div>
      <div style={{fontSize:12,color:t.muted,marginBottom:9,display:'flex',alignItems:'center',gap:6}}>{Ic.imgSrch} <strong style={{color:t.txt}}>„{query}"</strong></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
        {images.map((img,i)=>!errs[i]&&(
          <a key={img.id||i} href={img.source} target="_blank" rel="noopener noreferrer"
            style={{display:'block',borderRadius:8,overflow:'hidden',border:`1px solid ${t.border}`,textDecoration:'none',background:t.card,transition:'transform .2s cubic-bezier(.34,1.56,.64,1),opacity .15s'}}
            onMouseOver={e=>{e.currentTarget.style.transform='scale(1.04)';e.currentTarget.style.opacity='.9'}}
            onMouseOut={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.opacity='1'}}>
            <div style={{position:'relative',paddingBottom:'66%',overflow:'hidden'}}>
              <img src={img.thumbnail||img.url} alt={img.title||query}
                onError={()=>setErrs(p=>({...p,[i]:true}))}
                style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',transition:'transform .3s ease'}}
                onMouseOver={e=>e.currentTarget.style.transform='scale(1.06)'}
                onMouseOut={e=>e.currentTarget.style.transform='scale(1)'}/>
            </div>
            <div style={{padding:'4px 7px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:10,color:t.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>📷 {img.author||'Unsplash'}</span>
              {Ic.extLink}
            </div>
          </a>
        ))}
      </div>
      <div style={{fontSize:10,color:t.muted,marginTop:7}}>Fotografie z <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" style={{color:t.accent,textDecoration:'none'}}>Unsplash</a></div>
    </div>
  )
}

// ── Generated image ───────────────────────────────────────────────────────────
function GenImg({ imageData, mimeType, prompt, modelId, t }) {
  const [loaded, setLoaded] = useState(false)
  const [progress, setProgress] = useState(0)
  const src       = `data:${mimeType||'image/jpeg'};base64,${imageData}`
  const modelName = IMG_MODELS.find(m=>m.id===modelId)?.name || 'Pollinations'
  const dl = () => { const a=document.createElement('a');a.href=src;a.download=`lumi-${Date.now()}.jpg`;a.click() }

  // Fake progress bar pro loading feel
  useEffect(()=>{
    if(loaded) return
    setProgress(0)
    const id=setInterval(()=>setProgress(p=>p>=85?85:p+Math.random()*8),400)
    return()=>clearInterval(id)
  },[loaded])
  useEffect(()=>{ if(loaded) setProgress(100) },[loaded])

  return (
    <div>
      <div style={{fontSize:12,color:t.muted,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
        {Ic.magic} Pollinations.ai · <strong style={{color:t.purple}}>{modelName}</strong>
      </div>
      {!loaded&&(
        <div style={{width:320,maxWidth:'100%',borderRadius:12,overflow:'hidden',border:`1px solid ${t.border}`}}>
          {/* Shimmer skeleton */}
          <div className="shimmer" style={{height:280,borderRadius:'12px 12px 0 0'}}/>
          {/* Progress bar */}
          <div style={{height:3,background:t.btn}}>
            <div style={{height:'100%',background:`linear-gradient(90deg,${t.gradA},${t.gradB})`,width:`${progress}%`,transition:'width .4s ease',borderRadius:2}}/>
          </div>
          <div style={{padding:'8px 12px',display:'flex',alignItems:'center',gap:8}}>
            <div style={{display:'flex',gap:3}}>
              {[0,1,2].map(i=>(
                <div key={i} style={{width:5,height:5,borderRadius:'50%',background:t.gradA,opacity:.6,animation:`pu 1.4s infinite ease-in-out`,animationDelay:`${i*0.22}s`}}/>
              ))}
            </div>
            <span style={{fontSize:11,color:t.muted,animation:'progressPulse 1.5s infinite'}}>Generuji obrázek…</span>
          </div>
        </div>
      )}
      <div style={{position:'relative',display:loaded?'inline-block':'none',maxWidth:'100%'}}>
        <img src={src} alt={prompt} onLoad={()=>setLoaded(true)}
          style={{maxWidth:'100%',maxHeight:460,borderRadius:12,display:'block',border:`1px solid ${t.border}`,animation:'imgReveal .6s cubic-bezier(.34,1.06,.64,1)'}}/>
        <button onClick={dl}
          style={{position:'absolute',top:8,right:8,display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:7,background:'rgba(0,0,0,.7)',color:'#fff',fontSize:11,border:'none',cursor:'pointer',backdropFilter:'blur(6px)',fontFamily:'inherit',transition:'all .15s'}}
          onMouseOver={e=>e.currentTarget.style.background='rgba(0,0,0,.9)'}
          onMouseOut={e=>e.currentTarget.style.background='rgba(0,0,0,.7)'}>
          {Ic.dl} Stáhnout
        </button>
      </div>
      {prompt&&loaded&&<div style={{fontSize:11,color:t.muted,marginTop:6,fontStyle:'italic',lineHeight:1.4}}>„{prompt}"</div>}
    </div>
  )
}

// ── Quiz ──────────────────────────────────────────────────────────────────────
function QuizCard({ questions, t }) {
  const [cur,setCur]=useState(0),[answers,setAnswers]=useState({}),[done,setDone]=useState(false)
  if (!questions?.length) return <div style={{padding:'12px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`,fontSize:13,color:t.muted}}>Kvíz nemá žádné otázky.</div>
  const q=questions[cur],total=questions.length
  const score=Object.entries(answers).filter(([i,a])=>Number(a)===questions[Number(i)]?.correct).length
  if (done) {
    const pct=Math.round((score/total)*100)
    return (
      <div style={{padding:'20px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`,textAlign:'center',animation:'fadeInScale .4s cubic-bezier(.34,1.56,.64,1)'}}>
        <div style={{fontSize:44,marginBottom:10}}>{pct>=80?'🏆':pct>=60?'👍':pct>=40?'😊':'📚'}</div>
        <div style={{fontSize:24,fontWeight:700,color:t.txt}}>{score}/{total}</div>
        <div style={{fontSize:14,color:t.muted,marginTop:4}}>{pct}% správně</div>
        <div style={{width:'100%',height:8,background:t.btn,borderRadius:4,marginTop:14,overflow:'hidden'}}>
          <div style={{width:`${pct}%`,height:'100%',background:pct>=80?t.succ:pct>=60?t.accent:'#f59e0b',borderRadius:4,transition:'width 1.4s cubic-bezier(.4,0,.2,1)'}}/>
        </div>
        <div style={{fontSize:13,color:t.muted,marginTop:12,marginBottom:18}}>{pct>=80?'Výborně!':pct>=60?'Dobrá práce!':pct>=40?'Slušný výsledek!':'Příště lépe!'}</div>
        <button onClick={()=>{setAnswers({});setCur(0);setDone(false)}}
          style={{padding:'10px 24px',borderRadius:9,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>🔄 Zkusit znovu</button>
      </div>
    )
  }
  return (
    <div style={{padding:'14px 16px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <div style={{flex:1,height:4,background:t.btn,borderRadius:2,overflow:'hidden'}}>
          <div style={{width:`${((cur+1)/total)*100}%`,height:'100%',background:t.accent,transition:'width .4s cubic-bezier(.4,0,.2,1)'}}/>
        </div>
        <span style={{fontSize:11,color:t.muted,flexShrink:0}}>{cur+1}/{total}</span>
      </div>
      <div style={{fontSize:13,fontWeight:600,color:t.txt,marginBottom:12,lineHeight:1.4}}>🎓 {q.question}</div>
      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {q.options?.map((opt,i)=>{
          const sel=answers[cur],isC=i===q.correct,isSel=sel===i
          let bg=t.btn,clr=t.txt,brd=t.border
          if(sel!==undefined){if(isC){bg=t.success;clr=t.succ;brd=t.succ}else if(isSel){bg='rgba(239,68,68,.15)';clr='#fca5a5';brd='#f87171'}}
          return (
            <button key={i} onClick={()=>sel===undefined&&setAnswers(p=>({...p,[cur]:i}))} disabled={sel!==undefined}
              style={{padding:'9px 13px',borderRadius:8,background:bg,color:clr,border:`1.5px solid ${brd}`,fontSize:13,textAlign:'left',cursor:sel===undefined?'pointer':'default',fontFamily:'inherit',transition:'all .2s',display:'flex',alignItems:'center',gap:8,transform:sel===undefined?'':'scale(1)'}}>
              <span style={{width:22,height:22,borderRadius:'50%',background:'rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{String.fromCharCode(65+i)}</span>
              <span>{opt}</span>
              {sel!==undefined&&isC&&<span style={{marginLeft:'auto',fontWeight:700,animation:'checkIn .3s cubic-bezier(.34,1.56,.64,1)'}}>✓</span>}
              {sel!==undefined&&isSel&&!isC&&<span style={{marginLeft:'auto'}}>✗</span>}
            </button>
          )
        })}
      </div>
      {answers[cur]!==undefined&&q.explanation&&(
        <div style={{marginTop:10,padding:'10px 12px',borderRadius:8,background:t.tag,border:`1px solid ${t.border}`,fontSize:12,color:t.muted,lineHeight:1.5,animation:'fadeIn .3s ease'}}>
          💡 {q.explanation}
        </div>
      )}
      {answers[cur]!==undefined&&(
        <div style={{marginTop:12}}>
          {cur<total-1
            ?<button onClick={()=>setCur(c=>c+1)} style={{width:'100%',padding:'9px',borderRadius:8,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit',transition:'transform .15s'}} onMouseOver={e=>e.currentTarget.style.transform='scale(1.01)'} onMouseOut={e=>e.currentTarget.style.transform='scale(1)'}>Další →</button>
            :<button onClick={()=>setDone(true)} style={{width:'100%',padding:'9px',borderRadius:8,background:'#f59e0b',color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Výsledky 🏆</button>
          }
        </div>
      )}
    </div>
  )
}

// ── Voice button (nyní jen ikona bez labelu) ──────────────────────────────────
function VoiceBtn({ t, onTranscript, compact }) {
  const [on,setOn]=useState(false),[txt,setTxt]=useState(''),ref=useRef(null)
  const ok=typeof window!=='undefined'&&('SpeechRecognition' in window||'webkitSpeechRecognition' in window)
  if (!ok) return null
  const toggle=()=>{
    if(on){ref.current?.stop();setOn(false);return}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition
    const r=new SR();r.continuous=false;r.interimResults=true;r.lang='cs-CZ'
    r.onresult=e=>{const t2=Array.from(e.results).map(r=>r[0].transcript).join('');setTxt(t2);if(e.results[e.results.length-1].isFinal){onTranscript(t2);setTxt('');setOn(false)}}
    r.onerror=()=>setOn(false);r.onend=()=>setOn(false)
    ref.current=r;r.start();setOn(true)
  }
  if (compact) return (
    <button onClick={toggle} title={on?'Zastavit nahrávání':'Hlasový vstup'}
      style={{display:'flex',alignItems:'center',justifyContent:'center',padding:6,borderRadius:8,background:on?'#ef4444':t.btn,color:on?'#fff':t.muted,border:`1px solid ${on?'#ef4444':t.border}`,cursor:'pointer',transition:'all .2s',flexShrink:0,position:'relative'}}>
      {Ic.mic}
      {on&&txt&&<span style={{position:'absolute',bottom:'calc(100% + 6px)',left:'50%',transform:'translateX(-50%)',background:t.modal,border:`1px solid ${t.border}`,borderRadius:6,padding:'3px 8px',fontSize:10,color:t.txt,whiteSpace:'nowrap',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',boxShadow:'0 4px 12px rgba(0,0,0,.3)'}}>„{txt}"</span>}
    </button>
  )
  return null
}

// ── Message actions ───────────────────────────────────────────────────────────
function MsgActions({ msg, t, isLoggedIn, token, onExplain, onSaveMemory, onStar, starred }) {
  const [rat,setRat]=useState(null),[showFix,setShowFix]=useState(false),[fix,setFix]=useState(''),[copied,setCopied]=useState(false)
  const copy=()=>{navigator.clipboard.writeText(msg.content);setCopied(true);setTimeout(()=>setCopied(false),1500)}
  const feedback=async r=>{setRat(r);if(token&&msg.dbId){try{await callEdge('feedback',{messageId:msg.dbId,rating:r,correction:fix||null},token)}catch{}}setShowFix(false)}
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:4,marginTop:5,flexWrap:'wrap'}}>
        <button onClick={copy} style={{display:'flex',alignItems:'center',gap:3,padding:'3px 7px',borderRadius:5,background:copied?t.success:t.btn,color:copied?t.succ:t.muted,fontSize:11,border:`1px solid ${copied?t.succ:t.border}`,cursor:'pointer',fontFamily:'inherit',transition:'all .2s'}}>
          {Ic.copy}{copied?' ✓ Zkopírováno!':' Kopírovat'}
        </button>
        <button onClick={()=>onExplain(msg)} style={{display:'flex',alignItems:'center',gap:3,padding:'3px 7px',borderRadius:5,background:t.btn,color:t.muted,fontSize:11,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit'}}>
          {Ic.info} Jak jsem to zjistil?
        </button>
        {isLoggedIn&&<>
          <button onClick={()=>onSaveMemory(msg.content)} style={{display:'flex',alignItems:'center',gap:3,padding:'3px 7px',borderRadius:5,background:t.btn,color:t.muted,fontSize:11,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit'}}>{Ic.memory} Zapamatovat</button>
          <button onClick={()=>onStar(msg)} style={{display:'flex',padding:'3px 6px',borderRadius:5,background:starred?'#f59e0b22':t.btn,color:starred?'#f59e0b':t.muted,border:`1px solid ${starred?'#f59e0b':t.border}`,cursor:'pointer',transition:'all .2s'}}>
            {starred?Ic.starF:Ic.star}
          </button>
        </>}
        <button onClick={()=>feedback(1)} style={{display:'flex',padding:'3px 6px',borderRadius:5,background:rat===1?t.success:t.btn,color:rat===1?t.succ:t.muted,border:`1px solid ${rat===1?t.succ:t.border}`,cursor:'pointer'}}>{Ic.thumbUp}</button>
        <button onClick={()=>rat===-1?setShowFix(true):feedback(-1)} style={{display:'flex',padding:'3px 6px',borderRadius:5,background:rat===-1?'rgba(239,68,68,.15)':t.btn,color:rat===-1?'#fca5a5':t.muted,border:`1px solid ${rat===-1?'#f87171':t.border}`,cursor:'pointer'}}>{Ic.thumbDn}</button>
      </div>
      {showFix&&(
        <div style={{marginTop:6,padding:12,background:t.modal,border:`1px solid ${t.border}`,borderRadius:10,animation:'fadeIn .2s ease'}}>
          <div style={{fontSize:12,color:t.txt,marginBottom:7}}>Správná odpověď:</div>
          <textarea value={fix} onChange={e=>setFix(e.target.value)} rows={3} placeholder="Napište opravu…"
            style={{width:'100%',padding:'8px 10px',background:t.inBg,color:t.txt,border:`1px solid ${t.inBrd}`,borderRadius:7,fontSize:12,outline:'none',resize:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:6,marginTop:8}}>
            <button onClick={()=>setShowFix(false)} style={{padding:'5px 12px',borderRadius:7,background:t.btn,color:t.txt,fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Zrušit</button>
            <button onClick={()=>feedback(-1)} style={{padding:'5px 12px',borderRadius:7,background:t.accent,color:'#fff',fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Odeslat</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Toolbar dropdown ──────────────────────────────────────────────────────────
function ToolDropdown({ t, label, icon, children, accent, active }) {
  const [open,setOpen]=useState(false), ref=useRef(null)
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)}
    document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)
  },[])
  const clr=accent||t.accent
  return (
    <div ref={ref} style={{position:'relative'}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:8,background:(open||active)?clr+'22':t.btn,color:(open||active)?clr:t.muted,border:`1px solid ${(open||active)?clr:t.border}`,fontSize:12,fontWeight:(open||active)?600:400,fontFamily:'inherit',cursor:'pointer',transition:'all .15s'}}>
        {icon}{label}{open?Ic.chevUp:Ic.chevDn}
      </button>
      {open&&(
        <div style={{position:'absolute',bottom:'calc(100% + 8px)',left:0,minWidth:230,background:t.modal,border:`1px solid ${t.border}`,borderRadius:14,padding:6,zIndex:40,boxShadow:`0 12px 40px rgba(0,0,0,.45)`,animation:'dropIn .2s cubic-bezier(.34,1.56,.64,1)'}}>
          {children}
          <button onClick={()=>setOpen(false)} style={{position:'absolute',top:6,right:6,color:t.muted,display:'flex',padding:3,background:'none',border:'none',cursor:'pointer'}}>{Ic.x}</button>
        </div>
      )}
    </div>
  )
}

// ── Add Memory modal ──────────────────────────────────────────────────────────
function AddMemoryModal({ t, onClose, onSave }) {
  const [content,setContent]=useState(''),[category,setCategory]=useState('personal')
  const save=()=>{if(content.trim()){onSave(content.trim(),category);onClose()}}
  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:58,backdropFilter:'blur(4px)'}}/>
      <div onClick={e=>e.stopPropagation()}
        style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:59,width:'min(420px,96vw)',background:t.modal,border:`1px solid ${t.border}`,borderRadius:16,padding:24,fontFamily:"'DM Sans',sans-serif",animation:'fadeInScale .3s cubic-bezier(.34,1.56,.64,1)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <h3 style={{fontSize:15,fontWeight:600,color:t.txt}}>➕ Přidat do paměti Lumi</h3>
          <button onClick={onClose} style={{color:t.muted,display:'flex',padding:3,background:'none',border:'none',cursor:'pointer'}}>{Ic.x}</button>
        </div>
        <textarea value={content} onChange={e=>setContent(e.target.value)} rows={4}
          placeholder="Např. Jmenuji se Radek, jsem student programování…"
          style={{width:'100%',padding:'10px 12px',background:t.inBg,color:t.txt,border:`1.5px solid ${t.inBrd}`,borderRadius:9,fontSize:13,lineHeight:1.6,outline:'none',resize:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:12}}/>
        <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Kategorie</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:18}}>
          {MEM_CATEGORIES.map(c=>(
            <button key={c.id} onClick={()=>setCategory(c.id)}
              style={{padding:'5px 10px',borderRadius:6,background:category===c.id?t.accent:t.btn,color:category===c.id?'#fff':t.muted,fontSize:12,border:`1px solid ${category===c.id?t.accent:t.border}`,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',fontWeight:category===c.id?600:400}}>
              {c.label}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'8px 16px',borderRadius:8,background:t.btn,color:t.txt,fontSize:13,fontWeight:500,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Zrušit</button>
          <button onClick={save} disabled={!content.trim()}
            style={{padding:'8px 16px',borderRadius:8,background:content.trim()?t.accent:t.btn,color:content.trim()?'#fff':t.muted,fontSize:13,fontWeight:600,border:'none',cursor:content.trim()?'pointer':'default',fontFamily:'inherit',transition:'all .15s'}}>
            Uložit
          </button>
        </div>
      </div>
    </>
  )
}

// ── Settings modal ────────────────────────────────────────────────────────────
function SettingsModal({ t, themeName, setThemeName, sysPmt, setSysPmt, onClose, isLoggedIn, userId, memory, setMemory, aiModel, setAiModel, onAddMemory }) {
  const [tmp,setTmp]=useState(sysPmt),[tmpAI,setTmpAI]=useState(aiModel),[memList,setMemList]=useState([]),[tab,setTab]=useState('appearance')
  useEffect(()=>{
    if(tab==='memory'&&isLoggedIn)supabase.from('user_memory').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(50).then(({data})=>setMemList(data||[]))
  },[tab,isLoggedIn,userId])
  const delMem=async id=>{await supabase.from('user_memory').delete().eq('id',id);setMemList(p=>p.filter(m=>m.id!==id))}
  const delAll=async()=>{if(!isLoggedIn)return;await supabase.from('user_memory').delete().eq('user_id',userId);setMemList([])}
  const save=()=>{setSysPmt(tmp);setAiModel(tmpAI);onClose()}
  const tabs=[{id:'appearance',l:'Vzhled',e:'🎨'},{id:'model',l:'Model',e:'🤖'},{id:'behavior',l:'Chování',e:'⚙️'},{id:'memory',l:'Paměť',e:'🧠'},{id:'about',l:'O aplikaci',e:'ℹ️'}]
  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:49,backdropFilter:'blur(4px)'}}/>
      <div onClick={e=>e.stopPropagation()}
        style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:50,width:'min(580px,96vw)',maxHeight:'90vh',display:'flex',flexDirection:'column',background:t.modal,border:`1px solid ${t.border}`,borderRadius:18,fontFamily:"'DM Sans',sans-serif",overflow:'hidden',animation:'fadeInScale .25s cubic-bezier(.34,1.56,.64,1)'}}>
        <div style={{padding:'18px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}><LumiAvatar size={32} gradient={[t.gradA,t.gradB]}/><h2 style={{fontSize:16,fontWeight:600,color:t.txt}}>Nastavení</h2></div>
          <button onClick={onClose} style={{background:'none',border:'none',color:t.muted,cursor:'pointer',fontSize:20,display:'flex',padding:4}}>{Ic.x}</button>
        </div>
        <div style={{display:'flex',gap:4,padding:'12px 20px 0',flexShrink:0,flexWrap:'wrap'}}>
          {tabs.map(tb=>(
            <button key={tb.id} onClick={()=>setTab(tb.id)}
              style={{padding:'6px 11px',borderRadius:8,background:tab===tb.id?t.accent:t.btn,color:tab===tb.id?'#fff':t.muted,fontSize:12,fontWeight:tab===tb.id?600:400,border:'none',cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>
              {tb.e} {tb.l}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'16px 20px 20px'}}>

          {tab==='appearance'&&(
            <>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>12 barevných témat</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7}}>
                {THEME_LIST.map(th=>(
                  <button key={th.id} onClick={()=>setThemeName(th.id)}
                    style={{padding:'10px 6px',borderRadius:9,border:`2px solid ${themeName===th.id?t.accent:t.border}`,background:themeName===th.id?t.accent+'22':t.btn,color:themeName===th.id?t.accent:t.muted,fontSize:11,fontWeight:themeName===th.id?600:400,cursor:'pointer',fontFamily:'inherit',textAlign:'center',transition:'all .2s',transform:themeName===th.id?'scale(1.05)':'scale(1)'}}>
                    <div style={{fontSize:18,marginBottom:3}}>{th.icon}</div>{th.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab==='model'&&(
            <>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>AI Model pro chat</div>
              {AI_MODELS.map(m=>(
                <button key={m.id} onClick={()=>setTmpAI(m.id)}
                  style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`1.5px solid ${tmpAI===m.id?t.accent:t.border}`,background:tmpAI===m.id?t.accent+'18':t.btn,color:t.txt,fontSize:13,textAlign:'left',cursor:'pointer',fontFamily:'inherit',transition:'all .15s',marginBottom:8,display:'block'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <strong style={{color:tmpAI===m.id?t.accent:t.txt}}>{m.name}</strong>
                    {tmpAI===m.id&&<span style={{color:t.accent}}>{Ic.check}</span>}
                  </div>
                  <div style={{fontSize:12,color:t.muted,marginTop:3}}>{m.desc}</div>
                </button>
              ))}
              <div style={{padding:'12px 14px',borderRadius:10,background:t.tag,border:`1px solid ${t.border}`,fontSize:12,color:t.muted,lineHeight:1.6}}>
                💡 Pollinations.ai modely jsou <strong style={{color:t.accent}}>zdarma</strong>. Přidej API klíč ze <a href="https://enter.pollinations.ai/" target="_blank" rel="noopener noreferrer" style={{color:t.accent}}>Seed tieru</a> do Supabase Secrets jako <code style={{background:t.btn,padding:'1px 5px',borderRadius:3}}>POLLINATIONS_API_KEY</code> pro prioritní přístup.
              </div>
            </>
          )}

          {tab==='behavior'&&(
            <>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>Osobnost</div>
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:18}}>
                {PERSONAS.map(p=>(
                  <button key={p.label} onClick={()=>setTmp(p.val)}
                    style={{padding:'10px 13px',borderRadius:9,border:`1.5px solid ${tmp===p.val?t.accent:t.border}`,background:tmp===p.val?t.accent+'18':t.btn,color:tmp===p.val?t.accent:t.txt,fontSize:13,textAlign:'left',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'space-between',transition:'all .15s'}}>
                    {p.label}{tmp===p.val&&<span style={{color:t.accent,flexShrink:0}}>{Ic.check}</span>}
                  </button>
                ))}
              </div>
              <textarea value={tmp} onChange={e=>setTmp(e.target.value)} rows={3}
                style={{width:'100%',padding:'10px 12px',background:t.inBg,color:t.txt,border:`1.5px solid ${t.inBrd}`,borderRadius:9,fontSize:13,lineHeight:1.6,outline:'none',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box',marginBottom:12}}/>
              <div style={{padding:'12px 14px',borderRadius:10,background:t.tag,border:`1px solid ${t.border}`}}>
                <div style={{fontSize:12,fontWeight:600,color:t.txt,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>{Ic.brain} Epizodická paměť</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:12,color:t.muted}}>Lumi si pamatuje kontext z minulých chatů</span>
                  <button onClick={()=>setMemory(m=>!m)}
                    style={{width:42,height:24,borderRadius:12,background:memory?t.accent:t.btn,border:`1px solid ${memory?t.accent:t.border}`,cursor:'pointer',position:'relative',transition:'all .2s',flexShrink:0}}>
                    <span style={{position:'absolute',top:3,left:memory?20:3,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left .2s',display:'block'}}/>
                  </button>
                </div>
              </div>
            </>
          )}

          {tab==='memory'&&(
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em'}}>Paměť {memList.length>0&&`(${memList.length})`}</div>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>{onAddMemory();onClose()}} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:7,background:t.accent,color:'#fff',fontSize:12,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>
                    {Ic.addMem} Přidat
                  </button>
                  {memList.length>0&&<button onClick={delAll} style={{fontSize:12,color:t.danger,cursor:'pointer',background:'none',border:'none',fontFamily:'inherit',padding:'5px 8px'}}>Smazat vše</button>}
                </div>
              </div>
              {!isLoggedIn&&<p style={{fontSize:13,color:t.muted}}>Pro správu paměti se přihlaste.</p>}
              {isLoggedIn&&memList.length===0&&<div style={{textAlign:'center',padding:'24px 0',color:t.muted,fontSize:13}}><div style={{fontSize:32,marginBottom:8}}>🧠</div>Paměť je prázdná.</div>}
              {memList.map(m=>(
                <div key={m.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'9px 12px',borderRadius:9,background:t.tag,border:`1px solid ${t.border}`,marginBottom:7}}>
                  <span style={{fontSize:10,color:t.muted,background:t.btn,padding:'2px 6px',borderRadius:4,flexShrink:0,marginTop:1}}>{MEM_CATEGORIES.find(c=>c.id===m.category)?.label||m.category}</span>
                  {m.source==='manual'&&<span style={{fontSize:9,color:t.accent,background:t.accent+'22',padding:'1px 5px',borderRadius:3,flexShrink:0,marginTop:1}}>ručně</span>}
                  <span style={{fontSize:13,color:t.txt,flex:1,lineHeight:1.4}}>{m.content}</span>
                  <button onClick={()=>delMem(m.id)} style={{color:t.muted,display:'flex',padding:3,flexShrink:0,background:'none',border:'none',cursor:'pointer'}}>{Ic.trash}</button>
                </div>
              ))}
            </>
          )}

          {tab==='about'&&(
            <div style={{fontSize:13,color:t.muted,lineHeight:1.7}}>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,marginBottom:20}}>
                <LumiAvatar size={56} gradient={[t.gradA,t.gradB]}/>
                <div style={{textAlign:'center'}}>
                  <div style={{fontWeight:700,color:t.txt,fontSize:18}}>Lumi</div>
                  <div style={{fontSize:12,color:t.muted}}>Váš inteligentní asistent</div>
                  <span style={{background:'#f59e0b22',color:'#f59e0b',padding:'2px 10px',borderRadius:4,fontWeight:600,fontSize:12}}>BETA</span>
                </div>
              </div>
              {[['🤖 Chat','Gemini 3.1 Flash Lite / Flash'],['💭 Deep Thinking','Gemini 2.5 Flash/Pro'],['🔶 Gemma','Gemma 3 12B / 27B'],['🔴 Live','Gemini 2.0 Flash Live'],['🎨 AI Obrázky','Pollinations.ai (5 modelů)'],['📷 Fotografie','Unsplash API'],['🎙️ Hlas','Web Speech API'],['🧠 Paměť','Supabase PostgreSQL'],['🔒 Auth','Supabase Auth']].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',borderRadius:8,background:t.tag,border:`1px solid ${t.border}`,marginBottom:6}}>
                  <span>{k}</span><span style={{color:t.accent,fontSize:12}}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {(tab==='appearance'||tab==='behavior'||tab==='model')&&(
          <div style={{padding:'0 20px 20px',display:'flex',gap:8,justifyContent:'flex-end',flexShrink:0}}>
            <button onClick={onClose} style={{padding:'8px 16px',borderRadius:8,background:t.btn,color:t.txt,fontSize:13,fontWeight:500,cursor:'pointer',border:'none',fontFamily:'inherit'}}>Zrušit</button>
            <button onClick={save} style={{padding:'8px 16px',borderRadius:8,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',border:'none',fontFamily:'inherit'}}>Uložit</button>
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
  const [showAddMem, setShowAddMem] = useState(false)
  const [cookies,    setCookies]    = useState(()=>localStorage.getItem('lumi_cookies')==='1')
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
  const [userMsgCnt, setUserMsgCnt] = useState(0)
  const [selTxt,     setSelTxt]     = useState('')   // Vizualizovat výběr
  const [selPos,     setSelPos]     = useState(null)

  const endRef=useRef(null), fileRef=useRef(null), taRef=useRef(null), searchRef=useRef(null)
  const t          = THEMES[themeName]||THEMES.dark
  const isLoggedIn = !!session
  const activeConv = useMemo(()=>convs.find(c=>c.id===activeId)??convs[0]??null,[convs,activeId])

  useEffect(()=>{localStorage.setItem('theme',themeName)},[themeName])
  useEffect(()=>{localStorage.setItem('syspmt',sysPmt)},[sysPmt])
  useEffect(()=>{localStorage.setItem('aiModel',aiModel)},[aiModel])

  // Text selection for sparkle feature
  useEffect(()=>{
    const handler=()=>{
      const sel=window.getSelection()
      const txt=sel?.toString().trim()||''
      if(txt.length>5&&txt.length<300){
        setSelTxt(txt)
        const range=sel.getRangeAt(0)
        const rect=range.getBoundingClientRect()
        setSelPos({x:rect.left+rect.width/2,y:rect.top-12})
      }else{setSelTxt('');setSelPos(null)}
    }
    document.addEventListener('mouseup',handler)
    return()=>document.removeEventListener('mouseup',handler)
  },[])

  useEffect(()=>{
    if(isLoggedIn){getFreshToken().then(setToken);loadConvs()}
    else{const c=mkLocal();setConvs([c]);setActiveId(c.id);setMsgs([])}
  },[isLoggedIn]) // eslint-disable-line
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[msgs.length,activeConv?.messages?.length,loading])
  useEffect(()=>{if(activeId&&typeof window!=='undefined'&&window.innerWidth<=768)setSideOpen(false)},[activeId])

  // ── DB ──────────────────────────────────────────────────────────────────────
  async function loadConvs(){
    setDbLoad(true)
    const{data}=await supabase.from('conversations').select('*').order('updated_at',{ascending:false})
    if(data?.length>0){setConvs(data.map(c=>({...c,local:false})));setActiveId(data[0].id);await loadMsgs(data[0].id)}
    else{const c=await createConv();if(c){setConvs([{...c,local:false}]);setActiveId(c.id);setMsgs([])}}
    setDbLoad(false)
  }
  async function loadMsgs(cid){
    const{data}=await supabase.from('messages').select('*').eq('conversation_id',cid).order('created_at',{ascending:true})
    setMsgs(data??[]);setStarred(new Set((data??[]).filter(m=>m.starred).map(m=>m.id)))
    setUserMsgCnt((data??[]).filter(m=>m.role==='user').length)
  }
  async function createConv(title='Nová konverzace'){
    const{data}=await supabase.from('conversations').insert({user_id:session.user.id,title}).select().single();return data
  }
  async function saveMsg(cid,role,content,type='text',meta=null){
    const{data}=await supabase.from('messages').insert({conversation_id:cid,role,content,type,image_url:meta?JSON.stringify(meta):null}).select().single();return data
  }

  async function newConv(){
    setErr(null);setInput('');setAtts([])
    if(isLoggedIn){const c=await createConv();if(c){setConvs(p=>[{...c,local:false},...p]);setActiveId(c.id);setMsgs([]);setUserMsgCnt(0)}}
    else{const c=mkLocal();setConvs(p=>[c,...p]);setActiveId(c.id)}
    if(typeof window!=='undefined'&&window.innerWidth<=768)setSideOpen(false)
  }
  async function selectConv(id){setActiveId(id);setErr(null);if(isLoggedIn)await loadMsgs(id)}
  async function delConv(id,e){
    e.stopPropagation()
    if(isLoggedIn)await supabase.from('conversations').delete().eq('id',id)
    setConvs(prev=>{const next=prev.filter(c=>c.id!==id);const list=next.length>0?next:[mkLocal()];if(id===activeId){setActiveId(list[0].id);if(isLoggedIn&&next.length>0)loadMsgs(list[0].id);else setMsgs([])};return list})
  }
  async function renameConv(id,title){
    if(!title.trim())return
    if(isLoggedIn)await supabase.from('conversations').update({title}).eq('id',id)
    setConvs(p=>p.map(c=>c.id===id?{...c,title}:c));setEditId(null)
  }
  async function setConvColor(id,color){
    if(isLoggedIn)await supabase.from('conversations').update({color}).eq('id',id)
    setConvs(p=>p.map(c=>c.id===id?{...c,color}:c))
  }
  async function autoTitle(cid,msg){
    try{const d=await callEdge('auto_title',{messages:[{role:'user',content:[{type:'text',text:msg}]}]},token||ANON);if(d.title){if(isLoggedIn)await supabase.from('conversations').update({title:d.title}).eq('id',cid);setConvs(p=>p.map(c=>c.id===cid?{...c,title:d.title}:c))}}catch{}
  }
  const starMsg=async msg=>{
    const ns=!starred.has(msg.id)
    setStarred(p=>{const n=new Set(p);ns?n.add(msg.id):n.delete(msg.id);return n})
    if(isLoggedIn&&(msg.dbId||msg.id))await supabase.from('messages').update({starred:ns}).eq('id',msg.dbId||msg.id)
  }
  const exportChat=()=>{
    const lines=displayMsgs.map(m=>`[${m.role==='user'?'Vy':'Lumi'}] ${fmtTime(m.created_at)}\n${m.content}\n`)
    const b=new Blob([`Chat: ${activeConv?.title}\n${new Date().toLocaleString('cs-CZ')}\n\n`+lines.join('\n---\n\n')],{type:'text/plain;charset=utf-8'})
    const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`lumi-${activeConv?.title||'chat'}.txt`;a.click()
  }
  async function doSearch(q){
    setSearchQ(q)
    if(!q.trim()){setSearchRes([]);return}
    if(isLoggedIn){const{data}=await supabase.from('conversations').select('id,title,updated_at').ilike('title',`%${q}%`).limit(8);setSearchRes(data??[])}
    else setSearchRes(convs.filter(c=>c.title.toLowerCase().includes(q.toLowerCase())))
  }
  const onFile=async e=>{
    const files=Array.from(e.target.files)
    const res=await Promise.all(files.map(f=>new Promise(r=>{const rd=new FileReader();rd.onload=()=>r({id:uid(),name:f.name,type:f.type,size:f.size,data:rd.result.split(',')[1],preview:f.type.startsWith('image/')?rd.result:null});rd.readAsDataURL(f)})))
    setAtts(p=>[...p,...res]);fileRef.current.value=''
  }

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
      if(!qs.length)throw new Error('Kvíz neobsahuje otázky.')
      const aMsg={id:uid(),role:'assistant',type:'quiz',content:'🎓 Kvíz',_quizData:qs,created_at:new Date().toISOString()}
      if(isLocal)setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      else{await saveMsg(cid,'user',tmp.content,'text',null);await saveMsg(cid,'assistant','🎓 Kvíz','quiz',qs);await supabase.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',cid);setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmp,_tmp:false},aMsg])}
      addNewAnim(aMsg.id)
    }catch(e){setErr('Kvíz: '+e.message)}
    finally{setLoading(false);setQuizMode(false);setQuizTopic('')}
  }

  const addMemoryManual=async(content,category)=>{if(!isLoggedIn||!content)return;try{await callEdge('save_memory',{content,category,source:'manual'},token)}catch{}}
  const saveMemory=async c=>{if(!isLoggedIn||!c)return;try{await callEdge('save_memory',{content:c.slice(0,500),category:'general',source:'auto'},token)}catch{}}
  const explainMsg=async msg=>{setExplainTxt('Načítám…');try{const d=await callEdge('explain',{messages:[{role:'assistant',content:msg.content}],language:'Czech'},token||ANON);setExplainTxt(d.explanation||'Nepodařilo se.')}catch(e){setExplainTxt('Chyba: '+e.message)}}
  const addNewAnim=id=>{setNewIds(s=>{const n=new Set(s);n.add(id);setTimeout(()=>setNewIds(s2=>{const n2=new Set(s2);n2.delete(id);return n2}),800);return n})}

  // Vizualizovat výběr — generuje obrázek z označeného textu
  const visualizeSelection=async txt=>{
    setSelTxt('');setSelPos(null)
    const rl=checkImgRateLimit()
    if(!rl.ok){setErr(`Limit obrázků: počkejte ještě ${rl.wait} min`);return}
    setInput(txt);setImgMode('generate_image')
    setTimeout(()=>{send_img(txt)},50)
  }
  // Odeslání obrázku přímo
  const send_img=async(overrideText)=>{
    const txt=(overrideText||input).trim();if(!txt)return
    const rl=checkImgRateLimit()
    if(!rl.ok){setErr(`Limit obrázků: počkejte ještě ${rl.wait} minut (max 6 za 90 min)`);return}
    setInput('');setLoading(true);setErr(null)
    const cid=activeConv?.id,isLocal=activeConv?.local
    const tmpUser={id:uid(),role:'user',content:txt,type:'text',created_at:new Date().toISOString(),_tmp:true}
    if(isLocal)setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),tmpUser]}))
    else setMsgs(p=>[...p,tmpUser])
    try{
      recordImgUsage()
      const tk=isLoggedIn?(await getFreshToken()||ANON):ANON
      const result=await callEdge('generate_image',{messages:[{role:'user',content:txt}],imgModel},tk)
      const nid=uid()
      const aMsg={id:nid,role:'assistant',type:'generated_image',content:'🎨 Vygenerovaný obrázek',_imageData:result.imageData,_mimeType:result.mimeType,_prompt:result.prompt||txt,_modelId:imgModel,image_url:JSON.stringify({imageData:result.imageData,mimeType:result.mimeType,prompt:result.prompt||txt,modelId:imgModel}),created_at:new Date().toISOString()}
      if(isLocal)setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      else{const uRow=await saveMsg(cid,'user',txt,'text',null);await saveMsg(cid,'assistant','🎨 Vygenerovaný obrázek','generated_image',{imageData:result.imageData,mimeType:result.mimeType,prompt:result.prompt||txt,modelId:imgModel});await supabase.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',cid);setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmpUser,_tmp:false,dbId:uRow?.id},aMsg]);setUserMsgCnt(c=>c+1)}
      addNewAnim(nid)
    }catch(e){setErr('Generování: '+e.message);if(isLocal)setConvs(p=>p.map(c=>c.id===cid?{...c,messages:(c.messages??[]).filter(m=>!m._tmp)}:c));else setMsgs(p=>p.filter(m=>!m._tmp));setInput(txt)}
    finally{setLoading(false)}
  }

  const send=useCallback(async()=>{
    if(imgMode==='generate_image'){return send_img();}
    if((!input.trim()&&!atts.length)||loading||!activeConv)return
    const cid=activeConv.id,userText=input.trim()||atts.map(a=>a.name).join(', '),isLocal=activeConv.local
    const apiMode=isLoggedIn?detectAutoMode(userText,imgMode):'chat'
    const isFirst=(isLocal?activeConv.messages?.length:msgs.length)===0
    const api=[]
    atts.forEach(a=>{if(a.type.startsWith('image/'))api.push({type:'image',source:{type:'base64',media_type:a.type,data:a.data}});else api.push({type:'text',text:`[Soubor: ${a.name}]`})})
    if(input.trim())api.push({type:'text',text:input.trim()})
    const tmpUser={id:uid(),role:'user',content:userText,type:'text',created_at:new Date().toISOString(),_tmp:true,_atts:atts.map(a=>({id:a.id,name:a.name,type:a.type,preview:a.preview}))}
    setInput('');setAtts([]);setLoading(true);setErr(null)
    const prev=isLocal?(activeConv.messages??[]):msgs
    if(isLocal){setConvs(p=>p.map(c=>{if(c.id!==cid)return c;const title=isFirst?userText.slice(0,38)+(userText.length>38?'…':''):c.title;return{...c,title,messages:[...(c.messages??[]),tmpUser]}}))}
    else{setMsgs(p=>[...p,tmpUser]);if(isFirst&&activeConv.title==='Nová konverzace')autoTitle(cid,userText)}
    try{
      const history=[...prev,tmpUser].map(m=>({role:m.role,content:m.id===tmpUser.id&&api.length>0?api:[{type:'text',text:m.content}]}))
      const tk=isLoggedIn?(await getFreshToken()||ANON):ANON
      const payload={messages:history,system:sysPmt,thinking,memory}
      if(apiMode==='image_search'){}
      if(aiModel!=='default')payload.preferredModel=aiModel
      if(apiMode==='image_search'){
        const rl=checkImgRateLimit()
        if(!rl.ok){setErr(`Limit: počkejte ${rl.wait} min`);setLoading(false);setMsgs(prev);return}
      }
      const result=await callEdge(apiMode,payload,tk)
      const nid=uid();let aMsg
      if(result.type==='image_search'){
        aMsg={id:nid,role:'assistant',type:'image_search',content:`📷 ${result.images?.length??0} fotografií`,_images:result.images,_query:result.query,image_url:JSON.stringify(result.images),created_at:new Date().toISOString()}
      }else{
        aMsg={id:nid,role:'assistant',type:'text',content:result.text??'(prázdná odpověď)',created_at:new Date().toISOString()}
        setTypingIds(s=>{const n=new Set(s);n.add(nid);return n})
        setTimeout(()=>setTypingIds(s=>{const n=new Set(s);n.delete(nid);return n}),Math.min(Math.max((result.text?.length||100)*10,1000),10000))
      }
      addNewAnim(nid)
      if(isLocal){setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),aMsg]}))}
      else{
        const uRow=await saveMsg(cid,'user',userText,'text',null)
        if(aMsg.type==='image_search')await saveMsg(cid,'assistant',aMsg.content,'image_search',aMsg._images)
        else{const ar=await saveMsg(cid,'assistant',aMsg.content,'text',null);if(ar)aMsg.dbId=ar.id}
        await supabase.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',cid)
        setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmpUser,_tmp:false,dbId:uRow?.id},aMsg])
        setUserMsgCnt(c=>c+1)
      }
    }catch(e){setErr('Chyba: '+e.message);if(isLocal)setConvs(p=>p.map(c=>c.id===cid?{...c,messages:prev}:c));else setMsgs(prev);setInput(userText)}
    finally{setLoading(false)}
  },[input,atts,loading,activeConv,msgs,isLoggedIn,imgMode,sysPmt,thinking,memory,token,imgModel,aiModel]) // eslint-disable-line

  const onKey=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}
  const displayMsgs=showStarred?(activeConv?.local?(activeConv.messages??[]):msgs).filter(m=>starred.has(m.id)):(activeConv?.local?(activeConv.messages??[]):msgs)
  const canSend=(input.trim()||atts.length>0)&&!loading
  const userInitial=session?(session.user.user_metadata?.full_name||session.user.email||'U')[0].toUpperCase():'?'
  const currentAILabel=AI_MODELS.find(m=>m.id===aiModel)?.short||'Auto'

  function getImgData(msg){
    if(msg._images||msg._imageData||msg._quizData)return msg
    if(msg.image_url){try{const p=JSON.parse(msg.image_url);if(msg.type==='quiz')return{...msg,_quizData:Array.isArray(p)?p:[p]};if(msg.type==='generated_image')return{...msg,_imageData:p.imageData,_mimeType:p.mimeType,_prompt:p.prompt,_modelId:p.modelId};if(msg.type==='image_search')return{...msg,_images:Array.isArray(p)?p:undefined,_query:msg.content};if(Array.isArray(p))return{...msg,_images:p,_query:msg.content};if(p.imageData)return{...msg,_imageData:p.imageData,_mimeType:p.mimeType,_prompt:p.prompt,_modelId:p.modelId}}catch{return msg}}
    return msg
  }

  const phs={chat:thinking?'💭 Deep Thinking…':'Napište zprávu… (Enter = odeslat)',image_search:'🔍 Popište co hledáte…',generate_image:'🎨 Popište obrázek…'}

  const css=`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${t.scrl};border-radius:3px}
    ::-webkit-scrollbar-thumb:hover{background:${t.accent}66}
    textarea,input{font-family:inherit}textarea{resize:none;outline:none;border:none;background:transparent}input{outline:none;border:none;background:transparent}button{cursor:pointer;border:none;background:none;font-family:inherit}

    /* ── Core animations ── */
    @keyframes slideUp{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes fadeInScale{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
    @keyframes dropIn{from{opacity:0;transform:translateY(10px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes imgReveal{from{opacity:0;filter:blur(8px);transform:scale(.96)}to{opacity:1;filter:blur(0);transform:scale(1)}}
    @keyframes sparkleIn{from{opacity:0;transform:translateY(8px) scale(.85)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes checkIn{from{opacity:0;transform:scale(.3) rotate(-20deg)}to{opacity:1;transform:scale(1) rotate(0deg)}}
    @keyframes slideUpBanner{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}

    /* ── Aurora/ambient background ── */
    @keyframes auroraFloat{0%,100%{transform:translateX(-50%) scale(1) rotate(0deg)}33%{transform:translateX(-52%) scale(1.12) rotate(2deg)}66%{transform:translateX(-48%) scale(1.08) rotate(-2deg)}}
    @keyframes auroraFloat2{0%,100%{transform:scale(1) rotate(0deg);opacity:.6}50%{transform:scale(1.2) rotate(5deg);opacity:.9}}

    /* ── Message animations ── */
    @keyframes msgBounce{0%{opacity:0;transform:translateY(18px) scale(.93)}55%{transform:translateY(-4px) scale(1.015)}80%{transform:translateY(1px) scale(.998)}100%{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes msgSlideRight{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
    @keyframes msgSlideLeft{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}

    /* ── Typing/loading ── */
    @keyframes pu{0%,100%{opacity:.15;transform:scale(.7) translateY(2px)}50%{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    @keyframes thinkPulse{0%,100%{opacity:.4;transform:scale(.95)}50%{opacity:1;transform:scale(1)}}
    @keyframes thinkSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}

    /* ── Button/UI animations ── */
    @keyframes livePulse{0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,.5)}70%{box-shadow:0 0 0 10px rgba(248,113,113,0)}}
    @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
    @keyframes sendPop{0%{transform:scale(1)}30%{transform:scale(.88)}70%{transform:scale(1.12)}100%{transform:scale(1)}}
    @keyframes starPop{0%{transform:scale(1)}40%{transform:scale(1.4) rotate(15deg)}100%{transform:scale(1) rotate(0deg)}}
    @keyframes ripple{from{transform:scale(0);opacity:.6}to{transform:scale(3);opacity:0}}

    /* ── Welcome screen ── */
    @keyframes welcomeFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes hintAppear{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

    /* ── Sidebar ── */
    @keyframes convAppear{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}

    /* ── Image generation progress ── */
    @keyframes progressPulse{0%,100%{opacity:.4}50%{opacity:1}}
    @keyframes shimmer{from{background-position:-200% 0}to{background-position:200% 0}}

    /* ── Class applications ── */
    .msg-new-ai{animation:msgBounce .55s cubic-bezier(.34,1.56,.64,1) both}
    .msg-new-user{animation:msgSlideRight .35s cubic-bezier(.34,1.56,.64,1) both}
    .msg-old{animation:fadeIn .2s ease both}
    .dot span{display:inline-block;width:7px;height:7px;border-radius:50%;background:${t.accent};margin:0 2.5px;animation:pu 1.4s infinite ease-in-out}
    .dot span:nth-child(2){animation-delay:.22s}.dot span:nth-child(3){animation-delay:.44s}
    .cr:hover{background:${t.active}!important}.cr:hover .cr-act{opacity:1!important}
    .cr{transition:background .12s ease,border-left-color .15s ease}
    .ib:hover{opacity:.65}
    .ib{transition:opacity .15s}
    .err-shake{animation:shake .5s ease}
    .hint-btn{animation:hintAppear .4s ease both}
    .hint-btn:nth-child(1){animation-delay:.05s}
    .hint-btn:nth-child(2){animation-delay:.1s}
    .hint-btn:nth-child(3){animation-delay:.15s}
    .hint-btn:nth-child(4){animation-delay:.2s}
    .conv-item{animation:convAppear .25s ease both}
    .send-active{animation:sendPop .25s ease}
    .star-active{animation:starPop .35s cubic-bezier(.34,1.56,.64,1)}
    .shimmer{background:linear-gradient(90deg,${t.btn} 25%,${t.active} 50%,${t.btn} 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}

    @media(max-width:768px){.sidebar{position:fixed!important;top:0;left:0;bottom:0;z-index:30;box-shadow:4px 0 32px rgba(0,0,0,.6)}.sov{display:block!important}}
  `

  return (
    <div style={{display:'flex',height:'100dvh',overflow:'hidden',background:t.bg,color:t.txt,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <style>{css}</style>

      {/* Sparkle — Vizualizovat výběr */}
      {selTxt&&selPos&&isLoggedIn&&imgMode==='chat'&&(
        <div style={{position:'fixed',top:selPos.y,left:selPos.x,transform:'translate(-50%,-100%)',zIndex:70}}>
          <SparkleBtn t={t} selectedText={selTxt} onGenerate={visualizeSelection}/>
        </div>
      )}

      {sideOpen&&<div className="sov" onClick={()=>setSideOpen(false)} style={{display:'none',position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:29}}/>}

      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
      {sideOpen&&(
        <aside className="sidebar" style={{width:272,background:t.side,borderRight:`1px solid ${t.border}`,display:'flex',flexDirection:'column',flexShrink:0}}>
          <div style={{padding:'13px 12px',borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:9}}>
              <LumiAvatar size={28} gradient={[t.gradA,t.gradB]}/>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontWeight:700,fontSize:14,color:t.txt,letterSpacing:'-.3px'}}>Lumi</span>
                  <span style={{fontSize:9,background:'#f59e0b22',color:'#f59e0b',padding:'1px 5px',borderRadius:3,fontWeight:700}}>BETA</span>
                </div>
                <div style={{fontSize:10,color:t.muted}}>Váš inteligentní asistent</div>
              </div>
            </div>
            <div style={{display:'flex',gap:4}}>
              <button className="ib" onClick={()=>{setSearchOpen(o=>!o);setTimeout(()=>searchRef.current?.focus(),100)}}
                style={{color:t.muted,display:'flex',padding:6,borderRadius:6,background:searchOpen?t.active:'transparent'}}>{Ic.search}</button>
              <button onClick={newConv} style={{background:t.accent,color:'#fff',borderRadius:7,padding:'5px 9px',display:'flex',alignItems:'center'}}>{Ic.plus}</button>
            </div>
          </div>

          {searchOpen&&(
            <div style={{padding:'8px 10px',borderBottom:`1px solid ${t.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:7,padding:'7px 10px',background:t.inBg,border:`1px solid ${t.inBrd}`,borderRadius:9}}>
                <span style={{color:t.muted,flexShrink:0}}>{Ic.search}</span>
                <input ref={searchRef} value={searchQ} onChange={e=>doSearch(e.target.value)} placeholder="Hledat…" style={{flex:1,fontSize:13,color:t.txt}}/>
                {searchQ&&<button onClick={()=>{setSearchQ('');setSearchRes([])}} style={{color:t.muted,display:'flex',padding:2}}>{Ic.x}</button>}
              </div>
              {searchRes.map(c=>(
                <div key={c.id} onClick={()=>{selectConv(c.id);setSearchOpen(false);setSearchQ('');setSearchRes([])}}
                  style={{padding:'7px 9px',borderRadius:7,cursor:'pointer',fontSize:13,color:t.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:4}}
                  onMouseOver={e=>e.currentTarget.style.background=t.active} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  🔍 {c.title}
                </div>
              ))}
            </div>
          )}

          <div style={{flex:1,overflowY:'auto',padding:'5px'}}>
            {dbLoad?<div style={{padding:16,textAlign:'center',fontSize:12,color:t.muted}}>Načítám…</div>
              :convs.map((c,ci)=>(
                <div key={c.id} className="cr conv-item" onClick={()=>selectConv(c.id)}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'7px 9px',borderRadius:8,cursor:'pointer',marginBottom:2,transition:'background .12s',background:c.id===activeId?t.active:'transparent',borderLeft:`3px solid ${c.id===activeId?(c.color||t.accent):(c.color||'transparent')}`,animationDelay:`${Math.min(ci*0.035,0.25)}s`}}>
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
                    <button className="ib" onClick={e=>{e.stopPropagation();setEditId(c.id);setEditTitle(c.title)}} style={{color:t.muted,display:'flex',padding:4,borderRadius:5}}>{Ic.edit}</button>
                    <button className="ib" onClick={e=>delConv(c.id,e)} style={{color:t.muted,display:'flex',padding:4,borderRadius:5}}>{Ic.trash}</button>
                  </div>
                </div>
              ))}
          </div>

          <div style={{padding:'10px 11px',borderTop:`1px solid ${t.border}`}}>
            {isLoggedIn?(
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${t.gradA}33,${t.gradB}33)`,border:`1px solid ${t.gradA}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:t.accent,flexShrink:0}}>{userInitial}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:t.txt,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{session.user.user_metadata?.full_name||session.user.email}</div>
                  <div style={{fontSize:10,color:t.muted}}>{userMsgCnt>0?`${userMsgCnt} ${userMsgCnt===1?'zpráva':userMsgCnt<5?'zprávy':'zpráv'}`:'Přihlášen'}</div>
                </div>
                <button className="ib" onClick={()=>supabase.auth.signOut()} style={{color:t.muted,display:'flex',padding:4}}>{Ic.out}</button>
              </div>
            ):(
              <button onClick={()=>setShowAuth(true)}
                style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'9px 12px',borderRadius:9,background:t.btn,border:`1px solid ${t.border}`,color:t.muted,fontSize:13,fontWeight:500}}>
                <span style={{color:t.accent}}>{Ic.user}</span><span>Přihlásit se</span>
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
            <span style={{fontWeight:600,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activeConv?.title||'Lumi'}</span>
            {aiModel!=='default'&&<span style={{fontSize:10,background:t.purple+'22',color:t.purple,padding:'2px 7px',borderRadius:4,flexShrink:0,fontWeight:600}}>{currentAILabel}</span>}
            {thinking&&<span style={{fontSize:10,background:t.purple+'22',color:t.purple,padding:'2px 7px',borderRadius:4,flexShrink:0,fontWeight:600,animation:'thinkPulse 1.5s infinite'}}>💭</span>}
          </div>
          <div style={{display:'flex',gap:3,alignItems:'center',flexShrink:0}}>
            {isLoggedIn&&(
              <button className="ib" onClick={()=>setShowAddMem(true)} title="Přidat do paměti"
                style={{display:'flex',padding:'5px 8px',borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`}}>
                {Ic.addMem}
              </button>
            )}
            <button className="ib" onClick={()=>setShowStarred(s=>!s)} title="Oblíbené"
              style={{display:'flex',padding:'5px 8px',borderRadius:7,background:showStarred?'#f59e0b22':t.btn,color:showStarred?'#f59e0b':t.muted,border:`1px solid ${showStarred?'#f59e0b':t.border}`}}>
              {showStarred?Ic.starF:Ic.star}
            </button>
            <button className="ib" onClick={exportChat} title="Export"
              style={{display:'flex',padding:'5px 8px',borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`}}>
              {Ic.export}
            </button>
            <button className="ib" onClick={()=>setMdMode(m=>!m)} title="Markdown"
              style={{display:'flex',alignItems:'center',gap:2,padding:'5px 8px',borderRadius:7,background:mdMode?t.accent+'22':t.btn,color:mdMode?t.accent:t.muted,border:`1px solid ${mdMode?t.accent:t.border}`,fontSize:11}}>
              MD
            </button>
            <button className="ib" onClick={()=>setShowSet(true)} title="Nastavení"
              style={{display:'flex',padding:'5px 8px',borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`}}>
              {Ic.gear}
            </button>
            <button className="ib" onClick={()=>setThemeName(n=>{const ks=Object.keys(THEMES);return ks[(ks.indexOf(n)+1)%ks.length]})} title="Téma"
              style={{display:'flex',padding:'5px 8px',borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`,fontSize:14}}>
              {THEME_LIST.find(th=>th.id===themeName)?.icon||'🎨'}
            </button>
            {/* Přihlásit — přesunuto sem, ale bez červené barvy */}
            {!isLoggedIn&&(
              <button onClick={()=>setShowAuth(true)} title="Přihlásit se"
                style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:8,background:t.btn,color:t.muted,border:`1px solid ${t.border}`,cursor:'pointer'}}>
                {Ic.user}
              </button>
            )}
          </div>
        </header>

        {/* Info bars */}
        {explainTxt&&(
          <div style={{padding:'10px 14px',background:t.purple+'18',borderBottom:`1px solid ${t.purple}44`,display:'flex',alignItems:'flex-start',gap:8,fontSize:13,animation:'fadeIn .3s ease'}}>
            <span style={{color:t.purple,flexShrink:0,marginTop:1}}>{Ic.info}</span>
            <span style={{color:t.txt,flex:1,lineHeight:1.5}}>{explainTxt}</span>
            <button onClick={()=>setExplainTxt(null)} style={{color:t.muted,display:'flex',padding:3,flexShrink:0}}>{Ic.x}</button>
          </div>
        )}
        {showStarred&&(
          <div style={{padding:'7px 14px',background:'#f59e0b22',borderBottom:`1px solid #f59e0b44`,display:'flex',alignItems:'center',gap:8,fontSize:12,animation:'fadeIn .3s ease'}}>
            <span style={{color:'#f59e0b'}}>⭐</span><span style={{color:t.txt}}>Oblíbené zprávy ({displayMsgs.length})</span>
            <button onClick={()=>setShowStarred(false)} style={{color:t.muted,display:'flex',padding:3,marginLeft:'auto'}}>{Ic.x}</button>
          </div>
        )}

        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:'16px 14px',display:'flex',flexDirection:'column',gap:12,position:'relative'}}>
          {displayMsgs.length===0&&!loading&&(
            <div style={{textAlign:'center',marginTop:'7vh',padding:'0 16px',animation:'fadeIn .5s ease',position:'relative'}}>
              <AuroraBeam t={t}/>
              <div style={{position:'relative',zIndex:1}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:16,animation:'welcomeFloat 4s ease-in-out infinite'}}>
                  <LumiAvatar size={64} gradient={[t.gradA,t.gradB]}/>
                </div>
                <div style={{fontSize:23,fontWeight:700,marginBottom:8,color:t.txt}}>
                  {showStarred?'Žádné oblíbené zprávy':`Ahoj! Jsem ${APP_NAME}.`}
                </div>
                {!showStarred&&(
                  <>
                    <div style={{fontSize:13,color:t.muted,marginBottom:20,lineHeight:1.6}}>
                      {isLoggedIn?'Chat · AI Obrázky · Fotografie · Kvízy · Live · Hlas':'Začněte psát — přihlášení není potřeba'}
                    </div>
                    <div style={{display:'flex',gap:7,justifyContent:'center',flexWrap:'wrap',maxWidth:520,margin:'0 auto'}}>
                      {(isLoggedIn?['Jak funguje kvantové počítání?','Najdi fotky Prahy','Vygeneruj: forest at sunset','Kvíz o historii ČR']:['Jak funguje AI?','Napiš mi báseň','Co je strojové učení?','Pomoz mi s kódem']).map(hint=>(
                        <button key={hint} onClick={()=>setInput(hint)} className="hint-btn"
                          style={{padding:'7px 14px',borderRadius:20,background:t.btn,border:`1px solid ${t.border}`,color:t.muted,fontSize:12,transition:'all .25s cubic-bezier(.34,1.56,.64,1)',cursor:'pointer'}}
                          onMouseOver={e=>{e.currentTarget.style.borderColor=t.accent;e.currentTarget.style.color=t.txt;e.currentTarget.style.transform='translateY(-3px) scale(1.03)';e.currentTarget.style.boxShadow=`0 6px 20px ${t.accent}30`}}
                          onMouseOut={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.color=t.muted;e.currentTarget.style.transform='translateY(0) scale(1)';e.currentTarget.style.boxShadow='none'}}>
                          {hint}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {displayMsgs.map(msg=>{
            const m=getImgData(msg),isWide=['image_search','generated_image','quiz'].includes(msg.type)
            const isStar=starred.has(msg.id),isNew=newIds.has(msg.id),isTyp=typingIds.has(msg.id)
            const animCls=isNew?(msg.role==='user'?'msg-new-user':'msg-new-ai'):'msg-old'
            return (
              <div key={msg.id} className={animCls}
                style={{display:'flex',gap:8,justifyContent:msg.role==='user'?'flex-end':'flex-start',alignItems:'flex-start'}}>
                {msg.role==='assistant'&&<LumiAvatar size={28} gradient={[t.gradA,t.gradB]}/>}
                <div style={{maxWidth:isWide?'94%':'80%',minWidth:40}}>
                  {msg._atts?.length>0&&(
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6,justifyContent:'flex-end'}}>
                      {msg._atts.map(a=>a.preview
                        ?<img key={a.id} src={a.preview} alt={a.name} style={{height:60,width:60,objectFit:'cover',borderRadius:8,border:`1px solid ${t.border}`}}/>
                        :<div key={a.id} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 9px',background:t.pill,borderRadius:7,fontSize:12,color:t.txt}}>{a.type.includes('pdf')?Ic.pdf:Ic.file}<span style={{maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name.length>16?a.name.slice(0,14)+'…':a.name}</span></div>
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
                          ?isTyp?<TypingText text={msg.content} isDark={t.isDark} useMarkdown={mdMode} onDone={()=>setTypingIds(s=>{const n=new Set(s);n.delete(msg.id);return n})}/>
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
                  <div style={{width:28,height:28,borderRadius:8,background:isLoggedIn?t.accent+'88':t.ua,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:600,color:'#fff',flexShrink:0,marginTop:2}}>{isLoggedIn?userInitial:'?'}</div>
                )}
              </div>
            )
          })}

          {loading&&(
            <div style={{display:'flex',gap:8,alignItems:'flex-start',animation:'fadeIn .25s ease'}} className="msg-new-ai">
              <LumiAvatar size={28} gradient={[t.gradA,t.gradB]}/>
              <div style={{padding:'12px 16px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`,minWidth:80}}>
                {imgMode==='generate_image'
                  ? <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${t.purple}`,borderTopColor:'transparent',animation:'thinkSpin .8s linear infinite'}}/>
                      <span style={{fontSize:13,color:t.muted}}>Generuji obrázek (30–90 s)…</span>
                    </div>
                  : imgMode==='image_search'
                    ? <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${t.accent}`,borderTopColor:'transparent',animation:'thinkSpin .8s linear infinite'}}/>
                        <span style={{fontSize:13,color:t.muted}}>Hledám fotografie…</span>
                      </div>
                    : thinking
                      ? <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${t.purple}`,borderTopColor:'transparent',animation:'thinkSpin 1s linear infinite'}}/>
                          <span style={{fontSize:13,color:t.purple,animation:'thinkPulse 1.5s infinite'}}>Lumi přemýšlí…</span>
                        </div>
                      : <div className="dot"><span/><span/><span/></div>
                }
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

          {/* Toolbar */}
          {isLoggedIn&&(
            <div style={{display:'flex',gap:5,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>

              {/* Live */}
              <button onClick={()=>setShowLive(true)}
                style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:8,fontSize:12,fontWeight:600,background:'rgba(239,68,68,.15)',color:'#f87171',border:'1px solid rgba(239,68,68,.3)',animation:'livePulse 2s infinite',cursor:'pointer',fontFamily:'inherit'}}>
                {Ic.live} Live
              </button>

              {/* Nástroje */}
              <ToolDropdown t={t} label="Nástroje" icon={Ic.wand} active={imgMode!=='chat'||quizMode}>
                <div style={{padding:'6px 0'}}>
                  {[{id:'chat',icon:'💬',label:'Chat',color:t.accent},{id:'generate_image',icon:'🎨',label:'AI Obrázek',sub:'Pollinations.ai',color:t.purple},{id:'image_search',icon:'📷',label:'Hledat fotografie',sub:'Unsplash',color:t.green}].map(item=>(
                    <button key={item.id} onClick={()=>setImgMode(item.id)}
                      style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:imgMode===item.id?item.color+'22':'transparent',color:imgMode===item.id?item.color:t.txt,fontSize:13,fontFamily:'inherit',textAlign:'left',cursor:'pointer',borderRadius:8,border:'none',transition:'all .15s'}}>
                      <span style={{fontSize:16}}>{item.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:imgMode===item.id?600:400}}>{item.label}</div>
                        {item.sub&&<div style={{fontSize:10,color:t.muted}}>{item.sub}</div>}
                      </div>
                      {imgMode===item.id&&<span style={{color:item.color}}>{Ic.check}</span>}
                    </button>
                  ))}
                  <div style={{margin:'4px 12px',borderTop:`1px solid ${t.border}`}}/>
                  <button onClick={()=>setQuizMode(m=>!m)}
                    style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:quizMode?'#f59e0b22':'transparent',color:quizMode?'#f59e0b':t.txt,fontSize:13,fontFamily:'inherit',textAlign:'left',cursor:'pointer',borderRadius:8,border:'none',transition:'all .15s'}}>
                    <span style={{fontSize:16}}>🎓</span>
                    <div style={{fontWeight:quizMode?600:400}}>Kvíz</div>
                    {quizMode&&<span style={{color:'#f59e0b'}}>{Ic.check}</span>}
                  </button>
                </div>
              </ToolDropdown>

              {/* Model */}
              <ToolDropdown t={t} label="Model" icon={Ic.model} accent={t.purple} active={aiModel!=='default'||thinking}>
                <div style={{padding:'6px 0'}}>
                  <div style={{fontSize:10,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',padding:'4px 12px 6px'}}>Chat</div>
                  {AI_MODELS.map(m=>(
                    <button key={m.id} onClick={()=>setAiModel(m.id)}
                      style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:aiModel===m.id?t.purple+'22':'transparent',color:aiModel===m.id?t.purple:t.txt,fontSize:12,fontFamily:'inherit',textAlign:'left',cursor:'pointer',borderRadius:8,border:'none',transition:'all .15s'}}>
                      <div style={{flex:1}}><div style={{fontWeight:aiModel===m.id?600:400}}>{m.name}</div><div style={{fontSize:10,color:t.muted,marginTop:1}}>{m.desc}</div></div>
                      {aiModel===m.id&&<span style={{color:t.purple,flexShrink:0}}>{Ic.check}</span>}
                    </button>
                  ))}
                  <div style={{margin:'4px 12px',borderTop:`1px solid ${t.border}`}}/>
                  <button onClick={()=>setThinking(x=>!x)}
                    style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:thinking?t.purple+'22':'transparent',color:thinking?t.purple:t.txt,fontSize:12,fontFamily:'inherit',textAlign:'left',cursor:'pointer',borderRadius:8,border:'none',transition:'all .15s'}}>
                    <span style={{fontSize:14}}>💭</span>
                    <div style={{flex:1}}><div style={{fontWeight:thinking?600:400}}>Deep Thinking</div><div style={{fontSize:10,color:t.muted,marginTop:1}}>Gemini 2.5 — pomalejší, přesnější</div></div>
                    {thinking&&<span style={{color:t.purple,flexShrink:0}}>{Ic.check}</span>}
                  </button>
                  {imgMode==='generate_image'&&(
                    <>
                      <div style={{margin:'4px 12px',borderTop:`1px solid ${t.border}`}}/>
                      <div style={{fontSize:10,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',padding:'4px 12px 6px'}}>Obrázky · Pollinations.ai</div>
                      {IMG_MODELS.map(m=>(
                        <button key={m.id} onClick={()=>setImgModel(m.id)}
                          style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:imgModel===m.id?t.purple+'22':'transparent',color:imgModel===m.id?t.purple:t.txt,fontSize:12,fontFamily:'inherit',textAlign:'left',cursor:'pointer',borderRadius:8,border:'none',transition:'all .15s'}}>
                          <div style={{flex:1}}><div style={{fontWeight:imgModel===m.id?600:400}}>{m.name}</div><div style={{fontSize:10,color:t.muted,marginTop:1}}>{m.desc}</div></div>
                          {imgModel===m.id&&<span style={{color:t.purple,flexShrink:0}}>{Ic.check}</span>}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </ToolDropdown>

              {/* Aktivní mód + limit badge */}
              {imgMode!=='chat'&&<span style={{fontSize:11,padding:'3px 8px',borderRadius:5,background:imgMode==='generate_image'?t.purple+'22':'rgba(34,197,94,.15)',color:imgMode==='generate_image'?t.purple:t.green,fontWeight:600}}>
                {imgMode==='generate_image'?`🎨 ${IMG_MODELS.find(m=>m.id===imgModel)?.name||'Pollinations'}`:' 📷 Fotky'}
              </span>}
              {imgMode==='generate_image'&&<ImgLimitBadge t={t}/>}
            </div>
          )}

          {/* Quiz panel */}
          {quizMode&&(
            <div style={{marginBottom:8,padding:'12px',background:t.tag,borderRadius:10,border:`1px solid #f59e0b44`,animation:'dropIn .25s cubic-bezier(.34,1.56,.64,1)'}}>
              <input value={quizTopic} onChange={e=>setQuizTopic(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendQuiz()}
                placeholder="Téma kvízu…"
                style={{width:'100%',padding:'8px 12px',background:t.inBg,color:t.txt,border:`1.5px solid #f59e0b`,borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit',marginBottom:10,boxSizing:'border-box'}}/>
              <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12,color:t.muted,flexShrink:0}}>Počet:</span>
                  <div style={{display:'flex',gap:4}}>{QUIZ_COUNTS.map(n=>(
                    <button key={n} onClick={()=>setQuizCount(n)}
                      style={{padding:'4px 8px',borderRadius:6,background:quizCount===n?'#f59e0b':t.btn,color:quizCount===n?'#fff':t.muted,fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:quizCount===n?700:400,minWidth:28,transition:'all .15s'}}>
                      {n}
                    </button>
                  ))}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12,color:t.muted,flexShrink:0}}>Obtížnost:</span>
                  <div style={{display:'flex',gap:4}}>{QUIZ_DIFFS.map(([v,l])=>(
                    <button key={v} onClick={()=>setQuizDiff(v)}
                      style={{padding:'4px 9px',borderRadius:6,background:quizDiff===v?'#f59e0b':t.btn,color:quizDiff===v?'#fff':t.muted,fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:quizDiff===v?700:400,transition:'all .15s'}}>
                      {l}
                    </button>
                  ))}</div>
                </div>
                <button onClick={sendQuiz} disabled={!quizTopic.trim()||loading}
                  style={{padding:'6px 16px',borderRadius:8,background:'#f59e0b',color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit',opacity:!quizTopic.trim()?0.5:1,marginLeft:'auto',transition:'all .15s'}}>
                  Start 🎓
                </button>
              </div>
            </div>
          )}

          {/* Attachments */}
          {atts.length>0&&(
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
              {atts.map(a=>(
                <div key={a.id} style={{position:'relative',animation:'sparkleIn .25s ease'}}>
                  {a.preview?<img src={a.preview} alt={a.name} style={{height:46,width:46,objectFit:'cover',borderRadius:7,border:`1px solid ${t.border}`,display:'block'}}/>
                    :<div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 9px',background:t.pill,borderRadius:7,fontSize:12,color:t.txt}}>
                      {a.type.includes('pdf')?Ic.pdf:Ic.file}
                      <span style={{maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name.length>16?a.name.slice(0,14)+'…':a.name}</span>
                    </div>}
                  <button onClick={()=>setAtts(p=>p.filter(x=>x.id!==a.id))}
                    style={{position:'absolute',top:-5,right:-5,width:16,height:16,borderRadius:'50%',background:t.danger,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',border:'none',cursor:'pointer'}}>
                    {Ic.x}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input box — hlas je teď uvnitř */}
          <div style={{display:'flex',alignItems:'flex-end',gap:6,padding:'9px 11px',background:t.inBg,border:`1.5px solid ${imgMode!=='chat'?t.purple:thinking?t.purple:t.inBrd}`,borderRadius:14,transition:'border-color .2s'}}>
            <textarea ref={taRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
              placeholder={phs[imgMode]} rows={1}
              style={{flex:1,fontSize:14,lineHeight:1.5,color:t.txt,caretColor:t.accent,maxHeight:120,overflowY:'auto',paddingTop:2}}
              onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'}}/>
            <div style={{display:'flex',gap:3,alignItems:'center',flexShrink:0}}>
              {input.length>80&&<span style={{fontSize:10,color:input.length>1800?t.danger:input.length>1200?'#f59e0b':t.muted,flexShrink:0}}>{input.length}</span>}
              {/* Hlas přesunut sem */}
              <VoiceBtn t={t} compact onTranscript={txt=>{setInput(txt);setTimeout(()=>taRef.current?.focus(),100)}}/>
              <button className="ib" onClick={()=>fileRef.current.click()} style={{color:t.muted,display:'flex',padding:5}} title="Přidat soubor">{Ic.clip}</button>
              <button onClick={send} disabled={!canSend}
                style={{width:34,height:34,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',background:canSend?(imgMode==='generate_image'||thinking?t.purple:t.accent):t.btn,color:canSend?'#fff':t.muted,transition:'all .2s cubic-bezier(.34,1.56,.64,1)',transform:canSend?'scale(1)':'scale(.92)',flexShrink:0,border:'none',cursor:canSend?'pointer':'default',boxShadow:canSend?`0 4px 14px ${imgMode==='generate_image'||thinking?t.purple:t.accent}44`:'none'}}
                onMouseOver={e=>{if(canSend)e.currentTarget.style.transform='scale(1.1)'}}
                onMouseOut={e=>{if(canSend)e.currentTarget.style.transform='scale(1)'}}>
                {Ic.send}
              </button>
            </div>
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.docx,.xlsx,.pptx,.py,.js,.ts,.html,.css" style={{display:'none'}} onChange={onFile}/>

          {/* Beta disclaimer */}
          <div style={{fontSize:10,color:t.muted,textAlign:'center',marginTop:6,lineHeight:1.5}}>
            <span style={{background:'#f59e0b22',color:'#f59e0b',padding:'1px 5px',borderRadius:3,fontWeight:700,marginRight:5}}>BETA</span>
            Lumi může dělat chyby — vždy ověřte důležité informace
            {isLoggedIn?' · Paměť + Historie v Supabase':' · Přihlaste se pro plné funkce'}
          </div>
        </div>
      </main>

      {/* Modals */}
      {showAuth   &&<AuthModal onClose={()=>setShowAuth(false)} dark={t.isDark}/>}
      {showSet    &&<SettingsModal t={t} themeName={themeName} setThemeName={setThemeName} sysPmt={sysPmt} setSysPmt={setSysPmt} onClose={()=>setShowSet(false)} isLoggedIn={isLoggedIn} userId={session?.user?.id} memory={memory} setMemory={setMemory} aiModel={aiModel} setAiModel={setAiModel} onAddMemory={()=>setShowAddMem(true)}/>}
      {showLive   &&<LiveModal t={t} onClose={()=>setShowLive(false)} sysPmt={sysPmt} token={token}/>}
      {showAddMem &&<AddMemoryModal t={t} onClose={()=>setShowAddMem(false)} onSave={addMemoryManual}/>}

      {/* Cookie banner */}
      {!cookies&&<CookieBanner t={t} onAccept={()=>{setCookies(true);localStorage.setItem('lumi_cookies','1')}}/>}
    </div>
  )
}
