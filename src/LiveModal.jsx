import { useState, useEffect, useRef } from 'react'
import { ANON, callEdge, SYS_DEFAULT, getNowCtx, renderMD, LIVE_MODELS } from './constants.jsx'

// TTS přes Web Speech API — přečte odpověď nahlas
function speak(text, onStart, onEnd) {
  if (!('speechSynthesis' in window)) { onEnd?.(); return }
  window.speechSynthesis.cancel()
  // Čistý text bez markdown symbolů pro TTS
  const clean = text
    .replace(/```[\s\S]*?```/g, 'kód')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#+\s/g, '')
    .replace(/[-*] /g, '')
    .replace(/\n+/g, ' ')
    .trim()
  const utt = new SpeechSynthesisUtterance(clean)
  utt.lang = 'cs-CZ'
  utt.rate = 1.05
  utt.pitch = 1.0
  // Zkus najít český hlas
  const voices = window.speechSynthesis.getVoices()
  const czVoice = voices.find(v => v.lang.startsWith('cs')) || voices.find(v => v.lang.startsWith('sk'))
  if (czVoice) utt.voice = czVoice
  utt.onstart = onStart
  utt.onend = onEnd
  utt.onerror = onEnd
  window.speechSynthesis.speak(utt)
}

export default function LiveModal({ t, onClose, sysPmt, token }) {
  const [phase, setPhase]       = useState('idle')      // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState([])       // [{role, text}]
  const [interim, setInterim]   = useState('')           // průběžný STT text
  const [err, setErr]           = useState(null)
  const [elapsed, setElapsed]   = useState(0)
  const [voices, setVoices]     = useState([])
  const [autoMode, setAutoMode] = useState(true)         // automaticky nahrávat po odpovědi
  const [history, setHistory]   = useState([])           // konverzační historie pro AI
  const [liveModel, setLiveModel] = useState(LIVE_MODELS[0].id) // vybraný Live model

  const recRef   = useRef(null)
  const timerRef = useRef(null)
  const abortRef = useRef(false)

  // Načti hlasy
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis?.getVoices() || [])
    load()
    window.speechSynthesis?.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load)
  }, [])

  // Elapsed timer
  useEffect(() => {
    if (phase !== 'idle') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [phase])

  // Cleanup při unmount
  useEffect(() => {
    return () => {
      abortRef.current = true
      recRef.current?.stop()
      window.speechSynthesis?.cancel()
      clearInterval(timerRef.current)
    }
  }, [])

  const fmtE = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── Spuštění nahrávání ─────────────────────────────────────────────────────
  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setErr('Prohlížeč nepodporuje rozpoznávání řeči.'); return }

    setPhase('listening')
    setInterim('')
    setErr(null)
    abortRef.current = false

    const rec = new SR()
    rec.lang = 'cs-CZ'
    rec.continuous = false
    rec.interimResults = true
    recRef.current = rec

    rec.onresult = e => {
      let interim_ = '', final_ = ''
      for (const r of e.results) {
        if (r.isFinal) final_ += r[0].transcript
        else interim_ += r[0].transcript
      }
      setInterim(interim_)
      if (final_) handleUserSpeech(final_.trim())
    }

    rec.onerror = e => {
      if (e.error === 'no-speech') { setPhase('idle'); return }
      setErr('Chyba mikrofonu: ' + e.error)
      setPhase('idle')
    }

    rec.onend = () => {
      if (phase === 'listening') setInterim('')
    }

    rec.start()
  }

  // ── Zpracování textu od uživatele ──────────────────────────────────────────
  const handleUserSpeech = async (userText) => {
    if (!userText || abortRef.current) return
    recRef.current?.stop()
    setInterim('')
    setPhase('thinking')

    // Přidej do transkriptu
    const userMsg = { role: 'user', text: userText }
    setTranscript(prev => [...prev, userMsg])

    // Přidej do AI historie
    const newHistory = [...history, { role: 'user', content: [{ type: 'text', text: userText }] }]

    try {
      const tk = token || ANON
      const sys = (sysPmt || SYS_DEFAULT) + getNowCtx() +
        '\n\nOdpovídej stručně a přirozeně — tvoje odpověď bude přečtena nahlas. Max 3-4 věty.'

      const result = await callEdge('chat', {
        messages: newHistory,
        system: sys,
        memory: true,
        preferredModel: 'default',
      }, tk)

      if (abortRef.current) return

      const aiText = result.text || '(Prázdná odpověď)'
      const aiMsg = { role: 'ai', text: aiText }

      // Ulož do transkriptu a historie
      setTranscript(prev => [...prev, aiMsg])
      setHistory([...newHistory, { role: 'assistant', content: [{ type: 'text', text: aiText }] }])

      // Přečti odpověď nahlas
      setPhase('speaking')
      speak(
        aiText,
        () => setPhase('speaking'),
        () => {
          if (abortRef.current) return
          if (autoMode) {
            // Po odpovědi automaticky znovu nahrávej
            setTimeout(() => {
              if (!abortRef.current) startListening()
            }, 600)
          } else {
            setPhase('idle')
          }
        }
      )
    } catch (e) {
      setErr('Chyba AI: ' + e.message)
      setPhase('idle')
    }
  }

  // ── Ruční zadání textu ─────────────────────────────────────────────────────
  const [manualInput, setManualInput] = useState('')
  const sendManual = () => {
    const txt = manualInput.trim()
    if (!txt) return
    setManualInput('')
    handleUserSpeech(txt)
  }

  const stop = () => {
    abortRef.current = true
    recRef.current?.stop()
    window.speechSynthesis?.cancel()
    setPhase('idle')
    setInterim('')
  }

  const reset = () => {
    stop()
    setTranscript([])
    setHistory([])
    setElapsed(0)
    setErr(null)
    abortRef.current = false
  }

  const hasSR = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window
  const czVoice = voices.find(v => v.lang.startsWith('cs')) || voices.find(v => v.lang.startsWith('sk'))

  const phaseColor = { idle: t.muted, listening: t.green, thinking: t.accent, speaking: t.purple }
  const phaseLabel = {
    idle: '● Připraven',
    listening: '🎤 Nahrávám…',
    thinking: '💭 Přemýšlím…',
    speaking: '🔊 Mluvím…',
  }

  return (
    <>
      <div onClick={phase === 'idle' ? onClose : undefined}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.78)', zIndex: 98, backdropFilter: 'blur(8px)' }} />

      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 99, width: 'min(520px,96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: t.modal, border: `1px solid ${t.border}`, borderRadius: 20, fontFamily: "'DM Sans',sans-serif", overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg,${t.gradA},${t.gradB})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎙️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: t.txt }}>Lumi Live</div>
              <div style={{ fontSize: 11, color: phaseColor[phase] || t.muted, fontWeight: 500 }}>
                {phaseLabel[phase]}
                {phase !== 'idle' && <span style={{ marginLeft: 8, color: t.muted }}>{fmtE(elapsed)}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {phase !== 'idle' && (
              <button onClick={stop}
                style={{ padding: '6px 12px', borderRadius: 8, background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                ⏹ Stop
              </button>
            )}
            <button onClick={onClose}
              style={{ padding: '6px 12px', borderRadius: 8, background: t.btn, color: t.muted, fontSize: 12, border: `1px solid ${t.border}`, cursor: 'pointer', fontFamily: 'inherit' }}>
              Zavřít
            </button>
          </div>
        </div>

        {/* Status vizualizace */}
        <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexShrink: 0 }}>
          {/* Velký kruh se stavem */}
          <div style={{ width: 80, height: 80, borderRadius: '50%', border: `3px solid ${phaseColor[phase] || t.border}`, background: (phaseColor[phase] || t.muted) + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, transition: 'all .3s', boxShadow: phase !== 'idle' ? `0 0 24px ${phaseColor[phase]}44` : 'none', animation: phase === 'listening' ? 'livePulse 1.2s infinite' : phase === 'speaking' ? 'livePulse 0.8s infinite' : 'none' }}>
            {phase === 'idle' ? '🎤' : phase === 'listening' ? '🎤' : phase === 'thinking' ? '💭' : '🔊'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.txt, marginBottom: 4 }}>{phaseLabel[phase]}</div>
            {interim && <div style={{ fontSize: 12, color: t.muted, fontStyle: 'italic', lineHeight: 1.4 }}>„{interim}"</div>}
            {phase === 'thinking' && <div style={{ fontSize: 11, color: t.accent, animation: 'thinkPulse 1.5s infinite' }}>Gemini generuje odpověď…</div>}
            {phase === 'speaking' && <div style={{ fontSize: 11, color: t.purple }}>Čekej, přečtu odpověď…</div>}
            {phase === 'idle' && !hasSR && <div style={{ fontSize: 11, color: '#f59e0b' }}>⚠️ STT není dostupné v tomto prohlížeči</div>}
            {phase === 'idle' && hasSR && !czVoice && <div style={{ fontSize: 11, color: t.muted }}>Tip: Nainstaluj český hlas v nastavení systému</div>}
          </div>
        </div>

        {/* Nastavení */}
        <div style={{ padding: '0 18px 10px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={() => setAutoMode(a => !a)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 7, background: autoMode ? t.accent + '22' : t.btn, color: autoMode ? t.accent : t.muted, border: `1px solid ${autoMode ? t.accent : t.border}`, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: autoMode ? 600 : 400 }}>
            🔄 Auto-pokračovat
          </button>
          <button onClick={reset}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 7, background: t.btn, color: t.muted, border: `1px solid ${t.border}`, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            🗑️ Reset
          </button>
          {/* Model selector */}
          <select value={liveModel} onChange={e => setLiveModel(e.target.value)} disabled={phase !== 'idle'}
            style={{ padding: '3px 7px', borderRadius: 7, background: t.btn, color: t.muted, border: `1px solid ${t.border}`, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}>
            {LIVE_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <span style={{ fontSize: 10, color: t.muted, marginLeft: 'auto' }}>
            {hasTTS ? (czVoice ? `🔊 ${czVoice.name.slice(0, 20)}` : '🔊 TTS bez CZ hlasu') : '⚠️ TTS chybí'}
          </span>
        </div>

        {/* Transkript */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 8px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
          {transcript.length === 0 && phase === 'idle' && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: t.muted }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎙️</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: t.txt, marginBottom: 4 }}>Hlasový rozhovor s Lumi</div>
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>Klikni na mikrofon → mluv → Lumi odpoví a přečte odpověď nahlas</div>
            </div>
          )}
          {transcript.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '82%', padding: '8px 12px', borderRadius: item.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: item.role === 'user' ? t.accent : t.aiB, color: item.role === 'user' ? '#fff' : t.txt, fontSize: 13, lineHeight: 1.5, border: item.role === 'ai' ? `1px solid ${t.border}` : 'none' }}>
                {item.role === 'ai'
                  ? <div dangerouslySetInnerHTML={{ __html: renderMD(item.text, t.isDark) }} />
                  : item.text
                }
              </div>
            </div>
          ))}
        </div>

        {/* Chyba */}
        {err && (
          <div style={{ margin: '0 18px 8px', padding: '8px 12px', borderRadius: 9, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', fontSize: 12, flexShrink: 0 }}>
            ⚠️ {err}
          </div>
        )}

        {/* Ruční zadání textu */}
        <div style={{ padding: '8px 18px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 7, flexShrink: 0 }}>
          <input value={manualInput} onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendManual()}
            placeholder="Nebo napiš zprávu…"
            disabled={phase === 'thinking'}
            style={{ flex: 1, padding: '8px 12px', background: t.inBg, color: t.txt, border: `1px solid ${t.inBrd}`, borderRadius: 10, fontSize: 13, outline: 'none', fontFamily: 'inherit', opacity: phase === 'thinking' ? 0.5 : 1 }} />
          <button onClick={sendManual} disabled={!manualInput.trim() || phase === 'thinking'}
            style={{ padding: '8px 13px', borderRadius: 10, background: manualInput.trim() ? t.accent : t.btn, color: manualInput.trim() ? '#fff' : t.muted, border: 'none', cursor: manualInput.trim() ? 'pointer' : 'default', fontSize: 13, fontFamily: 'inherit', transition: 'all .2s' }}>
            ➤
          </button>
        </div>

        {/* Hlavní tlačítko */}
        <div style={{ padding: '10px 18px 16px', flexShrink: 0 }}>
          {phase === 'idle' ? (
            <button onClick={startListening} disabled={!hasSR}
              style={{ width: '100%', padding: '13px 0', borderRadius: 14, background: hasSR ? `linear-gradient(135deg,${t.gradA},${t.gradB})` : t.btn, color: hasSR ? '#fff' : t.muted, fontSize: 15, fontWeight: 700, border: 'none', cursor: hasSR ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'all .2s', boxShadow: hasSR ? `0 4px 20px ${t.gradA}44` : 'none' }}>
              🎤 Začít mluvit
            </button>
          ) : phase === 'listening' ? (
            <button onClick={stop}
              style={{ width: '100%', padding: '13px 0', borderRadius: 14, background: '#ef4444', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', animation: 'livePulse 1.5s infinite' }}>
              ⏹ Přestat nahrávat
            </button>
          ) : (
            <div style={{ width: '100%', padding: '13px 0', borderRadius: 14, background: t.tag, border: `1px solid ${t.border}`, fontSize: 13, color: t.muted, textAlign: 'center', fontFamily: 'inherit' }}>
              {phase === 'thinking' ? '💭 Generuji odpověď…' : '🔊 Přehrávám odpověď…'}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: t.muted, textAlign: 'center' }}>
            STT: Web Speech API · AI: Gemma 4 31B · TTS: {hasTTS ? (czVoice ? czVoice.name.slice(0, 25) : 'Web Speech (bez CZ)') : 'nedostupné'}
          </div>
        </div>
      </div>
    </>
  )
}
