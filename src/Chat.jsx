import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import AuthModal from './AuthModal'
import LiveModal from './LiveModal'

const EDGE = 'https://sjdvgkdvezzfazexzfrf.supabase.co/functions/v1/claude-chat'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqZHZna2R2ZXp6ZmF6ZXh6ZnJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTYyODIsImV4cCI6MjA4OTc5MjI4Mn0.ZkZ9jImrSZDHAkSnAWPGgwXXkXEu4YnJtUbeyX99eOg'
const SYS_DEFAULT = 'Jsi profesionální AI asistent. Odpovídáš vždy formálně, přesně a věcně. Píšeš v češtině pokud uživatel nepíše jinak.'
const EMOTION_EMOJI = { happy:'😊', sad:'😔', angry:'😠', anxious:'😰', neutral:'😐', excited:'🤩', frustrated:'😤' }
const CONV_COLORS = ['', '#6c8fff', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#f97316']

// HuggingFace modely
const HF_MODELS = [
  { id: 'black-forest-labs/FLUX.1-schnell', name: 'FLUX Schnell ⚡ (rychlý)' },
  { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL 🎨 (kvalitní)' },
  { id: 'runwayml/stable-diffusion-v1-5', name: 'SD 1.5 🖼️ (klasika)' },
  { id: 'Lykon/dreamshaper-8', name: 'DreamShaper 8 ✨' },
  { id: 'prompthero/openjourney-v4', name: 'OpenJourney v4 🚀' },
]

const uid = () => Math.random().toString(36).slice(2)
const fmtTime = ts => new Date(ts).toLocaleTimeString('cs-CZ', { hour:'2-digit', minute:'2-digit' })
const fmtDate = ts => {
  const d = new Date(ts), now = new Date()
  if (d.toDateString()===now.toDateString()) return 'Dnes'
  const y = new Date(now); y.setDate(y.getDate()-1)
  if (d.toDateString()===y.toDateString()) return 'Včera'
  return d.toLocaleDateString('cs-CZ',{day:'numeric',month:'short'})
}
async function getFreshToken() {
  const {data} = await supabase.auth.refreshSession()
  if (data?.session) return data.session.access_token
  const {data:d2} = await supabase.auth.getSession()
  return d2?.session?.access_token ?? null
}
async function callEdge(mode, payload, token) {
  const res = await fetch(EDGE, {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token||ANON}`},
    body: JSON.stringify({mode,...payload})
  })
  if (!res.ok) { const txt=await res.text(); let p; try{p=JSON.parse(txt)}catch{p=null}; throw new Error(p?.error||`HTTP ${res.status}`) }
  const d = await res.json()
  if (d.error) throw new Error(d.error)
  return d
}
function detectAutoMode(text, imgMode) {
  if (imgMode!=='chat') return imgMode
  const t = text.toLowerCase()
  if (['vygeneruj','nakresli','vytvoř obrázek','generate image','draw '].some(x=>t.includes(x))) return 'generate_image'
  if (['najdi obrázk','vyhledej fotk','ukaž fotky','fotky ','fotografie ','find image','photo of'].some(x=>t.includes(x))) return 'image_search'
  return 'chat'
}
const mkLocal = () => ({id:uid(),title:'Nová konverzace',messages:[],createdAt:Date.now(),local:true})

// ── Vylepšený Markdown + Code renderer ───────────────────────────────────────
function renderContent(text, isDark) {
  if (!text) return ''
  const codeBg = isDark ? '#0d1117' : '#f6f8fa'
  const codeBorder = isDark ? '#30363d' : '#d0d7de'
  const inlineBg = isDark ? 'rgba(110,118,129,0.2)' : 'rgba(175,184,193,0.2)'

  return text
    // Fenced code blocks s language label
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const langLabel = lang ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:${isDark?'#161b22':'#eaeef2'};border-bottom:1px solid ${codeBorder};font-size:11px;color:${isDark?'#8b949e':'#57606a'};font-family:monospace;border-radius:8px 8px 0 0"><span>${lang}</span><span style="font-size:10px;opacity:.7">kód</span></div>` : ''
      const escapedCode = code.replace(/</g,'&lt;').replace(/>/g,'&gt;')
      return `<div style="margin:10px 0;border:1px solid ${codeBorder};border-radius:${lang?'0 0 8px 8px':'8px'};overflow:hidden">${langLabel}<pre style="margin:0;padding:12px;background:${codeBg};overflow-x:auto;font-family:'JetBrains Mono',Consolas,monospace;font-size:13px;line-height:1.6;color:${isDark?'#e6edf3':'#24292f'}">${escapedCode.trimEnd()}</pre></div>`
    })
    // Inline code
    .replace(/`([^`]+)`/g, `<code style="background:${inlineBg};padding:2px 6px;border-radius:4px;font-size:12px;font-family:monospace;border:1px solid ${codeBorder}">$1</code>`)
    // Math — jednoduchý renderer pro základní výrazy
    .replace(/\$\$([^$]+)\$\$/g, '<div style="text-align:center;padding:8px;font-style:italic;font-size:15px;letter-spacing:0.5px;margin:6px 0">∑ $1</div>')
    .replace(/\$([^$]+)\$/g, '<span style="font-style:italic;font-size:13px;letter-spacing:0.3px">$1</span>')
    // Headings
    .replace(/^### (.+)$/gm, '<strong style="font-size:14px;display:block;margin:10px 0 4px;border-bottom:1px solid currentColor;padding-bottom:4px;opacity:.9">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="font-size:16px;display:block;margin:12px 0 5px">$1</strong>')
    .replace(/^# (.+)$/gm, '<strong style="font-size:18px;display:block;margin:14px 0 6px">$1</strong>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid currentColor;opacity:.2;margin:10px 0"/>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<div style="border-left:3px solid currentColor;opacity:.8;padding:4px 10px;margin:4px 0;font-style:italic">$1</div>')
    // Lists
    .replace(/^[\-\*] (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0;padding-left:4px"><span style="opacity:.6;flex-shrink:0">•</span><span>$1</span></div>')
    .replace(/^(\d+)\. (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0;padding-left:4px"><span style="opacity:.6;min-width:18px;flex-shrink:0">$1.</span><span>$2</span></div>')
    // Line breaks
    .replace(/\n/g, '<br/>')
}

// Témata
const T = {
  dark:     {bg:'#0f1117',side:'#13161f',hdr:'rgba(15,17,23,0.96)',txt:'#e8eaf0',muted:'#5a6178',border:'#1e2230',accent:'#6c8fff',purple:'#a855f7',active:'#1c2035',aiB:'#1a1d2a',inBg:'#13161f',iaBg:'#0f1117',inBrd:'#2a2f42',btn:'#1a1d2a',modal:'#13161f',pill:'#1a1d2a',ua:'#3d4460',scrl:'#2a2f42',card:'#1e2230',tag:'#1c2035',success:'#22543d',successTxt:'#68d391',danger:'#e53e3e',isDark:true},
  light:    {bg:'#f4f6fb',side:'#fff',hdr:'rgba(244,246,251,0.96)',txt:'#1a1d2a',muted:'#7a849a',border:'#e2e6f0',accent:'#4c6ef5',purple:'#9333ea',active:'#eef1ff',aiB:'#fff',inBg:'#fff',iaBg:'#f4f6fb',inBrd:'#d8dde8',btn:'#edf0f7',modal:'#fff',pill:'#edf0f7',ua:'#8898b0',scrl:'#c8cdd8',card:'#edf0f7',tag:'#eef1ff',success:'#f0fff4',successTxt:'#276749',danger:'#dc2626',isDark:false},
  midnight: {bg:'#070a12',side:'#0c0f1c',hdr:'rgba(7,10,18,0.97)',txt:'#dde4f5',muted:'#4a526a',border:'#151b2e',accent:'#818cf8',purple:'#c084fc',active:'#141728',aiB:'#111525',inBg:'#0c0f1c',iaBg:'#070a12',inBrd:'#1e2540',btn:'#111525',modal:'#0c0f1c',pill:'#111525',ua:'#2d3555',scrl:'#1e2540',card:'#141728',tag:'#141728',success:'#1a3a2a',successTxt:'#6ee7b7',danger:'#e53e3e',isDark:true},
}

// Ikony
const Ic = {
  send:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  plus:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  gear:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  magic:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>,
  search:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  imgSrch: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><rect x="3" y="3" width="7" height="5" rx="1"/><circle cx="14" cy="7" r="2"/></svg>,
  clip:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  x:       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  menu:    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  out:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  user:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  extLink: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  download:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  edit:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  file:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
  mic:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  micOff:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  brain:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>,
  thumbUp: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>,
  thumbDn: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>,
  explain: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  memory:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>,
  quiz:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  check:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  moon:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  sun:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  copy:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  star:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  starFill:<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  export:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  live:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M7.76 7.76a6 6 0 0 0 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
}

// ── Sub-komponenty ─────────────────────────────────────────────────────────────
function ImgSearchResults({ images, query, t }) {
  const [errs, setErrs] = useState({})
  if (!images?.length) return <div style={{fontSize:13,color:t.muted}}>Žádné fotografie pro „{query}"</div>
  return (
    <div>
      <div style={{fontSize:12,color:t.muted,marginBottom:9,display:'flex',alignItems:'center',gap:6}}>{Ic.imgSrch} Výsledky: <strong style={{color:t.txt}}>„{query}"</strong></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
        {images.map((img,i)=>!errs[i]&&(
          <a key={img.id||i} href={img.source} target="_blank" rel="noopener noreferrer"
            style={{display:'block',borderRadius:8,overflow:'hidden',border:`1px solid ${t.border}`,textDecoration:'none',background:t.card,transition:'transform .15s,opacity .15s'}}
            onMouseOver={e=>{e.currentTarget.style.opacity='0.85';e.currentTarget.style.transform='scale(1.02)'}}
            onMouseOut={e=>{e.currentTarget.style.opacity='1';e.currentTarget.style.transform='scale(1)'}}>
            <div style={{position:'relative',paddingBottom:'66%',overflow:'hidden',background:t.card}}>
              <img src={img.thumbnail||img.url} alt={img.title||query} onError={()=>setErrs(p=>({...p,[i]:true}))}
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

function GenImage({ imageData, mimeType, prompt, modelId, t }) {
  const src = `data:${mimeType||'image/png'};base64,${imageData}`
  const modelName = HF_MODELS.find(m=>m.id===modelId)?.name || modelId
  const dl = () => { const a=document.createElement('a');a.href=src;a.download=`ai-image-${Date.now()}.png`;a.click() }
  return (
    <div>
      <div style={{fontSize:12,color:t.muted,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
        {Ic.magic} <span>HuggingFace · <strong style={{color:t.purple}}>{modelName}</strong></span>
      </div>
      <div style={{position:'relative',display:'inline-block',maxWidth:'100%'}}>
        <img src={src} alt={prompt} style={{maxWidth:'100%',maxHeight:420,borderRadius:12,display:'block',border:`1px solid ${t.border}`}}/>
        <button onClick={dl} style={{position:'absolute',top:8,right:8,display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:7,background:'rgba(0,0,0,0.65)',color:'#fff',fontSize:11,border:'none',cursor:'pointer',backdropFilter:'blur(4px)',fontFamily:'inherit'}}>
          {Ic.download} Stáhnout
        </button>
      </div>
      {prompt&&<div style={{fontSize:11,color:t.muted,marginTop:6,fontStyle:'italic'}}>„{prompt}"</div>}
    </div>
  )
}

// Rozšířený kvíz s více otázkami, progress barem a skóre
function QuizCard({ questions, t }) {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showResult, setShowResult] = useState(false)

  if (!questions?.length) return null
  const q = questions[current]
  const total = questions.length
  const answered = Object.keys(answers).length
  const score = Object.entries(answers).filter(([i,a])=>Number(a)===questions[i]?.correct).length

  if (showResult) {
    const pct = Math.round((score/total)*100)
    const emoji = pct>=80?'🏆':pct>=60?'👍':pct>=40?'😊':'📚'
    return (
      <div style={{padding:'16px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
        <div style={{textAlign:'center',marginBottom:16}}>
          <div style={{fontSize:36,marginBottom:8}}>{emoji}</div>
          <div style={{fontSize:20,fontWeight:700,color:t.txt}}>{score}/{total} správně</div>
          <div style={{fontSize:13,color:t.muted,marginTop:4}}>{pct}% úspěšnost</div>
          <div style={{width:'100%',height:8,background:t.btn,borderRadius:4,marginTop:12,overflow:'hidden'}}>
            <div style={{width:`${pct}%`,height:'100%',background:pct>=80?t.successTxt:pct>=60?t.accent:'#f59e0b',borderRadius:4,transition:'width 1s ease'}}/>
          </div>
        </div>
        <button onClick={()=>{setAnswers({});setCurrent(0);setShowResult(false)}}
          style={{width:'100%',padding:'10px',borderRadius:9,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>
          🔄 Zkusit znovu
        </button>
      </div>
    )
  }

  return (
    <div style={{padding:'14px 16px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
      {/* Progress */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <div style={{flex:1,height:4,background:t.btn,borderRadius:2,overflow:'hidden'}}>
          <div style={{width:`${((current+1)/total)*100}%`,height:'100%',background:t.accent,transition:'width .3s ease'}}/>
        </div>
        <span style={{fontSize:11,color:t.muted,flexShrink:0}}>{current+1}/{total}</span>
      </div>
      <div style={{fontSize:13,fontWeight:600,color:t.txt,marginBottom:12,lineHeight:1.4}}>🎓 {q.question}</div>
      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {q.options?.map((opt,i)=>{
          const sel = answers[current], isCorrect=i===q.correct, isSelected=sel===i
          let bg=t.btn,clr=t.txt,brd=t.border
          if (sel!==undefined){if(isCorrect){bg=t.success;clr=t.successTxt;brd=t.successTxt}else if(isSelected){bg='#2a1a1a';clr='#fca5a5';brd='#6a2d2d'}}
          return (
            <button key={i} onClick={()=>sel===undefined&&setAnswers(p=>({...p,[current]:i}))} disabled={sel!==undefined}
              style={{padding:'9px 13px',borderRadius:8,background:bg,color:clr,border:`1.5px solid ${brd}`,fontSize:13,textAlign:'left',cursor:sel===undefined?'pointer':'default',fontFamily:'inherit',transition:'all .2s',display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:22,height:22,borderRadius:'50%',background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{String.fromCharCode(65+i)}</span>
              {opt}
              {sel!==undefined&&isCorrect&&<span style={{marginLeft:'auto'}}>✓</span>}
            </button>
          )
        })}
      </div>
      {answers[current]!==undefined&&q.explanation&&(
        <div style={{marginTop:10,padding:'10px 12px',borderRadius:8,background:t.tag,border:`1px solid ${t.border}`,fontSize:12,color:t.muted,lineHeight:1.5}}>
          💡 {q.explanation}
        </div>
      )}
      {answers[current]!==undefined&&(
        <div style={{display:'flex',gap:8,marginTop:12}}>
          {current<total-1?(
            <button onClick={()=>setCurrent(c=>c+1)} style={{flex:1,padding:'9px',borderRadius:8,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>
              Další otázka →
            </button>
          ):(
            <button onClick={()=>setShowResult(true)} style={{flex:1,padding:'9px',borderRadius:8,background:'#f59e0b',color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>
              Zobrazit výsledky 🏆
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function VoiceBtn({ t, onTranscript }) {
  const [listening, setListening] = useState(false)
  const [txt, setTxt] = useState('')
  const recRef = useRef(null)
  const supported = typeof window!=='undefined'&&('SpeechRecognition' in window||'webkitSpeechRecognition' in window)
  if (!supported) return null
  const toggle = () => {
    if (listening){recRef.current?.stop();setListening(false);return}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition
    const rec=new SR();rec.continuous=false;rec.interimResults=true;rec.lang='cs-CZ'
    rec.onresult=e=>{const t2=Array.from(e.results).map(r=>r[0].transcript).join('');setTxt(t2);if(e.results[e.results.length-1].isFinal){onTranscript(t2);setTxt('');setListening(false)}}
    rec.onerror=()=>setListening(false);rec.onend=()=>setListening(false)
    recRef.current=rec;rec.start();setListening(true)
  }
  return (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <button onClick={toggle} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 11px',borderRadius:20,background:listening?'#ef4444':t.btn,color:listening?'#fff':t.muted,border:`1px solid ${listening?'#ef4444':t.border}`,fontSize:12,fontWeight:listening?600:400,fontFamily:'inherit',cursor:'pointer',transition:'all .2s'}}>
        {listening?<>{Ic.micOff} Stop</>:<>{Ic.mic} Hlas</>}
      </button>
      {txt&&<span style={{fontSize:12,color:t.muted,fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:130}}>„{txt}"</span>}
    </div>
  )
}

function MsgActions({ msg, t, isLoggedIn, token, onExplain, onSaveMemory, onStar, starred }) {
  const [rating, setRating] = useState(null)
  const [showFix, setShowFix] = useState(false)
  const [fix, setFix] = useState('')
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(()=>setCopied(false),1500) }
  const sendFeedback = async r => {
    setRating(r)
    if (token&&msg.dbId){try{await callEdge('feedback',{messageId:msg.dbId,rating:r,correction:fix||null},token)}catch{}}
    setShowFix(false)
  }
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:4,marginTop:5,flexWrap:'wrap'}}>
        <button onClick={copy} style={{display:'flex',alignItems:'center',gap:3,padding:'3px 7px',borderRadius:5,background:copied?t.success:t.btn,color:copied?t.successTxt:t.muted,fontSize:11,border:`1px solid ${copied?t.successTxt:t.border}`,cursor:'pointer',fontFamily:'inherit',transition:'all .2s'}}>
          {Ic.copy}{copied?'Zkopírováno!':'Kopírovat'}
        </button>
        <button onClick={()=>onExplain(msg)} style={{display:'flex',alignItems:'center',gap:3,padding:'3px 7px',borderRadius:5,background:t.btn,color:t.muted,fontSize:11,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit'}}>
          {Ic.explain} Jak jsem to zjistil?
        </button>
        {isLoggedIn&&<>
          <button onClick={()=>onSaveMemory(msg.content)} style={{display:'flex',alignItems:'center',gap:3,padding:'3px 7px',borderRadius:5,background:t.btn,color:t.muted,fontSize:11,border:`1px solid ${t.border}`,cursor:'pointer',fontFamily:'inherit'}}>
            {Ic.memory} Zapamatovat
          </button>
          <button onClick={()=>onStar(msg)} style={{display:'flex',padding:'3px 6px',borderRadius:5,background:starred?'#f59e0b22':t.btn,color:starred?'#f59e0b':t.muted,border:`1px solid ${starred?'#f59e0b':t.border}`,cursor:'pointer',transition:'all .2s'}}>
            {starred?Ic.starFill:Ic.star}
          </button>
        </>}
        <button onClick={()=>sendFeedback(1)} style={{display:'flex',padding:'3px 6px',borderRadius:5,background:rating===1?t.success:t.btn,color:rating===1?t.successTxt:t.muted,border:`1px solid ${rating===1?t.successTxt:t.border}`,cursor:'pointer'}}>
          {Ic.thumbUp}
        </button>
        <button onClick={()=>rating===-1?setShowFix(true):sendFeedback(-1)} style={{display:'flex',padding:'3px 6px',borderRadius:5,background:rating===-1?'#2a1a1a':t.btn,color:rating===-1?'#fca5a5':t.muted,border:`1px solid ${rating===-1?'#6a2d2d':t.border}`,cursor:'pointer'}}>
          {Ic.thumbDn}
        </button>
      </div>
      {showFix&&(
        <div style={{marginTop:6,padding:12,background:t.modal,border:`1px solid ${t.border}`,borderRadius:10}}>
          <div style={{fontSize:12,color:t.txt,marginBottom:7}}>Jak by správná odpověď měla znít?</div>
          <textarea value={fix} onChange={e=>setFix(e.target.value)} rows={3} placeholder="Napište opravu…"
            style={{width:'100%',padding:'8px 10px',background:t.inBg,color:t.txt,border:`1px solid ${t.inBrd}`,borderRadius:7,fontSize:12,outline:'none',resize:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:6,marginTop:8}}>
            <button onClick={()=>setShowFix(false)} style={{padding:'5px 12px',borderRadius:7,background:t.btn,color:t.txt,fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Zrušit</button>
            <button onClick={()=>sendFeedback(-1)} style={{padding:'5px 12px',borderRadius:7,background:t.accent,color:'#fff',fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit'}}>Odeslat</button>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsModal({ t, themeName, setThemeName, sysPmt, setSysPmt, onClose, isLoggedIn, userId, memory, setMemory }) {
  const [tmpPmt, setTmpPmt] = useState(sysPmt)
  const [memList, setMemList] = useState([])
  const [tab, setTab] = useState('appearance')
  useEffect(()=>{
    if (tab==='memory'&&isLoggedIn) supabase.from('user_memory').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(20).then(({data})=>setMemList(data||[]))
  },[tab,isLoggedIn,userId])
  const delMem = async id=>{await supabase.from('user_memory').delete().eq('id',id);setMemList(p=>p.filter(m=>m.id!==id))}
  const themeOpts=[{id:'dark',label:'Tmavý',icon:'🌙'},{id:'light',label:'Světlý',icon:'☀️'},{id:'midnight',label:'Midnight',icon:'🌌'}]
  const personas=[
    {label:'Profesionální asistent',val:SYS_DEFAULT},
    {label:'Přátelský pomocník',val:'Jsi přátelský a uvolněný AI pomocník. Komunikuješ neformálně a s humorem. Píšeš v češtině.'},
    {label:'Expert programátor',val:'Jsi expert na programování. Odpovídáš přesně s kódovými příklady. Preferuješ stručnost.'},
    {label:'Kreativní spisovatel',val:'Jsi kreativní spisovatel. Pomáháš s texty, příběhy a básněmi.'},
    {label:'Lektor / učitel',val:'Jsi trpělivý lektor. Vysvětluješ jednoduše s příklady. Přizpůsobuješ se tempu studenta.'},
  ]
  const tabs=[{id:'appearance',label:'Vzhled',icon:'🎨'},{id:'behavior',label:'Chování',icon:'🤖'},{id:'memory',label:'Paměť',icon:'🧠'},{id:'about',label:'O aplikaci',icon:'ℹ️'}]
  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:49,backdropFilter:'blur(4px)'}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:50,width:'min(520px,96vw)',maxHeight:'88vh',display:'flex',flexDirection:'column',background:t.modal,border:`1px solid ${t.border}`,borderRadius:18,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
        <div style={{padding:'18px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <h2 style={{fontSize:16,fontWeight:600,color:t.txt}}>⚙️ Nastavení</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:t.muted,cursor:'pointer',fontSize:20,display:'flex',padding:4}}>{Ic.x}</button>
        </div>
        <div style={{display:'flex',gap:4,padding:'12px 20px 0',flexShrink:0,flexWrap:'wrap'}}>
          {tabs.map(tb=>(
            <button key={tb.id} onClick={()=>setTab(tb.id)} style={{padding:'6px 12px',borderRadius:8,background:tab===tb.id?t.accent:t.btn,color:tab===tb.id?'#fff':t.muted,fontSize:12,fontWeight:tab===tb.id?600:400,border:'none',cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>
              {tb.icon} {tb.label}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'16px 20px 20px'}}>
          {tab==='appearance'&&(
            <>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>Barevné téma</div>
              <div style={{display:'flex',gap:8,marginBottom:16}}>
                {themeOpts.map(th=>(
                  <button key={th.id} onClick={()=>setThemeName(th.id)} style={{flex:1,padding:'12px 8px',borderRadius:10,border:`2px solid ${themeName===th.id?t.accent:t.border}`,background:themeName===th.id?t.accent+'22':t.btn,color:themeName===th.id?t.accent:t.muted,fontSize:12,fontWeight:themeName===th.id?600:400,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',textAlign:'center'}}>
                    <div style={{fontSize:22,marginBottom:5}}>{th.icon}</div>{th.label}
                    {themeName===th.id&&<div style={{marginTop:4}}>{Ic.check}</div>}
                  </button>
                ))}
              </div>
            </>
          )}
          {tab==='behavior'&&(
            <>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>Osobnost asistenta</div>
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:18}}>
                {personas.map(p=>(
                  <button key={p.label} onClick={()=>setTmpPmt(p.val)} style={{padding:'10px 13px',borderRadius:9,border:`1.5px solid ${tmpPmt===p.val?t.accent:t.border}`,background:tmpPmt===p.val?t.accent+'18':t.btn,color:tmpPmt===p.val?t.accent:t.txt,fontSize:13,textAlign:'left',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'space-between',transition:'all .15s'}}>
                    {p.label}{tmpPmt===p.val&&<span style={{color:t.accent}}>{Ic.check}</span>}
                  </button>
                ))}
              </div>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Vlastní prompt</div>
              <textarea value={tmpPmt} onChange={e=>setTmpPmt(e.target.value)} rows={4}
                style={{width:'100%',padding:'10px 12px',background:t.inBg,color:t.txt,border:`1.5px solid ${t.inBrd}`,borderRadius:9,fontSize:13,lineHeight:1.6,outline:'none',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box',marginBottom:12}}/>
              <div style={{padding:'12px 14px',borderRadius:10,background:t.tag,border:`1px solid ${t.border}`}}>
                <div style={{fontSize:12,fontWeight:600,color:t.txt,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>{Ic.brain} Epizodická paměť</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:12,color:t.muted}}>AI si pamatuje kontext z minulých chatů</span>
                  <button onClick={()=>setMemory(m=>!m)} style={{width:42,height:24,borderRadius:12,background:memory?t.accent:t.btn,border:`1px solid ${memory?t.accent:t.border}`,cursor:'pointer',position:'relative',transition:'all .2s',flexShrink:0}}>
                    <span style={{position:'absolute',top:3,left:memory?20:3,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left .2s',display:'block'}}/>
                  </button>
                </div>
              </div>
            </>
          )}
          {tab==='memory'&&(
            <>
              <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>Uložená paměť {memList.length>0&&`(${memList.length})`}</div>
              {!isLoggedIn&&<p style={{fontSize:13,color:t.muted}}>Pro správu paměti se přihlaste.</p>}
              {isLoggedIn&&memList.length===0&&<p style={{fontSize:13,color:t.muted}}>Paměť je prázdná.</p>}
              {memList.map(m=>(
                <div key={m.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'9px 12px',borderRadius:9,background:t.tag,border:`1px solid ${t.border}`,marginBottom:7}}>
                  <span style={{fontSize:10,color:t.muted,background:t.btn,padding:'2px 6px',borderRadius:4,flexShrink:0,marginTop:1}}>{m.category}</span>
                  <span style={{fontSize:13,color:t.txt,flex:1,lineHeight:1.4}}>{m.content}</span>
                  <button onClick={()=>delMem(m.id)} style={{color:t.muted,display:'flex',padding:3,flexShrink:0}}>{Ic.trash}</button>
                </div>
              ))}
            </>
          )}
          {tab==='about'&&(
            <div style={{fontSize:13,color:t.muted,lineHeight:1.7}}>
              <div style={{width:52,height:52,borderRadius:14,background:t.accent+'22',border:`1.5px solid ${t.accent}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,margin:'0 auto 16px',color:t.accent}}>✦</div>
              <p style={{textAlign:'center',fontWeight:600,color:t.txt,fontSize:15,marginBottom:4}}>AI Asistent v2.0</p>
              <p style={{textAlign:'center',marginBottom:16}}>Powered by Google Gemini + HuggingFace</p>
              {[['🤖 Chat','Gemini 3.1 Flash'],['💭 Thinking','Gemini 2.5 Flash'],['🔴 Live','Gemini 2.0 Flash Live'],['🎨 Obrázky','HuggingFace FLUX/SD'],['📷 Fotografie','Unsplash API'],['🎙️ Hlas','Web Speech API'],['🧠 Paměť','Supabase'],['🔒 Auth','Supabase Auth']].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',borderRadius:8,background:t.tag,border:`1px solid ${t.border}`,marginBottom:6}}>
                  <span>{k}</span><span style={{color:t.accent,fontSize:12}}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {(tab==='appearance'||tab==='behavior')&&(
          <div style={{padding:'0 20px 20px',display:'flex',gap:8,justifyContent:'flex-end',flexShrink:0}}>
            <button onClick={onClose} style={{padding:'8px 16px',borderRadius:8,background:t.btn,color:t.txt,fontSize:13,fontWeight:500,cursor:'pointer',border:'none',fontFamily:'inherit'}}>Zrušit</button>
            <button onClick={()=>{setSysPmt(tmpPmt);onClose()}} style={{padding:'8px 16px',borderRadius:8,background:t.accent,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',border:'none',fontFamily:'inherit'}}>Uložit</button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Chat({ session }) {
  const [themeName, setThemeName]   = useState(()=>localStorage.getItem('theme')||'dark')
  const [showAuth, setShowAuth]     = useState(false)
  const [showSet, setShowSet]       = useState(false)
  const [showLive, setShowLive]     = useState(false)
  const [sysPmt, setSysPmt]         = useState(()=>localStorage.getItem('syspmt')||SYS_DEFAULT)
  const [imgMode, setImgMode]       = useState('chat')
  const [hfModel, setHfModel]       = useState(HF_MODELS[0].id)
  const [thinking, setThinking]     = useState(false)
  const [memory, setMemory]         = useState(true)
  const [markdownMode, setMarkdownMode] = useState(true)
  const [sideOpen, setSideOpen]     = useState(()=>typeof window!=='undefined'&&window.innerWidth>768)
  const [input, setInput]           = useState('')
  const [atts, setAtts]             = useState([])
  const [loading, setLoading]       = useState(false)
  const [err, setErr]               = useState(null)
  const [convs, setConvs]           = useState([mkLocal()])
  const [activeId, setActiveId]     = useState(null)
  const [msgs, setMsgs]             = useState([])
  const [dbLoading, setDbLoading]   = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ]       = useState('')
  const [searchRes, setSearchRes]   = useState([])
  const [editingId, setEditingId]   = useState(null)
  const [editTitle, setEditTitle]   = useState('')
  const [emotion, setEmotion]       = useState(null)
  // Kvíz state
  const [quizMode, setQuizMode]     = useState(false)
  const [quizTopic, setQuizTopic]   = useState('')
  const [quizCount, setQuizCount]   = useState(5)
  const [quizDiff, setQuizDiff]     = useState('medium')
  const [explainTxt, setExplainTxt] = useState(null)
  const [token, setToken]           = useState(null)
  const [starredMsgs, setStarredMsgs] = useState(new Set())
  const [showStarred, setShowStarred] = useState(false)
  // Animace pro nové zprávy
  const [newMsgIds, setNewMsgIds]   = useState(new Set())

  const endRef    = useRef(null)
  const fileRef   = useRef(null)
  const taRef     = useRef(null)
  const searchRef = useRef(null)

  const t          = T[themeName] || T.dark
  const isLoggedIn = !!session
  const activeConv = convs.find(c=>c.id===activeId)??convs[0]??null

  useEffect(()=>{localStorage.setItem('theme',themeName)},[themeName])
  useEffect(()=>{localStorage.setItem('syspmt',sysPmt)},[sysPmt])

  useEffect(()=>{
    if (isLoggedIn){getFreshToken().then(setToken);loadDbConvs()}
    else{const c=mkLocal();setConvs([c]);setActiveId(c.id);setMsgs([])}
  },[isLoggedIn]) // eslint-disable-line

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[msgs.length,activeConv?.messages?.length,loading])
  useEffect(()=>{if(activeId&&typeof window!=='undefined'&&window.innerWidth<=768)setSideOpen(false)},[activeId])

  // Detekce emocí s debounce
  useEffect(()=>{
    const last=msgs.filter(m=>m.role==='user').at(-1)
    if(!last?.content||last.content.length<20) return
    const timer=setTimeout(()=>{
      callEdge('detect_emotion',{messages:[{role:'user',content:last.content}]},token||ANON)
        .then(d=>{if(d.emotion&&d.emotion!=='neutral')setEmotion(d)}).catch(()=>{})
    },500)
    return ()=>clearTimeout(timer)
  },[msgs.length]) // eslint-disable-line

  // DB
  async function loadDbConvs(){
    setDbLoading(true)
    const{data}=await supabase.from('conversations').select('*').order('updated_at',{ascending:false})
    if(data?.length>0){setConvs(data.map(c=>({...c,local:false})));setActiveId(data[0].id);await loadDbMsgs(data[0].id)}
    else{const c=await createDbConv();if(c){setConvs([{...c,local:false}]);setActiveId(c.id);setMsgs([])}}
    setDbLoading(false)
  }
  async function loadDbMsgs(convId){
    const{data}=await supabase.from('messages').select('*').eq('conversation_id',convId).order('created_at',{ascending:true})
    setMsgs(data??[])
    setStarredMsgs(new Set((data??[]).filter(m=>m.starred).map(m=>m.id)))
  }
  async function createDbConv(title='Nová konverzace'){
    const{data}=await supabase.from('conversations').insert({user_id:session.user.id,title}).select().single()
    return data
  }
  async function saveDbMsg(convId,role,content,type='text',meta=null){
    const{data}=await supabase.from('messages').insert({conversation_id:convId,role,content,type,image_url:meta?JSON.stringify(meta):null}).select().single()
    return data
  }

  // Conversations
  async function newConv(){
    setErr(null);setInput('');setAtts([]);setEmotion(null)
    if(isLoggedIn){const c=await createDbConv();if(c){setConvs(p=>[{...c,local:false},...p]);setActiveId(c.id);setMsgs([])}}
    else{const c=mkLocal();setConvs(p=>[c,...p]);setActiveId(c.id)}
    if(typeof window!=='undefined'&&window.innerWidth<=768)setSideOpen(false)
  }
  async function selectConv(id){setActiveId(id);setErr(null);setEmotion(null);if(isLoggedIn)await loadDbMsgs(id)}
  async function delConv(id,e){
    e.stopPropagation()
    if(isLoggedIn)await supabase.from('conversations').delete().eq('id',id)
    setConvs(prev=>{
      const next=prev.filter(c=>c.id!==id)
      const list=next.length>0?next:[mkLocal()]
      if(id===activeId){setActiveId(list[0].id);if(isLoggedIn&&next.length>0)loadDbMsgs(list[0].id);else setMsgs([])}
      return list
    })
  }
  async function renameConv(id,title){
    if(!title.trim())return
    if(isLoggedIn)await supabase.from('conversations').update({title}).eq('id',id)
    setConvs(p=>p.map(c=>c.id===id?{...c,title}:c));setEditingId(null)
  }
  async function setConvColor(id,color){
    if(isLoggedIn)await supabase.from('conversations').update({color}).eq('id',id)
    setConvs(p=>p.map(c=>c.id===id?{...c,color}:c))
  }
  async function autoTitle(convId,firstMsg){
    try{
      const d=await callEdge('auto_title',{messages:[{role:'user',content:[{type:'text',text:firstMsg}]}]},token||ANON)
      if(d.title){if(isLoggedIn)await supabase.from('conversations').update({title:d.title}).eq('id',convId);setConvs(p=>p.map(c=>c.id===convId?{...c,title:d.title}:c))}
    }catch{}
  }
  const starMsg=async msg=>{
    const newStar=!starredMsgs.has(msg.id)
    setStarredMsgs(p=>{const n=new Set(p);newStar?n.add(msg.id):n.delete(msg.id);return n})
    if(isLoggedIn&&(msg.dbId||msg.id))await supabase.from('messages').update({starred:newStar}).eq('id',msg.dbId||msg.id)
  }
  const exportChat=()=>{
    const lines=displayMsgs.map(m=>`[${m.role==='user'?'Vy':'AI'}] ${fmtTime(m.created_at)}\n${m.content}\n`)
    const blob=new Blob([lines.join('\n---\n\n')],{type:'text/plain;charset=utf-8'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`chat-${activeConv?.title||'export'}.txt`;a.click()
  }
  async function doSearch(q){
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

  // Kvíz odeslání
  const sendQuiz=async()=>{
    if(!quizTopic.trim())return
    setLoading(true);setErr(null)
    const convId=activeConv?.id,isLocal=activeConv?.local
    const tmpA={id:uid(),role:'user',content:`🎓 Kvíz: ${quizTopic} (${quizCount} otázek, ${quizDiff})`,type:'text',created_at:new Date().toISOString(),_tmp:true}
    if(isLocal)setConvs(p=>p.map(c=>c.id!==convId?c:{...c,messages:[...(c.messages??[]),tmpA]}))
    else setMsgs(p=>[...p,tmpA])
    try{
      const d=await callEdge('quiz',{topic:quizTopic,difficulty:quizDiff,questionCount:quizCount,language:'Czech'},token||ANON)
      const questions=d.questions||[]
      const aMsg={id:uid(),role:'assistant',type:'quiz',content:'🎓 Kvíz',_quizData:questions,created_at:new Date().toISOString()}
      if(isLocal)setConvs(p=>p.map(c=>c.id!==convId?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      else{await saveDbMsg(convId,'user',tmpA.content,'text',null);await saveDbMsg(convId,'assistant',JSON.stringify(questions),'text',null);setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmpA,_tmp:false},aMsg])}
      setNewMsgIds(s=>{const n=new Set(s);n.add(aMsg.id);return n})
    }catch(e){setErr('Kvíz: '+e.message)}
    finally{setLoading(false);setQuizMode(false);setQuizTopic('')}
  }

  const saveMemory=async content=>{if(!isLoggedIn||!content)return;try{await callEdge('save_memory',{content:content.slice(0,500),category:'fact'},token)}catch{}}
  const explainMsg=async msg=>{
    setExplainTxt('Načítám…')
    try{const d=await callEdge('explain',{messages:[{role:'assistant',content:msg.content}],language:'Czech'},token||ANON);setExplainTxt(d.explanation||'Nepodařilo se.')}
    catch(e){setExplainTxt('Chyba: '+e.message)}
  }

  const send=useCallback(async()=>{
    if((!input.trim()&&!atts.length)||loading||!activeConv)return
    const convId=activeConv.id,userText=input.trim()||atts.map(a=>a.name).join(', '),isLocal=activeConv.local
    const apiMode=isLoggedIn?detectAutoMode(userText,imgMode):'chat'
    const isFirstMsg=(isLocal?activeConv.messages?.length:msgs.length)===0

    const apiContent=[]
    atts.forEach(a=>{
      if(a.type.startsWith('image/'))apiContent.push({type:'image',source:{type:'base64',media_type:a.type,data:a.data}})
      else apiContent.push({type:'text',text:`[Soubor: ${a.name}]`})
    })
    if(input.trim())apiContent.push({type:'text',text:input.trim()})

    const tmpUser={id:uid(),role:'user',content:userText,type:'text',created_at:new Date().toISOString(),_tmp:true,_atts:atts.map(a=>({id:a.id,name:a.name,type:a.type,preview:a.preview}))}
    setInput('');setAtts([]);setLoading(true);setErr(null);setEmotion(null)
    const prevMsgs=isLocal?(activeConv.messages??[]):msgs

    if(isLocal){
      setConvs(p=>p.map(c=>{if(c.id!==convId)return c;const title=isFirstMsg?userText.slice(0,38)+(userText.length>38?'…':''):c.title;return{...c,title,messages:[...(c.messages??[]),tmpUser]}}))
    }else{
      setMsgs(p=>[...p,tmpUser])
      if(isFirstMsg&&activeConv.title==='Nová konverzace')autoTitle(convId,userText)
    }

    try{
      const history=[...prevMsgs,tmpUser].map(m=>({role:m.role,content:m.id===tmpUser.id&&apiContent.length>0?apiContent:[{type:'text',text:m.content}]}))
      const tk=isLoggedIn?(await getFreshToken()||ANON):ANON
      const payload={messages:history,system:sysPmt,thinking,memory}
      if(apiMode==='generate_image')payload.hfModel=hfModel
      const result=await callEdge(apiMode,payload,tk)

      let aMsg
      const newId=uid()
      if(result.type==='image_search'){
        aMsg={id:newId,role:'assistant',type:'image_search',content:`📷 ${result.images?.length??0} fotografií`,_images:result.images,_query:result.query,image_url:JSON.stringify(result.images),created_at:new Date().toISOString()}
      }else if(result.type==='generated_image'){
        aMsg={id:newId,role:'assistant',type:'generated_image',content:'🎨 Vygenerovaný obrázek',_imageData:result.imageData,_mimeType:result.mimeType,_prompt:result.prompt||userText,_modelId:hfModel,image_url:JSON.stringify({imageData:result.imageData,mimeType:result.mimeType,prompt:result.prompt||userText,modelId:hfModel}),created_at:new Date().toISOString()}
      }else{
        aMsg={id:newId,role:'assistant',type:'text',content:result.text??'(prázdná odpověď)',created_at:new Date().toISOString()}
      }

      // Animace nové zprávy
      setNewMsgIds(s=>{const n=new Set(s);n.add(newId);setTimeout(()=>setNewMsgIds(s2=>{const n2=new Set(s2);n2.delete(newId);return n2}),600);return n})

      if(isLocal){
        setConvs(p=>p.map(c=>c.id!==convId?c:{...c,messages:[...(c.messages??[]),aMsg]}))
      }else{
        const uRow=await saveDbMsg(convId,'user',userText,'text',null)
        if(aMsg.type==='image_search')await saveDbMsg(convId,'assistant',aMsg.content,'image_search',aMsg._images)
        else if(aMsg.type==='generated_image')await saveDbMsg(convId,'assistant',aMsg.content,'image',{imageData:aMsg._imageData,mimeType:aMsg._mimeType,prompt:aMsg._prompt,modelId:hfModel})
        else{const aRow=await saveDbMsg(convId,'assistant',aMsg.content,'text',null);if(aRow)aMsg.dbId=aRow.id}
        await supabase.from('conversations').update({updated_at:new Date().toISOString()}).eq('id',convId)
        setMsgs(p=>[...p.filter(m=>!m._tmp),{...tmpUser,_tmp:false,dbId:uRow?.id},aMsg])
      }
    }catch(e){
      setErr('Chyba: '+e.message)
      if(isLocal)setConvs(p=>p.map(c=>c.id===convId?{...c,messages:prevMsgs}:c))
      else setMsgs(prevMsgs)
      setInput(userText)
    }finally{setLoading(false)}
  },[input,atts,loading,activeConv,msgs,isLoggedIn,imgMode,sysPmt,thinking,memory,token,hfModel]) // eslint-disable-line

  const onKey=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}
  const displayMsgs=showStarred?(activeConv?.local?(activeConv.messages??[]):msgs).filter(m=>starredMsgs.has(m.id)):(activeConv?.local?(activeConv.messages??[]):msgs)
  const canSend=(input.trim()||atts.length>0)&&!loading
  const userInitial=session?(session.user.user_metadata?.full_name||session.user.email||'U')[0].toUpperCase():'?'

  function getImgData(msg){
    if(msg._images||msg._imageData||msg._quizData)return msg
    if(msg.image_url){try{const p=JSON.parse(msg.image_url);return{...msg,_images:Array.isArray(p)?p:undefined,_imageData:p.imageData,_mimeType:p.mimeType,_prompt:p.prompt,_modelId:p.modelId,_query:msg.content,_quizData:undefined}}catch{return msg}}
    return msg
  }

  const modeColor=imgMode==='generate_image'?t.purple:t.accent
  const loadingTxt={chat:null,image_search:'🔍 Hledám fotografie…',generate_image:'🎨 Generuji obrázek (může trvat 30s)…'}
  const placeholders={chat:thinking?'💭 Hluboké přemýšlení (jen Gemini 2.5)…':'Napište zprávu… (Enter = odeslat)',image_search:'🔍 Popište co hledáte…',generate_image:'🎨 Popište obrázek co nejdetailněji…'}

  return (
    <div style={{display:'flex',height:'100dvh',overflow:'hidden',background:t.bg,color:t.txt,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${t.scrl};border-radius:2px}
        textarea,input{font-family:inherit}textarea{resize:none;outline:none;border:none;background:transparent}input{outline:none;border:none;background:transparent}
        button{cursor:pointer;border:none;background:none;font-family:inherit}
        @keyframes slideIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pu{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        @keyframes livePulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}
        @keyframes thinkingPulse{0%,100%{opacity:.5}50%{opacity:1}}
        .msg-new{animation:slideIn .35s cubic-bezier(.34,1.56,.64,1) both}
        .msg-old{animation:fadeIn .2s ease both}
        .dot span{display:inline-block;width:6px;height:6px;border-radius:50%;background:${t.accent};margin:0 2px;animation:pu 1.2s infinite ease-in-out}
        .dot span:nth-child(2){animation-delay:.18s}.dot span:nth-child(3){animation-delay:.36s}
        .cr:hover{background:${t.active}!important}.cr:hover .cr-act{opacity:1!important}
        .ib:hover{opacity:.65}
        @media(max-width:768px){.sidebar{position:fixed!important;top:0;left:0;bottom:0;z-index:30;box-shadow:4px 0 24px rgba(0,0,0,.5)}.sov{display:block!important}}
      `}</style>

      {sideOpen&&<div className="sov" onClick={()=>setSideOpen(false)} style={{display:'none',position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:29}}/>}

      {/* SIDEBAR */}
      {sideOpen&&(
        <aside className="sidebar" style={{width:272,background:t.side,borderRight:`1px solid ${t.border}`,display:'flex',flexDirection:'column',flexShrink:0}}>
          <div style={{padding:'13px 12px',borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:27,height:27,borderRadius:8,background:t.accent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',flexShrink:0}}>A</div>
              <span style={{fontWeight:600,fontSize:13,color:t.txt}}>AI Asistent</span>
            </div>
            <div style={{display:'flex',gap:4}}>
              <button className="ib" onClick={()=>{setSearchOpen(o=>!o);setTimeout(()=>searchRef.current?.focus(),100)}} style={{color:t.muted,display:'flex',padding:6,borderRadius:6,background:searchOpen?t.active:'transparent'}}>{Ic.search}</button>
              <button onClick={newConv} style={{background:t.accent,color:'#fff',borderRadius:7,padding:'5px 9px',display:'flex',alignItems:'center'}}>{Ic.plus}</button>
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
                  onMouseOver={e=>e.currentTarget.style.background=t.active} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  🔍 {c.title}
                </div>
              ))}
            </div>
          )}

          <div style={{flex:1,overflowY:'auto',padding:'5px'}}>
            {dbLoading?<div style={{padding:16,textAlign:'center',fontSize:12,color:t.muted}}>Načítám…</div>
              :convs.map(c=>(
                <div key={c.id} className="cr" onClick={()=>selectConv(c.id)}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'7px 9px',borderRadius:8,cursor:'pointer',marginBottom:2,transition:'background .1s',background:c.id===activeId?t.active:'transparent',borderLeft:`3px solid ${c.id===activeId?(c.color||t.accent):(c.color||'transparent')}`}}>
                  {editingId===c.id?(
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
                    <div style={{display:'flex',gap:2}}>
                      {CONV_COLORS.slice(1,5).map(col=>(
                        <button key={col} onClick={e=>{e.stopPropagation();setConvColor(c.id,col)}}
                          style={{width:10,height:10,borderRadius:'50%',background:col,border:`1.5px solid ${c.color===col?'#fff':t.border}`,cursor:'pointer'}}/>
                      ))}
                    </div>
                    <button className="ib" onClick={e=>{e.stopPropagation();setEditingId(c.id);setEditTitle(c.title)}} style={{color:t.muted,display:'flex',padding:4,borderRadius:5}}>{Ic.edit}</button>
                    <button className="ib" onClick={e=>delConv(c.id,e)} style={{color:t.muted,display:'flex',padding:4,borderRadius:5}}>{Ic.trash}</button>
                  </div>
                </div>
              ))
            }
          </div>

          <div style={{padding:'10px 11px',borderTop:`1px solid ${t.border}`}}>
            {isLoggedIn?(
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:30,height:30,borderRadius:8,background:t.accent+'33',border:`1px solid ${t.accent}55`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:t.accent,flexShrink:0}}>{userInitial}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,color:t.txt,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{session.user.user_metadata?.full_name||session.user.email}</div>
                  <div style={{fontSize:11,color:t.muted}}>Přihlášen</div>
                </div>
                <button className="ib" onClick={()=>supabase.auth.signOut()} style={{color:t.muted,display:'flex',padding:4}}>{Ic.out}</button>
              </div>
            ):(
              <button onClick={()=>setShowAuth(true)} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'9px 12px',borderRadius:9,background:t.btn,border:`1px solid ${t.border}`,color:t.muted,fontSize:13,fontWeight:500}}>
                <span style={{color:t.accent}}>{Ic.user}</span><span>Přihlásit se</span>
                <span style={{marginLeft:'auto',fontSize:10,background:t.tag,padding:'2px 7px',borderRadius:4}}>Uloží historii</span>
              </button>
            )}
          </div>
        </aside>
      )}

      {/* MAIN */}
      <main style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>
        <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 14px',height:52,background:t.hdr,borderBottom:`1px solid ${t.border}`,backdropFilter:'blur(12px)',flexShrink:0,gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
            <button className="ib" onClick={()=>setSideOpen(o=>!o)} style={{color:t.muted,display:'flex',padding:5,flexShrink:0}}>{Ic.menu}</button>
            <span style={{fontWeight:600,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activeConv?.title||'AI Asistent'}</span>
          </div>
          <div style={{display:'flex',gap:4,alignItems:'center',flexShrink:0}}>
            <button className="ib" onClick={()=>setShowStarred(s=>!s)} style={{display:'flex',padding:'5px 9px',borderRadius:7,background:showStarred?'#f59e0b22':t.btn,color:showStarred?'#f59e0b':t.muted,border:`1px solid ${showStarred?'#f59e0b':t.border}`}} title="Oblíbené">{showStarred?Ic.starFill:Ic.star}</button>
            <button className="ib" onClick={exportChat} style={{display:'flex',padding:'5px 9px',borderRadius:7,background:t.btn,color:t.muted}} title="Export">{Ic.export}</button>
            <button className="ib" onClick={()=>setMarkdownMode(m=>!m)} style={{display:'flex',alignItems:'center',gap:2,padding:'5px 9px',borderRadius:7,background:markdownMode?t.accent+'22':t.btn,color:markdownMode?t.accent:t.muted,border:`1px solid ${markdownMode?t.accent:t.border}`,fontSize:11}}>MD</button>
            {isLoggedIn&&(
              <button className="ib" onClick={()=>setThinking(x=>!x)} style={{display:'flex',alignItems:'center',gap:3,padding:'5px 9px',borderRadius:7,background:thinking?t.purple+'33':t.btn,color:thinking?t.purple:t.muted,border:`1px solid ${thinking?t.purple:t.border}`,fontSize:11}} title="Hluboké přemýšlení (pouze Gemini 2.5)">
                {Ic.brain}{thinking&&<span style={{animation:'thinkingPulse 1.5s infinite'}}> ON</span>}
              </button>
            )}
            <button className="ib" onClick={()=>setShowSet(true)} style={{display:'flex',padding:'5px 9px',borderRadius:7,background:t.btn,color:t.muted}}>{Ic.gear}</button>
            <button className="ib" onClick={()=>setThemeName(n=>n==='dark'?'light':n==='light'?'midnight':'dark')} style={{display:'flex',padding:'5px 9px',borderRadius:7,background:t.btn,color:t.muted}}>
              {themeName==='dark'?Ic.moon:themeName==='light'?Ic.sun:'🌌'}
            </button>
            {!isLoggedIn&&<button onClick={()=>setShowAuth(true)} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:7,background:t.accent,color:'#fff',fontSize:12,fontWeight:600}}>{Ic.user}<span>Přihlásit</span></button>}
          </div>
        </header>

        {emotion&&emotion.emotion!=='neutral'&&(
          <div style={{padding:'7px 14px',background:t.tag,borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12,animation:'fadeIn .3s ease'}}>
            <span style={{color:t.muted}}>{EMOTION_EMOJI[emotion.emotion]} <strong style={{color:t.txt}}>{emotion.emotion}</strong> · {emotion.suggestion}</span>
            <button onClick={()=>setEmotion(null)} style={{color:t.muted,display:'flex',padding:3}}>{Ic.x}</button>
          </div>
        )}
        {explainTxt&&(
          <div style={{padding:'10px 14px',background:t.purple+'18',borderBottom:`1px solid ${t.purple}44`,display:'flex',alignItems:'flex-start',gap:8,fontSize:13,animation:'fadeIn .3s ease'}}>
            <span style={{color:t.purple,flexShrink:0,marginTop:1}}>{Ic.explain}</span>
            <span style={{color:t.txt,flex:1,lineHeight:1.5}}>{explainTxt}</span>
            <button onClick={()=>setExplainTxt(null)} style={{color:t.muted,display:'flex',padding:3,flexShrink:0}}>{Ic.x}</button>
          </div>
        )}
        {showStarred&&(
          <div style={{padding:'7px 14px',background:'#f59e0b22',borderBottom:`1px solid #f59e0b44`,display:'flex',alignItems:'center',gap:8,fontSize:12}}>
            <span style={{color:'#f59e0b'}}>⭐</span>
            <span style={{color:t.txt}}>Oblíbené zprávy ({displayMsgs.length})</span>
            <button onClick={()=>setShowStarred(false)} style={{color:t.muted,display:'flex',padding:3,marginLeft:'auto'}}>{Ic.x}</button>
          </div>
        )}

        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:'16px 14px',display:'flex',flexDirection:'column',gap:12}}>
          {displayMsgs.length===0&&!loading&&(
            <div style={{textAlign:'center',marginTop:'7vh',padding:'0 16px',animation:'fadeIn .5s ease'}}>
              <div style={{width:52,height:52,borderRadius:14,background:t.accent+'22',border:`1.5px solid ${t.accent}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,margin:'0 auto 14px',color:t.accent}}>✦</div>
              <div style={{fontSize:20,fontWeight:600,marginBottom:6}}>{showStarred?'Žádné oblíbené zprávy':'Jak Vám mohu pomoci?'}</div>
              {!showStarred&&(
                <>
                  <div style={{fontSize:13,color:t.muted,marginBottom:18}}>{isLoggedIn?'Chat · HuggingFace AI obrázky · Fotografie · Kvízy · Live · Hlasový vstup':'Začněte psát — přihlášení není potřeba'}</div>
                  <div style={{display:'flex',gap:7,justifyContent:'center',flexWrap:'wrap',maxWidth:500,margin:'0 auto'}}>
                    {(isLoggedIn?['Jak funguje kvantové počítání?','Najdi mi fotky Prahy','Vygeneruj obrázek: sunset over mountains','Kvíz o historii ČR 5 otázek']:['Jak funguje AI?','Napiš mi báseň','Co je strojové učení?','Pomoz mi s kódem']).map(hint=>(
                      <button key={hint} onClick={()=>setInput(hint)} style={{padding:'7px 13px',borderRadius:20,background:t.btn,border:`1px solid ${t.border}`,color:t.muted,fontSize:12,transition:'all .15s'}}
                        onMouseOver={e=>{e.currentTarget.style.borderColor=t.accent;e.currentTarget.style.color=t.txt}}
                        onMouseOut={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.color=t.muted}}>
                        {hint}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {displayMsgs.map(msg=>{
            const m=getImgData(msg)
            const isWide=['image_search','generated_image','quiz'].includes(msg.type)
            const isStarred=starredMsgs.has(msg.id)
            const isNew=newMsgIds.has(msg.id)
            return (
              <div key={msg.id} className={isNew?'msg-new':'msg-old'} style={{display:'flex',gap:8,justifyContent:msg.role==='user'?'flex-end':'flex-start',alignItems:'flex-start'}}>
                {msg.role==='assistant'&&<div style={{width:28,height:28,borderRadius:8,background:t.accent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff',flexShrink:0,marginTop:2}}>A</div>}
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
                      <ImgSearchResults images={m._images} query={m._query||msg.content} t={t}/>
                      <div style={{fontSize:10,color:t.muted,marginTop:8,textAlign:'right'}}>{fmtTime(msg.created_at)}</div>
                    </div>
                  ):msg.type==='generated_image'?(
                    <div style={{padding:'12px 14px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
                      <GenImage imageData={m._imageData} mimeType={m._mimeType} prompt={m._prompt} modelId={m._modelId||hfModel} t={t}/>
                      <div style={{fontSize:10,color:t.muted,marginTop:8,textAlign:'right'}}>{fmtTime(msg.created_at)}</div>
                    </div>
                  ):msg.type==='quiz'?(
                    <QuizCard questions={m._quizData||(()=>{try{const p=JSON.parse(msg.content);return Array.isArray(p)?p:[p]}catch{return null}})()} t={t}/>
                  ):(
                    <div>
                      <div style={{padding:'10px 14px',background:msg.role==='user'?t.accent:t.aiB,color:msg.role==='user'?'#fff':t.txt,borderRadius:msg.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',border:msg.role==='assistant'?`1px solid ${isStarred?'#f59e0b':t.border}`:'none',opacity:msg._tmp?0.7:1}}>
                        {markdownMode&&msg.role==='assistant'
                          ?<div style={{fontSize:14,lineHeight:1.7,wordBreak:'break-word'}} dangerouslySetInnerHTML={{__html:renderContent(msg.content,t.isDark)}}/>
                          :<div style={{fontSize:14,lineHeight:1.65,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{msg.content}</div>
                        }
                        <div style={{fontSize:10,color:msg.role==='user'?'rgba(255,255,255,.5)':t.muted,marginTop:4,textAlign:'right',display:'flex',alignItems:'center',justifyContent:'flex-end',gap:6}}>
                          {isStarred&&<span style={{color:'#f59e0b'}}>⭐</span>}
                          {fmtTime(msg.created_at)}
                        </div>
                      </div>
                      {msg.role==='assistant'&&!msg._tmp&&(
                        <MsgActions msg={msg} t={t} isLoggedIn={isLoggedIn} token={token} onExplain={explainMsg} onSaveMemory={saveMemory} onStar={starMsg} starred={isStarred}/>
                      )}
                    </div>
                  )}
                </div>
                {msg.role==='user'&&<div style={{width:28,height:28,borderRadius:8,background:isLoggedIn?t.accent+'88':t.ua,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:600,color:'#fff',flexShrink:0,marginTop:2}}>{isLoggedIn?userInitial:'?'}</div>}
              </div>
            )
          })}

          {loading&&(
            <div style={{display:'flex',gap:8,alignItems:'flex-start',animation:'fadeIn .2s ease'}}>
              <div style={{width:28,height:28,borderRadius:8,background:t.accent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff',flexShrink:0}}>A</div>
              <div style={{padding:'12px 16px',background:t.aiB,borderRadius:'16px 16px 16px 4px',border:`1px solid ${t.border}`}}>
                {loadingTxt[imgMode]?<span style={{fontSize:13,color:t.muted}}>{loadingTxt[imgMode]}</span>
                  :thinking?<span style={{fontSize:13,color:t.purple,animation:'thinkingPulse 1.5s infinite'}}>💭 Gemini přemýšlí…</span>
                  :<div className="dot"><span/><span/><span/></div>}
              </div>
            </div>
          )}

          {err&&<div style={{padding:'9px 13px',background:'#ff444418',border:'1px solid #ff444440',borderRadius:9,fontSize:13,color:'#ff6b6b',display:'flex',gap:8,wordBreak:'break-word',animation:'fadeIn .2s ease'}}><span style={{flexShrink:0}}>⚠️</span><span>{err}</span></div>}
          <div ref={endRef}/>
        </div>

        {/* Input area */}
        <div style={{padding:'8px 12px 12px',background:t.iaBg,borderTop:`1px solid ${t.border}`,flexShrink:0}}>
          {isLoggedIn&&(
            <div style={{display:'flex',gap:5,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
              <button onClick={()=>setShowLive(true)} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:6,fontSize:12,fontWeight:600,background:'#ef4444',color:'#fff',border:'none',animation:'livePulse 2s infinite',transition:'all .15s'}}>
                {Ic.live} 🔴 Live
              </button>
              <button onClick={()=>setImgMode(m=>m==='generate_image'?'chat':'generate_image')} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:6,fontSize:12,fontWeight:imgMode==='generate_image'?600:400,background:imgMode==='generate_image'?t.purple:t.btn,color:imgMode==='generate_image'?'#fff':t.muted,border:`1px solid ${imgMode==='generate_image'?t.purple:t.border}`,transition:'all .15s'}}>
                {Ic.magic}{imgMode==='generate_image'?'🎨 HF Imagen':'AI Obrázek'}
              </button>
              <button onClick={()=>setImgMode(m=>m==='image_search'?'chat':'image_search')} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:6,fontSize:12,fontWeight:imgMode==='image_search'?600:400,background:imgMode==='image_search'?t.accent:t.btn,color:imgMode==='image_search'?'#fff':t.muted,border:`1px solid ${imgMode==='image_search'?t.accent:t.border}`,transition:'all .15s'}}>
                {Ic.imgSrch}{imgMode==='image_search'?'🔍 Fotky':'Fotky'}
              </button>
              <button onClick={()=>setQuizMode(m=>!m)} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:6,fontSize:12,fontWeight:quizMode?600:400,background:quizMode?'#f59e0b':t.btn,color:quizMode?'#fff':t.muted,border:`1px solid ${quizMode?'#f59e0b':t.border}`,transition:'all .15s'}}>
                {Ic.quiz}{quizMode?'🎓 Kvíz':'Kvíz'}
              </button>
            </div>
          )}

          {/* HF model selector */}
          {imgMode==='generate_image'&&isLoggedIn&&(
            <div style={{marginBottom:8}}>
              <select value={hfModel} onChange={e=>setHfModel(e.target.value)} style={{width:'100%',padding:'7px 10px',background:t.inBg,color:t.txt,border:`1px solid ${t.purple}`,borderRadius:8,fontSize:12,outline:'none',fontFamily:'inherit',cursor:'pointer'}}>
                {HF_MODELS.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <div style={{fontSize:10,color:t.muted,marginTop:4}}>⚠️ První generování může trvat až 60s (model se načítá) · Zdarma bez API klíče</div>
            </div>
          )}

          {/* Kvíz nastavení */}
          {quizMode&&(
            <div style={{marginBottom:8,padding:'12px',background:t.tag,borderRadius:10,border:`1px solid #f59e0b44`}}>
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                <input value={quizTopic} onChange={e=>setQuizTopic(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendQuiz()} placeholder="Téma kvízu (např. Fyzika, AI, Praha…)" style={{flex:1,padding:'8px 12px',background:t.inBg,color:t.txt,border:`1.5px solid #f59e0b`,borderRadius:8,fontSize:13}}/>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12,color:t.muted}}>Otázek:</span>
                  <div style={{display:'flex',gap:4}}>
                    {[1,3,5,10,15,20].map(n=>(
                      <button key={n} onClick={()=>setQuizCount(n)} style={{padding:'4px 8px',borderRadius:6,background:quizCount===n?'#f59e0b':t.btn,color:quizCount===n?'#fff':t.muted,fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit',transition:'all .15s',fontWeight:quizCount===n?600:400}}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12,color:t.muted}}>Obtížnost:</span>
                  <div style={{display:'flex',gap:4}}>
                    {[['easy','Lehká'],['medium','Střední'],['hard','Těžká']].map(([v,l])=>(
                      <button key={v} onClick={()=>setQuizDiff(v)} style={{padding:'4px 8px',borderRadius:6,background:quizDiff===v?'#f59e0b':t.btn,color:quizDiff===v?'#fff':t.muted,fontSize:12,border:'none',cursor:'pointer',fontFamily:'inherit',transition:'all .15s',fontWeight:quizDiff===v?600:400}}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={sendQuiz} disabled={!quizTopic.trim()||loading} style={{padding:'6px 16px',borderRadius:8,background:'#f59e0b',color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit',opacity:!quizTopic.trim()?0.5:1,marginLeft:'auto'}}>
                  Start 🎓
                </button>
              </div>
            </div>
          )}

          {atts.length>0&&(
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
              {atts.map(a=>(
                <div key={a.id} style={{position:'relative'}}>
                  {a.preview?<img src={a.preview} alt={a.name} style={{height:46,width:46,objectFit:'cover',borderRadius:7,border:`1px solid ${t.border}`,display:'block'}}/>
                    :<div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 9px',background:t.pill,borderRadius:7,fontSize:12,color:t.txt}}>{Ic.file}{a.name.length>16?a.name.slice(0,14)+'…':a.name}</div>}
                  <button onClick={()=>setAtts(p=>p.filter(x=>x.id!==a.id))} style={{position:'absolute',top:-5,right:-5,width:16,height:16,borderRadius:'50%',background:t.danger,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}>{Ic.x}</button>
                </div>
              ))}
            </div>
          )}

          <div style={{marginBottom:8}}>
            <VoiceBtn t={t} onTranscript={txt=>{setInput(txt);setTimeout(()=>taRef.current?.focus(),100)}}/>
          </div>

          <div style={{display:'flex',alignItems:'flex-end',gap:6,padding:'9px 11px',background:t.inBg,border:`1.5px solid ${imgMode!=='chat'?modeColor:thinking?t.purple:t.inBrd}`,borderRadius:14,transition:'border-color .2s'}}>
            <textarea ref={taRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
              placeholder={placeholders[imgMode]}
              rows={1} style={{flex:1,fontSize:14,lineHeight:1.5,color:t.txt,caretColor:t.accent,maxHeight:120,overflowY:'auto',paddingTop:2}}
              onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'}}/>
            <div style={{display:'flex',gap:4,alignItems:'center',flexShrink:0}}>
              <button className="ib" onClick={()=>fileRef.current.click()} style={{color:t.muted,display:'flex',padding:5}}>{Ic.clip}</button>
              <button onClick={send} disabled={!canSend} style={{width:34,height:34,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',background:canSend?(imgMode==='generate_image'||thinking?t.purple:t.accent):t.btn,color:canSend?'#fff':t.muted,transition:'all .15s',flexShrink:0}}>
                {Ic.send}
              </button>
            </div>
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.docx" style={{display:'none'}} onChange={onFile}/>
          <div style={{fontSize:10,color:t.muted,textAlign:'center',marginTop:5}}>
            Gemini AI · HuggingFace · Unsplash{isLoggedIn?' · Paměť + Historie':' · Přihlaste se pro plné funkce'}
          </div>
        </div>
      </main>

      {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} dark={t.isDark}/>}
      {showSet&&<SettingsModal t={t} themeName={themeName} setThemeName={setThemeName} sysPmt={sysPmt} setSysPmt={setSysPmt} onClose={()=>setShowSet(false)} isLoggedIn={isLoggedIn} userId={session?.user?.id} memory={memory} setMemory={setMemory}/>}
      {showLive&&<LiveModal t={t} onClose={()=>setShowLive(false)} sysPmt={sysPmt} token={token}/>}
    </div>
  )
}
