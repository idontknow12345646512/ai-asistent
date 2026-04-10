// ── Lumi AI — constants.jsx ───────────────────────────────────────────────────
export const EDGE='https://sjdvgkdvezzfazexzfrf.supabase.co/functions/v1/claude-chat'
export const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqZHZna2R2ZXp6ZmF6ZXh6ZnJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTYyODIsImV4cCI6MjA4OTc5MjI4Mn0.ZkZ9jImrSZDHAkSnAWPGgwXXkXEu4YnJtUbeyX99eOg'
export const APP_NAME='Lumi'
export const SYS_DEFAULT='Jsi Lumi, přátelský a inteligentní AI asistent. Odpovídáš přesně a věcně. Píšeš v češtině pokud uživatel nepíše jinak.'
export const CONV_COLORS=['','#6c8fff','#22c55e','#f59e0b','#ef4444','#a855f7','#06b6d4','#f97316']

// Pollinations — sliding window: 30p za 90 min od POSLEDNÍHO obrázku
export const IMG_MODELS=[
  {id:'flux',         name:'FLUX Schnell ⚡',cost:1,  desc:'Nejrychlejší • 1 pollen'},
  {id:'grok-imagine', name:'Grok Imagine 🤖',cost:20, desc:'xAI Aurora • 20 pollen'},
  {id:'qwen-image',   name:'Qwen Image+ 🎨', cost:30, desc:'Alibaba Qwen • 30 pollen'},
]
export const POLLEN_LIMIT=30
export const POLLEN_WINDOW=90 // minuty — 90 min od posledního obrázku

// AI modely
export const AI_MODELS=[
  {id:'default',    name:'Gemma 3 27B ✦', short:'G27B', desc:'Výchozí — nejsilnější open-source'},
  {id:'gemma-3-12b',name:'Gemma 3 12B 🔶',short:'G12B', desc:'Rychlejší open-source model'},
  {id:'gemini-auto',name:'Gemini Auto ⚡', short:'Auto', desc:'Gemini 3.1 Flash Lite — nejrychlejší'},
]

// DuckDuckGo search typy — bez API klíče, zdarma!
export const WEB_SEARCH_TYPES=[
  {id:'web',  label:'🌐 Web',     desc:'Celý internet — weby a články'},
  {id:'video',label:'🎬 Videa',   desc:'YouTube a ostatní videa'},
  {id:'image',label:'🖼️ Obrázky', desc:'Obrázky z celého webu'},
]

export const PERSONAS=[
  {label:'Lumi — výchozí',        val:SYS_DEFAULT},
  {label:'Profesionální asistent', val:'Jsi profesionální AI asistent. Odpovídáš formálně a přesně.'},
  {label:'Přátelský pomocník',     val:'Jsi přátelský AI pomocník. Komunikuješ neformálně a s humorem.'},
  {label:'Expert programátor',     val:'Jsi expert na programování. Odpovídáš přesně s kódovými příklady.'},
  {label:'Kreativní spisovatel',   val:'Jsi kreativní spisovatel. Pomáháš s texty, příběhy a básněmi.'},
  {label:'Lektor / učitel',        val:'Jsi trpělivý lektor. Vysvětluješ jednoduše s příklady.'},
  {label:'Sokrates 🏛️',            val:'Jsi sokratovský filosof. Odpovídáš otázkami a vedeš dialog.'},
  {label:'Data analytik 📊',       val:'Jsi analytik dat. Pomáháš interpretovat data a grafy.'},
]
export const QUIZ_COUNTS=[1,3,5,10,15,20]
export const QUIZ_DIFFS=[['easy','🟢 Lehká'],['medium','🟡 Střední'],['hard','🔴 Těžká']]
export const MEM_CATEGORIES=[
  {id:'personal',label:'👤 Osobní'},{id:'prefs',label:'❤️ Preference'},
  {id:'work',label:'💼 Práce'},{id:'general',label:'📌 Obecné'},{id:'fact',label:'📚 Fakt'},
]

