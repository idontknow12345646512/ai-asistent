import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { supabase } from './supabase'
import AuthModal from './AuthModal'
import LiveModal from './LiveModal'
import {
  ANON, SYS_DEFAULT, CONV_COLORS, IMG_MODELS, AI_MODELS, LIVE_MODELS,
  WEB_SEARCH_TYPES, PERSONAS, QUIZ_COUNTS, QUIZ_DIFFS, MEM_CATEGORIES,
  THEMES, THEME_LIST, Ic, LumiAvatar, POLLEN_LIMIT,
  uid, fmtTime, fmtRelTime, fmtDate, callEdge, detectIntent, detectAutoMode,
  detectMemoryInfo, mkLocal, renderMD, getNowCtx, getPollenCache, setPollenCache,
} from './constants.jsx'

async function getFreshToken(){
  const{data}=await supabase.auth.refreshSession()
  if(data?.session)return data.session.access_token
  const{data:d2}=await supabase.auth.getSession()
  return d2?.session?.access_token??null
}

// ── TypingText ────────────────────────────────────────────────────────────────
const TypingText=memo(function TypingText({text,isDark,useMarkdown,onDone}){
  const[shown,setShown]=useState(''),[fin,setFin]=useState(false)
  useEffect(()=>{
    setShown('');setFin(false)
    if(!text){setFin(true);onDone?.();return}
    let i=0;const sp=text.length>800?6:text.length>300?8:10
    const id=setInterval(()=>{i+=sp;if(i>=text.length){setShown(text);setFin(true);clearInterval(id);onDone?.()}else setShown(text.slice(0,i))},12)
    return()=>clearInterval(id)
  },[text]) // eslint-disable-line
  if(fin&&useMarkdown)return<div style={{fontSize:14,lineHeight:1.7,wordBreak:'break-word'}} dangerouslySetInnerHTML={{__html:renderMD(text,isDark)}}/>
  return<div style={{fontSize:14,lineHeight:1.65,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{shown}{!fin&&<span style={{animation:'blink 1s infinite',display:'inline-block',width:2,height:14,background:'currentColor',marginLeft:1,verticalAlign:'text-bottom'}}/>}</div>
})

// ── AuroraBeam ────────────────────────────────────────────────────────────────
const AuroraBeam=memo(function AuroraBeam({t}){
  return(
    <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:0}}>
      <div style={{position:'absolute',top:'-15%',left:'50%',transform:'translateX(-50%)',width:'75%',height:'65%',background:`radial-gradient(ellipse at center,${t.gradA}20 0%,${t.gradB}12 40%,transparent 70%)`,animation:'auroraFloat 9s ease-in-out infinite',borderRadius:'50%',filter:'blur(48px)'}}/>
      <div style={{position:'absolute',top:'5%',left:'10%',width:'35%',height:'45%',background:`radial-gradient(ellipse at center,${t.gradB}12 0%,transparent 70%)`,animation:'auroraFloat2 13s ease-in-out infinite',borderRadius:'50%',filter:'blur(56px)'}}/>
    </div>
  )
})

// ── PollenBadge ───────────────────────────────────────────────────────────────
const PollenBadge=memo(function PollenBadge({t,imgModel,pollenInfo}){
  const cost=IMG_MODELS.find(m=>m.id===imgModel)?.cost||1
  const rem=pollenInfo?.remaining??POLLEN_LIMIT
  const pct=Math.max(0,Math.min(100,Math.round((rem/POLLEN_LIMIT)*100)))
  const clr=rem<=0?t.danger:rem<10?'#f59e0b':t.green
  const[countdown,setCountdown]=useState('')
  useEffect(()=>{
    const resetAt=pollenInfo?.resetAt
    if(!resetAt||rem>0){setCountdown('');return}
    const tick=()=>{const diff=new Date(resetAt).getTime()-Date.now();if(diff<=0){setCountdown('reset!');return};const m=Math.floor(diff/60000),s=Math.floor((diff%60000)/1000);setCountdown(`${m}:${String(s).padStart(2,'0')}`)}
    tick();const id=setInterval(tick,1000);return()=>clearInterval(id)
  },[pollenInfo?.resetAt,rem])
  return(
    <div style={{display:'flex',alignItems:'center',gap:5,padding:'3px 8px',borderRadius:6,background:t.tag,border:`1px solid ${t.border}`,fontSize:11,flexShrink:0}}>
      <span>🌸</span>
      <span style={{color:clr,fontWeight:700}}>{rem}/{POLLEN_LIMIT}</span>
      {countdown&&<span style={{fontSize:9,color:t.danger,fontWeight:700}}>⏱{countdown}</span>}
      <div style={{width:30,height:3,background:t.btn,borderRadius:2,overflow:'hidden'}}>
        <div style={{width:`${pct}%`,height:'100%',background:clr,borderRadius:2,transition:'width .4s'}}/>
      </div>
      {rem<cost&&<span style={{fontSize:9,color:t.danger}}>⚠️</span>}
    </div>
  )
})

// ── WeatherCard ───────────────────────────────────────────────────────────────
const WeatherCard=memo(function WeatherCard({data,t}){
  const{city,country,current,daily}=data
  const dayNames=['Ne','Po','Út','St','Čt','Pá','So']
  return(
    <div style={{borderRadius:14,overflow:'hidden',border:`1px solid ${t.border}`}}>
      <div style={{padding:'14px 16px',background:`linear-gradient(135deg,${t.gradA}33,${t.gradB}22)`,borderBottom:`1px solid ${t.border}`}}>
        <div style={{fontSize:11,color:t.muted,marginBottom:3}}>📍 {city}, {country}</div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{fontSize:40,fontWeight:700,color:t.txt}}>{current.temp}°</div>
          <div><div style={{fontSize:15,color:t.txt}}>{current.desc}</div><div style={{fontSize:11,color:t.muted}}>Pocitová {current.feels}°C</div></div>
        </div>
        <div style={{display:'flex',gap:12,marginTop:8}}>
          <span style={{fontSize:11,color:t.muted}}>💧{current.humidity}%</span>
          <span style={{fontSize:11,color:t.muted}}>💨{current.wind}km/h</span>
        </div>
      </div>
      <div style={{display:'flex',overflowX:'auto',background:t.tag}}>
        {daily.map((d,i)=>{
          const dt=new Date(d.date),isToday=i===0
          return(
            <div key={d.date} style={{flex:'0 0 auto',padding:'8px 12px',textAlign:'center',borderRight:`1px solid ${t.border}`,minWidth:72,background:isToday?t.accent+'22':'transparent'}}>
              <div style={{fontSize:10,color:isToday?t.accent:t.muted,fontWeight:isToday?700:400}}>{isToday?'Dnes':dayNames[dt.getDay()]}</div>
              <div style={{fontSize:16,margin:'4px 0'}}>{d.desc.split(' ')[0]}</div>
              <div style={{fontSize:11,color:t.txt,fontWeight:600}}>{d.max}°</div>
              <div style={{fontSize:10,color:t.muted}}>{d.min}°</div>
              {d.rain>0&&<div style={{fontSize:9,color:'#60a5fa'}}>🌧{d.rain}mm</div>}
            </div>
          )
        })}
      </div>
      <div style={{fontSize:9,color:t.muted,padding:'3px 8px',textAlign:'right'}}>OpenMeteo • zdarma</div>
    </div>
  )
})

// ── WebSearchResults ──────────────────────────────────────────────────────────
const WebSearchResults=memo(function WebSearchResults({data,t}){
  const{results=[],summary,query,searchType='web',provider=''}=data
  if(!results.length)return<div style={{color:t.muted,fontSize:13,textAlign:'center',padding:12}}>Žádné výsledky pro „{query}". Zkus jiný dotaz.</div>
  return(
    <div>
      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10,flexWrap:'wrap'}}>
        <span style={{fontSize:13}}>{searchType==='video'?'🎬':searchType==='image'?'🖼️':'🌐'}</span>
        <strong style={{color:t.txt,fontSize:13}}>„{query}"</strong>
        <span style={{fontSize:10,color:t.muted,background:t.btn,padding:'1px 6px',borderRadius:4,border:`1px solid ${t.border}`}}>{provider||'Search'}</span>
        <span style={{fontSize:10,color:t.muted}}>{results.length} výsledků</span>
      </div>
      {summary&&searchType==='web'&&(
        <div style={{padding:'9px 11px',borderRadius:9,background:t.accent+'18',border:`1px solid ${t.accent}33`,marginBottom:10,fontSize:13,color:t.txt,lineHeight:1.6}}>
          <div style={{fontSize:10,color:t.accent,fontWeight:600,marginBottom:4,display:'flex',alignItems:'center',gap:5}}><LumiAvatar size={12} gradient={[t.gradA,t.gradB]}/> Lumi shrnuje</div>
          <div dangerouslySetInnerHTML={{__html:renderMD(summary,t.isDark)}}/>
        </div>
      )}
      {searchType==='image'&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
          {results.slice(0,9).map((r,i)=>(
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{display:'block',borderRadius:7,overflow:'hidden',border:`1px solid ${t.border}`,textDecoration:'none',transition:'transform .15s'}} onMouseOver={e=>e.currentTarget.style.transform='scale(1.03)'} onMouseOut={e=>e.currentTarget.style.transform='scale(1)'}>
              <div style={{position:'relative',paddingBottom:'75%',background:t.btn}}>
                {r.thumb&&<img src={r.thumb} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>}
                {!r.thumb&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>🖼️</div>}
              </div>
            </a>
          ))}
        </div>
      )}
      {searchType==='video'&&(
        <div style={{display:'flex',flexDirection:'column',gap:7}}>
          {results.slice(0,8).map((r,i)=>(
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{display:'flex',gap:9,padding:'9px',borderRadius:9,background:t.btn,border:`1px solid ${t.border}`,textDecoration:'none',transition:'background .12s'}} onMouseOver={e=>e.currentTarget.style.background=t.active} onMouseOut={e=>e.currentTarget.style.background=t.btn}>
              <div style={{width:80,height:50,borderRadius:5,overflow:'hidden',background:t.card,flexShrink:0,position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {r.thumb?<img src={r.thumb} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:22}}>▶️</span>}
                {r.duration&&<span style={{position:'absolute',bottom:2,right:2,fontSize:9,background:'rgba(0,0,0,.8)',color:'#fff',padding:'1px 3px',borderRadius:2}}>{r.duration}</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:t.accent,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:2}}>{r.title}</div>
                <div style={{fontSize:10,color:t.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.desc}</div>
                {r.published&&<div style={{fontSize:9,color:t.muted,marginTop:2}}>{r.published}</div>}
              </div>
            </a>
          ))}
        </div>
      )}
      {searchType==='web'&&(
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {results.slice(0,8).map((r,i)=>(
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{display:'block',padding:'9px 11px',borderRadius:9,background:t.btn,border:`1px solid ${t.border}`,textDecoration:'none',transition:'background .12s'}} onMouseOver={e=>e.currentTarget.style.background=t.active} onMouseOut={e=>e.currentTarget.style.background=t.btn}>
              <div style={{fontSize:12,fontWeight:600,color:t.accent,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:2}}>{r.title}</div>
              <div style={{fontSize:9,color:t.muted,marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.url}</div>
              {r.desc&&<div style={{fontSize:11,color:t.txt,lineHeight:1.4,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{r.desc}</div>}
            </a>
          ))}
        </div>
      )}
      <div style={{fontSize:9,color:t.muted,marginTop:7,textAlign:'right'}}>🔍 {provider}</div>
    </div>
  )
})

