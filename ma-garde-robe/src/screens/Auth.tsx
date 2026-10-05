import { useState, useCallback } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import LanguageSwitcher from '../components/LanguageSwitcher'

type Mode = 'login' | 'signup' | 'forgot'

function translateError(error: string, t: (k: string) => string): string {
  if (error.includes('Invalid login credentials')) return t('authErrorInvalidCredentials')
  if (error.includes('already registered') || error.includes('already in use')) return t('authErrorEmailInUse')
  if (error.includes('Password should be') || error.includes('at least 6')) return t('authErrorWeakPassword')
  if (error.includes('Failed to fetch') || error.includes('network')) return t('authErrorNetwork')
  return t('authErrorGeneric')
}

export default function AuthScreen() {
  const { t, locale } = useI18n()
  const { refresh } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password.trim()) return

    setLoading(true)
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw new Error(err.message)
        await refresh()
      } else if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email: email.trim(), password })
        if (err) throw new Error(err.message)
        // Auto sign-in after signup (email confirmation is OFF)
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (signInErr) throw new Error(signInErr.message)
        await refresh()
      } else if (mode === 'forgot') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim())
        if (err) throw new Error(err.message)
        setResetSent(true)
      }
    } catch (err) {
      setError(translateError((err as Error).message, t))
    } finally {
      setLoading(false)
    }
  }, [mode, email, password, t, refresh])

  const isRTL = locale === 'ar'

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-sm">
        {/* Language switcher — top-right, available before login */}
        <div className="flex justify-end mb-4" style={{ position: 'relative', zIndex: 60 }}>
          <LanguageSwitcher />
        </div>

        {/* Logo / branding */}
        <div className="text-center mb-10 animate-fade-up">
          <div className="w-14 h-14 mx-auto mb-5 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--shadow-md)' }}>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <path d="M8 3L4 6l2 4 2-1.5V21h12V8.5L18 10l2-4-4-3-2 2-2-2-2 2-2-2z" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="tagline mb-2">{t('appTagline')}</p>
          <h1 className="text-[32px] title-display" style={{ color: 'var(--ink)' }}>
            {mode === 'login' ? t('authWelcome') : mode === 'signup' ? t('authSignup') : t('authForgotPasswordTitle')}
          </h1>
          <p className="text-[13px] font-sans mt-2" style={{ color: 'var(--ink-3)' }}>
            {mode === 'forgot' ? t('authForgotPasswordHint') : t('authSubtitle')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass p-5 space-y-4 animate-fade-up delay-1">
          <div>
            <label className="block text-xs font-sans font-semibold mb-2" style={{ color: 'var(--tc-45)' }}>
              {t('authEmail')}
            </label>
            <input
              type="email"
              required
              dir="ltr"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('authEmailPlaceholder')}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="block text-xs font-sans font-semibold mb-2" style={{ color: 'var(--tc-45)' }}>
                {t('authPassword')}
              </label>
              <input
                type="password"
                required
                minLength={6}
                dir="ltr"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('authPasswordPlaceholder')}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2.5 rounded-xl text-xs font-sans font-medium animate-fade-in"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          {/* Reset sent confirmation */}
          {mode === 'forgot' && resetSent && (
            <div className="px-3 py-2.5 rounded-xl text-xs font-sans font-medium animate-fade-in"
              style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>
              {t('authResetLinkSent')}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-gold py-3.5 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'var(--on-accent)' }} />
            ) : (
              <>
                {mode === 'login' ? t('authLogin') : mode === 'signup' ? t('authSignup') : t('authForgotPasswordTitle')}
              </>
            )}
          </button>

          {/* Forgot password link (login mode only) */}
          {mode === 'login' && (
            <button type="button" onClick={() => { setMode('forgot'); setError(null); setResetSent(false) }}
              className="w-full text-center text-xs font-sans font-medium" style={{ color: 'var(--tc-45)' }}>
              {t('authForgotPassword')}
            </button>
          )}
        </form>

        {/* Mode switch */}
        <div className="text-center mt-6 animate-fade-up delay-2">
          {mode === 'login' && (
            <p className="text-xs font-sans" style={{ color: 'var(--tc-45)' }}>
              {t('authNoAccount')}{' '}
              <button onClick={() => { setMode('signup'); setError(null) }} className="font-bold" style={{ color: 'var(--tc)' }}>
                {t('authSignUpCta')}
              </button>
            </p>
          )}
          {mode === 'signup' && (
            <p className="text-xs font-sans" style={{ color: 'var(--tc-45)' }}>
              {t('authHaveAccount')}{' '}
              <button onClick={() => { setMode('login'); setError(null) }} className="font-bold" style={{ color: 'var(--tc)' }}>
                {t('authSignInCta')}
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <p className="text-xs font-sans" style={{ color: 'var(--tc-45)' }}>
              <button onClick={() => { setMode('login'); setError(null); setResetSent(false) }} className="font-bold" style={{ color: 'var(--tc)' }}>
                ← {t('authSignInCta')}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
