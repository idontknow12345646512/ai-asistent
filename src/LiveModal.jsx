import { useState, useEffect, useRef } from 'react'

const LIVE_TOKEN_URL = 'https://sjdvgkdvezzfazexzfrf.supabase.co/functions/v1/live-token'

function bufToB64(buf) {
  const bytes=new Uint8Array(buf); let bin=''
  for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i])
  return btoa(bin)
}
function pcm16ToF32(buf) {
  const i16=new Int16Array(buf),f32=new Float32Array(i16.length)
  for(let i=0;i<i16.length;i++) f32[i]=i16[i]/32768.0
  return f32
}

export default function LiveModal({ t, onClose, sysPmt, token }) {
  const [status,    setStatus]    = useState('idle')
  const [mode,      setMode]      = useState('voice')
  const [transcript,setTranscript]= useState([])
  const [aiSpeaking,setAiSpeaking]= useState(false)
  const [userSpeak, setUserSpeak] = useState(false)
  const [err,       setErr]       = useState(null)
  const [elapsed,   setElapsed]   = useState(0)

  const wsRef=useRef(null),audioCtxRef=useRef(null),mediaRef=useRef(null)
  const scriptRef=useRef(null),videoRef=useRef(null),timerRef=useRef(null)
  const playQ=useRef([]),playing=useRef(false)

  useEffect(()=>{
    if(status==='connected') timerRef.current=setInterval(()=>setElapsed(e=>e+1),1000)
    else clearInterval(timerRef.current)
    return()=>clearInterval(timerRef.current)
  },[status])

  const fmtE=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  const playAudio=async b64=>{
    playQ.current.push(b64)
    if(playing.current) return
    playing.current=true
    while(playQ.current.length>0){
      const data=playQ.current.shift()
      try{
        const ctx=audioCtxRef.current; if(!ctx) break
        const raw=atob(data),buf=new ArrayBuffer(raw.length),view=new Uint8Array(buf)
        for(let i=0;i<raw.length;i++) view[i]=raw.charCodeAt(i)
        const f32=pcm16ToF32(buf)
        const ab=ctx.createBuffer(1,f32.length,24000)
        ab.copyToChannel(f32,0)
        const src=ctx.createBufferSource();src.buffer=ab;src.connect(ctx.destination)
        setAiSpeaking(true)
        await new Promise(r=>{src.onended=r;src.start()})
      }catch{}
    }
    setAiSpeaking(false);playing.current=false
  }

  const connect=async()=>{
    setStatus('connecting');setErr(null);setTranscript([]);setElapsed(0)
    try{
      const res=await fetch(LIVE_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({systemPrompt:sysPmt})})
      const{wsUrl,model}=await res.json()
      audioCtxRef.current=new(window.AudioContext||window.webkitAudioContext)({sampleRate:16000})
      let stream
      if(mode==='screen') stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true})
      else if(mode==='camera') stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true})
      else stream=await navigator.mediaDevices.getUserMedia({audio:true})
      mediaRef.current=stream
      if((mode==='camera'||mode==='screen')&&videoRef.current){videoRef.current.srcObject=stream;videoRef.current.play()}
      const ws=new WebSocket(wsUrl);wsRef.current=ws
      ws.onopen=()=>{
        setStatus('connected')
        ws.send(JSON.stringify({setup:{model,generation_config:{response_modalities:['AUDIO']},system_instruction:{parts:[{text:sysPmt}]}}}))
        const ctx=audioCtxRef.current
        const src2=ctx.createMediaStreamSource(stream)
        const proc=ctx.createScriptProcessor(4096,1,1)
        scriptRef.current=proc
        proc.onaudioprocess=e=>{
          if(ws.readyState!==WebSocket.OPEN) return
          const f=e.inputBuffer.getChannelData(0),pcm=new Int16Array(f.length)
          for(let i=0;i<f.length;i++) pcm[i]=Math.max(-32768,Math.min(32767,Math.round(f[i]*32767)))
          const energy=f.reduce((s,v)=>s+v*v,0)/f.length
          setUserSpeak(energy>0.001)
          ws.send(JSON.stringify({realtimeInput:{mediaChunks:[{mimeType:'audio/pcm;rate=16000',data:bufToB64(pcm.buffer)}]}}))
        }
        src2.connect(proc);proc.connect(ctx.destination)
      }
      ws.onmessage=async ev=>{
        try{
          const data=JSON.parse(ev.data)
          if(data.serverContent?.modelTurn?.parts){
            for(const p of data.serverContent.modelTurn.parts){
              if(p.inlineData?.mimeType?.startsWith('audio/')) playAudio(p.inlineData.data)
              if(p.text) setTranscript(prev=>[...prev,{role:'ai',text:p.text}])
            }
          }
          if(data.serverContent?.inputTranscript) setTranscript(prev=>[...prev,{role:'user',text:data.serverContent.inputTranscript}])
          if(data.serverContent?.turnComplete) setAiSpeaking(false)
        }catch{}
      }
      ws.onerror=()=>{setErr('WebSocket chyba.');setStatus('error')}
      ws.onclose=()=>{if(status==='connected')setStatus('idle')}
    }catch(e){setErr('Chyba: '+e.message);setStatus('error')}
  }

  const disconnect=()=>{
    wsRef.current?.close();scriptRef.current?.disconnect()
    mediaRef.current?.getTracks().forEach(t=>t.stop());audioCtxRef.current?.close()
    wsRef.current=null;scriptRef.current=null;mediaRef.current=null;audioCtxRef.current=null
    setStatus('idle');setAiSpeaking(false);setUserSpeak(false)
  }
  useEffect(()=>()=>disconnect(),[]) // eslint-disable-line

  return (
    <>
      <div onClick={status==='idle'||status==='error'?onClose:undefined} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:98,backdropFilter:'blur(8px)'}}/>
      <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:99,width:'min(520px,96vw)',background:t.modal,border:`1px solid ${t.border}`,borderRadius:20,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
        <div style={{padding:'18px 20px 14px',borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:status==='connected'?'#ef4444':'#6c8fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17}}>{status==='connected'?'🔴':'🎙️'}</div>
            <div>
              <div style={{fontWeight:600,fontSize:15,color:t.txt}}>Gemini Live</div>
              <div style={{fontSize:11,color:t.muted}}>
                {status==='idle'&&'Vyberte režim a připojte se'}
                {status==='connecting'&&'⏳ Připojuji…'}
                {status==='connected'&&`🟢 Připojeno · ${fmtE(elapsed)}`}
                {status==='error'&&'❌ Chyba připojení'}
              </div>
            </div>
          </div>
          <button onClick={status==='connected'?disconnect:onClose}
            style={{padding:'6px 14px',borderRadius:8,background:status==='connected'?'#ef4444':t.btn,color:status==='connected'?'#fff':t.muted,fontSize:13,fontWeight:500,border:'none',cursor:'pointer',fontFamily:'inherit'}}>
            {status==='connected'?'Ukončit':'Zavřít'}
          </button>
        </div>
        <div style={{padding:'16px 20px'}}>
          {status!=='connected'&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>Režim</div>
              <div style={{display:'flex',gap:8}}>
                {[{id:'voice',icon:'🎤',label:'Hlas'},{id:'camera',icon:'📷',label:'Kamera'},{id:'screen',icon:'🖥️',label:'Obrazovka'}].map(m=>(
                  <button key={m.id} onClick={()=>setMode(m.id)}
                    style={{flex:1,padding:'12px 8px',borderRadius:10,border:`2px solid ${mode===m.id?t.accent:t.border}`,background:mode===m.id?t.accent+'22':t.btn,color:mode===m.id?t.accent:t.muted,fontSize:12,fontWeight:mode===m.id?600:400,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',textAlign:'center'}}>
                    <div style={{fontSize:22,marginBottom:4}}>{m.icon}</div>{m.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(mode==='camera'||mode==='screen')&&status==='connected'&&(
            <div style={{marginBottom:14,borderRadius:12,overflow:'hidden',border:`1px solid ${t.border}`,background:'#000',aspectRatio:'16/9',position:'relative'}}>
              <video ref={videoRef} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            </div>
          )}
          {status==='connected'&&(
            <div style={{display:'flex',gap:12,marginBottom:14,justifyContent:'center'}}>
              {[{icon:'🎤',label:'Ty',active:userSpeak,color:'#22c55e'},{icon:'🤖',label:'AI',active:aiSpeaking,color:t.accent}].map(item=>(
                <div key={item.label} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                  <div style={{width:60,height:60,borderRadius:'50%',border:`3px solid ${item.active?item.color:t.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,background:item.active?item.color+'22':t.btn,transition:'all .2s'}}>{item.icon}</div>
                  <span style={{fontSize:11,color:t.muted}}>{item.active?(item.label==='Ty'?'Mluvíš…':'AI mluví…'):item.label}</span>
                </div>
              ))}
            </div>
          )}
          {transcript.length>0&&(
            <div style={{maxHeight:160,overflowY:'auto',marginBottom:14,display:'flex',flexDirection:'column',gap:6}}>
              {transcript.map((item,i)=>(
                <div key={i} style={{display:'flex',gap:6,justifyContent:item.role==='user'?'flex-end':'flex-start'}}>
                  <div style={{maxWidth:'80%',padding:'7px 11px',borderRadius:10,background:item.role==='user'?t.accent:t.aiB,color:item.role==='user'?'#fff':t.txt,fontSize:13,border:item.role==='ai'?`1px solid ${t.border}`:'none'}}>{item.text}</div>
                </div>
              ))}
            </div>
          )}
          {err&&<div style={{marginBottom:14,padding:'10px 13px',borderRadius:9,background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',color:'#fca5a5',fontSize:13}}>⚠️ {err}</div>}
          {status!=='connected'&&(
            <button onClick={connect} disabled={status==='connecting'}
              style={{width:'100%',padding:'13px 0',borderRadius:12,background:t.accent,color:'#fff',fontSize:15,fontWeight:600,border:'none',cursor:status==='connecting'?'default':'pointer',fontFamily:'inherit',opacity:status==='connecting'?0.7:1,transition:'all .2s'}}>
              {status==='connecting'?'⏳ Připojuji…':'🎙️ Spustit Live'}
            </button>
          )}
          <div style={{marginTop:10,fontSize:11,color:t.muted,textAlign:'center'}}>Powered by Gemini 2.0 Flash Live · Limit ~10 min/den</div>
        </div>
      </div>
    </>
  )
}
