import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Chat from './Chat'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0f1117', color:'#6c8fff', fontFamily:'DM Sans,sans-serif', fontSize:14, gap:10 }}>
      <div style={{ width:20, height:20, borderRadius:'50%', border:'2px solid #6c8fff', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }}/>
      Načítám…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return <Chat session={session} />
}