// ── Themes (12) ───────────────────────────────────────────────────────────────
export const THEMES={
  dark:      {bg:'#0f1117',side:'#13161f',hdr:'rgba(15,17,23,.96)',  txt:'#e8eaf0',muted:'#5a6178',border:'#1e2230',accent:'#6c8fff',purple:'#a855f7',green:'#22c55e',active:'#1c2035',aiB:'#1a1d2a',inBg:'#13161f',iaBg:'#0f1117',inBrd:'#2a2f42',btn:'#1a1d2a',modal:'#13161f',pill:'#1a1d2a',ua:'#3d4460',scrl:'#2a2f42',card:'#1e2230',tag:'#1c2035',success:'rgba(34,197,94,.15)', succ:'#68d391',danger:'#e53e3e',gradA:'#6c8fff',gradB:'#a855f7',isDark:true},
  light:     {bg:'#f4f6fb',side:'#ffffff',hdr:'rgba(244,246,251,.96)',txt:'#1a1d2a',muted:'#7a849a',border:'#e2e6f0',accent:'#4c6ef5',purple:'#9333ea',green:'#16a34a',active:'#eef1ff',aiB:'#ffffff',inBg:'#ffffff',iaBg:'#f4f6fb',inBrd:'#d8dde8',btn:'#edf0f7',modal:'#ffffff',pill:'#edf0f7',ua:'#8898b0',scrl:'#c8cdd8',card:'#edf0f7',tag:'#eef1ff',success:'rgba(22,163,74,.12)',  succ:'#276749',danger:'#dc2626',gradA:'#4c6ef5',gradB:'#9333ea',isDark:false},
  midnight:  {bg:'#070a12',side:'#0c0f1c',hdr:'rgba(7,10,18,.97)',   txt:'#dde4f5',muted:'#4a526a',border:'#151b2e',accent:'#818cf8',purple:'#c084fc',green:'#4ade80',active:'#141728',aiB:'#111525',inBg:'#0c0f1c',iaBg:'#070a12',inBrd:'#1e2540',btn:'#111525',modal:'#0c0f1c',pill:'#111525',ua:'#2d3555',scrl:'#1e2540',card:'#141728',tag:'#141728',success:'rgba(74,222,128,.12)', succ:'#6ee7b7',danger:'#e53e3e',gradA:'#818cf8',gradB:'#c084fc',isDark:true},
  forest:    {bg:'#0a120a',side:'#0d1a0d',hdr:'rgba(10,18,10,.96)',  txt:'#d4e8d4',muted:'#4a6a4a',border:'#1a2e1a',accent:'#4ade80',purple:'#86efac',green:'#22c55e',active:'#142014',aiB:'#111e11',inBg:'#0d1a0d',iaBg:'#0a120a',inBrd:'#1e3a1e',btn:'#111e11',modal:'#0d1a0d',pill:'#111e11',ua:'#2d4a2d',scrl:'#1e3a1e',card:'#142014',tag:'#142014',success:'rgba(74,222,128,.15)',succ:'#86efac',danger:'#f87171',gradA:'#4ade80',gradB:'#22c55e',isDark:true},
  sunset:    {bg:'#120a0a',side:'#1e0f0a',hdr:'rgba(18,10,10,.96)',  txt:'#f0ddd4',muted:'#6a4a3a',border:'#2e1a0e',accent:'#fb923c',purple:'#f97316',green:'#fbbf24',active:'#241408',aiB:'#1e1108',inBg:'#1e0f0a',iaBg:'#120a0a',inBrd:'#3a2010',btn:'#1e1108',modal:'#1e0f0a',pill:'#1e1108',ua:'#4a2a1a',scrl:'#3a2010',card:'#241408',tag:'#241408',success:'rgba(251,146,60,.15)', succ:'#fdba74',danger:'#ef4444',gradA:'#fb923c',gradB:'#f97316',isDark:true},
  ocean:     {bg:'#050d1a',side:'#081526',hdr:'rgba(5,13,26,.96)',   txt:'#d0e8f5',muted:'#3a5a7a',border:'#0e2040',accent:'#38bdf8',purple:'#7dd3fc',green:'#34d399',active:'#0a1e38',aiB:'#081530',inBg:'#081526',iaBg:'#050d1a',inBrd:'#102840',btn:'#081530',modal:'#081526',pill:'#081530',ua:'#1a3a5a',scrl:'#102840',card:'#0a1e38',tag:'#0a1e38',success:'rgba(56,189,248,.15)', succ:'#7dd3fc',danger:'#f87171',gradA:'#38bdf8',gradB:'#7dd3fc',isDark:true},
  rose:      {bg:'#12080e',side:'#1e0e18',hdr:'rgba(18,8,14,.96)',   txt:'#f0d4e8',muted:'#6a3a5a',border:'#2e1028',accent:'#f472b6',purple:'#ec4899',green:'#34d399',active:'#240a1e',aiB:'#1e0818',inBg:'#1e0e18',iaBg:'#12080e',inBrd:'#3a1030',btn:'#1e0818',modal:'#1e0e18',pill:'#1e0818',ua:'#4a1a3a',scrl:'#3a1030',card:'#240a1e',tag:'#240a1e',success:'rgba(244,114,182,.15)',succ:'#f9a8d4',danger:'#ef4444',gradA:'#f472b6',gradB:'#ec4899',isDark:true},
  aurora:    {bg:'#080a14',side:'#0c0e1e',hdr:'rgba(8,10,20,.96)',   txt:'#e0f0f0',muted:'#3a5a6a',border:'#141e38',accent:'#2dd4bf',purple:'#818cf8',green:'#4ade80',active:'#101828',aiB:'#0c1424',inBg:'#0c0e1e',iaBg:'#080a14',inBrd:'#182038',btn:'#0c1424',modal:'#0c0e1e',pill:'#0c1424',ua:'#1a3a4a',scrl:'#182038',card:'#101828',tag:'#101828',success:'rgba(45,212,191,.15)', succ:'#5eead4',danger:'#f87171',gradA:'#2dd4bf',gradB:'#818cf8',isDark:true},
  slate:     {bg:'#0d1117',side:'#161b22',hdr:'rgba(13,17,23,.96)',  txt:'#c9d1d9',muted:'#484f58',border:'#21262d',accent:'#58a6ff',purple:'#bc8cff',green:'#3fb950',active:'#1c2128',aiB:'#161b22',inBg:'#0d1117',iaBg:'#0d1117',inBrd:'#30363d',btn:'#21262d',modal:'#161b22',pill:'#21262d',ua:'#30363d',scrl:'#30363d',card:'#1c2128',tag:'#1c2128',success:'rgba(63,185,80,.15)',  succ:'#3fb950',danger:'#f85149',gradA:'#58a6ff',gradB:'#bc8cff',isDark:true},
  lavender:  {bg:'#f5f3ff',side:'#faf9ff',hdr:'rgba(245,243,255,.96)',txt:'#1e1b4b',muted:'#6b7280',border:'#e0d7ff',accent:'#7c3aed',purple:'#9333ea',green:'#059669',active:'#ede9fe',aiB:'#ffffff',inBg:'#ffffff',iaBg:'#f5f3ff',inBrd:'#d0c7ff',btn:'#ede9fe',modal:'#ffffff',pill:'#ede9fe',ua:'#a78bfa',scrl:'#c4b5fd',card:'#ede9fe',tag:'#ede9fe',success:'rgba(5,150,105,.12)',  succ:'#047857',danger:'#dc2626',gradA:'#7c3aed',gradB:'#9333ea',isDark:false},
  nord:      {bg:'#2e3440',side:'#3b4252',hdr:'rgba(46,52,64,.96)',  txt:'#eceff4',muted:'#7a8898',border:'#434c5e',accent:'#88c0d0',purple:'#b48ead',green:'#a3be8c',active:'#434c5e',aiB:'#3b4252',inBg:'#2e3440',iaBg:'#2e3440',inBrd:'#4c566a',btn:'#3b4252',modal:'#3b4252',pill:'#3b4252',ua:'#4c566a',scrl:'#4c566a',card:'#434c5e',tag:'#434c5e',success:'rgba(163,190,140,.15)',succ:'#a3be8c',danger:'#bf616a',gradA:'#88c0d0',gradB:'#b48ead',isDark:true},
  solarized: {bg:'#002b36',side:'#073642',hdr:'rgba(0,43,54,.96)',   txt:'#fdf6e3',muted:'#657b83',border:'#094652',accent:'#268bd2',purple:'#6c71c4',green:'#859900',active:'#073642',aiB:'#073642',inBg:'#002b36',iaBg:'#002b36',inBrd:'#094652',btn:'#073642',modal:'#073642',pill:'#073642',ua:'#586e75',scrl:'#094652',card:'#073642',tag:'#073642',success:'rgba(133,153,0,.15)',   succ:'#859900',danger:'#dc322f',gradA:'#268bd2',gradB:'#6c71c4',isDark:true},
}
export const THEME_LIST=[
  {id:'dark',label:'Tmavý',icon:'🌙'},{id:'light',label:'Světlý',icon:'☀️'},
  {id:'midnight',label:'Midnight',icon:'🌌'},{id:'forest',label:'Forest',icon:'🌲'},
  {id:'sunset',label:'Sunset',icon:'🌅'},{id:'ocean',label:'Ocean',icon:'🌊'},
  {id:'rose',label:'Rose',icon:'🌸'},{id:'aurora',label:'Aurora',icon:'🌠'},
  {id:'slate',label:'Slate',icon:'⬛'},{id:'lavender',label:'Lavender',icon:'💜'},
  {id:'nord',label:'Nord',icon:'❄️'},{id:'solarized',label:'Solarized',icon:'🌞'},
]

