import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import Chat from './Chat'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0f1117', color:'#6c8fff', fontFamily:'DM Sans, sans-serif', fontSize:15 }}>
      Načítám…
    </div>
  )

  return session ? <Chat session={session} /> : <Auth />
}