// ── GenImg ────────────────────────────────────────────────────────────────────
const GenImg=memo(function GenImg({imageData,mimeType,prompt,modelId,t}){
  const[loaded,setLoaded]=useState(false),[prog,setProg]=useState(0)
  const modelName=IMG_MODELS.find(m=>m.id===modelId)?.name||'Pollinations'

  // Pokud nemáme imageData (obrázek nebyl uložen v DB — jen metadata)
  if(!imageData){
    return(
      <div>
        <div style={{fontSize:11,color:t.muted,marginBottom:7,display:'flex',alignItems:'center',gap:5}}>{Ic.magic} Pollinations · <strong style={{color:t.purple}}>{modelName}</strong></div>
        <div style={{padding:'14px',background:t.tag,borderRadius:12,border:`1px solid ${t.border}`,fontSize:13,color:t.muted,textAlign:'center'}}>
          🎨 Obrázek není k dispozici po obnovení stránky<br/>
          <span style={{fontSize:11}}>{prompt&&`„${prompt}"`}</span>
        </div>
      </div>
    )
  }

  const src=`data:${mimeType||'image/jpeg'};base64,${imageData}`
  const dl=()=>{const a=document.createElement('a');a.href=src;a.download=`lumi-${Date.now()}.jpg`;a.click()}

  // Plynulý progress — zastaví se na 90% dokud obrázek nenačte
  useEffect(()=>{
    if(loaded)return
    let p=0
    const id=setInterval(()=>{
      p=p<88?p+Math.random()*7:88  // max 88% dokud nenačte
      setProg(Math.min(p,88))
    },500)
    return()=>clearInterval(id)
  },[loaded])
  useEffect(()=>{if(loaded)setProg(100)},[loaded])

  return(
    <div>
      <div style={{fontSize:11,color:t.muted,marginBottom:7,display:'flex',alignItems:'center',gap:5}}>{Ic.magic} Pollinations · <strong style={{color:t.purple}}>{modelName}</strong></div>
      {!loaded&&(
        <div style={{width:300,maxWidth:'100%',borderRadius:12,overflow:'hidden',border:`1px solid ${t.border}`}}>
          <div className="shimmer" style={{height:260}}/>
          <div style={{height:3,background:t.btn}}>
            <div style={{height:'100%',background:`linear-gradient(90deg,${t.gradA},${t.gradB})`,width:`${prog}%`,transition:'width .5s ease'}}/>
          </div>
          <div style={{padding:'7px 11px',display:'flex',alignItems:'center',gap:7}}>
            <div className="dot"><span/><span/><span/></div>
            <span style={{fontSize:11,color:t.muted}}>{prog<88?'Generuji…':'Skoro hotovo…'}</span>
          </div>
        </div>
      )}
      <div style={{position:'relative',display:loaded?'inline-block':'none',maxWidth:'100%'}}>
        <img src={src} alt={prompt} onLoad={()=>setLoaded(true)} style={{maxWidth:'100%',maxHeight:460,borderRadius:12,display:'block',border:`1px solid ${t.border}`,animation:'imgReveal .6s ease'}}/>
        {loaded&&<button onClick={dl} style={{position:'absolute',top:8,right:8,display:'flex',alignItems:'center',gap:4,padding:'4px 9px',borderRadius:7,background:'rgba(0,0,0,.7)',color:'#fff',fontSize:11,border:'none',cursor:'pointer',fontFamily:'inherit'}}>{Ic.dl} Stáhnout</button>}
      </div>
      {prompt&&loaded&&<div style={{fontSize:11,color:t.muted,marginTop:5,fontStyle:'italic'}}>„{prompt}"</div>}
    </div>
  )
})

// ── ImgGrid ───────────────────────────────────────────────────────────────────
const ImgGrid=memo(function ImgGrid({images,query,t}){
  if(!images?.length)return<div style={{fontSize:13,color:t.muted}}>Žádné fotografie pro „{query}"</div>
  return(
    <div>
      <div style={{fontSize:11,color:t.muted,marginBottom:8}}>📷 „{query}"</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
        {images.slice(0,9).map((img,i)=>(
          <a key={img.id||i} href={img.source||img.url} target="_blank" rel="noopener noreferrer" style={{display:'block',borderRadius:8,overflow:'hidden',border:`1px solid ${t.border}`,textDecoration:'none',transition:'transform .2s'}} onMouseOver={e=>e.currentTarget.style.transform='scale(1.04)'} onMouseOut={e=>e.currentTarget.style.transform='scale(1)'}>
            <div style={{position:'relative',paddingBottom:'66%',overflow:'hidden'}}>
              <img src={img.thumbnail||img.thumb||img.url} alt={img.title||query} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
            </div>
            {img.author&&<div style={{padding:'3px 6px',fontSize:10,color:t.muted}}>📷 {img.author}</div>}
          </a>
        ))}
      </div>
    </div>
  )
})

// ── QuizCard ──────────────────────────────────────────────────────────────────
const QuizCard=memo(function QuizCard({questions,t}){
  const[cur,setCur]=useState(0),[answers,setAnswers]=useState({}),[done,setDone]=useState(false)
  if(!questions?.length)return<div style={{padding:'12px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`,fontSize:13,color:t.muted}}>Kvíz nemá otázky.</div>
  const q=questions[cur],total=questions.length
  const score=Object.entries(answers).filter(([i,a])=>Number(a)===questions[Number(i)]?.correct).length
  if(done){
    const pct=Math.round((score/total)*100)
    return(
      <div style={{padding:'18px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`,textAlign:'center',animation:'fadeInScale .4s ease'}}>
        <div style={{fontSize:40,marginBottom:6}}>{pct>=80?'🏆':pct>=60?'👍':pct>=40?'😊':'📚'}</div>
        <div style={{fontSize:22,fontWeight:700,color:t.txt}}>{score}/{total}</div>
        <div style={{fontSize:13,color:t.muted,marginTop:3}}>{pct}% správně</div>
        <div style={{width:'100%',height:7,background:t.btn,borderRadius:4,marginTop:12,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',background:pct>=80?t.succ:pct>=60?t.accent:'#f59e0b',borderRadius:4,transition:'width 1.2s ease'}}/></div>
        <div style={{fontSize:12,color:t.muted,margin:'10px 0 14px'}}>{pct>=80?'Výborně!':pct>=60?'Dobrá práce!':pct>=40?'Slušný výsledek!':'Příště lépe!'}</div>
        <button onClick={()=>{setAnswers({});setCur(0);setDone(false)}} style={{padding:'9px 20px',borderRadius:9,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>🔄 Znovu</button>
      </div>
    )
  }
  return(
    <div style={{padding:'13px 15px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:11}}>
        <div style={{flex:1,height:4,background:t.btn,borderRadius:2,overflow:'hidden'}}><div style={{width:`${((cur+1)/total)*100}%`,height:'100%',background:t.accent,transition:'width .4s'}}/></div>
        <span style={{fontSize:11,color:t.muted}}>{cur+1}/{total}</span>
      </div>
      <div style={{fontSize:13,fontWeight:600,color:t.txt,marginBottom:11,lineHeight:1.4}}>🎓 {q.question}</div>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {q.options?.map((opt,i)=>{
          const sel=answers[cur],isC=i===q.correct,isSel=sel===i
          let bg=t.btn,clr=t.txt,brd=t.border
          if(sel!==undefined){if(isC){bg=t.success;clr=t.succ;brd=t.succ}else if(isSel){bg='rgba(239,68,68,.15)';clr='#fca5a5';brd='#f87171'}}
          return(
            <button key={i} onClick={()=>sel===undefined&&setAnswers(p=>({...p,[cur]:i}))} disabled={sel!==undefined}
              style={{padding:'8px 12px',borderRadius:8,background:bg,color:clr,border:`1.5px solid ${brd}`,fontSize:13,textAlign:'left',cursor:sel===undefined?'pointer':'default',fontFamily:'inherit',transition:'all .2s',display:'flex',alignItems:'center',gap:7}}>
              <span style={{width:20,height:20,borderRadius:'50%',background:'rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>{String.fromCharCode(65+i)}</span>
              <span>{opt}</span>
              {sel!==undefined&&isC&&<span style={{marginLeft:'auto',fontWeight:700}}>✓</span>}
              {sel!==undefined&&isSel&&!isC&&<span style={{marginLeft:'auto'}}>✗</span>}
            </button>
          )
        })}
      </div>
      {answers[cur]!==undefined&&q.explanation&&<div style={{marginTop:8,padding:'8px 11px',borderRadius:8,background:t.tag,border:`1px solid ${t.border}`,fontSize:11,color:t.muted}}>💡 {q.explanation}</div>}
      {answers[cur]!==undefined&&<div style={{marginTop:10}}>{cur<total-1?<button onClick={()=>setCur(c=>c+1)} style={{width:'100%',padding:'8px',borderRadius:8,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Další →</button>:<button onClick={()=>setDone(true)} style={{width:'100%',padding:'8px',borderRadius:8,background:'#f59e0b',color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Výsledky 🏆</button>}</div>}
    </div>
  )
})

// ── VoiceBtn ──────────────────────────────────────────────────────────────────
function VoiceBtn({t,onTranscript}){
  const[on,setOn]=useState(false),[txt,setTxt]=useState(''),ref=useRef(null)
  const ok=typeof window!=='undefined'&&('SpeechRecognition' in window||'webkitSpeechRecognition' in window)
  if(!ok)return null
  const toggle=()=>{
    if(on){ref.current?.stop();setOn(false);return}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition
    const r=new SR();r.continuous=false;r.interimResults=true;r.lang='cs-CZ'
    r.onresult=e=>{const t2=Array.from(e.results).map(r=>r[0].transcript).join('');setTxt(t2);if(e.results[e.results.length-1].isFinal){onTranscript(t2);setTxt('');setOn(false)}}
    r.onerror=()=>setOn(false);r.onend=()=>setOn(false)
    ref.current=r;r.start();setOn(true)
  }
  return(
    <div style={{position:'relative'}}>
      <button onClick={toggle} title={on?'Stop':'Hlas'} style={{display:'flex',alignItems:'center',justifyContent:'center',padding:6,borderRadius:8,background:on?'#ef4444':t.btn,color:on?'#fff':t.muted,border:`1px solid ${on?'#ef4444':t.border}`,cursor:'pointer',transition:'all .2s'}}>{Ic.mic}</button>
      {on&&txt&&<div style={{position:'absolute',bottom:'calc(100% + 5px)',left:'50%',transform:'translateX(-50%)',background:t.modal,border:`1px solid ${t.border}`,borderRadius:6,padding:'3px 8px',fontSize:10,color:t.txt,whiteSpace:'nowrap',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',boxShadow:'0 4px 12px rgba(0,0,0,.3)',zIndex:5}}>„{txt}"</div>}
    </div>
  )
}

// ── MsgActions ────────────────────────────────────────────────────────────────
const MsgActions=memo(function MsgActions({msg,t,isLoggedIn,token,onExplain,onStar,starred,onPin,pinned}){
  const[rat,setRat]=useState(null),[copied,setCopied]=useState(false)
  const copy=()=>{navigator.clipboard.writeText(msg.content);setCopied(true);setTimeout(()=>setCopied(false),1500)}
  const feedback=async r=>{setRat(r);if(token&&msg.dbId){try{await callEdge('feedback',{messageId:msg.dbId,rating:r},token)}catch{}}}
  return(
    <div style={{display:'flex',alignItems:'center',gap:4,marginTop:4,flexWrap:'wrap'}}>
      <button onClick={copy} style={{display:'flex',alignItems:'center',gap:3,padding:'2px 7px',borderRadius:5,background:copied?t.success:t.btn,color:copied?t.succ:t.muted,fontSize:11,border:`1px solid ${copied?t.succ:t.border}`,cursor:'pointer',fontFamily:'inherit',transition:'all .2s'}}>{Ic.copy}{copied?' ✓':' Kopírovat'}</button>
      <button onClick={()=>onExplain(msg)} style={{display:'flex',alignItems:'center',gap:3,padding:'2px 7px',borderRadius:5,background:t.btn,color:t.muted,fontSize:11,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit'}}>{Ic.info} Jak?</button>
      {isLoggedIn&&<>
        <button onClick={()=>onStar(msg)} style={{display:'flex',padding:'2px 5px',borderRadius:5,background:starred?'#f59e0b22':t.btn,color:starred?'#f59e0b':t.muted,border:`1px solid ${starred?'#f59e0b':t.border}`,cursor:'pointer',transition:'all .2s'}}>{starred?Ic.starF:Ic.star}</button>
        <button onClick={()=>onPin(msg)} style={{display:'flex',padding:'2px 5px',borderRadius:5,background:pinned?t.accent+'22':t.btn,color:pinned?t.accent:t.muted,border:`1px solid ${pinned?t.accent:t.border}`,cursor:'pointer',transition:'all .2s'}} title="Připnout">{Ic.pin}</button>
      </>}
      <button onClick={()=>feedback(1)} style={{display:'flex',padding:'2px 5px',borderRadius:5,background:rat===1?t.success:t.btn,color:rat===1?t.succ:t.muted,border:`1px solid ${rat===1?t.succ:t.border}`,cursor:'pointer'}}>{Ic.thumbUp}</button>
      <button onClick={()=>feedback(-1)} style={{display:'flex',padding:'2px 5px',borderRadius:5,background:rat===-1?'rgba(239,68,68,.15)':t.btn,color:rat===-1?'#fca5a5':t.muted,border:`1px solid ${rat===-1?'#f87171':t.border}`,cursor:'pointer'}}>{Ic.thumbDn}</button>
    </div>
  )
})

// ── Dropdown ──────────────────────────────────────────────────────────────────
function Dropdown({t,label,icon,children,active,accent,upward=true,alignRight=false}){
  const[open,setOpen]=useState(false)
  const[pos,setPos]=useState({})
  const ref=useRef(null),btnRef=useRef(null)
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target)&&!btnRef.current?.contains(e.target))setOpen(false)}
    document.addEventListener('mousedown',h)
    return()=>document.removeEventListener('mousedown',h)
  },[])
  const toggle=()=>{
    if(!open&&btnRef.current){
      const r=btnRef.current.getBoundingClientRect()
      const menuW=260
      // Zabrání přetečení vpravo
      const leftPos=alignRight
        ? Math.max(4, r.right - menuW)   // zarovnání vpravo od tlačítka
        : Math.min(r.left, window.innerWidth - menuW - 4)
      setPos({
        bottom: upward ? window.innerHeight - r.top + 6 : undefined,
        top:    upward ? undefined : r.bottom + 6,
        left:   leftPos,
        minWidth: menuW,
      })
    }
    setOpen(o=>!o)
  }
  const clr=accent||t.accent
  return(
    <div ref={ref} style={{position:'relative',display:'inline-flex'}}>
      <button ref={btnRef} onClick={toggle}
        style={{display:'flex',alignItems:'center',gap:label?5:0,padding:label?'5px 10px':'0',background:(open||active)?clr+'22':'transparent',color:(open||active)?clr:t.muted,border:'none',fontSize:12,fontWeight:(open||active)?600:400,fontFamily:'inherit',cursor:'pointer',transition:'all .15s',borderRadius:8}}>
        {icon}{label&&<span>{label}</span>}{label&&(open?Ic.chevUp:Ic.chevDn)}
      </button>
      {open&&(
        <div style={{position:'fixed',bottom:pos.bottom,top:pos.top,left:pos.left,minWidth:pos.minWidth,background:t.modal,border:`1px solid ${t.border}`,borderRadius:12,padding:5,zIndex:9999,boxShadow:'0 16px 48px rgba(0,0,0,.6)',animation:'dropIn .18s ease',maxHeight:'75vh',overflowY:'auto'}}>
          {children}
          <button onClick={()=>setOpen(false)} style={{position:'sticky',bottom:0,float:'right',color:t.muted,display:'flex',padding:3,background:'none',border:'none',cursor:'pointer',marginTop:2}}>{Ic.x}</button>
        </div>
      )}
    </div>
  )
}
function DItem({t,onClick,active,clr,icon,label,sub}){
  return(
    <button onClick={onClick} style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'8px 11px',background:active?clr+'22':'transparent',color:active?clr:t.txt,fontSize:12,fontFamily:'inherit',textAlign:'left',cursor:'pointer',borderRadius:8,border:'none',transition:'all .15s'}}>
      <span style={{fontSize:15,flexShrink:0}}>{icon}</span>
      <div style={{flex:1,minWidth:0}}><div style={{fontWeight:active?600:400}}>{label}</div>{sub&&<div style={{fontSize:10,color:t.muted,marginTop:1}}>{sub}</div>}</div>
      {active&&<span style={{color:clr,flexShrink:0}}>{Ic.check}</span>}
    </button>
  )
}

// ── UNIKÁTNÍ FUNKCE: Focus Timer (Pomodoro) ───────────────────────────────────
function FocusTimer({t,onClose}){
  const[phase,setPhase]=useState('idle')
  const[secs,setSecs]=useState(25*60)
  const[total,setTotal]=useState(25*60)
  const[sessions,setSessions]=useState(0)
  const[workMin,setWorkMin]=useState(25)
  const[breakMin,setBreakMin]=useState(5)
  const ref=useRef(null)
  useEffect(()=>{
    if(phase==='idle')return
    ref.current=setInterval(()=>{
      setSecs(s=>{
        if(s<=1){
          clearInterval(ref.current)
          if(phase==='work'){setSessions(n=>n+1);setPhase('break');const b=breakMin*60;setSecs(b);setTotal(b)}
          else{setPhase('idle');setSecs(workMin*60);setTotal(workMin*60)}
          return 0
        }
        return s-1
      })
    },1000)
    return()=>clearInterval(ref.current)
  },[phase,breakMin,workMin])
  const start=()=>{setSecs(workMin*60);setTotal(workMin*60);setPhase('work')}
  const stop=()=>{clearInterval(ref.current);setPhase('idle');setSecs(workMin*60);setTotal(workMin*60)}
  const mm=String(Math.floor(secs/60)).padStart(2,'0')
  const ss2=String(secs%60).padStart(2,'0')
  const pct=total>0?((total-secs)/total)*100:0
  const clr=phase==='work'?t.accent:phase==='break'?t.green:t.muted
  const r=38,circ=2*Math.PI*r
  return(
    <div style={{padding:'14px',background:t.modal,border:`1px solid ${t.border}`,borderRadius:14,minWidth:210,animation:'dropIn .2s ease'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <span style={{fontSize:13,fontWeight:600,color:t.txt}}>⏱ Focus Timer</span>
        <button onClick={onClose} style={{color:t.muted,background:'none',border:'none',cursor:'pointer',display:'flex',padding:2}}>{Ic.x}</button>
      </div>
      <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
        <div style={{position:'relative',width:96,height:96}}>
          <svg width="96" height="96" style={{transform:'rotate(-90deg)'}}>
            <circle cx="48" cy="48" r={r} fill="none" stroke={t.btn} strokeWidth="6"/>
            <circle cx="48" cy="48" r={r} fill="none" stroke={clr} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={circ-circ*(pct/100)} style={{transition:'stroke-dashoffset .9s linear'}}/>
          </svg>
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontSize:19,fontWeight:700,color:t.txt,letterSpacing:1}}>{mm}:{ss2}</div>
            <div style={{fontSize:10,color:clr,fontWeight:600}}>{phase==='work'?'Fokus':phase==='break'?'Pauza':'Připraven'}</div>
          </div>
        </div>
      </div>
      {phase==='idle'&&(
        <div style={{display:'flex',gap:10,marginBottom:10,justifyContent:'center'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:10,color:t.muted,marginBottom:3}}>Fokus (min)</div>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <button onClick={()=>setWorkMin(m=>Math.max(1,m-5))} style={{padding:'2px 6px',borderRadius:5,background:t.btn,color:t.txt,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>-</button>
              <span style={{fontSize:13,fontWeight:600,color:t.txt,minWidth:22,textAlign:'center'}}>{workMin}</span>
              <button onClick={()=>setWorkMin(m=>Math.min(90,m+5))} style={{padding:'2px 6px',borderRadius:5,background:t.btn,color:t.txt,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>+</button>
            </div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:10,color:t.muted,marginBottom:3}}>Pauza (min)</div>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <button onClick={()=>setBreakMin(m=>Math.max(1,m-1))} style={{padding:'2px 6px',borderRadius:5,background:t.btn,color:t.txt,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>-</button>
              <span style={{fontSize:13,fontWeight:600,color:t.txt,minWidth:22,textAlign:'center'}}>{breakMin}</span>
              <button onClick={()=>setBreakMin(m=>Math.min(30,m+1))} style={{padding:'2px 6px',borderRadius:5,background:t.btn,color:t.txt,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>+</button>
            </div>
          </div>
        </div>
      )}
      {sessions>0&&<div style={{fontSize:11,color:t.muted,textAlign:'center',marginBottom:8}}>✅ {sessions} session{sessions>1?'y':''} hotovo</div>}
      {phase==='idle'
        ?<button onClick={start} style={{width:'100%',padding:'8px',borderRadius:9,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>▶ Start</button>
        :<button onClick={stop} style={{width:'100%',padding:'8px',borderRadius:9,background:t.danger,color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>⏹ Stop</button>}
    </div>
  )
}

// ── Prompt záložky ────────────────────────────────────────────────────────────
const BMARKS_KEY='lumi_bookmarks'
function PromptBookmarks({t,input,onSelect}){
  const[marks,setMarks]=useState(()=>{try{return JSON.parse(localStorage.getItem(BMARKS_KEY)||'[]')}catch{return[]}})
  const[editMode,setEditMode]=useState(false),[lbl,setLbl]=useState('')
  const save=m=>{try{localStorage.setItem(BMARKS_KEY,JSON.stringify(m))}catch{}}
  const add=()=>{if(!input.trim())return;const label=lbl.trim()||input.trim().slice(0,30)+(input.length>30?'…':'');const next=[{id:uid(),label,text:input.trim()},...marks].slice(0,20);setMarks(next);save(next);setLbl('')}
  const del=id=>{const next=marks.filter(m=>m.id!==id);setMarks(next);save(next)}
  return(
    <div style={{marginBottom:7,animation:'dropIn .2s ease'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6,flexWrap:'wrap'}}>
        <span style={{fontSize:11,color:t.muted,fontWeight:600}}>🔖 Záložky</span>
        <button onClick={()=>setEditMode(e=>!e)} style={{fontSize:10,color:t.muted,background:editMode?t.active:t.btn,border:`1px solid ${t.border}`,cursor:'pointer',padding:'2px 7px',borderRadius:4,fontFamily:'inherit'}}>{editMode?'Hotovo':'Spravovat'}</button>
        {input.trim()&&<div style={{display:'flex',gap:4,flex:1,minWidth:110}}>
          <input value={lbl} onChange={e=>setLbl(e.target.value)} placeholder="Název…" style={{flex:1,fontSize:11,padding:'3px 7px',background:t.inBg,color:t.txt,border:`1px solid ${t.inBrd}`,borderRadius:5,outline:'none',fontFamily:'inherit'}}/>
          <button onClick={add} style={{padding:'3px 8px',borderRadius:5,background:t.accent,color:'#fff',fontSize:11,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>+ Uložit</button>
        </div>}
      </div>
      {marks.length===0&&<div style={{fontSize:11,color:t.muted,textAlign:'center',padding:'4px 0'}}>Žádné záložky. Napiš prompt → Uložit.</div>}
      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
        {marks.map(m=>(
          <div key={m.id} style={{display:'flex',alignItems:'center',borderRadius:20,background:t.tag,border:`1px solid ${t.border}`,overflow:'hidden',transition:'border-color .15s'}} onMouseOver={e=>e.currentTarget.style.borderColor=t.accent} onMouseOut={e=>e.currentTarget.style.borderColor=t.border}>
            <button onClick={()=>onSelect(m.text)} style={{padding:'3px 9px',background:'transparent',color:t.txt,fontSize:11,border:'none',cursor:'pointer',fontFamily:'inherit',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={m.text}>🔖 {m.label}</button>
            {editMode&&<button onClick={()=>del(m.id)} style={{padding:'3px 6px',background:'rgba(239,68,68,.15)',color:'#f87171',fontSize:10,border:'none',borderLeft:`1px solid ${t.border}`,cursor:'pointer'}}>✕</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Image Style Presets ───────────────────────────────────────────────────────
const IMG_STYLES=[
  {l:'📸 Realistic',v:'photorealistic, 8k, sharp, detailed'},
  {l:'🎌 Anime',v:'anime style, vibrant, studio ghibli'},
  {l:'🎬 Cinematic',v:'cinematic, dramatic lighting, movie still'},
  {l:'🖼️ Oil Paint',v:'oil painting, impressionist, textured'},
  {l:'🌆 Cyberpunk',v:'cyberpunk, neon lights, rain, futuristic'},
  {l:'🧸 Cartoon',v:'cartoon, bold outlines, flat colors'},
]
function ImageStylePresets({t,onSelect}){
  return(
    <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:7,animation:'fadeIn .3s ease'}}>
      {IMG_STYLES.map(s=>(
        <button key={s.l} onClick={()=>onSelect(s.v)} style={{padding:'3px 9px',borderRadius:20,background:t.tag,border:`1px solid ${t.border}`,color:t.muted,fontSize:11,cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}} onMouseOver={e=>{e.currentTarget.style.borderColor=t.purple;e.currentTarget.style.color=t.txt;e.currentTarget.style.background=t.purple+'22'}} onMouseOut={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.color=t.muted;e.currentTarget.style.background=t.tag}}>{s.l}</button>
      ))}
    </div>
  )
}

// ── Šablony ───────────────────────────────────────────────────────────────────
const TEMPLATES=[
  {icon:'📧',label:'Formální email',text:'Napiš formální email na téma: '},
  {icon:'📝',label:'Shrnutí textu',text:'Shrň stručně a jasně: '},
  {icon:'💼',label:'Meeting notes',text:'Napiš zprávu z meetingu. Témata: '},
  {icon:'🐛',label:'Bug report',text:'Napiš bug report: Problém: '},
  {icon:'📣',label:'Social post',text:'Napiš poutavý příspěvek o: '},
  {icon:'📖',label:'Vysvětli jednoduše',text:'Vysvětli mi jednoduše (jako 10letému): '},
  {icon:'⚡',label:'Bullet pointy',text:'Přepiš do přehledných bullet pointů: '},
  {icon:'🔍',label:'Analýza',text:'Analyzuj silné a slabé stránky: '},
]

// ── Kalkulačka ────────────────────────────────────────────────────────────────
function CalcWidget({t,onResult}){
  const[expr,setExpr]=useState(''),[res,setRes]=useState(''),[err,setErr]=useState(false)
  const calc=()=>{try{const c=expr.replace(/[^0-9+\-*/.()%\s]/g,'');if(!c.trim())return;const r=new Function(`"use strict";return(${c})`)();setRes(String(r));setErr(false)}catch{setRes('Chyba');setErr(true)}}
  return(
    <div style={{padding:'9px 11px',background:t.tag,borderRadius:9,border:`1px solid ${t.border}`,marginBottom:7}}>
      <div style={{fontSize:10,color:t.muted,marginBottom:5}}>🔢 Kalkulačka</div>
      <div style={{display:'flex',gap:5}}>
        <input value={expr} onChange={e=>setExpr(e.target.value)} onKeyDown={e=>e.key==='Enter'&&calc()} placeholder="2 + 2 * 10 …" style={{flex:1,padding:'6px 9px',background:t.inBg,color:t.txt,border:`1px solid ${t.inBrd}`,borderRadius:6,fontSize:13,outline:'none',fontFamily:'monospace'}}/>
        <button onClick={calc} style={{padding:'6px 11px',borderRadius:6,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>=</button>
      </div>
      {res&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:6,padding:'6px 10px',borderRadius:6,background:err?'rgba(239,68,68,.1)':t.success,border:`1px solid ${err?'#f87171':t.succ}`}}>
        <span style={{fontSize:16,fontWeight:700,color:err?'#f87171':t.succ,fontFamily:'monospace'}}>{res}</span>
        {!err&&<button onClick={()=>onResult(res)} style={{fontSize:10,color:t.accent,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>Vložit →</button>}
      </div>}
    </div>
  )
}

// ── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({t,themeName,setThemeName,sysPmt,setSysPmt,onClose,isLoggedIn,userId,memory,setMemory}){
  const[tmp,setTmp]=useState(sysPmt),[tab,setTab]=useState('appearance'),[memList,setMemList]=useState([])
  useEffect(()=>{if(tab==='memory'&&isLoggedIn)supabase.from('user_memory').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(50).then(({data})=>setMemList(data||[]))},[tab,isLoggedIn,userId])
  const delMem=async id=>{await supabase.from('user_memory').delete().eq('id',id);setMemList(p=>p.filter(m=>m.id!==id))}
  const tabs=[{id:'appearance',l:'Vzhled',e:'🎨'},{id:'behavior',l:'Chování',e:'⚙️'},{id:'memory',l:'Paměť',e:'🧠'},{id:'about',l:'O Lumi',e:'ℹ️'}]
  return(
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:49,backdropFilter:'blur(4px)'}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:50,width:'min(560px,96vw)',maxHeight:'88vh',display:'flex',flexDirection:'column',background:t.modal,border:`1px solid ${t.border}`,borderRadius:18,fontFamily:"'DM Sans',sans-serif",overflow:'hidden',animation:'fadeInScale .25s ease'}}>
        <div style={{padding:'16px 18px 0',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:9}}><LumiAvatar size={30} gradient={[t.gradA,t.gradB]}/><h2 style={{fontSize:15,fontWeight:600,color:t.txt}}>Nastavení</h2></div>
          <button onClick={onClose} style={{background:'none',border:'none',color:t.muted,cursor:'pointer',display:'flex',padding:4}}>{Ic.x}</button>
        </div>
        <div style={{display:'flex',gap:4,padding:'10px 18px 0',flexShrink:0,flexWrap:'wrap'}}>
          {tabs.map(tb=><button key={tb.id} onClick={()=>setTab(tb.id)} style={{padding:'5px 10px',borderRadius:7,background:tab===tb.id?t.accent:t.btn,color:tab===tb.id?'#fff':t.muted,fontSize:12,fontWeight:tab===tb.id?600:400,border:'none',cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>{tb.e} {tb.l}</button>)}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'14px 18px 18px'}}>
          {tab==='appearance'&&(
            <>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>Téma</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                {THEME_LIST.map(th=><button key={th.id} onClick={()=>setThemeName(th.id)} style={{padding:'9px 5px',borderRadius:8,border:`2px solid ${themeName===th.id?t.accent:t.border}`,background:themeName===th.id?t.accent+'22':t.btn,color:themeName===th.id?t.accent:t.muted,fontSize:10,fontWeight:themeName===th.id?600:400,cursor:'pointer',fontFamily:'inherit',textAlign:'center',transition:'all .2s',transform:themeName===th.id?'scale(1.05)':'scale(1)'}}>
                  <div style={{fontSize:17,marginBottom:2}}>{th.icon}</div>{th.label}
                </button>)}
              </div>
            </>
          )}
          {tab==='behavior'&&(
            <>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Osobnost</div>
              <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:14}}>
                {PERSONAS.map(p=><button key={p.label} onClick={()=>setTmp(p.val)} style={{padding:'9px 12px',borderRadius:8,border:`1.5px solid ${tmp===p.val?t.accent:t.border}`,background:tmp===p.val?t.accent+'18':t.btn,color:tmp===p.val?t.accent:t.txt,fontSize:12,textAlign:'left',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'space-between',transition:'all .15s'}}>{p.label}{tmp===p.val&&<span style={{color:t.accent}}>{Ic.check}</span>}</button>)}
              </div>
              <textarea value={tmp} onChange={e=>setTmp(e.target.value)} rows={3} style={{width:'100%',padding:'9px 11px',background:t.inBg,color:t.txt,border:`1.5px solid ${t.inBrd}`,borderRadius:8,fontSize:12,lineHeight:1.6,outline:'none',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box',marginBottom:12}}/>
              <div style={{padding:'11px 13px',borderRadius:9,background:t.tag,border:`1px solid ${t.border}`,marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,color:t.txt,marginBottom:7}}>{Ic.brain} Epizodická paměť</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:12,color:t.muted}}>Lumi si pamatuje kontext z minulých chatů</span>
                  <button onClick={()=>setMemory(m=>!m)} style={{width:40,height:22,borderRadius:11,background:memory?t.accent:t.btn,border:`1px solid ${memory?t.accent:t.border}`,cursor:'pointer',position:'relative',transition:'all .2s',flexShrink:0}}>
                    <span style={{position:'absolute',top:2,left:memory?19:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left .2s',display:'block'}}/>
                  </button>
                </div>
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button onClick={onClose} style={{padding:'7px 14px',borderRadius:8,background:t.btn,color:t.txt,fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Zrušit</button>
                <button onClick={()=>{setSysPmt(tmp);onClose()}} style={{padding:'7px 14px',borderRadius:8,background:t.accent,color:'#fff',fontSize:12,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Uložit</button>
              </div>
            </>
          )}
          {tab==='memory'&&(
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em'}}>Paměť ({memList.length})</div>
                {memList.length>0&&<button onClick={async()=>{await supabase.from('user_memory').delete().eq('user_id',userId);setMemList([])}} style={{fontSize:11,color:t.danger,cursor:'pointer',background:'none',border:'none',fontFamily:'inherit'}}>Smazat vše</button>}
              </div>
              {!isLoggedIn&&<p style={{fontSize:12,color:t.muted}}>Přihlaste se.</p>}
              {isLoggedIn&&memList.length===0&&<div style={{textAlign:'center',padding:'20px 0',color:t.muted}}><div style={{fontSize:28,marginBottom:6}}>🧠</div>Paměť je prázdná.</div>}
              {memList.map(m=>(
                <div key={m.id} style={{display:'flex',alignItems:'flex-start',gap:7,padding:'8px 11px',borderRadius:8,background:t.tag,border:`1px solid ${t.border}`,marginBottom:6}}>
                  <span style={{fontSize:9,color:t.muted,background:t.btn,padding:'1px 5px',borderRadius:3,flexShrink:0,marginTop:1}}>{MEM_CATEGORIES.find(c=>c.id===m.category)?.label||m.category}</span>
                  {m.source==='auto'&&<span style={{fontSize:9,color:t.green,background:t.green+'22',padding:'1px 5px',borderRadius:3,flexShrink:0,marginTop:1}}>auto 🤖</span>}
                  <span style={{fontSize:12,color:t.txt,flex:1,lineHeight:1.4}}>{m.content}</span>
                  <button onClick={()=>delMem(m.id)} style={{color:t.muted,display:'flex',padding:3,flexShrink:0,background:'none',border:'none',cursor:'pointer'}}>{Ic.trash}</button>
                </div>
              ))}
            </>
          )}
          {tab==='about'&&(
            <div style={{fontSize:12,color:t.muted,lineHeight:1.7}}>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:7,marginBottom:18}}>
                <LumiAvatar size={52} gradient={[t.gradA,t.gradB]}/>
                <div style={{textAlign:'center'}}><div style={{fontWeight:700,color:t.txt,fontSize:17}}>Lumi</div><span style={{background:'#f59e0b22',color:'#f59e0b',padding:'1px 8px',borderRadius:4,fontWeight:600,fontSize:11}}>BETA</span></div>
              </div>
              {[['🤖 Chat','Gemma 4 31B (výchozí)'],['💭 Deep Thinking','Gemini 3.1 Flash Lite / 2.5 Pro'],['🌐 Web Search','Google Search (Gemini Grounding)'],['🎨 AI Obrázky','Pollinations.ai (3 modely)'],['📷 Fotografie','Unsplash / Pixabay'],['🌤️ Počasí','OpenMeteo (zdarma, bez API)'],['🎙️ Live','Gemini 3 Flash Live / 2.5 Native Audio'],['🧠 Auto-paměť','Detekce + Supabase PostgreSQL'],['📝 Drafty','Supabase auto-save'],['⏱ Focus Timer','Pomodoro vestavěný']].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 11px',borderRadius:7,background:t.tag,border:`1px solid ${t.border}`,marginBottom:5}}>
                  <span>{k}</span><span style={{color:t.accent,fontSize:11}}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── AddMemoryModal ────────────────────────────────────────────────────────────
function AddMemoryModal({t,onClose,onSave}){
  const[content,setContent]=useState(''),[cat,setCat]=useState('personal')
  return(
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:58,backdropFilter:'blur(4px)'}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:59,width:'min(400px,96vw)',background:t.modal,border:`1px solid ${t.border}`,borderRadius:14,padding:20,fontFamily:"'DM Sans',sans-serif",animation:'fadeInScale .25s ease'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <h3 style={{fontSize:14,fontWeight:600,color:t.txt}}>➕ Přidat do paměti</h3>
          <button onClick={onClose} style={{color:t.muted,display:'flex',padding:3,background:'none',border:'none',cursor:'pointer'}}>{Ic.x}</button>
        </div>
        <textarea value={content} onChange={e=>setContent(e.target.value)} rows={3} placeholder="Např. Jmenuji se Radek, studuji programování…" style={{width:'100%',padding:'9px 11px',background:t.inBg,color:t.txt,border:`1.5px solid ${t.inBrd}`,borderRadius:8,fontSize:12,lineHeight:1.6,outline:'none',resize:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:10}}/>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:14}}>
          {MEM_CATEGORIES.map(c=><button key={c.id} onClick={()=>setCat(c.id)} style={{padding:'4px 9px',borderRadius:5,background:cat===c.id?t.accent:t.btn,color:cat===c.id?'#fff':t.muted,fontSize:11,border:`1px solid ${cat===c.id?t.accent:t.border}`,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',fontWeight:cat===c.id?600:400}}>{c.label}</button>)}
        </div>
        <div style={{display:'flex',gap:7,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'7px 14px',borderRadius:7,background:t.btn,color:t.txt,fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Zrušit</button>
          <button onClick={()=>{if(content.trim()){onSave(content.trim(),cat);onClose()}}} disabled={!content.trim()} style={{padding:'7px 14px',borderRadius:7,background:content.trim()?t.accent:t.btn,color:content.trim()?'#fff':t.muted,fontSize:12,fontWeight:600,border:'none',cursor:content.trim()?'pointer':'default',fontFamily:'inherit',transition:'all .15s'}}>Uložit</button>
        </div>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── LUMI CODE — kódový asistent (Claude Code styl) ────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function LumiCode({t,token,onClose,callEdge}){
  const[input,setInput]=useState('')
  const[lang,setLang]=useState('javascript')
  const[task,setTask]=useState('explain')
  const[toLang,setToLang]=useState('python')
  const[result,setResult]=useState(null)
  const[loading,setLoading]=useState(false)
  const[history,setHistory]=useState([])
  const[err,setErr]=useState(null)

  const TASKS=[
    {id:'explain',  label:'Vysvětlit',   icon:'📖', sub:'Co dělá tento kód'},
    {id:'refactor', label:'Refaktorovat',icon:'🔧', sub:'Vylepšit kvalitu'},
    {id:'gen_tests',label:'Testy',       icon:'🧪', sub:'Unit testy'},
    {id:'debug',    label:'Debug',       icon:'🐛', sub:'Najít chyby'},
    {id:'convert',  label:'Konvertovat', icon:'🔄', sub:'Do jiného jazyka'},
    {id:'write',    label:'Napsat kód',  icon:'✍️', sub:'Dle zadání'},
  ]
  const LANGS=['javascript','typescript','python','java','c#','go','rust','php','html','css','sql','kotlin','swift']

  // Anthropic API přímo — claude-sonnet-4-6
  const callClaude=async(systemPrompt,userMsg)=>{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:1000,
        system:systemPrompt,
        messages:[{role:'user',content:userMsg}]
      })
    })
    const d=await res.json()
    if(d.error)throw new Error(d.error.message)
    return d.content?.[0]?.text||''
  }

  const SYS={
    explain:`Expert ${lang} developer. Vysvětli kód česky: 1) Co dělá 2) Jak funguje 3) Klíčové části. Buď konkrétní a stručný.`,
    refactor:`Expert ${lang} developer. Refaktoruj kód: zlepši čitelnost, výkon, best practices. Vrať POUZE refaktorovaný kód + seznam změn pod ním.`,
    gen_tests:`Expert ${lang} tester. Napiš unit testy pro tento kód. Pokryj happy path, edge cases a error stavy.`,
    debug:`Expert ${lang} debugger. Najdi všechny bugy, security problémy a potenciální chyby. Vysvětli každý problém a navrhni opravu.`,
    convert:`Expert developer. Konvertuj kód z ${lang} do ${toLang}. Zachovej logiku, přidej komentáře kde je to potřeba. Vrať POUZE kód v ${toLang}.`,
    write:`Expert ${lang} developer. Napiš čistý, komentovaný kód dle zadání. Přidej příklady použití.`,
  }

  const run=async()=>{
    if(!input.trim())return
    setLoading(true);setResult(null);setErr(null)
    try{
      const userMsg=task==='convert'
        ?`Konvertuj tento ${lang} kód do ${toLang}:\n\`\`\`${lang}\n${input}\n\`\`\``
        :task==='write'
        ?`Napiš ${lang} kód pro: ${input}`
        :`\`\`\`${lang}\n${input}\n\`\`\``
      const res=await callClaude(SYS[task]||SYS.explain, userMsg)
      setResult(res)
      setHistory(h=>[{task,lang,input:input.slice(0,55)+'…',result:res,ts:Date.now()},...h.slice(0,9)])
    }catch(e){setErr('Chyba: '+e.message)}
    setLoading(false)
  }

  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',zIndex:80,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}>
      <div onClick={e=>e.stopPropagation()} style={{width:'min(860px,97vw)',maxHeight:'91vh',display:'flex',flexDirection:'column',background:t.modal,border:`1px solid ${t.border}`,borderRadius:16,overflow:'hidden',animation:'fadeInScale .2s ease',fontFamily:"'DM Sans',sans-serif"}}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'13px 18px',borderBottom:`1px solid ${t.border}`,background:'#10b98110',flexShrink:0}}>
          <span style={{fontSize:20,fontFamily:'monospace'}}>{'</>'}</span>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:'#10b981'}}>Lumi Code</div>
            <div style={{fontSize:11,color:t.muted}}>AI kódový asistent · claude-sonnet-4-6 · Anthropic</div>
          </div>
          <button onClick={onClose} style={{marginLeft:'auto',color:t.muted,background:'none',border:'none',cursor:'pointer',fontSize:18,lineHeight:1}}>✕</button>
        </div>
        <div style={{display:'flex',flex:1,overflow:'hidden',minHeight:0}}>
          {/* Levý panel — vstup */}
          <div style={{width:280,flexShrink:0,display:'flex',flexDirection:'column',padding:14,gap:9,borderRight:`1px solid ${t.border}`,overflow:'auto'}}>
            {/* Task */}
            <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:.6}}>Úkol</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
              {TASKS.map(tk=>(
                <button key={tk.id} onClick={()=>setTask(tk.id)}
                  style={{padding:'7px 5px',borderRadius:8,border:`1px solid ${task===tk.id?'#10b981':t.border}`,background:task===tk.id?'#10b98120':t.btn,cursor:'pointer',textAlign:'center',transition:'all .12s'}}>
                  <div style={{fontSize:15}}>{tk.icon}</div>
                  <div style={{fontSize:11,fontWeight:task===tk.id?700:400,color:task===tk.id?'#10b981':t.txt,marginTop:1}}>{tk.label}</div>
                  <div style={{fontSize:10,color:t.muted,lineHeight:1.3}}>{tk.sub}</div>
                </button>
              ))}
            </div>
            {/* Jazyk */}
            <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:.6}}>Jazyk</div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              {LANGS.map(l=>(
                <button key={l} onClick={()=>setLang(l)}
                  style={{padding:'2px 8px',borderRadius:10,fontSize:11,border:`1px solid ${lang===l?'#10b981':t.border}`,background:lang===l?'#10b98120':'transparent',color:lang===l?'#10b981':t.muted,cursor:'pointer',fontFamily:'inherit'}}>
                  {l}
                </button>
              ))}
            </div>
            {/* Cílový jazyk (jen pro konverzi) */}
            {task==='convert'&&(
              <>
                <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:.6}}>Cílový jazyk</div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {LANGS.filter(l=>l!==lang).map(l=>(
                    <button key={l} onClick={()=>setToLang(l)}
                      style={{padding:'2px 8px',borderRadius:10,fontSize:11,border:`1px solid ${toLang===l?'#6366f1':t.border}`,background:toLang===l?'#6366f120':'transparent',color:toLang===l?'#6366f1':t.muted,cursor:'pointer',fontFamily:'inherit'}}>
                      {l}
                    </button>
                  ))}
                </div>
              </>
            )}
            {/* Textarea */}
            <textarea value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&e.ctrlKey)run()}}
              placeholder={task==='write'?'Popiš co chceš napsat… (Ctrl+Enter = spustit)':'Vlož kód sem… (Ctrl+Enter = spustit)'}
              style={{flex:1,minHeight:140,padding:'9px 11px',background:t.inBg,border:`1px solid ${t.inBrd}`,borderRadius:8,color:t.txt,fontSize:12,fontFamily:'monospace',resize:'none',outline:'none',lineHeight:1.6}}/>
            <button onClick={run} disabled={loading||!input.trim()}
              style={{padding:'9px',borderRadius:8,background:loading||!input.trim()?t.btn:'#10b981',color:loading||!input.trim()?t.muted:'#fff',fontSize:13,fontWeight:700,border:'none',cursor:loading?'default':'pointer',transition:'all .18s'}}>
              {loading?'⏳ Generuji…':'▶ Spustit  (Ctrl+↵)'}
            </button>
            {err&&<div style={{fontSize:11,color:'#ef4444',background:'#ef444415',padding:'6px 10px',borderRadius:7}}>{err}</div>}
            {/* Historie */}
            {history.length>0&&(
              <div>
                <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>Historie</div>
                {history.slice(0,5).map((h,i)=>(
                  <div key={i} onClick={()=>setResult(h.result)}
                    style={{padding:'4px 8px',borderRadius:6,background:t.btn,marginBottom:3,cursor:'pointer',fontSize:11,color:t.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {TASKS.find(tk=>tk.id===h.task)?.icon} {h.input}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Pravý panel — výsledek */}
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>
            {result?(
              <>
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'9px 14px',borderBottom:`1px solid ${t.border}`,flexShrink:0,background:t.btn}}>
                  <span style={{fontSize:12,fontWeight:600,color:'#10b981'}}>✓ Výsledek</span>
                  <span style={{fontSize:11,color:t.muted,flex:1}}>{TASKS.find(tk=>tk.id===task)?.label} · {lang}{task==='convert'?' → '+toLang:''}</span>
                  <button onClick={()=>navigator.clipboard.writeText(result)} style={{padding:'3px 10px',borderRadius:6,fontSize:11,background:t.card,color:t.muted,border:`1px solid ${t.border}`,cursor:'pointer'}}>📋 Kopírovat</button>
                  <button onClick={()=>setResult(null)} style={{color:t.muted,background:'none',border:'none',cursor:'pointer',fontSize:12}}>✕</button>
                </div>
                <div style={{flex:1,overflow:'auto',padding:16}}
                  dangerouslySetInnerHTML={{__html:renderMD(result,true)}}/>
              </>
            ):(
              <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10,color:t.muted}}>
                <span style={{fontSize:44,fontFamily:'monospace'}}>{'</>'}</span>
                <span style={{fontSize:14,fontWeight:500}}>Výsledek se zobrazí zde</span>
                <span style={{fontSize:12,textAlign:'center',maxWidth:220,lineHeight:1.6,color:t.muted}}>Vyber úkol vlevo, jazyk, vlož kód a stiskni Spustit</span>
                <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap',justifyContent:'center',maxWidth:300}}>
                  {['Vysvětli bubble sort','Refaktoruj tento kód','Napiš testy pro login funkci'].map(s=>(
                    <button key={s} onClick={()=>{setInput(s);setTask(s.startsWith('Vysvětli')?'explain':s.startsWith('Refaktoruj')?'refactor':'gen_tests')}}
                      style={{padding:'4px 10px',borderRadius:10,fontSize:11,border:`1px solid ${t.border}`,background:t.btn,color:t.muted,cursor:'pointer',fontFamily:'inherit'}}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── LUMI COWORK — AI pro soubory a úkoly (Cowork styl) ───────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function LumiCowork({t,token,onClose,callEdge}){
  const[tab,setTab]=useState('tasks')
  const[tasks,setTasks]=useState(()=>{try{return JSON.parse(localStorage.getItem('lumi_tasks')||'[]')}catch{return[]}})
  const[newTask,setNewTask]=useState('')
  const[taskPri,setTaskPri]=useState('medium')
  const[docText,setDocText]=useState('')
  const[docResult,setDocResult]=useState(null)
  const[docOp,setDocOp]=useState('summarize')
  const[docQ,setDocQ]=useState('')
  const[loading,setLoading]=useState(false)
  const[aiTask,setAiTask]=useState('')
  const[aiResult,setAiResult]=useState(null)
  const[aiHistory,setAiHistory]=useState([]) // [{role,content}]
  const[err,setErr]=useState(null)

  const saveTasks=t_=>localStorage.setItem('lumi_tasks',JSON.stringify(t_))
  const addTask=()=>{
    if(!newTask.trim())return
    const t_=[...tasks,{id:Date.now(),text:newTask,priority:taskPri,done:false}]
    setTasks(t_);saveTasks(t_);setNewTask('')
  }
  const toggleTask=id=>{const t_=tasks.map(t=>t.id===id?{...t,done:!t.done}:t);setTasks(t_);saveTasks(t_)}
  const delTask=id=>{const t_=tasks.filter(t=>t.id!==id);setTasks(t_);saveTasks(t_)}

  // Anthropic API pro AI asistenta
  const callClaude=async(system,messages)=>{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,system,messages})
    })
    const d=await res.json()
    if(d.error)throw new Error(d.error.message)
    return d.content?.[0]?.text||''
  }

  // Dokumenty — přes callEdge (Gemini), výsledek přes renderMD
  const runDocOp=async()=>{
    if(!docText.trim())return
    setLoading(true);setDocResult(null);setErr(null)
    try{
      let d
      if(docOp==='summarize')    d=await callEdge('summarize',   {text:docText,style:'bullets'},token)
      else if(docOp==='analyze') d=await callEdge('analyze_doc', {text:docText,question:docQ||'Shrň hlavní body a klíčové informace.'},token)
      else if(docOp==='translate')d=await callEdge('translate',  {text:docText,targetLang:'angličtina'},token)
      else if(docOp==='correct') d=await callEdge('correct',     {text:docText},token)
      if(d?.error)throw new Error(d.error)
      setDocResult(d?.text||'Hotovo.')
    }catch(e){setErr('Dokument: '+e.message)}
    setLoading(false)
  }

  // AI Asistent — Anthropic (streaming-like přes useState history)
  const runAiTask=async()=>{
    if(!aiTask.trim())return
    setLoading(true);setErr(null)
    const newHistory=[...aiHistory,{role:'user',content:aiTask}]
    setAiHistory(newHistory);setAiTask('')
    try{
      const res=await callClaude(
        'Jsi Lumi Cowork — AI asistent pro produktivitu, plánování a správu úkolů. Odpovídej česky, konkrétně a prakticky. Formátuj pomocí markdown pro přehlednost.',
        newHistory
      )
      setAiResult(res)
      setAiHistory(h=>[...h,{role:'assistant',content:res}])
    }catch(e){setErr('AI: '+e.message)}
    setLoading(false)
  }

  const PRI={high:{label:'Vysoká',color:'#ef4444'},medium:{label:'Střední',color:'#f59e0b'},low:{label:'Nízká',color:'#10b981'}}

  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',zIndex:80,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}>
      <div onClick={e=>e.stopPropagation()} style={{width:'min(820px,97vw)',maxHeight:'91vh',display:'flex',flexDirection:'column',background:t.modal,border:`1px solid ${t.border}`,borderRadius:16,overflow:'hidden',animation:'fadeInScale .2s ease',fontFamily:"'DM Sans',sans-serif"}}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'13px 18px',borderBottom:`1px solid ${t.border}`,background:'#f59e0b10',flexShrink:0}}>
          <span style={{fontSize:20}}>🤝</span>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:'#f59e0b'}}>Lumi Cowork</div>
            <div style={{fontSize:11,color:t.muted}}>Úkoly · Dokumenty · AI asistent (Claude + Gemini)</div>
          </div>
          <button onClick={onClose} style={{marginLeft:'auto',color:t.muted,background:'none',border:'none',cursor:'pointer',fontSize:18,lineHeight:1}}>✕</button>
        </div>
        {/* Tabs */}
        <div style={{display:'flex',borderBottom:`1px solid ${t.border}`,flexShrink:0}}>
          {[['tasks','✅ Úkoly'],['docs','📄 Dokumenty'],['ai','🤖 AI asistent']].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)}
              style={{flex:1,padding:'10px',fontSize:13,border:'none',borderBottom:`2px solid ${tab===id?'#f59e0b':'transparent'}`,background:tab===id?'#f59e0b10':'transparent',color:tab===id?'#f59e0b':t.muted,cursor:'pointer',fontFamily:'inherit',fontWeight:tab===id?700:400,transition:'all .15s'}}>
              {label}
            </button>
          ))}
        </div>
        {err&&<div style={{margin:'8px 16px 0',padding:'6px 12px',background:'#ef444415',border:'1px solid #ef444430',borderRadius:7,fontSize:11,color:'#ef4444'}}>{err} <button onClick={()=>setErr(null)} style={{marginLeft:8,color:'#ef4444',background:'none',border:'none',cursor:'pointer'}}>✕</button></div>}
        {/* Content */}
        <div style={{flex:1,overflow:'auto',padding:16,minHeight:0}}>

          {/* ── ÚKOLY ── */}
          {tab==='tasks'&&(
            <div>
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()}
                  placeholder="Přidat úkol… (Enter)"
                  style={{flex:1,padding:'8px 12px',background:t.inBg,border:`1px solid ${t.inBrd}`,borderRadius:8,color:t.txt,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
                <div style={{display:'flex',gap:4}}>
                  {Object.entries(PRI).map(([k,v])=>(
                    <button key={k} onClick={()=>setTaskPri(k)}
                      style={{padding:'4px 8px',borderRadius:6,border:`1px solid ${taskPri===k?v.color:t.border}`,background:taskPri===k?v.color+'22':'transparent',color:taskPri===k?v.color:t.muted,fontSize:11,cursor:'pointer'}}>
                      {v.label}
                    </button>
                  ))}
                </div>
                <button onClick={addTask} style={{padding:'8px 16px',borderRadius:8,background:'#f59e0b',color:'#fff',fontSize:15,fontWeight:700,border:'none',cursor:'pointer'}}>+</button>
              </div>
              {tasks.length===0
                ?<div style={{textAlign:'center',color:t.muted,padding:40,fontSize:13}}>Žádné úkoly · přidej první!</div>
                :<div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {['high','medium','low'].map(pri=>{
                    const pt=tasks.filter(t=>t.priority===pri)
                    if(!pt.length)return null
                    return(<div key={pri}>
                      <div style={{fontSize:10,color:PRI[pri].color,textTransform:'uppercase',letterSpacing:.6,margin:'8px 0 4px',fontWeight:600}}>{PRI[pri].label} priorita</div>
                      {pt.map(task=>(
                        <div key={task.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 11px',borderRadius:9,background:task.done?t.btn:t.card,border:`1px solid ${task.done?t.border:PRI[pri].color+'33'}`,marginBottom:4,transition:'all .15s'}}>
                          <input type="checkbox" checked={task.done} onChange={()=>toggleTask(task.id)} style={{accentColor:PRI[pri].color,cursor:'pointer',width:15,height:15,flexShrink:0}}/>
                          <span style={{flex:1,fontSize:13,color:task.done?t.muted:t.txt,textDecoration:task.done?'line-through':'none'}}>{task.text}</span>
                          <span style={{width:7,height:7,borderRadius:'50%',background:PRI[pri].color,flexShrink:0}}/>
                          <button onClick={()=>delTask(task.id)} style={{color:t.muted,background:'none',border:'none',cursor:'pointer',fontSize:15,lineHeight:1,padding:'0 2px'}}>×</button>
                        </div>
                      ))}
                    </div>)
                  })}
                  <div style={{fontSize:11,color:t.muted,textAlign:'center',marginTop:10}}>
                    ✅ {tasks.filter(t=>t.done).length} / {tasks.length} hotovo
                  </div>
                </div>
              }
            </div>
          )}

          {/* ── DOKUMENTY ── */}
          {tab==='docs'&&(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {[['summarize','📋 Shrnutí'],['analyze','🔍 Analýza'],['translate','🌐 Překlad EN'],['correct','✏️ Korektura']].map(([id,label])=>(
                  <button key={id} onClick={()=>{setDocOp(id);setDocResult(null);setErr(null)}}
                    style={{padding:'6px 13px',borderRadius:8,border:`1px solid ${docOp===id?'#f59e0b':t.border}`,background:docOp===id?'#f59e0b22':t.btn,color:docOp===id?'#f59e0b':t.muted,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:docOp===id?700:400}}>
                    {label}
                  </button>
                ))}
              </div>
              {docOp==='analyze'&&(
                <input value={docQ} onChange={e=>setDocQ(e.target.value)} placeholder="Otázka k dokumentu (volitelné)…"
                  style={{padding:'7px 11px',background:t.inBg,border:`1px solid ${t.inBrd}`,borderRadius:7,color:t.txt,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
              )}
              <textarea value={docText} onChange={e=>setDocText(e.target.value)} placeholder="Vlož text dokumentu…"
                style={{minHeight:150,padding:'10px 12px',background:t.inBg,border:`1px solid ${t.inBrd}`,borderRadius:8,color:t.txt,fontSize:13,resize:'none',outline:'none',fontFamily:'inherit',lineHeight:1.6}}/>
              <button onClick={runDocOp} disabled={loading||!docText.trim()}
                style={{padding:'9px',borderRadius:8,background:loading||!docText.trim()?t.btn:'#f59e0b',color:loading||!docText.trim()?t.muted:'#fff',fontSize:13,fontWeight:700,border:'none',cursor:loading?'default':'pointer'}}>
                {loading?'⏳ Zpracovávám…':'▶ Spustit'}
              </button>
              {docResult&&(
                <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,overflow:'hidden'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 13px',borderBottom:`1px solid ${t.border}`,background:t.btn}}>
                    <span style={{fontSize:12,fontWeight:600,color:'#f59e0b'}}>✓ Výsledek</span>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>navigator.clipboard.writeText(docResult)} style={{fontSize:11,padding:'3px 9px',borderRadius:5,background:t.card,color:t.muted,border:`1px solid ${t.border}`,cursor:'pointer'}}>📋 Kopírovat</button>
                      <button onClick={()=>setDocResult(null)} style={{color:t.muted,background:'none',border:'none',cursor:'pointer',fontSize:12}}>✕</button>
                    </div>
                  </div>
                  {/* renderMD místo <pre> */}
                  <div style={{padding:'12px 14px',lineHeight:1.7,fontSize:13,color:t.txt}}
                    dangerouslySetInnerHTML={{__html:renderMD(docResult,true)}}/>
                </div>
              )}
            </div>
          )}

          {/* ── AI ASISTENT ── */}
          {tab==='ai'&&(
            <div style={{display:'flex',flexDirection:'column',gap:10,height:'100%'}}>
              {/* Quick prompts */}
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {['📅 Navrhni týdenní plán','⚡ Prioritizuj mé úkoly','✉️ Napiš email kolegovi','💡 Brainstorm nápady','📊 Shrň výsledky týdne'].map(s=>(
                  <button key={s} onClick={()=>setAiTask(s.slice(2).trim())}
                    style={{padding:'4px 10px',borderRadius:10,fontSize:11,border:`1px solid ${t.border}`,background:t.btn,color:t.muted,cursor:'pointer',fontFamily:'inherit',transition:'all .12s'}}>
                    {s}
                  </button>
                ))}
              </div>
              {/* Chat historie */}
              {aiHistory.length>0&&(
                <div style={{flex:1,overflow:'auto',display:'flex',flexDirection:'column',gap:8,minHeight:120,maxHeight:320,padding:'4px 0'}}>
                  {aiHistory.map((m,i)=>(
                    <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',flexDirection:m.role==='user'?'row-reverse':'row'}}>
                      <div style={{width:26,height:26,borderRadius:'50%',background:m.role==='user'?t.accent+'33':'#f59e0b33',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>
                        {m.role==='user'?'👤':'🤝'}
                      </div>
                      {m.role==='assistant'
                        ?<div style={{flex:1,background:t.card,border:`1px solid ${t.border}`,borderRadius:'12px 12px 12px 3px',padding:'9px 13px',fontSize:13,lineHeight:1.6}}
                            dangerouslySetInnerHTML={{__html:renderMD(m.content,true)}}/>
                        :<div style={{flex:1,background:t.accent+'18',border:`1px solid ${t.accent}33`,borderRadius:'12px 12px 3px 12px',padding:'9px 13px',fontSize:13,color:t.txt,lineHeight:1.6}}>
                            {m.content}
                          </div>
                      }
                    </div>
                  ))}
                  {loading&&<div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <div style={{width:26,height:26,borderRadius:'50%',background:'#f59e0b33',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>🤝</div>
                    <div style={{padding:'9px 13px',background:t.card,border:`1px solid ${t.border}`,borderRadius:'12px 12px 12px 3px',fontSize:13,color:t.muted}}>⏳ Přemýšlím…</div>
                  </div>}
                </div>
              )}
              {aiHistory.length===0&&!loading&&(
                <div style={{textAlign:'center',color:t.muted,padding:'20px 0',fontSize:13}}>
                  🤖 Zeptej se na cokoliv ohledně produktivity nebo práce
                </div>
              )}
              {/* Input */}
              <div style={{display:'flex',gap:8,marginTop:'auto'}}>
                <textarea value={aiTask} onChange={e=>setAiTask(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();runAiTask()}}}
                  placeholder="Napiš úkol nebo otázku… (Enter = odeslat, Shift+Enter = nový řádek)"
                  rows={2}
                  style={{flex:1,padding:'9px 12px',background:t.inBg,border:`1px solid ${t.inBrd}`,borderRadius:8,color:t.txt,fontSize:13,resize:'none',outline:'none',fontFamily:'inherit',lineHeight:1.5}}/>
                <button onClick={runAiTask} disabled={loading||!aiTask.trim()}
                  style={{padding:'0 16px',borderRadius:8,background:loading||!aiTask.trim()?t.btn:'#f59e0b',color:loading||!aiTask.trim()?t.muted:'#fff',fontSize:16,fontWeight:700,border:'none',cursor:loading?'default':'pointer',flexShrink:0}}>
                  ↑
                </button>
              </div>
              {aiHistory.length>0&&(
                <button onClick={()=>{setAiHistory([]);setAiResult(null)}}
                  style={{fontSize:11,color:t.muted,background:'none',border:'none',cursor:'pointer',alignSelf:'center'}}>
                  🗑️ Smazat historii
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── GoalsModal — Sledování cílů (nápad 19) ────────────────────────────────────
function GoalsModal({t,token,onClose,callEdge}){
  const[goals,setGoals]=useState([])
  const[loading,setLoading]=useState(true)
  const[adding,setAdding]=useState(false)
  const[newTitle,setNewTitle]=useState('')
  const[newDesc,setNewDesc]=useState('')
  const[newDue,setNewDue]=useState('')

  useEffect(()=>{
    callEdge('get_goals',{},token).then(d=>{setGoals(d.goals||[]);setLoading(false)}).catch(()=>setLoading(false))
  },[]) // eslint-disable-line

  const addGoal=async()=>{
    if(!newTitle.trim())return
    await callEdge('save_goal',{title:newTitle,description:newDesc,due_date:newDue||null},token)
    setNewTitle('');setNewDesc('');setNewDue('');setAdding(false)
    const d=await callEdge('get_goals',{},token)
    setGoals(d.goals||[])
  }

  const updateProgress=async(id,progress)=>{
    setGoals(p=>p.map(g=>g.id===id?{...g,progress}:g))
    await callEdge('update_goal_progress',{goal_id:id,progress},token)
  }

  const statusColor={active:t.accent,completed:t.green,paused:t.muted}
  const statusLabel={active:'Aktivní',completed:'Splněno ✓',paused:'Pozastaveno'}

  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:70,backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{width:'min(540px,96vw)',maxHeight:'85vh',display:'flex',flexDirection:'column',background:t.modal,border:`1px solid ${t.border}`,borderRadius:18,fontFamily:"'DM Sans',sans-serif",animation:'fadeInScale .25s ease',overflow:'hidden'}}>
        <div style={{padding:'18px 20px 14px',borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontWeight:700,fontSize:16,color:t.txt}}>🎯 Moje cíle</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setAdding(a=>!a)} style={{padding:'5px 12px',borderRadius:8,background:t.accent,color:'#fff',fontSize:12,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>+ Přidat cíl</button>
            <button onClick={onClose} style={{padding:'5px 10px',borderRadius:8,background:t.btn,color:t.muted,fontSize:12,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit'}}>✕</button>
          </div>
        </div>

        {adding&&(
          <div style={{padding:'14px 20px',borderBottom:`1px solid ${t.border}`,background:t.active,flexShrink:0}}>
            <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Název cíle…"
              style={{width:'100%',padding:'8px 11px',background:t.inBg,color:t.txt,border:`1.5px solid ${t.accent}`,borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit',marginBottom:7,boxSizing:'border-box'}}/>
            <input value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="Popis (volitelný)…"
              style={{width:'100%',padding:'7px 11px',background:t.inBg,color:t.txt,border:`1px solid ${t.border}`,borderRadius:8,fontSize:12,outline:'none',fontFamily:'inherit',marginBottom:7,boxSizing:'border-box'}}/>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="date" value={newDue} onChange={e=>setNewDue(e.target.value)}
                style={{flex:1,padding:'7px 10px',background:t.inBg,color:t.txt,border:`1px solid ${t.border}`,borderRadius:8,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
              <button onClick={addGoal} disabled={!newTitle.trim()}
                style={{padding:'7px 16px',borderRadius:8,background:newTitle.trim()?t.accent:t.btn,color:newTitle.trim()?'#fff':t.muted,fontSize:12,fontWeight:600,border:'none',cursor:newTitle.trim()?'pointer':'default',fontFamily:'inherit'}}>
                Uložit
              </button>
              <button onClick={()=>setAdding(false)} style={{padding:'7px 10px',borderRadius:8,background:t.btn,color:t.muted,fontSize:12,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit'}}>Zrušit</button>
            </div>
          </div>
        )}

        <div style={{flex:1,overflowY:'auto',padding:'12px 20px'}}>
          {loading&&<div style={{textAlign:'center',color:t.muted,padding:20}}>Načítám…</div>}
          {!loading&&!goals.length&&<div style={{textAlign:'center',color:t.muted,padding:20}}>Zatím žádné cíle. Přidej první! 🎯</div>}
          {goals.map(g=>(
            <div key={g.id} style={{marginBottom:12,padding:'12px',background:t.aiB,borderRadius:12,border:`1px solid ${t.border}`}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:6}}>
                <div>
                  <div style={{fontWeight:600,fontSize:14,color:t.txt}}>{g.title}</div>
                  {g.description&&<div style={{fontSize:12,color:t.muted,marginTop:2}}>{g.description}</div>}
                  {g.due_date&&<div style={{fontSize:11,color:t.muted,marginTop:2}}>📅 Termín: {new Date(g.due_date).toLocaleDateString('cs-CZ')}</div>}
                </div>
                <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:(statusColor[g.status]||t.muted)+'22',color:statusColor[g.status]||t.muted,fontWeight:600,flexShrink:0,marginLeft:8}}>
                  {statusLabel[g.status]||g.status}
                </span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{flex:1,height:6,background:t.btn,borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${g.progress||0}%`,background:`linear-gradient(90deg,${t.accent},${t.purple})`,borderRadius:3,transition:'width .3s'}}/>
                </div>
                <span style={{fontSize:11,color:t.muted,minWidth:32}}>{g.progress||0}%</span>
                <input type="range" min={0} max={100} value={g.progress||0}
                  onChange={e=>updateProgress(g.id,Number(e.target.value))}
                  style={{width:80,accentColor:t.accent,cursor:'pointer'}}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── PlusMenu — 5 hlavních nástrojů + Zobrazit více ────────────────────────────
function PlusMenu({t,imgMode,setImgMode,toolMode,setToolMode,quizMode,setQuizMode,
  showBookmarks,setShowBookmarks,showTemplates,setShowTemplates,showCalc,setShowCalc,
  showFocusTimer,setShowFocusTimer,showLive,showAddMem,isLoggedIn,fileRef}){
  const[expanded,setExpanded]=useState(false)
  const setTool=id=>{ setToolMode(toolMode===id?null:id); setImgMode('chat'); setQuizMode(false) }
  return(
    <div style={{padding:'4px 0',width:258}}>
      {/* 5 hlavních */}
      <DItem t={t} onClick={()=>fileRef.current.click()} active={false} clr={t.accent} icon="📎" label="Přidat soubor" sub="Obrázek, PDF, kód, text…"/>
      <DItem t={t} onClick={()=>{setImgMode(imgMode==='web_search'?'chat':'web_search');setToolMode(null);setQuizMode(false)}} active={imgMode==='web_search'} clr={t.green} icon="🌐" label="Web Search" sub="Hledej na internetu"/>
      <DItem t={t} onClick={()=>{setImgMode(imgMode==='generate_image'?'chat':'generate_image');setToolMode(null);setQuizMode(false)}} active={imgMode==='generate_image'} clr={t.purple} icon="🎨" label="AI Obrázek" sub="Generuj z textu"/>
      <DItem t={t} onClick={()=>{setQuizMode(m=>!m);if(!quizMode)setImgMode('chat');setToolMode(null)}} active={quizMode} clr='#f59e0b' icon="🎓" label="Kvíz" sub="Interaktivní test"/>
      {isLoggedIn&&<DItem t={t} onClick={showLive} active={false} clr='#f87171' icon="🔴" label="Live — hlas" sub="STT → AI → TTS"/>}

      {/* Zobrazit více */}
      <button onClick={()=>setExpanded(e=>!e)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 12px',background:'transparent',color:t.muted,fontSize:12,fontFamily:'inherit',cursor:'pointer',border:'none',borderTop:`1px solid ${t.border}`,marginTop:4}}>
        <span>{expanded?'▲ Zobrazit méně':'▼ Zobrazit více nástrojů'}</span>
      </button>

      {expanded&&<>
        {/* Utility */}
        <div style={{fontSize:9,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.1em',padding:'6px 12px 2px'}}>Utility</div>
        <DItem t={t} onClick={()=>{setShowBookmarks(s=>!s);setShowTemplates(false);setShowCalc(false)}} active={showBookmarks} clr={t.accent} icon="🔖" label="Záložky promptů" sub="Uložené prompty"/>
        <DItem t={t} onClick={()=>{setShowTemplates(s=>!s);setShowCalc(false);setShowBookmarks(false)}} active={showTemplates} clr={t.accent} icon="📝" label="Šablony zpráv"/>
        <DItem t={t} onClick={()=>{setShowCalc(s=>!s);setShowTemplates(false);setShowBookmarks(false)}} active={showCalc} clr={t.accent} icon="🔢" label="Kalkulačka"/>
        <DItem t={t} onClick={()=>{setImgMode(imgMode==='image_search'?'chat':'image_search');setToolMode(null);setQuizMode(false)}} active={imgMode==='image_search'} clr={t.accent} icon="📷" label="Fotografie" sub="Unsplash / Pixabay"/>
        <DItem t={t} onClick={()=>setShowFocusTimer(f=>!f)} active={showFocusTimer} clr={t.accent} icon="⏱" label="Focus Timer" sub="Pomodoro"/>
        {isLoggedIn&&<DItem t={t} onClick={showAddMem} active={false} clr={t.green} icon="🧠" label="Přidat do paměti"/>}

        {/* Textové */}
        <div style={{fontSize:9,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.1em',padding:'6px 12px 2px',borderTop:`1px solid ${t.border}`,marginTop:4}}>📝 Textové nástroje</div>
        {[['write_text','✍️','Psaní textů'],['translate','🌍','Překlad'],['summarize','📋','Sumarizace'],
          ['correct','✅','Korektura'],['rewrite','✏️','Přepis stylu'],['headlines','📰','Nadpisy'],
          ['seo','🔍','SEO'],['email','📧','E-mail'],['sentiment','😊','Analýza sentimentu'],
        ].map(([id,icon,label])=><DItem key={id} t={t} onClick={()=>setTool(id)} active={toolMode===id} clr='#06b6d4' icon={icon} label={label}/>)}

        {/* Kód */}
        <div style={{fontSize:9,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.1em',padding:'6px 12px 2px',borderTop:`1px solid ${t.border}`,marginTop:4}}>💻 Kód & Vývoj</div>
        {[['write_code','💻','Psaní kódu'],['debug','🐛','Debuggování'],['explain_code','🔬','Vysvětli kód'],
          ['refactor','🔧','Refaktoring'],['gen_tests','🧪','Generuj testy'],['convert_code','🔄','Konverze'],
          ['db_schema','🗄️','DB & SQL'],['api_help','🔌','API integrace'],
        ].map(([id,icon,label])=><DItem key={id} t={t} onClick={()=>setTool(id)} active={toolMode===id} clr='#f97316' icon={icon} label={label}/>)}

        {/* Analýza */}
        <div style={{fontSize:9,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.1em',padding:'6px 12px 2px',borderTop:`1px solid ${t.border}`,marginTop:4}}>🔍 Analýza & Výzkum</div>
        {[['analyze_doc','📄','Analyzuj dokument'],['fact_check','🔎','Fact Check'],
          ['data_analysis','📈','Data analýza'],['research','🔬','Vědecký výzkum'],
          ['describe_image','👁️','Popis obrázku'],['analyze_chart','📊','Analýza grafu'],
        ].map(([id,icon,label])=><DItem key={id} t={t} onClick={()=>setTool(id)} active={toolMode===id} clr='#a855f7' icon={icon} label={label}/>)}

        {/* Kreativita */}
        <div style={{fontSize:9,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.1em',padding:'6px 12px 2px',borderTop:`1px solid ${t.border}`,marginTop:4}}>🎓 Vzdělávání & Kreativita</div>
        {[['tutor','🎓','Tutoring'],['presentation','📊','Prezentace'],['roleplay','🎭','Roleplay'],
          ['task_plan','🗺️','Plánování úkolů'],['brainstorm','💡','Brainstorming'],
        ].map(([id,icon,label])=><DItem key={id} t={t} onClick={()=>setTool(id)} active={toolMode===id} clr='#f59e0b' icon={icon} label={label}/>)}
      </>}
    </div>
  )
}

export default function Chat({session}){
  const[themeName,setThemeName]=useState(()=>localStorage.getItem('lumi_theme')||'dark')
  const[showAuth,setShowAuth]=useState(false)
  const[showSet,setShowSet]=useState(false)
  const[showLive,setShowLive]=useState(false)
  const[showAddMem,setShowAddMem]=useState(false)
  const[showGoals,setShowGoals]=useState(false)
  const[shareSlug,setShareSlug]=useState('')    // pro sdílení konverzace
  const[showShareModal,setShowShareModal]=useState(false)
  const[cookies,setCookies]=useState(()=>localStorage.getItem('lumi_cookies')==='1')
  const[sysPmt,setSysPmt]=useState(()=>localStorage.getItem('lumi_sys')||SYS_DEFAULT)
  const[aiModel,setAiModel]=useState(()=>localStorage.getItem('lumi_model')||'default')
  // Modes
  const[imgMode,setImgMode]=useState('chat')
  const[imgModel,setImgModel]=useState(IMG_MODELS[0].id)
  const[webSearchType,setWebSearchType]=useState('web')
  const[thinking,setThinking]=useState(false)
  const[memory,setMemory]=useState(true)
  const[mdMode,setMdMode]=useState(true)
  // UI toggles
  const[sideOpen,setSideOpen]=useState(()=>typeof window!=='undefined'&&window.innerWidth>768)
  const[input,setInput]=useState('')
  const[atts,setAtts]=useState([])
  const[loading,setLoading]=useState(false)
  const[err,setErr]=useState(null)
  const[showImgStyles,setShowImgStyles]=useState(false)
  const[showTemplates,setShowTemplates]=useState(false)
  const[showCalc,setShowCalc]=useState(false)
  const[showBookmarks,setShowBookmarks]=useState(false)
  const[showFocusTimer,setShowFocusTimer]=useState(false)
  const[toolMode,setToolMode]=useState(null)
  const[toolOptions,setToolOptions]=useState({})
  const[isDragging,setIsDragging]=useState(false)
  // ── LUMI CODE + LUMI COWORK ─────────────────────────────────────────────────
  const[showLumiCode,setShowLumiCode]=useState(false)
  const[showLumiCowork,setShowLumiCowork]=useState(false)
  // ── ARTIFACTS (Claude AI styl) ──────────────────────────────────────────────
  const[artifact,setArtifact]=useState(null)       // {code, lang, title}
  const[artifactOpen,setArtifactOpen]=useState(false)
  const[artifactTab,setArtifactTab]=useState('preview') // 'preview' | 'code'
  // ── PROJEKTY ────────────────────────────────────────────────────────────────
  const[projects,setProjects]=useState([])
  const[activeProject,setActiveProject]=useState(null)   // vybraný projekt
  const[showProjectModal,setShowProjectModal]=useState(false)
  const[editProject,setEditProject]=useState(null)       // editovaný projekt nebo null=nový
  // ── STYL PSANÍ ──────────────────────────────────────────────────────────────
  const[writeStyle,setWriteStyle]=useState(null) // null|'concise'|'detailed'|'formal'|'casual'|'technical'
  // Conversations
  const[convs,setConvs]=useState([mkLocal()])
  const[activeId,setActiveId]=useState(null)
  const[msgs,setMsgs]=useState([])
  const[dbLoad,setDbLoad]=useState(false)
  const[searchQ,setSearchQ]=useState(''),[searchOpen,setSearchOpen]=useState(false),[searchRes,setSearchRes]=useState([])
  const[editId,setEditId]=useState(null),[editTitle,setEditTitle]=useState('')
  // Quiz
  const[quizMode,setQuizMode]=useState(false)
  const[quizTopic,setQuizTopic]=useState('')
  const[quizCount,setQuizCount]=useState(5)
  const[quizDiff,setQuizDiff]=useState('medium')
  // Misc
  const[explainTxt,setExplainTxt]=useState(null)
  const[token,setToken]=useState(null)
  const[starred,setStarred]=useState(new Set())
  const[pinnedMsgs,setPinnedMsgs]=useState(new Set())
  const[showStarred,setShowStarred]=useState(false)
  const[newIds,setNewIds]=useState(new Set())
  const[typingIds,setTypingIds]=useState(new Set())
  const[wordCount,setWordCount]=useState(0)
  const[pollenInfo,setPollenInfo]=useState(()=>({remaining:POLLEN_LIMIT,...getPollenCache()}))
  const[autoMemToast,setAutoMemToast]=useState('')
  // Persistence přes session: počasí a search přežijí refresh
  const[lastWeather]=useState(()=>{try{const d=sessionStorage.getItem('lumi_weather');return d?JSON.parse(d):null}catch{return null}})
  const draftTimerRef=useRef(null)

  const endRef=useRef(null),fileRef=useRef(null),taRef=useRef(null),searchRef=useRef(null)
  const t=THEMES[themeName]||THEMES.dark
  const isLoggedIn=!!session
  const activeConv=useMemo(()=>convs.find(c=>c.id===activeId)??convs[0]??null,[convs,activeId])

  // Persist settings
  useEffect(()=>{localStorage.setItem('lumi_theme',themeName)},[themeName])
  useEffect(()=>{localStorage.setItem('lumi_sys',sysPmt)},[sysPmt])
  useEffect(()=>{localStorage.setItem('lumi_model',aiModel)},[aiModel])

  // Init
  useEffect(()=>{
    if(isLoggedIn){getFreshToken().then(setToken);loadConvs();loadProjects()}
    else{const c=mkLocal();setConvs([c]);setActiveId(c.id);setMsgs([])}
  },[isLoggedIn]) // eslint-disable-line

  // Načtení projektů
  async function loadProjects(){
    try{const tk=await getFreshToken()||ANON;const d=await callEdge('get_projects',{},tk);if(d.projects)setProjects(d.projects)}catch{}
  }

  // Detekce artifactů v AI odpovědi — hledá ```html, ```jsx, ```js, ```python bloky
  function detectArtifact(text){
    const m=text.match(/```(html|jsx|tsx|js|javascript|python|css|svg|react)\n([\s\S]*?)```/i)
    if(!m)return null
    return{lang:m[1].toLowerCase(),code:m[2],title:m[1].toUpperCase()+' artifact'}
  }

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[msgs.length,loading])
  useEffect(()=>{setWordCount(input.trim()?input.trim().split(/\s+/).filter(Boolean).length:0)},[input])

  // Draft autosave
  useEffect(()=>{
    if(!isLoggedIn||!activeId||activeConv?.local)return
    if(draftTimerRef.current)clearTimeout(draftTimerRef.current)
    draftTimerRef.current=setTimeout(async()=>{try{await callEdge('save_draft',{conv_id:activeId,draft:input},token||ANON)}catch{}},2000)
    return()=>{if(draftTimerRef.current)clearTimeout(draftTimerRef.current)}
  },[input,activeId]) // eslint-disable-line

  // Load draft on conv switch
  useEffect(()=>{
    if(!isLoggedIn||!activeId||activeConv?.local)return
    if(draftTimerRef.current){clearTimeout(draftTimerRef.current);draftTimerRef.current=null}
    setInput('')
    callEdge('load_draft',{conv_id:activeId},token||ANON).then(d=>{if(d.draft)setInput(d.draft)}).catch(()=>{})
    if(token)callEdge('get_pollen_status',{imgModel},token).then(ps=>{if(ps?.remaining!==undefined){setPollenInfo(ps);setPollenCache(ps)}}).catch(()=>{})
  },[activeId]) // eslint-disable-line

  // Drag & drop
  useEffect(()=>{
    const el=document.getElementById('lumi-main');if(!el)return
    const onDO=e=>{e.preventDefault();setIsDragging(true)}
    const onDL=e=>{if(!el.contains(e.relatedTarget))setIsDragging(false)}
    const onDrop=async e=>{
      e.preventDefault();setIsDragging(false)
      const files=Array.from(e.dataTransfer.files);if(!files.length)return
      const res=await Promise.all(files.map(f=>new Promise(r=>{const rd=new FileReader();rd.onload=()=>r({id:uid(),name:f.name,type:f.type,size:f.size,data:rd.result.split(',')[1],preview:f.type.startsWith('image/')?rd.result:null});rd.readAsDataURL(f)})))
      setAtts(p=>[...p,...res])
    }
    el.addEventListener('dragover',onDO);el.addEventListener('dragleave',onDL);el.addEventListener('drop',onDrop)
    return()=>{el.removeEventListener('dragover',onDO);el.removeEventListener('dragleave',onDL);el.removeEventListener('drop',onDrop)}
  },[])

  // Keyboard shortcuts
  useEffect(()=>{
    const h=e=>{
      const isMod=e.ctrlKey||e.metaKey
      if(isMod){
        if(e.key==='k'){e.preventDefault();newConv()}
        if(e.key==='e'){e.preventDefault();exportChat()}
        if(e.key==='b'&&document.activeElement===taRef.current){
          e.preventDefault()
          const ta=taRef.current,s=ta.selectionStart,en=ta.selectionEnd
          if(s!==en){const sel=input.slice(s,en);setInput(input.slice(0,s)+'**'+sel+'**'+input.slice(en))}
        }
      }
      if(e.key==='Escape'){setExplainTxt(null);setShowFocusTimer(false)}
    }
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)
  },[input]) // eslint-disable-line

  // ── DB ────────────────────────────────────────────────────────────────────
  async function loadConvs(){
    setDbLoad(true)
    const{data}=await supabase.from('conversations').select('id,title,updated_at,color').order('updated_at',{ascending:false}).limit(50)
    if(data?.length>0){setConvs(data.map(c=>({...c,local:false})));setActiveId(data[0].id);await loadMsgs(data[0].id)}
    else{const c=await createConv();if(c){setConvs([{...c,local:false}]);setActiveId(c.id);setMsgs([])}}
    setDbLoad(false)
  }
  async function loadMsgs(cid){
    const{data}=await supabase.from('messages').select('id,role,content,type,image_url,created_at,starred,pinned').eq('conversation_id',cid).order('created_at',{ascending:true}).limit(200)
    setMsgs(data??[]);setStarred(new Set((data??[]).filter(m=>m.starred).map(m=>m.id)));setPinnedMsgs(new Set((data??[]).filter(m=>m.pinned).map(m=>m.id)))
  }
  async function createConv(title='Nová konverzace'){const{data}=await supabase.from('conversations').insert({user_id:session.user.id,title}).select('id,title,updated_at,color').single();return data}

  // Uloží zprávu — meta se komprimuje před uložením (base64 bez null bytes)
  async function saveMsg(cid,role,content,type='text',meta=null){
    let image_url=null
    if(meta){
      try{
        const raw=JSON.stringify(meta)
        // Pro velké obrázky (>50KB) uložíme jen metadata bez imageData (šetří DB)
        if(type==='generated_image'&&meta.imageData&&raw.length>80000){
          image_url=JSON.stringify({prompt:meta.prompt,mimeType:meta.mimeType,modelId:meta.modelId,_truncated:true})
        } else {
          image_url=raw
        }
      }catch{image_url=null}
    }
    const{data}=await supabase.from('messages').insert({conversation_id:cid,role,content,type,image_url}).select('id').single()
    return data
  }

  async function newConv(){
    setErr(null);setInput('');setAtts([])
    if(isLoggedIn){const c=await createConv();if(c){setConvs(p=>[{...c,local:false},...p]);setActiveId(c.id);setMsgs([])}}
    else{const c=mkLocal();setConvs(p=>[c,...p]);setActiveId(c.id)}
    if(typeof window!=='undefined'&&window.innerWidth<=768)setSideOpen(false)
  }
  async function selectConv(id){setActiveId(id);setErr(null);if(isLoggedIn)await loadMsgs(id)}
  async function delConv(id,e){
    e.stopPropagation();if(isLoggedIn)await supabase.from('conversations').delete().eq('id',id)
    setConvs(prev=>{const next=prev.filter(c=>c.id!==id);const list=next.length>0?next:[mkLocal()];if(id===activeId){setActiveId(list[0].id);if(isLoggedIn&&next.length>0)loadMsgs(list[0].id);else setMsgs([])}return list})
  }
  async function renameConv(id,title){if(!title.trim())return;if(isLoggedIn)await supabase.from('conversations').update({title}).eq('id',id);setConvs(p=>p.map(c=>c.id===id?{...c,title}:c));setEditId(null)}

  // AutoTitle — volá se AŽ PO AI odpovědi, použije kontext obou zpráv pro lepší název
  async function autoTitle(cid,context){
    try{
      const d=await callEdge('auto_title',{messages:[{role:'user',content:[{type:'text',text:context.slice(0,300)}]}]},token||ANON)
      if(d.title?.trim()){
        const title=d.title.trim().replace(/^["']|["']$/g,'') // odstraň uvozovky
        if(isLoggedIn)await supabase.from('conversations').update({title}).eq('id',cid)
        setConvs(p=>p.map(c=>c.id===cid?{...c,title}:c))
      }
    }catch{}
  }
  const starMsg=async msg=>{const ns=!starred.has(msg.id);setStarred(p=>{const n=new Set(p);ns?n.add(msg.id):n.delete(msg.id);return n});if(isLoggedIn)await supabase.from('messages').update({starred:ns}).eq('id',msg.id)}
  const pinMsg=async msg=>{const np=!pinnedMsgs.has(msg.id);setPinnedMsgs(p=>{const n=new Set(p);np?n.add(msg.id):n.delete(msg.id);return n});if(isLoggedIn)await supabase.from('messages').update({pinned:np}).eq('id',msg.id)}
  const exportChat=()=>{
    const lines=displayMsgs.map(m=>`[${m.role==='user'?'Vy':'Lumi'}] ${fmtTime(m.created_at)}\n${m.content}\n`)
    const b=new Blob([`Chat: ${activeConv?.title}\n${new Date().toLocaleString('cs-CZ')}\n\n`+lines.join('\n---\n\n')],{type:'text/plain;charset=utf-8'})
    const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`lumi-${activeConv?.title||'chat'}.txt`;a.click()
  }
  async function doSearch(q){
    setSearchQ(q);if(!q.trim()){setSearchRes([]);return}
    if(isLoggedIn){const{data}=await supabase.from('conversations').select('id,title,updated_at').ilike('title',`%${q}%`).limit(8);setSearchRes(data??[])}
    else setSearchRes(convs.filter(c=>c.title.toLowerCase().includes(q.toLowerCase())))
  }
  const onFile=async e=>{
    const files=Array.from(e.target.files)
    const res=await Promise.all(files.map(f=>new Promise(r=>{const rd=new FileReader();rd.onload=()=>r({id:uid(),name:f.name,type:f.type,size:f.size,data:rd.result.split(',')[1],preview:f.type.startsWith('image/')?rd.result:null});rd.readAsDataURL(f)})))
    setAtts(p=>[...p,...res]);fileRef.current.value=''
  }
  const addNewAnim=id=>{setNewIds(s=>{const n=new Set(s);n.add(id);setTimeout(()=>setNewIds(s2=>{const n2=new Set(s2);n2.delete(id);return n2}),700);return n})}

  // Auto-paměť
  const tryAutoMemory=useCallback(async(text)=>{
    if(!isLoggedIn||!token)return
    const m=detectMemoryInfo(text)
    if(!m.save)return
    try{await callEdge('save_memory',{content:m.content,category:m.category,source:'auto'},token);setAutoMemToast(`🧠 Zapamatováno: „${m.content.slice(0,35)}…"`);setTimeout(()=>setAutoMemToast(''),3000)}catch{}
  },[isLoggedIn,token])

  const addMemoryManual=async(content,cat)=>{if(!isLoggedIn||!content)return;try{await callEdge('save_memory',{content,category:cat,source:'manual'},token)}catch{}}

  // Sdílení konverzace (nápad 2)
  const shareConversation=async()=>{
    if(!activeConv||!isLoggedIn)return
    try{
      const tk=await getFreshToken()||ANON
      const d=await callEdge('share_conversation',{conv_id:activeConv.id},tk)
      if(d.slug){
        setShareSlug(d.slug)
        setShowShareModal(true)
      }
    }catch(e){setErr('Sdílení: '+e.message)}
  }
  const explainMsg=async msg=>{setExplainTxt('Načítám…');try{const d=await callEdge('explain',{messages:[{role:'assistant',content:msg.content}]},token||ANON);setExplainTxt(d.explanation||'Nepodařilo se.')}catch(e){setExplainTxt('Chyba: '+e.message)}}
  const parsePollenErr=msg=>{if(msg.startsWith('POLLEN_LIMIT:')){const[,spent,,wait,cost,resetAt]=msg.split(':');return{type:'limit',spent:Number(spent),wait:Number(wait),cost:Number(cost),resetAt:resetAt||null}}; if(msg.startsWith('POLLEN_BALANCE:'))return{type:'balance',wait:Number(msg.split(':')[1])||30};return null}

  // ── Send: Image ────────────────────────────────────────────────────────────
  const sendImg=useCallback(async(overrideText)=>{
    const txt=(overrideText||input).trim();if(!txt)return
    if(!isLoggedIn){setErr('Pro generování obrázků se přihlaste.');return}
    setInput('');setLoading(true);setErr(null)
    const cid=activeConv?.id,isLocal=activeConv?.local
    const tk=await getFreshToken()||ANON
    const tmpUser={id:uid(),role:'user',content:txt,type:'text',created_at:new Date().toISOString(),_tmp:true}
    if(isLocal)setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),tmpUser]}))
    else setMsgs(p=>[...p,tmpUser])
    try{
      const result=await callEdge('generate_image',{messages:[{role:'user',content:txt}],imgModel},tk)
      if(result.error)throw new Error(result.error)
      if(result.pollenSpent!==undefined){const ps={remaining:result.pollenRemaining??0,spent:result.pollenSpent,resetAt:result.pollenResetAt||null};setPollenInfo(ps);setPollenCache(ps)}
      const nid=uid()
      const imgMeta={prompt:result.prompt||txt,modelId:imgModel,mimeType:result.mimeType}
      const aMsg={id:nid,role:'assistant',type:'generated_image',content:'🎨 Vygenerovaný obrázek',
        _imageData:result.imageData,_mimeType:result.mimeType,_prompt:result.prompt||txt,_modelId:imgModel,
        // image_url ukládá jen metadata bez base64 (šetří výkon při render)
        image_url:JSON.stringify(imgMeta),
        _fullData:result.imageData, // runtime only, neperzistuje
        created_at:new Date().toISOString()}

      // Zobraz IHNED — neblokuj na DB
      if(isLocal){
        setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      } else {
        setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmpUser,_tmp:false},aMsg])
        // DB na pozadí — base64 může být velký, uložíme async
        ;(async()=>{try{
          const uRow=await saveMsg(cid,'user',txt)
          // Uložíme plná data do DB (async)
          await saveMsg(cid,'assistant','🎨 Vygenerovaný obrázek','generated_image',
            {imageData:result.imageData,mimeType:result.mimeType,prompt:result.prompt||txt,modelId:imgModel})
          await supabase.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',cid)
          if(uRow?.id)setMsgs(p=>p.map(m=>m.id===tmpUser.id?{...m,id:uRow.id}:m))
        }catch(dbErr){console.warn('Img DB save:',dbErr)}})()
      }
      addNewAnim(nid)
    }catch(e){
      const pe=parsePollenErr(e.message)
      if(pe?.type==='limit'){setPollenInfo(p=>({...p,remaining:0,resetAt:pe.resetAt}));setErr(`🌸 Pollen limit: čekej ${pe.wait} min`)}
      else if(pe?.type==='balance')setErr(`🌸 Pollinations bez pollen. Zkus za ${pe.wait} min.`)
      else setErr('Generování: '+e.message)
      if(isLocal)setConvs(p=>p.map(c=>c.id===cid?{...c,messages:(c.messages??[]).filter(m=>!m._tmp)}:c))
      else setMsgs(p=>p.filter(m=>!m._tmp))
      setInput(txt)
    }
    finally{setLoading(false)}
  },[input,isLoggedIn,activeConv,imgModel]) // eslint-disable-line

  // ── Send: Web Search ───────────────────────────────────────────────────────
  const sendWebSearch=useCallback(async(overrideInput)=>{
    const txt=(overrideInput||input).trim();if(!txt)return
    if(!isLoggedIn){setErr('Pro web search se přihlaste.');return}
    setInput('');setLoading(true);setErr(null)
    const cid=activeConv?.id,isLocal=activeConv?.local
    const tk=await getFreshToken()||ANON
    const tmpUser={id:uid(),role:'user',content:`🌐 ${txt}`,type:'text',created_at:new Date().toISOString(),_tmp:true}
    if(isLocal)setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),tmpUser]}))
    else setMsgs(p=>[...p,tmpUser])
    try{
      const result=await callEdge('web_search',{query:txt,searchType:webSearchType},tk)
      if(!result||result.error)throw new Error(result?.error||'Search selhal')

      const nid=uid()
      // Uloż výsledky jako JSON do image_url sloupce pro perzistenci přes refresh
      const webMeta={results:result.results||[],summary:result.summary||'',query:txt,searchType:webSearchType,provider:result.provider||''}
      const aMsg={id:nid,role:'assistant',type:'web_search',content:`🌐 ${result.results?.length||0} výsledků — "${txt}"`,_webData:webMeta,created_at:new Date().toISOString()}

      // Zobraz výsledky IHNED bez čekání na DB
      if(isLocal){
        setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      } else {
        setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmpUser,_tmp:false},aMsg])
        // Ulož do DB na pozadí (neblokuje UI)
        saveMsg(cid,'user',tmpUser.content).catch(()=>{})
        saveMsg(cid,'assistant',aMsg.content,'web_search',webMeta).catch(()=>{})
        supabase.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',cid).then(()=>{})
      }
      addNewAnim(nid)

      // Pokud existuje AI shrnutí, zobraz ho jako samostatnou textovou zprávu
      if(result.summary?.trim()){
        const sid=uid()
        const sumMsg={id:sid,role:'assistant',type:'text',
          content:`**Shrnutí výsledků pro „${txt}":**\n\n${result.summary}`,
          created_at:new Date().toISOString()}
        setTypingIds(s=>{const n=new Set(s);n.add(sid);return n})
        setTimeout(()=>setTypingIds(s=>{const n=new Set(s);n.delete(sid);return n}),
          Math.min(result.summary.length*8,6000))
        addNewAnim(sid)
        if(isLocal){
          setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),sumMsg]}))
        } else {
          setMsgs(p=>[...p,sumMsg])
          saveMsg(cid,'assistant',sumMsg.content).catch(()=>{})
        }
      }

    }catch(e){
      setErr('Web Search: '+e.message)
      if(isLocal)setConvs(p=>p.map(c=>c.id===cid?{...c,messages:(c.messages??[]).filter(m=>!m._tmp)}:c))
      else setMsgs(p=>p.filter(m=>!m._tmp))
      setInput(txt)
    }
    finally{setLoading(false)}
  },[input,isLoggedIn,activeConv,webSearchType]) // eslint-disable-line

  // ── Send: Weather ──────────────────────────────────────────────────────────
  const sendWeather=useCallback(async(city)=>{
    if(!city?.trim())return
    setLoading(true);setErr(null)
    const cid=activeConv?.id,isLocal=activeConv?.local
    const tk=await getFreshToken()||ANON
    const tmpUser={id:uid(),role:'user',content:`🌤️ Počasí: ${city}`,type:'text',created_at:new Date().toISOString(),_tmp:true}
    if(isLocal)setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),tmpUser]}))
    else setMsgs(p=>[...p,tmpUser])
    try{
      const result=await callEdge('weather',{location:city},tk)
      if(result.error)throw new Error(result.error)
      const nid=uid()
      const weatherData=result.weather
      const aMsg={id:nid,role:'assistant',type:'weather',
        content:`🌤️ ${weatherData?.city||city}`,
        _weatherData:weatherData,
        created_at:new Date().toISOString()}
      // Zobraz IHNED
      if(isLocal){
        setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      } else {
        setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmpUser,_tmp:false},aMsg])
        // DB na pozadí — uložíme weather data jako JSON do image_url
        ;(async()=>{try{
          await saveMsg(cid,'user',tmpUser.content)
          await saveMsg(cid,'assistant',aMsg.content,'weather',weatherData)
          await supabase.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',cid)
        }catch(e){console.warn('Weather DB save:',e)}})()
      }
      addNewAnim(nid)
    }catch(e){
      setErr('Počasí: '+e.message)
      if(isLocal)setConvs(p=>p.map(c=>c.id===cid?{...c,messages:(c.messages??[]).filter(m=>!m._tmp)}:c))
      else setMsgs(p=>p.filter(m=>!m._tmp))
    }
    finally{setLoading(false)}
  },[activeConv]) // eslint-disable-line

  // ── Send: Quiz ─────────────────────────────────────────────────────────────
  const sendQuiz=async()=>{
    if(!quizTopic.trim()||loading)return
    setLoading(true);setErr(null)
    const cid=activeConv?.id,isLocal=activeConv?.local
    const tk=isLoggedIn?(await getFreshToken()||ANON):ANON
    const tmp={id:uid(),role:'user',content:`🎓 Kvíz: ${quizTopic}`,type:'text',created_at:new Date().toISOString(),_tmp:true}
    if(isLocal)setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),tmp]}))
    else setMsgs(p=>[...p,tmp])
    try{
      const d=await callEdge('quiz',{topic:quizTopic,difficulty:quizDiff,questionCount:quizCount},tk)
      if(d.error)throw new Error(d.error)
      const qs=d.questions||[];if(!qs.length)throw new Error('Kvíz nemá otázky.')
      const nid=uid()
      const aMsg={id:nid,role:'assistant',type:'quiz',content:'🎓 Kvíz',_quizData:qs,created_at:new Date().toISOString()}
      // Zobraz IHNED
      if(isLocal){
        setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      } else {
        setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmp,_tmp:false},aMsg])
        // Ulož na pozadí
        ;(async()=>{try{
          await saveMsg(cid,'user',tmp.content)
          await saveMsg(cid,'assistant','🎓 Kvíz','quiz',qs)
          await supabase.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',cid)
        }catch(e){console.warn('Quiz DB save:',e)}})()
      }
      addNewAnim(nid)
    }catch(e){
      setErr('Kvíz: '+e.message)
      if(isLocal)setConvs(p=>p.map(c=>c.id===cid?{...c,messages:(c.messages??[]).filter(m=>!m._tmp)}:c))
      else setMsgs(p=>p.filter(m=>!m._tmp))
    }
    finally{setLoading(false);setQuizMode(false);setQuizTopic('')}
  }

  const TOOL_LABELS={
    // Textové
    write_text:'✍️ Psaní textu',translate:'🌍 Překlad',summarize:'📋 Sumarizace',
    correct:'✅ Korektura',rewrite:'✏️ Přepis stylu',headlines:'📰 Nadpisy',
    seo:'🔍 SEO',email:'📧 E-mail',sentiment:'😊 Sentiment',
    // Kód
    write_code:'💻 Psaní kódu',debug:'🐛 Debug',explain_code:'🔬 Vysvětli kód',
    refactor:'🔧 Refaktoring',gen_tests:'🧪 Testy',convert_code:'🔄 Konverze',
    db_schema:'🗄️ DB & SQL',api_help:'🔌 API integrace',
    // Multimédia
    describe_image:'👁️ Popis obrázku',analyze_chart:'📊 Analýza grafu',
    // Analýza
    analyze_doc:'📄 Dokument',fact_check:'🔎 Fact Check',
    data_analysis:'📈 Data analýza',research:'🔬 Výzkum',
    // Plánování
    task_plan:'🗺️ Plánování',brainstorm:'💡 Brainstorming',
    // Vzdělávání
    tutor:'🎓 Tutoring',presentation:'📊 Prezentace',roleplay:'🎭 Roleplay',
  }

  const TOOL_OPTIONS={
    write_text:{label:'Typ textu',placeholder:'článek / esej / příběh / scénář / blogpost…',field:'style',default:'článek'},
    translate:{label:'Cílový jazyk',placeholder:'angličtina, němčina, španělština, japonština…',field:'targetLang',default:'angličtina'},
    summarize:{label:'Styl',placeholder:'bullets / tldr / paragraph',field:'style',default:'bullets'},
    rewrite:{label:'Styl',placeholder:'formal / casual / poetic / simple / technical / funny / academic',field:'style',default:'formal'},
    refactor:{label:'Jazyk',placeholder:'JavaScript, Python, TypeScript, Java…',field:'lang',default:'JavaScript'},
    write_code:{label:'Jazyk',placeholder:'Python, JavaScript, TypeScript, Java, C#…',field:'lang',default:'Python'},
    debug:{label:'Jazyk',placeholder:'JavaScript, Python, TypeScript…',field:'lang',default:'JavaScript'},
    explain_code:{label:'Úroveň',placeholder:'začátečník / pokročilý / expert',field:'level',default:'pokročilý'},
    gen_tests:{label:'Framework',placeholder:'Jest, Pytest, JUnit, Vitest…',field:'lang',default:'Jest'},
    convert_code:{label:'Z → Do',placeholder:'Python → JavaScript',field:'langs',default:'Python → JavaScript'},
    db_schema:{label:'Typ DB',placeholder:'PostgreSQL, MySQL, SQLite, MongoDB…',field:'lang',default:'PostgreSQL'},
    api_help:{label:'Typ API',placeholder:'REST, GraphQL, SDK, WebSocket…',field:'style',default:'REST'},
    analyze_doc:{label:'Otázka',placeholder:'Shrň hlavní body. / O co jde?',field:'question',default:'Shrň hlavní body dokumentu.'},
    data_analysis:{label:'Co analyzovat',placeholder:'trendy, statistiky, korelace…',field:'style',default:'shrnutí a trendy'},
    research:{label:'Hloubka',placeholder:'stručná rešerše / detailní studie',field:'style',default:'stručná rešerše'},
    brainstorm:{label:'Počet nápadů',placeholder:'10',field:'count',default:'10'},
    presentation:{label:'Počet slidů',placeholder:'8',field:'slides',default:'8'},
    roleplay:{label:'Scénář / Role',placeholder:'Hraj HR manažera, procvičuji pohovor',field:'scenario',default:''},
    task_plan:{label:'Detailnost',placeholder:'stručný / detailní s milníky',field:'style',default:'detailní s milníky'},
    tutor:{label:'Úroveň',placeholder:'začátečník / středně pokročilý / expert',field:'level',default:'středně pokročilý'},
  }

  // Odeslání tool požadavku
  const sendTool=useCallback(async(text,tool,opts={})=>{
    if(!text.trim()||loading||!activeConv)return
    const cid=activeConv.id,isLocal=activeConv.local
    const tk=isLoggedIn?(await getFreshToken()||ANON):ANON
    const tmpUser={id:uid(),role:'user',content:`[${TOOL_LABELS[tool]||tool}] ${text.slice(0,80)}${text.length>80?'…':''}`,type:'text',created_at:new Date().toISOString(),_tmp:true}
    setInput('');setLoading(true);setErr(null)
    if(isLocal)setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),tmpUser]}))
    else setMsgs(p=>[...p,tmpUser])

    // Sestav payload dle tool — nové nástroje jdou jako 'chat' s upraveným system promptem
    const CHAT_TOOLS=new Set(['write_text','write_code','debug','explain_code','db_schema','api_help','describe_image','analyze_chart','data_analysis','research','task_plan','tutor'])
    let payload={text,mode:tool}

    if(CHAT_TOOLS.has(tool)){
      // Tyto nástroje volají chat s upraveným systémovým promptem
      const chatPrompts={
        write_text:`Jsi profesionální spisovatel. Napiš ${opts.style||'článek'} na toto téma. Buď kreativní, strukturovaný, používej markdown. Dodej hotový text připravený k publikaci.`,
        write_code:`Jsi senior ${opts.lang||'Python'} vývojář. Napiš čistý, komentovaný, funkční kód. Přidej příklady použití a vysvětlení.`,
        debug:`Jsi expert na debugging ${opts.lang||''}. Najdi a oprav všechny chyby v kódu. Vysvětli co bylo špatně a proč. Ukaž opravenou verzi.`,
        explain_code:`Vysvětli tento kód jako pro ${opts.level||'pokročilého'} vývojáře. Popiš co každá část dělá, proč je to napsané takto, a jaké jsou edge cases.`,
        db_schema:`Jsi expert na ${opts.lang||'PostgreSQL'}. Navrhni databázové schéma / SQL dotazy pro tento požadavek. Přidej indexy, constraints a vysvětlení.`,
        api_help:`Jsi expert na ${opts.style||'REST'} API integrace. Pomoz s implementací. Ukaž konkrétní příklady kódu, error handling a best practices.`,
        describe_image:`Popiš detailně co vidíš na přiloženém obrázku. Zahrň: co je na obrázku, barvy, kompozici, text, grafy nebo tabulky pokud jsou přítomny, a co z toho vyplývá.`,
        analyze_chart:`Analyzuj tento graf nebo tabulku. Extrahuj klíčová data, trendy, anomálie a závěry. Formátuj jako strukturovanou analýzu.`,
        data_analysis:`Analyzuj tato data a zjisti: ${opts.style||'shrnutí a trendy'}. Uveď statistiky, vzorce, anomálie a doporučení.`,
        research:`Proveď ${opts.style||'stručnou rešerši'} na toto téma. Zahrň: klíčové pojmy, stav výzkumu, hlavní zjištění, zdroje k dalšímu studiu.`,
        task_plan:`Vytvoř ${opts.style||'detailní'} akční plán pro dosažení tohoto cíle. Rozlož ho na konkrétní kroky, přidej milníky, odhadni čas a identifikuj rizika.`,
        tutor:`Jsi trpělivý tutor. Vysvětli toto téma pro ${opts.level||'středně pokročilého'} studenta. Začni od základů, použij příklady, analogie a zkontroluj porozumění.`,
      }
      const sysPmt=chatPrompts[tool]||`Pomož s úkolem: ${tool}`
      const now=new Date()
      const days=['neděle','pondělí','úterý','středa','čtvrtek','pátek','sobota']
      payload={
        mode:'chat',
        messages:[{role:'user',content:[{type:'text',text}],...(atts.length>0?{content:[...atts.map(a=>({type:'image',source:{type:'base64',media_type:a.type,data:a.data}})),{type:'text',text}]}:{})}],
        system:sysPmt+`\n\nDnes je ${days[now.getDay()]} ${now.toLocaleDateString('cs-CZ')}.`,
        preferredModel:aiModel,thinking,memory,
      }
    } else {
      // Původní specialized tools
      if(tool==='translate')payload.targetLang=opts.targetLang||'angličtina'
      if(tool==='summarize')payload.style=opts.style||'bullets'
      if(tool==='rewrite')payload.style=opts.style||'formal'
      if(tool==='refactor')payload.lang=opts.lang||'JavaScript'
      if(tool==='gen_tests')payload.lang=opts.lang||'JavaScript'
      if(tool==='convert_code'){
        const parts=(opts.langs||'Python → JavaScript').split(/→|->/);
        payload.fromLang=(parts[0]||'Python').trim();payload.toLang=(parts[1]||'JavaScript').trim()
      }
      if(tool==='analyze_doc')payload.question=opts.question||'Shrň hlavní body.'
      if(tool==='brainstorm'){payload.topic=text;payload.count=Number(opts.count)||10}
      if(tool==='presentation'){payload.topic=text;payload.slides=Number(opts.slides)||8}
      if(tool==='roleplay'){payload.scenario=opts.scenario||'asistent';payload.userMsg=text;payload.roleHistory=[]}
      if(tool==='task_plan'){payload.topic=text;payload.style=opts.style}
      if(tool==='tutor'){payload.topic=text;payload.level=opts.level}
    }

    try{
      const result=await callEdge(payload.mode||tool,payload,tk)
      const nid=uid()
      const aMsg={id:nid,role:'assistant',type:'text',content:result.text??'(prázdná odpověď)',created_at:new Date().toISOString()}
      setTypingIds(s=>{const n=new Set(s);n.add(nid);return n})
      setTimeout(()=>setTypingIds(s=>{const n=new Set(s);n.delete(nid);return n}),Math.min(Math.max((result.text?.length||100)*9,800),8000))
      addNewAnim(nid)
      if(isLocal){
        setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      } else {
        setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmpUser,_tmp:false},aMsg])
        // DB na pozadí — neblokuje UI
        ;(async()=>{try{
          const uRow=await saveMsg(cid,'user',tmpUser.content)
          await saveMsg(cid,'assistant',aMsg.content)
          await supabase.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',cid)
          if(uRow?.id)setMsgs(p=>p.map(m=>m.id===tmpUser.id?{...m,id:uRow.id}:m))
        }catch(dbErr){console.warn('Tool DB save:',dbErr)}})()
      }
    }catch(e){setErr('Chyba nástroje: '+e.message);if(isLocal)setConvs(p=>p.map(c=>c.id===cid?{...c,messages:(c.messages??[]).filter(m=>!m._tmp)}:c));else setMsgs(p=>p.filter(m=>!m._tmp));setInput(text)}
    finally{setLoading(false)}
  },[loading,activeConv,isLoggedIn,token,aiModel,thinking,memory,atts]) // eslint-disable-line

  // ── Main send ──────────────────────────────────────────────────────────────
  const send=useCallback(async()=>{
    // Slash commands — /web, /img, /kviz, /share, /goal
    if(input.trim().startsWith('/')){
      const raw=input.trim()
      const cmd=raw.slice(1).split(' ')[0].toLowerCase()
      const rest=raw.slice(cmd.length+2).trim()
      if(cmd==='web'||cmd==='search'){setInput(rest||input.slice(cmd.length+2));setImgMode('web_search');if(rest){setTimeout(()=>sendWebSearch(rest),50);}return}
      if(cmd==='img'||cmd==='image'||cmd==='obr'){setInput(rest||'');setImgMode('generate_image');if(rest){setTimeout(()=>sendImg(rest),50);}return}
      if(cmd==='kviz'||cmd==='quiz'){setInput('');setQuizMode(true);if(rest)setQuizTopic(rest);return}
      if(cmd==='share'&&isLoggedIn){shareConversation();return}
      if(cmd==='goal'&&isLoggedIn){setShowGoals(true);return}
      if(cmd==='live'){setShowLive(true);setInput('');return}
      // Neznámý slash příkaz — odešli jako normální text
    }
    // Tool mode — odešle přes speciální API endpoint
    if(toolMode&&input.trim()){
      const opts={...toolOptions}
      const def=TOOL_OPTIONS[toolMode]
      if(def&&!opts[def.field])opts[def.field]=def.default
      return sendTool(input,toolMode,opts)
    }
    if(imgMode==='generate_image'){sendImg();return}
    if(imgMode==='web_search'){sendWebSearch();return}
    if((!input.trim()&&!atts.length)||loading||!activeConv)return
    const userText=input.trim()||atts.map(a=>a.name).join(', ')
    const cid=activeConv.id,isLocal=activeConv.local

    // Auto-paměť
    tryAutoMemory(userText)

    // Smart intent detection — jen pokud je chat mode
    if(isLoggedIn&&imgMode==='chat'){
      const intent=detectIntent(userText)
      if(intent==='generate_image'){setImgMode('generate_image');sendImg(userText);return}
      if(intent==='web_search'){sendWebSearch(userText);return}
      if(intent==='image_search'){setImgMode('image_search');setInput(userText);setTimeout(()=>send(),30);return}
      if(intent==='weather'){
        const cm=userText.match(/(?:počasí\s+(?:v\s+|ve\s+|na\s+)?|weather\s+in\s+|teplota\s+v\s+|předpověď\s+(?:v\s+)?)([a-záčďéěíňóřšťúůýžA-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^\s,.!?]{1,30}(?:\s+[a-záčďéěíňóřšťúůýžA-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^\s,.!?]{1,30})?)/i)
        setInput('');sendWeather(cm?.[1]||'Praha');return
      }
      if(intent==='quiz'){
        const tm=userText.match(/(?:kvíz\s+(?:na\s+téma\s+|o\s+)?)(.+)/i)||userText.match(/quiz\s+(?:about\s+)?(.+)/i)
        setInput('');setQuizMode(true);setQuizTopic((tm?.[1]?.trim()||userText.replace(/kvíz|quiz/gi,'').trim()||'Obecné').slice(0,60));return
      }
    }

    const apiMode=isLoggedIn?detectAutoMode(userText,imgMode):'chat'
    if(apiMode==='generate_image'){setImgMode('generate_image');sendImg(userText);return}
    if(apiMode==='web_search'){sendWebSearch(userText);return}

    const isFirst=(isLocal?activeConv.messages?.length:msgs.length)===0
    const api=[]
    atts.forEach(a=>{if(a.type.startsWith('image/'))api.push({type:'image',source:{type:'base64',media_type:a.type,data:a.data}});else api.push({type:'text',text:`[Soubor: ${a.name}]`})})
    if(input.trim())api.push({type:'text',text:input.trim()})
    const tmpUser={id:uid(),role:'user',content:userText,type:'text',created_at:new Date().toISOString(),_tmp:true,_atts:atts.map(a=>({id:a.id,name:a.name,type:a.type,preview:a.preview}))}
    setInput('');setAtts([]);setLoading(true);setErr(null)
    const prev=isLocal?(activeConv.messages??[]):msgs
    if(isLocal)setConvs(p=>p.map(c=>{if(c.id!==cid)return c;const title=isFirst?userText.slice(0,38)+(userText.length>38?'…':''):c.title;return{...c,title,messages:[...(c.messages??[]),tmpUser]}}))
    else setMsgs(p=>[...p,tmpUser])
    try{
      const history=[...prev,tmpUser].map(m=>({role:m.role,content:m.id===tmpUser.id&&api.length>0?api:[{type:'text',text:m.content}]}))
      const tk=isLoggedIn?(await getFreshToken()||ANON):ANON
      const sysWithDate=(activeProject?.system_prompt?activeProject.system_prompt+'\n\n':'')+sysPmt+getNowCtx()
      const payload={messages:history,system:sysWithDate,thinking,memory,preferredModel:aiModel,writeStyle:writeStyle||undefined}
      const result=await callEdge(apiMode,payload,tk)
      const nid=uid();let aMsg
      if(result.type==='image_search'){
        aMsg={id:nid,role:'assistant',type:'image_search',content:`📷 ${result.images?.length??0} fotografií`,_images:result.images,_query:result.query,image_url:JSON.stringify(result.images),created_at:new Date().toISOString()}
      }else{
        aMsg={id:nid,role:'assistant',type:'text',content:result.text??'(prázdná odpověď)',created_at:new Date().toISOString()}
        setTypingIds(s=>{const n=new Set(s);n.add(nid);return n})
        setTimeout(()=>setTypingIds(s=>{const n=new Set(s);n.delete(nid);return n}),Math.min(Math.max((result.text?.length||100)*9,1000),10000))
        // ── ARTIFACT detekce (Claude AI styl) ──────────────────────────────
        const art=detectArtifact(result.text??'')
        if(art){setArtifact(art);setArtifactOpen(true);setArtifactTab('preview')}
      }
      addNewAnim(nid)
      // ✅ Zobraz odpověď IHNED
      if(isLocal){
        setConvs(p=>p.map(c=>c.id!==cid?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      } else {
        setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmpUser,_tmp:false},aMsg])
        // Ulož do DB + autoTitle NA POZADÍ — až po zobrazení odpovědi
        ;(async()=>{
          try{
            const uRow=await saveMsg(cid,'user',userText)
            if(aMsg.type==='image_search')await saveMsg(cid,'assistant',aMsg.content,'image_search',aMsg._images)
            else await saveMsg(cid,'assistant',aMsg.content)
            await supabase.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',cid)
            if(uRow?.id)setMsgs(p=>p.map(m=>m.id===tmpUser.id?{...m,id:uRow.id}:m))
            // ✅ AutoTitle až PO uložení AI odpovědi — použij obsah odpovědi pro lepší název
            if(isFirst&&activeConv.title==='Nová konverzace'){
              autoTitle(cid,userText+' '+aMsg.content.slice(0,100))
            }
          }catch(dbErr){console.warn('DB save:',dbErr)}
        })()
      }
    }catch(e){setErr('Chyba: '+e.message);if(isLocal)setConvs(p=>p.map(c=>c.id===cid?{...c,messages:prev}:c));else setMsgs(prev);setInput(userText)}
    finally{setLoading(false)}
  },[input,atts,loading,activeConv,msgs,isLoggedIn,imgMode,sysPmt,thinking,memory,token,imgModel,aiModel,webSearchType,tryAutoMemory,shareConversation,setQuizMode,setQuizTopic,setShowGoals,setShowLive,sendImg,sendWebSearch]) // eslint-disable-line

  const onKey=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}
  const displayMsgs=showStarred?(activeConv?.local?(activeConv.messages??[]):msgs).filter(m=>starred.has(m.id)):(activeConv?.local?(activeConv.messages??[]):msgs)
  const canSend=(input.trim()||atts.length>0)&&!loading
  const userInitial=session?(session.user.user_metadata?.full_name||session.user.email||'U')[0].toUpperCase():'?'
  const currentModel=AI_MODELS.find(m=>m.id===aiModel)||AI_MODELS[0]

  function getMsgData(msg){
    if(msg._images||msg._imageData||msg._quizData||msg._webData||msg._weatherData)return msg
    if(msg.image_url){try{
      const p=JSON.parse(msg.image_url)
      if(msg.type==='quiz')return{...msg,_quizData:Array.isArray(p)?p:[p]}
      if(msg.type==='generated_image'){
        // p._truncated = uložené jen metadata bez base64 (viz saveMsg komprese)
        // V tom případě nemáme imageData, zobrazíme placeholder
        if(p._truncated)return{...msg,_prompt:p.prompt,_modelId:p.modelId,_mimeType:p.mimeType,_imageData:null}
        if(p.imageData)return{...msg,_imageData:p.imageData,_mimeType:p.mimeType,_prompt:p.prompt,_modelId:p.modelId}
        // Nová verze ukládá jen metadata — obrázek není k dispozici po refreshi
        return{...msg,_prompt:p.prompt,_modelId:p.modelId,_mimeType:p.mimeType,_imageData:null}
      }
      if(msg.type==='image_search')return{...msg,_images:Array.isArray(p)?p:undefined,_query:msg.content}
      if(msg.type==='web_search')return{...msg,_webData:{results:p.results||[],summary:p.summary||'',query:p.query||'',searchType:p.searchType||'web',provider:p.provider||''}}
      if(msg.type==='weather')return{...msg,_weatherData:p}
      if(Array.isArray(p))return{...msg,_images:p,_query:msg.content}
      if(p.imageData)return{...msg,_imageData:p.imageData,_mimeType:p.mimeType,_prompt:p.prompt,_modelId:p.modelId}
    }catch{return msg}}
    return msg
  }

  const phs={
    // Módy
    chat:thinking?'💭 Deep Thinking…':'Zeptat se Lumi…',
    image_search:'📷 Popište co hledáte…',
    generate_image:'🎨 Popište obrázek…',
    web_search:'🌐 Hledej na internetu…',
    // Textové nástroje
    write_text:'✍️ Téma nebo zadání textu (článek, esej, příběh…)',
    translate:'🌍 Vlož text k přeložení…',
    summarize:'📋 Vlož text k sumarizaci…',
    correct:'✅ Vlož text ke korektuře…',
    rewrite:'✏️ Vlož text k přepsání stylu…',
    headlines:'📰 Vlož text pro generování nadpisů…',
    seo:'🔍 Vlož text k SEO optimalizaci…',
    email:'📧 Popiš e-mail (komu, o čem, tón)…',
    sentiment:'😊 Vlož text k analýze sentimentu…',
    // Kód
    write_code:'💻 Popiš co má kód dělat…',
    debug:'🐛 Vlož kód s chybou…',
    explain_code:'🔬 Vlož kód k vysvětlení…',
    refactor:'🔧 Vlož kód k refaktoringu…',
    gen_tests:'🧪 Vlož kód pro generování testů…',
    convert_code:'🔄 Vlož kód ke konverzi…',
    db_schema:'🗄️ Popiš co potřebuješ uložit / jaký dotaz…',
    api_help:'🔌 Popiš API integraci nebo endpoint…',
    // Multimédia
    describe_image:'👁️ Nahraj obrázek nebo popiš co chceš analyzovat…',
    analyze_chart:'📊 Vlož data nebo nahraj graf k analýze…',
    // Analýza
    analyze_doc:'📄 Vlož text dokumentu nebo PDF obsahu…',
    fact_check:'🔎 Vlož tvrzení k ověření…',
    data_analysis:'📈 Vlož data nebo popiš co analyzovat…',
    research:'🔬 Téma pro vědecký výzkum / rešerši…',
    // Plánování
    task_plan:'🗺️ Popiš cíl nebo projekt k naplánování…',
    brainstorm:'💡 Téma pro brainstorming…',
    // Vzdělávání
    tutor:'🎓 Co chceš vysvětlit nebo se naučit…',
    presentation:'📊 Téma prezentace…',
    roleplay:'🎭 Zahaj scénář nebo napiš kontext…',
  }

  // ── CSS ────────────────────────────────────────────────────────────────────
  const css=`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${t.scrl};border-radius:3px}::-webkit-scrollbar-thumb:hover{background:${t.accent}66}
    textarea,input{font-family:inherit}textarea{resize:none;outline:none;border:none;background:transparent}input{outline:none;border:none;background:transparent}button{cursor:pointer;border:none;background:none;font-family:inherit}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes fadeInScale{from{opacity:0;transform:scale(.93)}to{opacity:1;transform:scale(1)}}
    @keyframes dropIn{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes imgReveal{from{opacity:0;filter:blur(6px);transform:scale(.97)}to{opacity:1;filter:blur(0);transform:scale(1)}}
    @keyframes msgBounce{0%{opacity:0;transform:translateY(14px) scale(.94)}55%{transform:translateY(-3px) scale(1.01)}100%{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes msgSlideR{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
    @keyframes pu{0%,100%{opacity:.15;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    @keyframes thinkSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    @keyframes thinkPulse{0%,100%{opacity:.4}50%{opacity:1}}
    @keyframes livePulse{0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,.5)}70%{box-shadow:0 0 0 8px rgba(248,113,113,0)}}
    @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
    @keyframes welcomeFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes auroraFloat{0%,100%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-52%) scale(1.1)}}
    @keyframes auroraFloat2{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.15);opacity:.9}}
    @keyframes shimmer{from{background-position:-200% 0}to{background-position:200% 0}}
    @keyframes slideUpBanner{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
    @keyframes toastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
    .msg-new-ai{animation:msgBounce .5s cubic-bezier(.34,1.56,.64,1) both}
    .msg-new-user{animation:msgSlideR .3s cubic-bezier(.34,1.56,.64,1) both}
    .msg-old{animation:fadeIn .15s ease both}
    .dot span{display:inline-block;width:7px;height:7px;border-radius:50%;background:${t.accent};margin:0 2px;animation:pu 1.4s infinite ease-in-out}
    .dot span:nth-child(2){animation-delay:.22s}.dot span:nth-child(3){animation-delay:.44s}
    .cr:hover{background:${t.active}!important}.cr:hover .cr-act{opacity:1!important}
    .cr{transition:background .1s}
    .ib:hover{opacity:.65}.ib{transition:opacity .15s}
    .err-shake{animation:shake .4s ease}
    .shimmer{background:linear-gradient(90deg,${t.btn} 25%,${t.active} 50%,${t.btn} 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
    @media(max-width:768px){.sidebar{position:fixed!important;top:0;left:0;bottom:0;z-index:30;box-shadow:4px 0 32px rgba(0,0,0,.6)}.sov{display:block!important}}
  `

  return(
    <div style={{display:'flex',height:'100dvh',overflow:'hidden',background:t.bg,color:t.txt,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <style>{css}</style>

      {/* Auto-mem toast */}
      {autoMemToast&&<div style={{position:'fixed',top:14,left:'50%',transform:'translateX(-50%)',zIndex:90,background:t.green+'22',border:`1px solid ${t.green}44`,color:t.succ,padding:'7px 16px',borderRadius:20,fontSize:12,fontWeight:500,animation:'toastIn .3s ease',whiteSpace:'nowrap',backdropFilter:'blur(8px)'}}>{autoMemToast}</div>}

      {/* Focus Timer floating */}
      {showFocusTimer&&<div style={{position:'fixed',bottom:80,right:16,zIndex:45}}><FocusTimer t={t} onClose={()=>setShowFocusTimer(false)}/></div>}

      {sideOpen&&<div className="sov" onClick={()=>setSideOpen(false)} style={{display:'none',position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:29}}/>}

      {/* ── PROJEKT MODAL ───────────────────────────────────────────────────── */}
      {showProjectModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:80,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowProjectModal(false)}>
          <div style={{background:t.card,borderRadius:16,padding:24,width:400,border:`1px solid ${t.border}`}} onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:700,fontSize:16,color:t.txt,marginBottom:16}}>{editProject?.id?'Upravit projekt':'Nový projekt'}</div>
            {['name','description','system_prompt'].map(field=>(
              <div key={field} style={{marginBottom:12}}>
                <div style={{fontSize:11,color:t.muted,marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>{field==='name'?'Název':field==='description'?'Popis':'Vlastní instrukce (system prompt)'}</div>
                {field==='system_prompt'
                  ?<textarea value={editProject?.[field]||''} onChange={e=>setEditProject(p=>({...p,[field]:e.target.value}))} placeholder="Instrukce pro AI v tomto projektu…" style={{width:'100%',background:t.inBg,border:`1px solid ${t.inBrd}`,borderRadius:8,padding:'8px 10px',color:t.txt,fontSize:13,height:90,resize:'none'}}/>
                  :<input value={editProject?.[field]||''} onChange={e=>setEditProject(p=>({...p,[field]:e.target.value}))} placeholder={field==='name'?'Název projektu…':'Krátký popis…'} style={{width:'100%',background:t.inBg,border:`1px solid ${t.inBrd}`,borderRadius:8,padding:'8px 10px',color:t.txt,fontSize:13}}/>
                }
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:t.muted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Ikona a barva</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {['📁','💻','🎨','🔬','📝','🎓','🏠','🎮','🌍','⚡'].map(icon=>(
                  <button key={icon} onClick={()=>setEditProject(p=>({...p,icon}))} style={{fontSize:18,padding:'4px 8px',borderRadius:6,border:`2px solid ${editProject?.icon===icon?t.accent:t.border}`,background:'transparent',cursor:'pointer'}}>{icon}</button>
                ))}
              </div>
              <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                {['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#06b6d4'].map(color=>(
                  <button key={color} onClick={()=>setEditProject(p=>({...p,color}))} style={{width:24,height:24,borderRadius:'50%',background:color,border:`3px solid ${editProject?.color===color?t.txt:'transparent'}`,cursor:'pointer'}}/>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              {editProject?.id&&<button onClick={async()=>{await callEdge('delete_project',{project_id:editProject.id},token||ANON);loadProjects();setShowProjectModal(false)}} style={{padding:'7px 14px',borderRadius:8,background:t.danger+'22',color:t.danger,fontSize:13,border:'none',cursor:'pointer'}}>Smazat</button>}
              <button onClick={()=>setShowProjectModal(false)} style={{padding:'7px 14px',borderRadius:8,background:t.btn,color:t.muted,fontSize:13,border:'none',cursor:'pointer'}}>Zrušit</button>
              <button onClick={async()=>{
                await callEdge('save_project',{project_id:editProject?.id,name:editProject?.name||'Projekt',description:editProject?.description,system_prompt:editProject?.system_prompt,color:editProject?.color||'#6366f1',icon:editProject?.icon||'📁'},token||ANON)
                loadProjects();setShowProjectModal(false)
              }} style={{padding:'7px 14px',borderRadius:8,background:t.accent,color:'#fff',fontSize:13,border:'none',cursor:'pointer',fontWeight:600}}>Uložit</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
      {sideOpen&&(
        <aside className="sidebar" style={{width:266,background:t.side,borderRight:`1px solid ${t.border}`,display:'flex',flexDirection:'column',flexShrink:0}}>
          <div style={{padding:'12px 11px',borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:7}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <LumiAvatar size={27} gradient={[t.gradA,t.gradB]}/>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{fontWeight:700,fontSize:14,color:t.txt}}>Lumi</span>
                  <span style={{fontSize:9,background:'#f59e0b22',color:'#f59e0b',padding:'1px 5px',borderRadius:3,fontWeight:700}}>BETA</span>
                </div>
                <div style={{fontSize:10,color:t.muted}}>Váš inteligentní asistent</div>
              </div>
            </div>
            <div style={{display:'flex',gap:3}}>
              <button className="ib" onClick={()=>{setSearchOpen(o=>!o);setTimeout(()=>searchRef.current?.focus(),100)}} style={{color:t.muted,display:'flex',padding:6,borderRadius:6,background:searchOpen?t.active:'transparent'}}>{Ic.search}</button>
              <button onClick={newConv} style={{background:t.accent,color:'#fff',borderRadius:7,padding:'5px 8px',display:'flex',alignItems:'center'}}>{Ic.plus}</button>
            </div>
          </div>

          {searchOpen&&(
            <div style={{padding:'7px 9px',borderBottom:`1px solid ${t.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 9px',background:t.inBg,border:`1px solid ${t.inBrd}`,borderRadius:8}}>
                <span style={{color:t.muted,flexShrink:0}}>{Ic.search}</span>
                <input ref={searchRef} value={searchQ} onChange={e=>doSearch(e.target.value)} placeholder="Hledat…" style={{flex:1,fontSize:13,color:t.txt}}/>
                {searchQ&&<button onClick={()=>{setSearchQ('');setSearchRes([])}} style={{color:t.muted,display:'flex',padding:2}}>{Ic.x}</button>}
              </div>
              {searchRes.map(c=>(
                <div key={c.id} onClick={()=>{selectConv(c.id);setSearchOpen(false);setSearchQ('');setSearchRes([])}}
                  style={{padding:'6px 8px',borderRadius:6,cursor:'pointer',fontSize:13,color:t.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:3}}
                  onMouseOver={e=>e.currentTarget.style.background=t.active} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  🔍 {c.title}
                </div>
              ))}
            </div>
          )}

          <div style={{flex:1,overflowY:'auto',padding:'4px'}}>
            {/* ── PROJEKTY ─────────────────────────────────────────────────── */}
            {isLoggedIn&&projects.length>0&&(
              <div style={{marginBottom:6}}>
                <div style={{fontSize:10,color:t.muted,padding:'4px 8px 2px',textTransform:'uppercase',letterSpacing:.8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span>Projekty</span>
                  <button onClick={()=>{setEditProject({color:'#6366f1',icon:'📁'});setShowProjectModal(true)}} style={{color:t.muted,background:'none',border:'none',cursor:'pointer',fontSize:13,display:'flex',padding:2}}>{Ic.plus}</button>
                </div>
                {projects.map(p=>(
                  <div key={p.id} onClick={()=>setActiveProject(activeProject?.id===p.id?null:p)}
                    style={{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',borderRadius:7,cursor:'pointer',marginBottom:1,background:activeProject?.id===p.id?p.color+'22':'transparent',borderLeft:`3px solid ${activeProject?.id===p.id?p.color:'transparent'}`}}
                    onMouseOver={e=>e.currentTarget.style.background=t.active} onMouseOut={e=>e.currentTarget.style.background=activeProject?.id===p.id?p.color+'22':'transparent'}>
                    <span style={{fontSize:14}}>{p.icon||'📁'}</span>
                    <span style={{fontSize:13,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:t.txt}}>{p.name}</span>
                    <button onClick={e=>{e.stopPropagation();setEditProject(p);setShowProjectModal(true)}} style={{color:t.muted,background:'none',border:'none',cursor:'pointer',fontSize:11,opacity:.5,display:'flex',padding:2}}>{Ic.edit}</button>
                  </div>
                ))}
                <button onClick={()=>{setEditProject({color:'#6366f1',icon:'📁'});setShowProjectModal(true)}} style={{width:'100%',padding:'5px 8px',borderRadius:7,border:`1px dashed ${t.border}`,color:t.muted,fontSize:12,cursor:'pointer',background:'none',textAlign:'left',marginBottom:4}}>+ Nový projekt</button>
                <div style={{height:1,background:t.border,margin:'4px 4px 6px'}}/>
              </div>
            )}
            {isLoggedIn&&projects.length===0&&(
              <button onClick={()=>{setEditProject({color:'#6366f1',icon:'📁'});setShowProjectModal(true)}} style={{width:'100%',padding:'5px 8px',borderRadius:7,border:`1px dashed ${t.border}`,color:t.muted,fontSize:12,cursor:'pointer',background:'none',textAlign:'left',marginBottom:6}}>📁 Nový projekt</button>
            )}
            {dbLoad?<div style={{padding:14,textAlign:'center',fontSize:12,color:t.muted}}>Načítám…</div>
              :convs.map((c,ci)=>(
                <div key={c.id} className="cr" onClick={()=>selectConv(c.id)}
                  style={{display:'flex',alignItems:'center',gap:5,padding:'6px 8px',borderRadius:7,cursor:'pointer',marginBottom:2,background:c.id===activeId?t.active:'transparent',borderLeft:`3px solid ${c.id===activeId?(c.color||t.accent):(c.color||'transparent')}`,animation:`fadeIn .15s ease ${Math.min(ci*0.02,.15)}s both`}}>
                  {editId===c.id?(
                    <form onSubmit={e=>{e.preventDefault();renameConv(c.id,editTitle)}} style={{flex:1}} onClick={e=>e.stopPropagation()}>
                      <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} onBlur={()=>renameConv(c.id,editTitle)} autoFocus style={{width:'100%',fontSize:13,color:t.txt,background:t.inBg,border:`1px solid ${t.accent}`,borderRadius:5,padding:'2px 6px'}}/>
                    </form>
                  ):(
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:c.id===activeId?t.txt:t.muted}}>{c.title}</div>
                      <div style={{fontSize:10,color:t.muted,marginTop:1}}>{c.local?'Dočasná':fmtDate(c.updated_at)}</div>
                    </div>
                  )}
                  <div className="cr-act" style={{display:'flex',gap:2,opacity:0,transition:'opacity .12s',flexShrink:0}}>
                    <button className="ib" onClick={e=>{e.stopPropagation();setEditId(c.id);setEditTitle(c.title)}} style={{color:t.muted,display:'flex',padding:3,borderRadius:4}}>{Ic.edit}</button>
                    <button className="ib" onClick={e=>delConv(c.id,e)} style={{color:t.muted,display:'flex',padding:3,borderRadius:4}}>{Ic.trash}</button>
                  </div>
                </div>
              ))}
          </div>

          <div style={{padding:'9px 10px',borderTop:`1px solid ${t.border}`}}>
            {/* ── Lumi Code + Lumi Cowork ─────────────────────────────────── */}
            <div style={{display:'flex',gap:5,marginBottom:8}}>
              <button onClick={()=>setShowLumiCode(true)}
                style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'7px 0',borderRadius:8,background:'#10b98122',border:`1px solid #10b98144`,color:'#10b981',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                <span style={{fontSize:14}}>{'</>'}</span> Code
              </button>
              <button onClick={()=>setShowLumiCowork(true)}
                style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'7px 0',borderRadius:8,background:'#f59e0b22',border:`1px solid #f59e0b44`,color:'#f59e0b',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                <span style={{fontSize:14}}>🤝</span> Cowork
              </button>
            </div>
            {isLoggedIn?(
              <div style={{display:'flex',alignItems:'center',gap:7}}>
                <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${t.gradA}33,${t.gradB}33)`,border:`1px solid ${t.gradA}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:t.accent,flexShrink:0}}>{userInitial}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:t.txt,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{session.user.user_metadata?.full_name||session.user.email}</div>
                  <div style={{fontSize:10,color:t.muted}}>Přihlášen</div>
                </div>
                <button className="ib" onClick={()=>supabase.auth.signOut()} style={{color:t.muted,display:'flex',padding:3}} title="Odhlásit">{Ic.out}</button>
              </div>
            ):(
              <button onClick={()=>setShowAuth(true)} style={{width:'100%',display:'flex',alignItems:'center',gap:7,padding:'8px 11px',borderRadius:8,background:t.btn,border:`1px solid ${t.border}`,color:t.muted,fontSize:13,fontWeight:500,cursor:'pointer'}}>
                <span style={{color:t.accent}}>{Ic.user}</span><span>Přihlásit se</span>
                <span style={{marginLeft:'auto',fontSize:10,background:t.tag,padding:'2px 6px',borderRadius:3}}>Uloží historii</span>
              </button>
            )}
          </div>
        </aside>
      )}

      {/* ── MAIN + ARTIFACT PANEL ──────────────────────────────────────────── */}
      <div style={{flex:1,display:'flex',overflow:'hidden',minWidth:0}}>
      <main id="lumi-main" style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0,position:'relative'}}>

        {/* Drag overlay */}
        {isDragging&&<div style={{position:'absolute',inset:0,zIndex:60,background:t.accent+'22',border:`2px dashed ${t.accent}`,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',pointerEvents:'none'}}><div style={{textAlign:'center',color:t.accent}}><div style={{fontSize:38,marginBottom:8}}>📎</div><div style={{fontSize:15,fontWeight:600}}>Přetáhni soubory sem</div></div></div>}

        {/* ── HEADER — Gemini style ───────────────────────────────────────── */}
        <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 14px',height:50,background:t.hdr,borderBottom:`1px solid ${t.border}`,backdropFilter:'blur(12px)',flexShrink:0,gap:7}}>
          <div style={{display:'flex',alignItems:'center',gap:7,minWidth:0}}>
            <button className="ib" onClick={()=>setSideOpen(o=>!o)} style={{color:t.muted,display:'flex',padding:5,flexShrink:0}}>{Ic.menu}</button>
            <span style={{fontWeight:600,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:t.txt}}>{activeConv?.title||'Lumi'}</span>
            {thinking&&<span style={{fontSize:10,background:t.purple+'22',color:t.purple,padding:'2px 6px',borderRadius:4,flexShrink:0,animation:'thinkPulse 1.5s infinite'}}>💭</span>}
          </div>
          <div style={{display:'flex',gap:3,alignItems:'center',flexShrink:0}}>
            {isLoggedIn&&<button className="ib" onClick={shareConversation} title="Sdílet konverzaci" style={{display:'flex',padding:'5px 7px',borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`}}>🔗</button>}
            {isLoggedIn&&<button className="ib" onClick={()=>setShowGoals(true)} title="Moje cíle" style={{display:'flex',padding:'5px 7px',borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`}}>🎯</button>}
            {isLoggedIn&&<button className="ib" onClick={()=>setShowAddMem(true)} title="Přidat do paměti" style={{display:'flex',padding:'5px 7px',borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`}}>{Ic.addMem}</button>}
            <button className="ib" onClick={()=>setShowStarred(s=>!s)} title="Oblíbené" style={{display:'flex',padding:'5px 7px',borderRadius:7,background:showStarred?'#f59e0b22':t.btn,color:showStarred?'#f59e0b':t.muted,border:`1px solid ${showStarred?'#f59e0b':t.border}`}}>{showStarred?Ic.starF:Ic.star}</button>
            <button className="ib" onClick={exportChat} title="Export" style={{display:'flex',padding:'5px 7px',borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`}}>{Ic.export}</button>
            <button className="ib" onClick={()=>setMdMode(m=>!m)} title="Markdown" style={{display:'flex',alignItems:'center',padding:'5px 7px',borderRadius:7,background:mdMode?t.accent+'22':t.btn,color:mdMode?t.accent:t.muted,border:`1px solid ${mdMode?t.accent:t.border}`,fontSize:11}}>MD</button>
            <button className="ib" onClick={()=>setShowSet(true)} title="Nastavení" style={{display:'flex',padding:'5px 7px',borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`}}>{Ic.gear}</button>
            <button className="ib" onClick={()=>setThemeName(n=>{const ks=Object.keys(THEMES);return ks[(ks.indexOf(n)+1)%ks.length]})} title="Téma" style={{display:'flex',padding:'5px 7px',borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`,fontSize:14}}>
              {THEME_LIST.find(th=>th.id===themeName)?.icon||'🎨'}
            </button>
            {!isLoggedIn&&<button onClick={()=>setShowAuth(true)} style={{display:'flex',alignItems:'center',justifyContent:'center',width:30,height:30,borderRadius:7,background:t.btn,color:t.muted,border:`1px solid ${t.border}`,cursor:'pointer'}}>{Ic.user}</button>}
          </div>
        </header>

        {/* Explain bar */}
        {explainTxt&&<div style={{padding:'9px 13px',background:t.purple+'18',borderBottom:`1px solid ${t.purple}44`,display:'flex',alignItems:'flex-start',gap:7,fontSize:13,animation:'fadeIn .3s ease'}}>
          <span style={{color:t.purple,flexShrink:0,marginTop:1}}>{Ic.info}</span>
          <span style={{color:t.txt,flex:1,lineHeight:1.5}}>{explainTxt}</span>
          <button onClick={()=>setExplainTxt(null)} style={{color:t.muted,display:'flex',padding:3,flexShrink:0,background:'none',border:'none',cursor:'pointer'}}>{Ic.x}</button>
        </div>}

        {showStarred&&<div style={{padding:'6px 13px',background:'#f59e0b22',borderBottom:`1px solid #f59e0b44`,display:'flex',alignItems:'center',gap:7,fontSize:12}}>
          <span style={{color:'#f59e0b'}}>⭐</span><span style={{color:t.txt}}>Oblíbené ({displayMsgs.length})</span>
          <button onClick={()=>setShowStarred(false)} style={{color:t.muted,display:'flex',padding:3,marginLeft:'auto',background:'none',border:'none',cursor:'pointer'}}>{Ic.x}</button>
        </div>}

        {/* ── MESSAGES ─────────────────────────────────────────────────────── */}
        <div style={{flex:1,overflowY:'auto',padding:'14px 13px',display:'flex',flexDirection:'column',gap:11,position:'relative'}}>
          {displayMsgs.length===0&&!loading&&(
            <div style={{textAlign:'center',marginTop:'8vh',padding:'0 14px',animation:'fadeIn .4s ease',position:'relative'}}>
              <AuroraBeam t={t}/>
              <div style={{position:'relative',zIndex:1}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:14,animation:'welcomeFloat 4s ease-in-out infinite'}}>
                  <LumiAvatar size={60} gradient={[t.gradA,t.gradB]}/>
                </div>
                <div style={{fontSize:22,fontWeight:700,marginBottom:7,color:t.txt}}>{showStarred?'Žádné oblíbené':'Ahoj! Jsem Lumi.'}</div>
                {!showStarred&&(
                  <>
                    <div style={{fontSize:13,color:t.muted,marginBottom:18,lineHeight:1.6}}>
                      {isLoggedIn?'Gemma 4 31B · Web Search · AI Obrázky · Kvízy · Počasí · Live · Focus Timer':'Začněte psát — bez přihlášení'}
                    </div>
                    <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap',maxWidth:500,margin:'0 auto'}}>
                      {(isLoggedIn?['Jak funguje kvantové počítání?','Vygeneruj obrázek lesa','Jaké je počasí v Praze','Udělej kvíz o historii']:['Jak funguje AI?','Napiš mi báseň','Co je strojové učení?','Pomoz mi s kódem']).map((hint,hi)=>(
                        <button key={hint} onClick={()=>setInput(hint)}
                          style={{padding:'6px 13px',borderRadius:20,background:t.btn,border:`1px solid ${t.border}`,color:t.muted,fontSize:12,transition:'all .2s ease',cursor:'pointer',animationDelay:`${hi*0.05}s`}}
                          onMouseOver={e=>{e.currentTarget.style.borderColor=t.accent;e.currentTarget.style.color=t.txt;e.currentTarget.style.transform='translateY(-2px)'}}
                          onMouseOut={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.color=t.muted;e.currentTarget.style.transform='translateY(0)'}}>
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
            const m=getMsgData(msg)
            const isWide=['image_search','generated_image','quiz','web_search','weather'].includes(msg.type)
            const isStar=starred.has(msg.id),isNew=newIds.has(msg.id),isTyp=typingIds.has(msg.id)
            const isPinned=pinnedMsgs.has(msg.id)
            const animCls=isNew?(msg.role==='user'?'msg-new-user':'msg-new-ai'):'msg-old'
            return(
              <div key={msg.id} className={animCls} style={{display:'flex',gap:7,justifyContent:msg.role==='user'?'flex-end':'flex-start',alignItems:'flex-start'}}>
                {msg.role==='assistant'&&<LumiAvatar size={27} gradient={[t.gradA,t.gradB]}/>}
                <div style={{maxWidth:isWide?'94%':'80%',minWidth:36}}>
                  {isPinned&&<div style={{fontSize:10,color:t.accent,marginBottom:2,display:'flex',alignItems:'center',gap:3}}>{Ic.pin} Připnuto</div>}
                  {msg._atts?.length>0&&(
                    <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:5,justifyContent:'flex-end'}}>
                      {msg._atts.map(a=>a.preview
                        ?<img key={a.id} src={a.preview} alt={a.name} style={{height:54,width:54,objectFit:'cover',borderRadius:7,border:`1px solid ${t.border}`}}/>
                        :<div key={a.id} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',background:t.pill,borderRadius:6,fontSize:11,color:t.txt}}>{a.type.includes('pdf')?Ic.pdf:Ic.file}<span style={{maxWidth:110,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span></div>
                      )}
                    </div>
                  )}
                  {msg.type==='weather'?(
                    <div style={{padding:'11px 13px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
                      {(m._weatherData||msg._weatherData)?<WeatherCard data={m._weatherData||msg._weatherData} t={t}/>:<div style={{color:t.muted,fontSize:13}}>Data počasí nedostupná.</div>}
                      <div style={{fontSize:10,color:t.muted,marginTop:7,textAlign:'right'}}>{fmtRelTime(msg.created_at)}</div>
                    </div>
                  ):msg.type==='web_search'?(
                    <div style={{padding:'11px 13px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
                      <WebSearchResults data={m._webData||{results:[],query:'',searchType:'web'}} t={t}/>
                      <div style={{fontSize:10,color:t.muted,marginTop:7,textAlign:'right'}}>{fmtRelTime(msg.created_at)}</div>
                    </div>
                  ):msg.type==='image_search'?(
                    <div style={{padding:'11px 13px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
                      <ImgGrid images={m._images} query={m._query||msg.content} t={t}/>
                      <div style={{fontSize:10,color:t.muted,marginTop:7,textAlign:'right'}}>{fmtRelTime(msg.created_at)}</div>
                    </div>
                  ):msg.type==='generated_image'?(
                    <div style={{padding:'11px 13px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
                      <GenImg imageData={m._imageData} mimeType={m._mimeType} prompt={m._prompt} modelId={m._modelId||imgModel} t={t}/>
                      <div style={{fontSize:10,color:t.muted,marginTop:7,textAlign:'right'}}>{fmtRelTime(msg.created_at)}</div>
                    </div>
                  ):msg.type==='quiz'?(
                    <QuizCard questions={m._quizData} t={t}/>
                  ):(
                    <div>
                      <div style={{padding:'9px 13px',background:msg.role==='user'?t.accent:t.aiB,color:msg.role==='user'?'#fff':t.txt,borderRadius:msg.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',border:msg.role==='assistant'?`1px solid ${isStar?'#f59e0b':t.border}`:'none',opacity:msg._tmp?0.7:1}}>
                        {msg.role==='assistant'&&(isTyp||(!msg._tmp&&mdMode))
                          ?isTyp?<TypingText text={msg.content} isDark={t.isDark} useMarkdown={mdMode} onDone={()=>setTypingIds(s=>{const n=new Set(s);n.delete(msg.id);return n})}/>
                            :<div style={{fontSize:14,lineHeight:1.7,wordBreak:'break-word'}} dangerouslySetInnerHTML={{__html:renderMD(msg.content,t.isDark)}}/>
                          :<div style={{fontSize:14,lineHeight:1.65,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{msg.content}</div>
                        }
                        <div style={{fontSize:10,color:msg.role==='user'?'rgba(255,255,255,.5)':t.muted,marginTop:3,textAlign:'right',display:'flex',alignItems:'center',justifyContent:'flex-end',gap:5}}>
                          {isStar&&<span style={{color:'#f59e0b'}}>⭐</span>}
                          {isPinned&&<span style={{color:t.accent}}>📌</span>}
                          {fmtRelTime(msg.created_at)}
                        </div>
                      </div>
                      {msg.role==='assistant'&&!msg._tmp&&<MsgActions msg={msg} t={t} isLoggedIn={isLoggedIn} token={token} onExplain={explainMsg} onStar={starMsg} starred={isStar} onPin={pinMsg} pinned={isPinned}/>}
                    </div>
                  )}
                </div>
                {msg.role==='user'&&<div style={{width:27,height:27,borderRadius:7,background:isLoggedIn?t.accent+'88':t.ua,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,color:'#fff',flexShrink:0,marginTop:2}}>{isLoggedIn?userInitial:'?'}</div>}
              </div>
            )
          })}

          {loading&&(
            <div style={{display:'flex',gap:7,alignItems:'flex-start',animation:'fadeIn .2s ease'}} className="msg-new-ai">
              <LumiAvatar size={27} gradient={[t.gradA,t.gradB]}/>
              <div style={{padding:'11px 15px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`,minWidth:70}}>
                {imgMode==='generate_image'?(<div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${t.purple}`,borderTopColor:'transparent',animation:'thinkSpin .8s linear infinite'}}/><span style={{fontSize:12,color:t.muted}}>Generuji obrázek…</span></div>)
                :imgMode==='web_search'?(<div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${t.accent}`,borderTopColor:'transparent',animation:'thinkSpin .8s linear infinite'}}/><span style={{fontSize:12,color:t.muted}}>🔍 Prohledávám…</span></div>)
                :imgMode==='image_search'?(<div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${t.green}`,borderTopColor:'transparent',animation:'thinkSpin .8s linear infinite'}}/><span style={{fontSize:12,color:t.muted}}>Hledám fotky…</span></div>)
                :thinking?(<div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${t.purple}`,borderTopColor:'transparent',animation:'thinkSpin 1s linear infinite'}}/><span style={{fontSize:12,color:t.purple,animation:'thinkPulse 1.5s infinite'}}>Lumi přemýšlí…</span></div>)
                :(<div className="dot"><span/><span/><span/></div>)}
              </div>
            </div>
          )}

          {err&&<div className="err-shake" style={{padding:'8px 12px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:9,fontSize:13,color:'#fca5a5',display:'flex',gap:7,wordBreak:'break-word',alignItems:'flex-start'}}>
            <span style={{flexShrink:0}}>⚠️</span>
            <span style={{flex:1}}>{err}</span>
            <div style={{display:'flex',gap:5,flexShrink:0}}>
              <button onClick={()=>{setErr(null);const allMsgs=activeConv?.local?(activeConv.messages??[]):msgs;const lu=allMsgs.filter(m=>m.role==='user').at(-1);if(lu)setInput(lu.content)}} style={{fontSize:11,color:t.accent,background:t.btn,border:`1px solid ${t.border}`,borderRadius:5,padding:'2px 7px',cursor:'pointer',fontFamily:'inherit'}}>🔄 Zkusit znovu</button>
              <button onClick={()=>setErr(null)} style={{color:'#fca5a5',display:'flex',padding:2,background:'none',border:'none',cursor:'pointer'}}>{Ic.x}</button>
            </div>
          </div>}
          <div ref={endRef}/>
        </div>

        {/* ── INPUT AREA — Claude.ai style ──────────────────────────────────── */}
        <div style={{padding:'7px 11px 9px',background:t.iaBg,borderTop:`1px solid ${t.border}`,flexShrink:0}}>

          {/* Aktivní projekt banner */}
          {activeProject&&(
            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:6,padding:'5px 10px',background:activeProject.color+'18',borderRadius:7,border:`1px solid ${activeProject.color}44`,animation:'dropIn .15s ease'}}>
              <span style={{fontSize:13}}>{activeProject.icon||'📁'}</span>
              <span style={{fontSize:12,color:t.txt,fontWeight:500,flex:1}}>{activeProject.name}</span>
              {activeProject.system_prompt&&<span style={{fontSize:10,color:t.muted}}>vlastní instrukce ✓</span>}
              <button onClick={()=>setActiveProject(null)} style={{color:t.muted,background:'none',border:'none',cursor:'pointer',fontSize:13,display:'flex',padding:2}}>{Ic.x}</button>
            </div>
          )}

          {toolMode&&TOOL_OPTIONS[toolMode]&&(
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7,padding:'7px 12px',background:t.tag,borderRadius:9,border:`1px solid #06b6d444`,animation:'dropIn .2s ease'}}>
              <span style={{fontSize:11,color:'#06b6d4',fontWeight:600,flexShrink:0}}>{TOOL_OPTIONS[toolMode].label}:</span>
              <input value={toolOptions[TOOL_OPTIONS[toolMode].field]||''} onChange={e=>setToolOptions(o=>({...o,[TOOL_OPTIONS[toolMode].field]:e.target.value}))}
                placeholder={TOOL_OPTIONS[toolMode].placeholder} style={{flex:1,padding:'3px 8px',background:t.inBg,color:t.txt,border:`1px solid #06b6d444`,borderRadius:6,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
              <span style={{fontSize:10,color:t.muted,flexShrink:0,whiteSpace:'nowrap'}}>pak napiš →</span>
            </div>
          )}

          {/* Quiz panel */}
          {quizMode&&(
            <div style={{marginBottom:7,padding:'11px',background:t.tag,borderRadius:9,border:`1px solid #f59e0b44`,animation:'dropIn .2s ease'}}>
              <input value={quizTopic} onChange={e=>setQuizTopic(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendQuiz()} placeholder="Téma kvízu…" style={{width:'100%',padding:'7px 11px',background:t.inBg,color:t.txt,border:`1.5px solid #f59e0b`,borderRadius:7,fontSize:13,outline:'none',fontFamily:'inherit',marginBottom:8,boxSizing:'border-box'}}/>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <span style={{fontSize:11,color:t.muted}}>Počet:</span>
                <div style={{display:'flex',gap:3}}>{QUIZ_COUNTS.map(n=><button key={n} onClick={()=>setQuizCount(n)} style={{padding:'3px 7px',borderRadius:5,background:quizCount===n?'#f59e0b':t.btn,color:quizCount===n?'#fff':t.muted,fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:quizCount===n?700:400,minWidth:26}}>{n}</button>)}</div>
                <span style={{fontSize:11,color:t.muted}}>Obtíž:</span>
                <div style={{display:'flex',gap:3}}>{QUIZ_DIFFS.map(([v,l])=><button key={v} onClick={()=>setQuizDiff(v)} style={{padding:'3px 8px',borderRadius:5,background:quizDiff===v?'#f59e0b':t.btn,color:quizDiff===v?'#fff':t.muted,fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:quizDiff===v?700:400}}>{l}</button>)}</div>
                <button onClick={sendQuiz} disabled={!quizTopic.trim()||loading} style={{padding:'5px 14px',borderRadius:7,background:'#f59e0b',color:'#fff',fontSize:12,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit',opacity:!quizTopic.trim()?0.5:1,marginLeft:'auto'}}>Start 🎓</button>
              </div>
            </div>
          )}

          {/* Image styles */}
          {imgMode==='generate_image'&&showImgStyles&&<ImageStylePresets t={t} onSelect={s=>setInput(p=>p?p+', '+s:s)}/>}

          {/* Bookmarks */}
          {showBookmarks&&<PromptBookmarks t={t} input={input} onSelect={txt=>{setInput(txt);setShowBookmarks(false);taRef.current?.focus()}}/>}

          {/* Templates */}
          {showTemplates&&(
            <div style={{marginBottom:7,background:t.modal,border:`1px solid ${t.border}`,borderRadius:9,overflow:'hidden',animation:'dropIn .2s ease'}}>
              <div style={{padding:'6px 11px',borderBottom:`1px solid ${t.border}`,fontSize:11,color:t.muted,fontWeight:600,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                📝 Šablony <button onClick={()=>setShowTemplates(false)} style={{color:t.muted,background:'none',border:'none',cursor:'pointer',display:'flex',padding:2}}>{Ic.x}</button>
              </div>
              <div style={{display:'flex',flexDirection:'column',maxHeight:240,overflowY:'auto'}}>
                {TEMPLATES.map(tp=>(
                  <button key={tp.label} onClick={()=>{setInput(tp.text);setShowTemplates(false);taRef.current?.focus()}} style={{display:'flex',alignItems:'center',gap:9,padding:'8px 11px',background:'transparent',color:t.txt,fontSize:12,textAlign:'left',cursor:'pointer',fontFamily:'inherit',border:'none',transition:'background .1s'}} onMouseOver={e=>e.currentTarget.style.background=t.active} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{fontSize:15,flexShrink:0}}>{tp.icon}</span><span style={{color:t.muted,fontSize:12}}>{tp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Calc */}
          {showCalc&&<CalcWidget t={t} onResult={r=>{setInput(p=>p?p+' '+r:r);setShowCalc(false);taRef.current?.focus()}}/>}

          {/* Attachments */}
          {atts.length>0&&(
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:7}}>
              {atts.map(a=>(
                <div key={a.id} style={{position:'relative'}}>
                  {a.preview?<img src={a.preview} alt={a.name} style={{height:44,width:44,objectFit:'cover',borderRadius:6,border:`1px solid ${t.border}`,display:'block'}}/>
                    :<div style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',background:t.pill,borderRadius:6,fontSize:11,color:t.txt}}>{a.type.includes('pdf')?Ic.pdf:Ic.file}<span style={{maxWidth:110,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span></div>}
                  <button onClick={()=>setAtts(p=>p.filter(x=>x.id!==a.id))} style={{position:'absolute',top:-4,right:-4,width:15,height:15,borderRadius:'50%',background:t.danger,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',border:'none',cursor:'pointer',fontSize:9}}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* ── HLAVNÍ INPUT — Claude.ai style ────────────────────────────── */}
          <div style={{background:t.inBg,border:`1.5px solid ${toolMode?'#06b6d4':imgMode==='generate_image'||thinking?t.purple:imgMode==='web_search'?t.green:t.inBrd}`,borderRadius:16,transition:'border-color .2s'}}>
            {/* Active mode/tool pill uvnitř boxu nahoře */}
            {(imgMode!=='chat'||toolMode||quizMode)&&(
              <div style={{display:'flex',alignItems:'center',gap:5,padding:'7px 14px 0',flexWrap:'wrap'}}>
                {toolMode&&<span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,padding:'2px 8px',borderRadius:12,background:'#06b6d422',color:'#06b6d4',fontWeight:600}}>
                  {TOOL_LABELS[toolMode]}<button onClick={()=>setToolMode(null)} style={{color:'#06b6d4',background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',lineHeight:1}}>{Ic.x}</button>
                </span>}
                {imgMode!=='chat'&&!toolMode&&<span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,padding:'2px 8px',borderRadius:12,background:imgMode==='generate_image'?t.purple+'22':imgMode==='web_search'?t.green+'22':'rgba(34,197,94,.15)',color:imgMode==='generate_image'?t.purple:imgMode==='web_search'?t.green:t.green,fontWeight:600}}>
                  {imgMode==='generate_image'?`🎨 ${IMG_MODELS.find(m=>m.id===imgModel)?.name||'AI Obrázek'}`:imgMode==='web_search'?`🌐 ${WEB_SEARCH_TYPES.find(s=>s.id===webSearchType)?.label||'Web'}`:imgMode==='image_search'?'📷 Fotografie':''}
                  <button onClick={()=>setImgMode('chat')} style={{color:'inherit',background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',lineHeight:1}}>{Ic.x}</button>
                </span>}
                {quizMode&&<span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,padding:'2px 8px',borderRadius:12,background:'#f59e0b22',color:'#f59e0b',fontWeight:600}}>
                  🎓 Kvíz<button onClick={()=>setQuizMode(false)} style={{color:'#f59e0b',background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',lineHeight:1}}>{Ic.x}</button>
                </span>}
                {thinking&&<span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,padding:'2px 8px',borderRadius:12,background:t.purple+'22',color:t.purple,fontWeight:600,animation:'thinkPulse 1.5s infinite'}}>
                  💭 Deep Thinking<button onClick={()=>setThinking(false)} style={{color:t.purple,background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',lineHeight:1}}>{Ic.x}</button>
                </span>}
                {writeStyle&&<span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,padding:'2px 8px',borderRadius:12,background:'#0891b222',color:'#0891b2',fontWeight:600}}>
                  ✍️ {({concise:'Stručně',detailed:'Detailně',formal:'Formálně',casual:'Casualně',technical:'Technicky'})[writeStyle]}
                  <button onClick={()=>setWriteStyle(null)} style={{color:'#0891b2',background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',lineHeight:1}}>{Ic.x}</button>
                </span>}
              </div>
            )}

            {/* Textarea */}
            <textarea ref={taRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
              placeholder={phs[toolMode]||phs[imgMode]||'Zeptat se Lumi…'} rows={1}
              style={{width:'100%',fontSize:14,lineHeight:1.55,color:t.txt,caretColor:t.accent,maxHeight:200,overflowY:'auto',display:'block',background:'transparent',padding:'12px 14px 4px',border:'none',outline:'none',fontFamily:"'DM Sans','Segoe UI',sans-serif",resize:'none'}}
              onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,200)+'px'}}/>

            {/* Bottom bar — + vlevo, voice + model + send vpravo */}
            <div style={{display:'flex',alignItems:'center',padding:'4px 8px 8px',gap:4}}>

              {/* + button — 5 hlavních + Zobrazit více */}
              <div style={{position:'relative',flexShrink:0}}>
                <Dropdown t={t} label="" icon={
                  <div style={{width:30,height:30,borderRadius:8,border:`1px solid ${t.border}`,background:t.btn,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:300,color:t.muted,transition:'all .15s'}}>+</div>
                } active={showTemplates||showCalc||showBookmarks||imgMode!=='chat'||!!toolMode||quizMode}>
                  <PlusMenu t={t} imgMode={imgMode} setImgMode={setImgMode} toolMode={toolMode} setToolMode={setToolMode}
                    quizMode={quizMode} setQuizMode={setQuizMode} showBookmarks={showBookmarks} setShowBookmarks={setShowBookmarks}
                    showTemplates={showTemplates} setShowTemplates={setShowTemplates} showCalc={showCalc} setShowCalc={setShowCalc}
                    showFocusTimer={showFocusTimer} setShowFocusTimer={setShowFocusTimer} showLive={()=>setShowLive(true)}
                    showAddMem={()=>setShowAddMem(true)} isLoggedIn={isLoggedIn} fileRef={fileRef}/>
                </Dropdown>
              </div>

              {/* Flex spacer */}
              <div style={{flex:1,display:'flex',alignItems:'center',gap:5,paddingLeft:2}}>
                {wordCount>0&&<span style={{fontSize:10,color:t.muted}}>{wordCount} sl</span>}
                {input.length>100&&<span style={{fontSize:10,color:input.length>1800?t.danger:input.length>1200?'#f59e0b':t.muted}}>{input.length}</span>}
              </div>

              {/* Voice */}
              <VoiceBtn t={t} onTranscript={txt=>{setInput(txt);setTimeout(()=>taRef.current?.focus(),100)}}/>

              {/* ✍️ Styl psaní — Claude AI styl */}
              {isLoggedIn&&(
                <div style={{position:'relative'}}>
                  <Dropdown t={t} label="" alignRight={true} icon={
                    <div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 9px',borderRadius:8,background:writeStyle?'#0891b222':t.btn,border:`1px solid ${writeStyle?'#0891b2':t.border}`,color:writeStyle?'#0891b2':t.muted,fontSize:11,fontWeight:500,cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap'}}>
                      ✍️ {writeStyle?({concise:'Stručně',detailed:'Detailně',formal:'Formálně',casual:'Casualně',technical:'Technicky'})[writeStyle]:'Styl'} {Ic.chevDn}
                    </div>
                  } active={!!writeStyle} accent="#0891b2">
                    <div style={{padding:'4px 0',width:200}}>
                      <div style={{fontSize:9,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.1em',padding:'4px 12px 2px'}}>Styl odpovědi</div>
                      {[
                        {id:null,icon:'🔄',label:'Automaticky',sub:'Lumi rozhodne sám'},
                        {id:'concise',icon:'⚡',label:'Stručně',sub:'Krátké odpovědi'},
                        {id:'detailed',icon:'📖',label:'Detailně',sub:'S příklady a kontextem'},
                        {id:'formal',icon:'👔',label:'Formálně',sub:'Profesionální tón'},
                        {id:'casual',icon:'😊',label:'Casualně',sub:'Přátelský styl'},
                        {id:'technical',icon:'🔧',label:'Technicky',sub:'Odborné termíny'},
                      ].map(s=>(
                        <DItem key={s.id??'auto'} t={t} onClick={()=>setWriteStyle(s.id)} active={writeStyle===s.id} clr="#0891b2" icon={s.icon} label={s.label} sub={s.sub}/>
                      ))}
                    </div>
                  </Dropdown>
                </div>
              )}

              {/* Model Picker — pill jako "Sonnet 4.6" */}
              {isLoggedIn&&(
                <div style={{position:'relative'}}>
                  <Dropdown t={t} label="" alignRight={true} icon={
                    <div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 9px',borderRadius:8,background:thinking?t.purple+'22':t.btn,border:`1px solid ${thinking?t.purple:t.border}`,color:thinking?t.purple:t.muted,fontSize:11,fontWeight:500,cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap'}}>
                      {thinking?'💭 Thinking':(currentModel?.short||'G4')} {Ic.chevDn}
                    </div>
                  } active={aiModel!=='default'||thinking} accent={t.purple}>
                    <div style={{padding:'4px 0',width:240}}>
                      <div style={{fontSize:9,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.1em',padding:'4px 12px 2px'}}>Chat model</div>
                      {AI_MODELS.map(m=>(
                        <DItem key={m.id} t={t} onClick={()=>setAiModel(m.id)} active={aiModel===m.id} clr={t.purple} icon={m.id==='default'?'✦':m.id==='gemini-25-pro'?'💎':'⚡'} label={m.name} sub={m.desc}/>
                      ))}
                      <div style={{margin:'4px 12px',borderTop:`1px solid ${t.border}`}}/>
                      <DItem t={t} onClick={()=>setThinking(x=>!x)} active={thinking} clr={t.purple} icon="💭" label="Deep Thinking" sub="Přesnější, ale pomalejší"/>
                      {imgMode==='generate_image'&&<>
                        <div style={{margin:'4px 12px',borderTop:`1px solid ${t.border}`}}/>
                        <div style={{fontSize:9,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.1em',padding:'4px 12px 2px'}}>Obrázky</div>
                        {IMG_MODELS.map(m=><DItem key={m.id} t={t} onClick={()=>setImgModel(m.id)} active={imgModel===m.id} clr={t.purple} icon="🎨" label={m.name} sub={`${m.desc} · ${m.cost}🌸`}/>)}
                      </>}
                      {imgMode==='web_search'&&<>
                        <div style={{margin:'4px 12px',borderTop:`1px solid ${t.border}`}}/>
                        <div style={{fontSize:9,fontWeight:700,color:t.muted,textTransform:'uppercase',letterSpacing:'.1em',padding:'4px 12px 2px'}}>Typ hledání</div>
                        {WEB_SEARCH_TYPES.map(st=><DItem key={st.id} t={t} onClick={()=>setWebSearchType(st.id)} active={webSearchType===st.id} clr={t.green} icon={st.label.split(' ')[0]} label={st.label} sub={st.desc}/>)}
                      </>}
                    </div>
                  </Dropdown>
                </div>
              )}

              {/* SEND button */}
              <button onClick={send} disabled={!canSend}
                style={{width:34,height:34,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',background:canSend?(toolMode?'#06b6d4':imgMode==='generate_image'||thinking?t.purple:imgMode==='web_search'?t.green:t.accent):t.btn,color:canSend?'#fff':t.muted,transition:'all .2s ease',flexShrink:0,border:'none',cursor:canSend?'pointer':'default',boxShadow:canSend?`0 2px 10px ${toolMode?'#06b6d4':imgMode==='generate_image'||thinking?t.purple:imgMode==='web_search'?t.green:t.accent}55`:'none'}}
                onMouseOver={e=>{if(canSend)e.currentTarget.style.transform='scale(1.07)'}}
                onMouseOut={e=>e.currentTarget.style.transform='scale(1)'}>
                {Ic.send}
              </button>
            </div>
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.docx,.xlsx,.py,.js,.ts,.html,.css" style={{display:'none'}} onChange={onFile}/>

          {/* Beta footer */}
          <div style={{fontSize:10,color:t.muted,textAlign:'center',marginTop:5}}>
            <span style={{background:'#f59e0b22',color:'#f59e0b',padding:'1px 5px',borderRadius:3,fontWeight:700,marginRight:4}}>BETA</span>
            Lumi může dělat chyby · Ctrl+K nová konverzace · Příkazy: <code style={{fontSize:9,background:t.tag,padding:'1px 4px',borderRadius:3}}>/web</code> <code style={{fontSize:9,background:t.tag,padding:'1px 4px',borderRadius:3}}>/img</code> <code style={{fontSize:9,background:t.tag,padding:'1px 4px',borderRadius:3}}>/kviz</code> <code style={{fontSize:9,background:t.tag,padding:'1px 4px',borderRadius:3}}>/share</code>
            {isLoggedIn&&<span> · ✅ Auto-save</span>}
          </div>
        </div>
      </main>

      {/* ── ARTIFACT PANEL (Claude AI styl) ────────────────────────────────── */}
      {artifactOpen&&artifact&&(
        <div style={{width:'min(480px,45vw)',minWidth:320,borderLeft:`1px solid ${t.border}`,display:'flex',flexDirection:'column',background:t.side,animation:'fadeIn .2s ease',flexShrink:0}}>
          {/* Artifact header */}
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderBottom:`1px solid ${t.border}`,flexShrink:0}}>
            <span style={{fontSize:13,fontWeight:600,color:t.txt,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {artifact.lang==='html'||artifact.lang==='jsx'||artifact.lang==='tsx'?'🖼️':'📄'} {artifact.title}
            </span>
            {/* Tab switcher */}
            {['preview','code'].map(tab=>(
              <button key={tab} onClick={()=>setArtifactTab(tab)}
                style={{padding:'3px 10px',borderRadius:6,fontSize:12,border:`1px solid ${artifactTab===tab?t.accent:t.border}`,background:artifactTab===tab?t.accent+'22':'transparent',color:artifactTab===tab?t.accent:t.muted,cursor:'pointer',fontWeight:artifactTab===tab?600:400}}>
                {tab==='preview'?'Náhled':'Kód'}
              </button>
            ))}
            <button onClick={()=>setArtifactOpen(false)} style={{color:t.muted,background:'none',border:'none',cursor:'pointer',display:'flex',padding:4,borderRadius:5}}>{Ic.x}</button>
          </div>
          {/* Artifact content */}
          <div style={{flex:1,overflow:'auto',position:'relative'}}>
            {artifactTab==='preview'?(
              ['html','jsx','tsx','svg'].includes(artifact.lang)?(
                <iframe
                  srcDoc={artifact.lang==='svg'?`<!DOCTYPE html><html><body style="margin:0;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh">${artifact.code}</body></html>`:
                    artifact.code.includes('<!DOCTYPE')||artifact.code.includes('<html')?artifact.code:
                    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:16px;margin:0}</style></head><body>${artifact.code}</body></html>`}
                  style={{width:'100%',height:'100%',border:'none',minHeight:400}}
                  sandbox="allow-scripts allow-same-origin"
                  title="Artifact preview"
                />
              ):(
                <pre style={{padding:16,fontSize:13,color:t.txt,fontFamily:'monospace',whiteSpace:'pre-wrap',wordBreak:'break-all',margin:0}}>{artifact.code}</pre>
              )
            ):(
              <div style={{position:'relative'}}>
                <pre style={{padding:16,fontSize:12,color:t.txt,fontFamily:'monospace',whiteSpace:'pre-wrap',wordBreak:'break-all',margin:0,lineHeight:1.6}}>{artifact.code}</pre>
                <button onClick={()=>navigator.clipboard.writeText(artifact.code)}
                  style={{position:'sticky',top:8,right:8,float:'right',margin:'8px 8px 0 0',padding:'4px 10px',borderRadius:6,fontSize:11,background:t.btn,color:t.muted,border:`1px solid ${t.border}`,cursor:'pointer'}}>
                  📋 Kopírovat
                </button>
              </div>
            )}
          </div>
          {/* Artifact footer */}
          <div style={{padding:'8px 14px',borderTop:`1px solid ${t.border}`,display:'flex',gap:8,flexShrink:0}}>
            <button onClick={()=>navigator.clipboard.writeText(artifact.code)}
              style={{flex:1,padding:'6px 0',borderRadius:7,fontSize:12,background:t.btn,color:t.muted,border:`1px solid ${t.border}`,cursor:'pointer'}}>
              📋 Kopírovat kód
            </button>
            <button onClick={()=>{
              const blob=new Blob([artifact.code],{type:'text/plain'})
              const a=document.createElement('a');a.href=URL.createObjectURL(blob)
              a.download=`artifact.${artifact.lang==='javascript'?'js':artifact.lang}`;a.click()
            }} style={{flex:1,padding:'6px 0',borderRadius:7,fontSize:12,background:t.btn,color:t.muted,border:`1px solid ${t.border}`,cursor:'pointer'}}>
              ⬇️ Stáhnout
            </button>
          </div>
        </div>
      )}
      </div>{/* konec MAIN + ARTIFACT wrapper */}
      {showAuth   &&<AuthModal onClose={()=>setShowAuth(false)} dark={t.isDark}/>}
      {showSet    &&<SettingsModal t={t} themeName={themeName} setThemeName={setThemeName} sysPmt={sysPmt} setSysPmt={setSysPmt} onClose={()=>setShowSet(false)} isLoggedIn={isLoggedIn} userId={session?.user?.id} memory={memory} setMemory={setMemory}/>}
      {showLive   &&<LiveModal t={t} onClose={()=>setShowLive(false)} sysPmt={sysPmt} token={token}/>}
      {showAddMem &&<AddMemoryModal t={t} onClose={()=>setShowAddMem(false)} onSave={addMemoryManual}/>}

      {/* Share Modal */}
      {showShareModal&&(
        <div onClick={()=>setShowShareModal(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:70,backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{width:'min(460px,96vw)',background:t.modal,border:`1px solid ${t.border}`,borderRadius:18,padding:'24px',fontFamily:"'DM Sans',sans-serif",animation:'fadeInScale .25s ease'}}>
            <div style={{fontWeight:700,fontSize:17,color:t.txt,marginBottom:6}}>🔗 Sdílet konverzaci</div>
            <div style={{fontSize:13,color:t.muted,marginBottom:16}}>Kdokoliv s tímto odkazem si může přečíst konverzaci (read-only).</div>
            <div style={{display:'flex',gap:8,marginBottom:12}}>
              <input readOnly value={`${window.location.origin}/shared/${shareSlug}`}
                style={{flex:1,padding:'8px 11px',background:t.inBg,color:t.txt,border:`1px solid ${t.border}`,borderRadius:8,fontSize:13,fontFamily:'inherit',outline:'none'}}/>
              <button onClick={()=>navigator.clipboard.writeText(`${window.location.origin}/shared/${shareSlug}`).then(()=>alert('Zkopírováno!'))}
                style={{padding:'8px 14px',borderRadius:8,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
                📋 Kopírovat
              </button>
            </div>
            <div style={{fontSize:11,color:t.muted,marginBottom:16}}>Kód konverzace: <code style={{background:t.tag,padding:'2px 6px',borderRadius:4}}>{shareSlug}</code></div>
            <button onClick={()=>setShowShareModal(false)} style={{width:'100%',padding:'9px',borderRadius:9,background:t.btn,color:t.muted,fontSize:13,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit'}}>Zavřít</button>
          </div>
        </div>
      )}

      {/* Goals Modal */}
      {showGoals&&<GoalsModal t={t} token={token||ANON} onClose={()=>setShowGoals(false)} callEdge={callEdge}/>}
      {showLumiCode&&<LumiCode t={t} token={token||ANON} onClose={()=>setShowLumiCode(false)} callEdge={callEdge}/>}
      {showLumiCowork&&<LumiCowork t={t} token={token||ANON} onClose={()=>setShowLumiCowork(false)} callEdge={callEdge}/>}
      {!cookies   &&<div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:80,padding:'12px 18px',background:t.isDark?'rgba(13,16,25,.97)':'rgba(255,255,255,.97)',backdropFilter:'blur(16px)',borderTop:`1px solid ${t.border}`,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',boxShadow:'0 -4px 24px rgba(0,0,0,.2)',animation:'slideUpBanner .4s ease'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:180}}>
          <span style={{fontSize:18}}>🍪</span>
          <div><div style={{fontSize:12,fontWeight:600,color:t.txt}}>Lumi používá cookies</div><div style={{fontSize:10,color:t.muted}}>Ukládáme téma, nastavení a pollen limit. Žádné sledovací cookies.</div></div>
        </div>
        <button onClick={()=>{setCookies(true);localStorage.setItem('lumi_cookies','1')}} style={{padding:'8px 18px',borderRadius:8,background:t.accent,color:'#fff',fontSize:12,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Rozumím</button>
      </div>}
    </div>
  )
}