// ── Helpers ───────────────────────────────────────────────────────────────────
export const uid=()=>Math.random().toString(36).slice(2)
export const fmtTime=ts=>new Date(ts).toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'})
export const fmtRelTime=ts=>{const diff=Date.now()-new Date(ts).getTime(),min=Math.floor(diff/60000);if(min<1)return'právě teď';if(min<60)return`před ${min} min`;const h=Math.floor(min/60);if(h<24)return`před ${h} h`;return new Date(ts).toLocaleDateString('cs-CZ',{day:'numeric',month:'short'})}
export const fmtDate=ts=>{
  const d=new Date(ts),now=new Date()
  if(d.toDateString()===now.toDateString())return'Dnes'
  const y=new Date(now);y.setDate(y.getDate()-1)
  if(d.toDateString()===y.toDateString())return'Včera'
  return d.toLocaleDateString('cs-CZ',{day:'numeric',month:'short'})
}
export async function callEdge(mode,payload,token){
  const res=await fetch(EDGE,{method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${token||ANON}`},
    body:JSON.stringify({mode,...payload})})
  if(!res.ok){const t=await res.text();let p;try{p=JSON.parse(t)}catch{p=null};throw new Error(p?.error||`HTTP ${res.status}`)}
  const d=await res.json();if(d.error)throw new Error(d.error);return d
}
// ── Smart Intent Detection ────────────────────────────────────────────────────
// Detekuje záměr z textu zprávy včetně negací ("nechci", "negeneruj"...)
// Vrátí: 'chat' | 'generate_image' | 'image_search' | 'web_search' | 'quiz' | 'weather' | 'moodboard'
export function detectIntent(text){
  const t=text.toLowerCase().trim()

  // ── Negace — explicitní odmítnutí ────────────────────────────────────────
  const negations=['nechci','nechce','negeneruj','negenerovat','nevytvářej','nekresli',
    'nezobrazuj','nevyhledávej','nehledej','nespouštěj','nepotřebuji obrázek',
    'nepotřebuji kvíz','bez obrázku','bez kvízu','dont generate','do not generate',
    "don't generate",'no image','no quiz']
  if(negations.some(n=>t.includes(n)))return'chat'

  // ── Mood Board ────────────────────────────────────────────────────────────
  const moodboardTriggers=['mood board','moodboard','nálada','vytvoř náladu',
    'inspirační tabule','nástěnka','vibe board','aesthetic']
  if(moodboardTriggers.some(x=>t.includes(x)))return'moodboard'

  // ── Počasí ────────────────────────────────────────────────────────────────
  const weatherTriggers=['jaké je počasí','jak je venku','počasí v','teplota v',
    "what's the weather",'weather in','how hot','how cold','bude pršet',
    'bude sněžit','předpověď počasí','meteorologická','teplota venku']
  if(weatherTriggers.some(x=>t.includes(x)))return'weather'

  // ── Kvíz ─────────────────────────────────────────────────────────────────
  const quizTriggers=['udělej kvíz','vytvoř kvíz','chci kvíz','spusť kvíz',
    'otestuj mě','testuj mě','make a quiz','quiz me','quiz about',
    'kvízové otázky','otázky na téma','vyzkoušej mě']
  if(quizTriggers.some(x=>t.includes(x)))return'quiz'

  // ── Web Search ────────────────────────────────────────────────────────────
  const searchTriggers=['hledej na webu','vyhledej na webu','najdi na internetu',
    'najdi informace o','co se děje','co je nového','search the web','find online',
    'google','vyhledej','co víš o','co je to','kdo je','kdy se stalo','kde se nachází',
    'latest news','nejnovější zprávy','aktuální informace']
  if(searchTriggers.some(x=>t.includes(x)))return'web_search'

  // ── Generování obrázku ────────────────────────────────────────────────────
  const imgTriggers=['vygeneruj obrázek','vygeneruj mi obrázek','nakresli','vytvoř obrázek',
    'generate image','generate a picture','draw me','create image','create picture',
    'chci obrázek','chci vidět obrázek','ukaž mi obrázek','vygeneruj','vykresli',
    'namaluj','illustruj','zobraz mi','ai obrázek']
  if(imgTriggers.some(x=>t.includes(x)))return'generate_image'

  // ── Hledání fotografií ────────────────────────────────────────────────────
  const photoTriggers=['najdi fotku','najdi fotografii','najdi obrázek','vyhledej fotku',
    'find a photo','find an image','show me a photo','fotografie od','foto ']
  if(photoTriggers.some(x=>t.includes(x)))return'image_search'

  return'chat'
}

// Zpětná kompatibilita — zachová starý detectAutoMode
export function detectAutoMode(text,imgMode){
  if(imgMode!=='chat')return imgMode
  const intent=detectIntent(text)
  // Přeložíme quiz/weather/moodboard na chat (zpracuje se v send funkci)
  if(['quiz','weather','moodboard'].includes(intent))return'chat'
  return intent
}
export const mkLocal=()=>({id:uid(),title:'Nová konverzace',messages:[],createdAt:Date.now(),local:true})

// Pollen local cache — kopie server stavu
export const getPollenCache=()=>{
  try{const d=JSON.parse(localStorage.getItem('lumi_pollen')||'{}')
    return{remaining:d.remaining??POLLEN_LIMIT,spent:d.spent||0,resetAt:d.resetAt||null,ts:d.ts||0}}
  catch{return{remaining:POLLEN_LIMIT,spent:0,resetAt:null,ts:0}}}
export const setPollenCache=d=>localStorage.setItem('lumi_pollen',JSON.stringify({...d,ts:Date.now()}))

// ── Markdown renderer ─────────────────────────────────────────────────────────
export function renderMD(text,isDark){
  if(!text)return''
  const cb=isDark?'#0d1117':'#f6f8fa',cbrd=isDark?'#30363d':'#d0d7de',ib=isDark?'rgba(110,118,129,0.2)':'rgba(175,184,193,0.2)'
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g,(_,lang,code)=>{
      const lbl=lang?`<div style="display:flex;justify-content:space-between;padding:5px 12px;background:${isDark?'#161b22':'#eaeef2'};border-bottom:1px solid ${cbrd};font-size:11px;color:${isDark?'#8b949e':'#57606a'};font-family:monospace;border-radius:8px 8px 0 0"><span style="font-weight:600">${lang}</span><span>code</span></div>`:''
      const esc=code.replace(/</g,'&lt;').replace(/>/g,'&gt;')
      return`<div style="margin:8px 0;border:1px solid ${cbrd};border-radius:${lang?'0 0 8px 8px':'8px'};overflow:hidden">${lbl}<pre style="margin:0;padding:12px;background:${cb};overflow-x:auto;font-family:'JetBrains Mono',Consolas,monospace;font-size:13px;line-height:1.6;color:${isDark?'#e6edf3':'#24292f'}">${esc.trimEnd()}</pre></div>`
    })
    .replace(/`([^`]+)`/g,`<code style="background:${ib};padding:2px 6px;border-radius:4px;font-size:12px;font-family:monospace;border:1px solid ${cbrd}">$1</code>`)
    .replace(/^### (.+)$/gm,`<strong style="font-size:14px;display:block;margin:10px 0 4px">$1</strong>`)
    .replace(/^## (.+)$/gm,`<strong style="font-size:16px;display:block;margin:12px 0 5px">$1</strong>`)
    .replace(/^# (.+)$/gm,`<strong style="font-size:18px;display:block;margin:14px 0 6px">$1</strong>`)
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/^---$/gm,`<hr style="border:none;border-top:1px solid currentColor;opacity:.2;margin:10px 0"/>`)
    .replace(/^> (.+)$/gm,`<div style="border-left:3px solid currentColor;opacity:.8;padding:4px 10px;margin:4px 0;font-style:italic">$1</div>`)
    .replace(/^[\-\*] (.+)$/gm,`<div style="display:flex;gap:8px;margin:3px 0;padding-left:4px"><span style="opacity:.5;flex-shrink:0">•</span><span>$1</span></div>`)
    .replace(/^(\d+)\. (.+)$/gm,`<div style="display:flex;gap:8px;margin:3px 0;padding-left:4px"><span style="opacity:.5;min-width:18px;flex-shrink:0">$1.</span><span>$2</span></div>`)
    .replace(/\n/g,'<br/>')
}

// ── Icons ─────────────────────────────────────────────────────────────────────
export const Ic={
  send:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  plus:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  gear:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  magic:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>,
  search:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  globe:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  video:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  imgSrch:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><rect x="3" y="3" width="7" height="5" rx="1"/><circle cx="14" cy="7" r="2"/></svg>,
  clip:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  x:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  menu:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  out:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  user:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  extLink:<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  dl:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  edit:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  file:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
  pdf:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  mic:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  brain:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>,
  thumbUp:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>,
  thumbDn:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>,
  info:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  memory:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>,
  quiz:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  check:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  copy:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  star:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  starF:<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  export:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  live:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M7.76 7.76a6 6 0 0 0 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
  chevDn:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  chevUp:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>,
  model:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  wand:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>,
  addMem:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>,
  spark:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>,
  pin:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>,
  clock:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
}

// ── Lumi Avatar ───────────────────────────────────────────────────────────────
export function LumiAvatar({size=28,gradient=['#6c8fff','#a855f7']}){
  const id=`lg-${Math.random().toString(36).slice(2,7)}`
  return(
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id={id} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop stopColor={gradient[0]}/><stop offset="1" stopColor={gradient[1]}/></linearGradient></defs>
      <rect width="40" height="40" rx="12" fill={`url(#${id})`}/>
      <path d="M13 12C13 12 13 20 13 24C13 26.2 14.8 28 17 28L27 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.95"/>
      <circle cx="26" cy="16" r="3.5" fill="white" opacity="0.9"/>
      <circle cx="20" cy="13" r="2" fill="white" opacity="0.6"/>
    </svg>
  )
}
