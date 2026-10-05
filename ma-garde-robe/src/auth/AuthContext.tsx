import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, user: data.session?.user ?? null, loading: false })
    }).catch(() => {
      setState({ session: null, user: null, loading: false })
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setState({ session, user: session?.user ?? null, loading: false })
      })()
    })

    return () => { listener.subscription.unsubscribe() }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setState({ session: null, user: null, loading: false })
  }, [])

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    setState({ session: data.session, user: data.session?.user ?? null, loading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
