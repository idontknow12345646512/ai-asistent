import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Chat from './Chat'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading, null = not logged in

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Zobraz chat okamžitě — session předáme jako prop (může být null)
  if (session === undefined) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f1117', color: '#6c8fff', fontFamily: 'DM Sans, sans-serif', fontSize: 14 }}>
      Načítám…
    </div>
  )

  return <Chat session={session} />
}
