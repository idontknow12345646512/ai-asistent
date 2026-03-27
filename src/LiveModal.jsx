import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const LIVE_TOKEN_URL = 'https://sjdvgkdvezzfazexzfrf.supabase.co/functions/v1/live-token'

// Převod ArrayBuffer na base64
function bufToB64(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// PCM16 → Float32
function pcm16ToFloat32(buf) {
  const int16 = new Int16Array(buf)
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0
  return float32
}

export default function LiveModal({ t, onClose, sysPmt, token }) {
  const [status, setStatus]       = useState('idle') // idle|connecting|connected|error
  const [mode, setMode]           = useState('voice') // voice|camera|screen
  const [transcript, setTranscript] = useState([]) // [{role,text}]
  const [aiSpeaking, setAiSpeaking] = useState(false)
  const [userSpeaking, setUserSpeaking] = useState(false)
  const [err, setErr]             = useState(null)
  const [elapsed, setElapsed]     = useState(0)

  const wsRef       = useRef(null)
  const audioCtxRef = useRef(null)
  const mediaRef    = useRef(null) // MediaStream
  const scriptRef   = useRef(null) // ScriptProcessor
  const videoRef    = useRef(null) // <video> element
  const timerRef    = useRef(null)
  const playQueueRef= useRef([])
  const playingRef  = useRef(false)

  // Timer
  useEffect(() => {
    if (status === 'connected') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [status])

  const fmtElapsed = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  // Přehrání audio z AI
  const playAudio = async (b64Data) => {
    playQueueRef.current.push(b64Data)
    if (playingRef.current) return
    playingRef.current = true
    while (playQueueRef.current.length > 0) {
      const data = playQueueRef.current.shift()
      try {
        const ctx = audioCtxRef.current
        if (!ctx) break
        const raw = atob(data)
        const buf = new ArrayBuffer(raw.length)
        const view = new Uint8Array(buf)
        for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
        const float32 = pcm16ToFloat32(buf)
        const audioBuf = ctx.createBuffer(1, float32.length, 24000)
        audioBuf.copyToChannel(float32, 0)
        const source = ctx.createBufferSource()
        source.buffer = audioBuf
        source.connect(ctx.destination)
        setAiSpeaking(true)
        await new Promise(resolve => { source.onended = resolve; source.start() })
      } catch {}
    }
    setAiSpeaking(false)
    playingRef.current = false
  }

  // Navázání WebSocket
  const connect = async () => {
    setStatus('connecting')
    setErr(null)
    setTranscript([])
    setElapsed(0)

    try {
      // Získej WS URL z Edge Function
      const res = await fetch(LIVE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ systemPrompt: sysPmt })
      })
      const { wsUrl, model } = await res.json()

      // Audio kontext
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 })

      // Spusť media stream
      let stream
      if (mode === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      } else if (mode === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      mediaRef.current = stream

      // Zobraz video náhled
      if ((mode === 'camera' || mode === 'screen') && videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }

      // WebSocket
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('connected')
        // Pošli setup zprávu
        ws.send(JSON.stringify({
          setup: {
            model,
            generation_config: { response_modalities: ['AUDIO'] },
            system_instruction: { parts: [{ text: sysPmt }] }
          }
        }))
        startAudioCapture(stream, ws)
      }

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data)
          // Audio odpověď
          if (data.serverContent?.modelTurn?.parts) {
            for (const part of data.serverContent.modelTurn.parts) {
              if (part.inlineData?.mimeType?.startsWith('audio/')) {
                playAudio(part.inlineData.data)
              }
              if (part.text) {
                setTranscript(p => [...p, { role: 'ai', text: part.text }])
              }
            }
          }
          // Transkript uživatele
          if (data.serverContent?.inputTranscript) {
            const txt = data.serverContent.inputTranscript
            if (txt) setTranscript(p => [...p, { role: 'user', text: txt }])
          }
          // Turn complete
          if (data.serverContent?.turnComplete) {
            setAiSpeaking(false)
          }
        } catch {}
      }

      ws.onerror = () => { setErr('WebSocket chyba. Zkus to znovu.'); setStatus('error') }
      ws.onclose = () => { if (status === 'connected') setStatus('idle') }

    } catch (e) {
      setErr('Chyba připojení: ' + e.message)
      setStatus('error')
    }
  }

  const startAudioCapture = (stream, ws) => {
    const ctx = audioCtxRef.current
    const source = ctx.createMediaStreamSource(stream)
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    scriptRef.current = processor

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return
      const float32 = e.inputBuffer.getChannelData(0)
      // Float32 → PCM16
      const pcm16 = new Int16Array(float32.length)
      for (let i = 0; i < float32.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)))
      }
      const b64 = bufToB64(pcm16.buffer)
      // Zjisti jestli uživatel mluví (energy detection)
      const energy = float32.reduce((s, v) => s + v * v, 0) / float32.length
      setUserSpeaking(energy > 0.001)
      ws.send(JSON.stringify({
        realtimeInput: {
          mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: b64 }]
        }
      }))
    }

    source.connect(processor)
    processor.connect(ctx.destination)
  }

  // Odeslat video frame (každých 2s)
  useEffect(() => {
    if (status !== 'connected' || mode === 'voice') return
    const canvas = document.createElement('canvas')
    const interval = setInterval(() => {
      if (!videoRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
      canvas.width = 320; canvas.height = 240
      const ctx2d = canvas.getContext('2d')
      ctx2d.drawImage(videoRef.current, 0, 0, 320, 240)
      const b64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1]
      wsRef.current.send(JSON.stringify({
        realtimeInput: {
          mediaChunks: [{ mimeType: 'image/jpeg', data: b64 }]
        }
      }))
    }, 2000)
    return () => clearInterval(interval)
  }, [status, mode])

  const disconnect = () => {
    wsRef.current?.close()
    scriptRef.current?.disconnect()
    mediaRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    wsRef.current = null
    scriptRef.current = null
    mediaRef.current = null
    audioCtxRef.current = null
    setStatus('idle')
    setAiSpeaking(false)
    setUserSpeaking(false)
  }

  useEffect(() => () => disconnect(), []) // eslint-disable-line

  const bg = t.bg
  const border = t.border

  return (
    <>
      <div onClick={status === 'idle' || status === 'error' ? onClose : undefined}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:98, backdropFilter:'blur(8px)' }}/>
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:99, width:'min(520px,96vw)', background:t.modal, border:`1px solid ${border}`, borderRadius:20, fontFamily:"'DM Sans',sans-serif", overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'18px 20px 14px', borderBottom:`1px solid ${border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background: status==='connected'?'#ef4444':'#6c8fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>
              {status==='connected' ? '🔴' : '🎙️'}
            </div>
            <div>
              <div style={{ fontWeight:600, fontSize:15, color:t.txt }}>Gemini Live</div>
              <div style={{ fontSize:11, color:t.muted }}>
                {status==='idle'&&'Vyberte režim a připojte se'}
                {status==='connecting'&&'⏳ Připojuji…'}
                {status==='connected'&&`🟢 Připojeno · ${fmtElapsed(elapsed)}`}
                {status==='error'&&'❌ Chyba připojení'}
              </div>
            </div>
          </div>
          <button onClick={status==='connected'?disconnect:onClose}
            style={{ padding:'6px 14px', borderRadius:8, background:status==='connected'?'#ef4444':t.btn, color:status==='connected'?'#fff':t.muted, fontSize:13, fontWeight:500, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            {status==='connected'?'Ukončit':'Zavřít'}
          </button>
        </div>

        <div style={{ padding:'16px 20px' }}>

          {/* Mode selection */}
          {status !== 'connected' && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:600, color:t.muted, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Režim</div>
              <div style={{ display:'flex', gap:8 }}>
                {[{id:'voice',icon:'🎤',label:'Hlas'},{id:'camera',icon:'📷',label:'Kamera'},{id:'screen',icon:'🖥️',label:'Obrazovka'}].map(m => (
                  <button key={m.id} onClick={()=>setMode(m.id)}
                    style={{ flex:1, padding:'12px 8px', borderRadius:10, border:`2px solid ${mode===m.id?t.accent:border}`, background:mode===m.id?t.accent+'22':t.btn, color:mode===m.id?t.accent:t.muted, fontSize:12, fontWeight:mode===m.id?600:400, cursor:'pointer', fontFamily:'inherit', transition:'all .15s', textAlign:'center' }}>
                    <div style={{ fontSize:22, marginBottom:4 }}>{m.icon}</div>{m.label}
                  </button>
                ))}
              </div>
              <div style={{ marginTop:10, padding:'9px 12px', borderRadius:8, background:t.tag, border:`1px solid ${border}`, fontSize:12, color:t.muted }}>
                {mode==='voice'&&'AI slyší tvůj hlas a odpovídá hlasem v reálném čase.'}
                {mode==='camera'&&'AI vidí kameru a slyší tě. Může komentovat co vidí.'}
                {mode==='screen'&&'AI vidí tvoji obrazovku — skvělé pro help s kódem nebo prací.'}
              </div>
            </div>
          )}

          {/* Video preview */}
          {(mode === 'camera' || mode === 'screen') && status === 'connected' && (
            <div style={{ marginBottom:14, borderRadius:12, overflow:'hidden', border:`1px solid ${border}`, background:'#000', aspectRatio:'16/9', position:'relative' }}>
              <video ref={videoRef} muted style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              <div style={{ position:'absolute', top:8, left:8, padding:'3px 8px', borderRadius:5, background:'rgba(0,0,0,0.65)', color:'#fff', fontSize:11 }}>
                {mode==='camera'?'📷 Kamera':'🖥️ Obrazovka'}
              </div>
            </div>
          )}

          {/* Visual indicators when connected */}
          {status === 'connected' && (
            <div style={{ display:'flex', gap:12, marginBottom:14, justifyContent:'center' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <div style={{ width:60, height:60, borderRadius:'50%', border:`3px solid ${userSpeaking?'#22c55e':border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, background:userSpeaking?'#22c55e22':t.btn, transition:'all .2s' }}>
                  🎤
                </div>
                <span style={{ fontSize:11, color:t.muted }}>{userSpeaking?'Mluvíš…':'Ty'}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', color:t.muted, fontSize:18 }}>⇄</div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <div style={{ width:60, height:60, borderRadius:'50%', border:`3px solid ${aiSpeaking?t.accent:border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, background:aiSpeaking?t.accent+'22':t.btn, transition:'all .2s' }}>
                  🤖
                </div>
                <span style={{ fontSize:11, color:t.muted }}>{aiSpeaking?'AI mluví…':'AI'}</span>
              </div>
            </div>
          )}

          {/* Transcript */}
          {transcript.length > 0 && (
            <div style={{ maxHeight:160, overflowY:'auto', marginBottom:14, display:'flex', flexDirection:'column', gap:6 }}>
              {transcript.map((item, i) => (
                <div key={i} style={{ display:'flex', gap:6, justifyContent:item.role==='user'?'flex-end':'flex-start' }}>
                  <div style={{ maxWidth:'80%', padding:'7px 11px', borderRadius:10, background:item.role==='user'?t.accent:t.aiB, color:item.role==='user'?'#fff':t.txt, fontSize:13, border:item.role==='ai'?`1px solid ${border}`:'none' }}>
                    {item.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {err && (
            <div style={{ marginBottom:14, padding:'10px 13px', borderRadius:9, background:'#2a1a1a', border:'1px solid #6a2d2d', color:'#fca5a5', fontSize:13 }}>
              ⚠️ {err}
            </div>
          )}

          {/* Connect button */}
          {status !== 'connected' && (
            <button onClick={connect} disabled={status==='connecting'}
              style={{ width:'100%', padding:'13px 0', borderRadius:12, background:t.accent, color:'#fff', fontSize:15, fontWeight:600, border:'none', cursor:status==='connecting'?'default':'pointer', fontFamily:'inherit', opacity:status==='connecting'?0.7:1, transition:'all .2s' }}>
              {status==='connecting'?'⏳ Připojuji…':'🎙️ Spustit Live'}
            </button>
          )}

          <div style={{ marginTop:10, fontSize:11, color:t.muted, textAlign:'center' }}>
            Powered by Gemini 2.0 Flash Live · Limit ~10 min/den (free tier)
          </div>
        </div>
      </div>
    </>
  )
}
