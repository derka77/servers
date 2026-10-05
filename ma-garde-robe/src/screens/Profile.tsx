import { useState, useEffect, useRef, useMemo } from 'react'
import { useOverlayClick } from '../lib/useOverlayClick'
import { useI18n } from '../i18n/I18nContext'
import { useLabels } from '../lib/labels'
import { updateProfile, addSizeHistory, fetchSizeHistory, uploadAvatar, updateAvatar, updateAvatarOptimized, fetchFashnCredits, runFaceToModel, pollTryOnStatus, countDemoGarments, countPersonalGarments, createDemoGarments, deleteAllDemoGarments, fetchAllWearLogs, type ProfileUpdate } from '../lib/api'
import { useTheme } from '../theme/ThemeContext'
import type { ThemeName } from '../theme/ThemeContext'
import type { Garment, Outfit, Profile, SizeHistoryEntry, WardrobeMode, WearLogEntry } from '../types'
import type { Locale } from '../i18n/dictionaries'
import { locales } from '../i18n/dictionaries'
import { buildDemoGarments, getStaticDemoCount, getDemoPieceBreakdown } from '../lib/demoWardrobe'

interface Props {
  profile: Profile | null
  garments: Garment[]
  outfits: Outfit[]
  onProfileChanged: () => void
  wardrobeMode: WardrobeMode
  onWardrobeModeChanged: (mode: WardrobeMode) => void
  onGarmentsChanged: () => void
  onNavigate: (t: 'home' | 'wardrobe' | 'stylist' | 'events' | 'profile') => void
  onSignOut: () => void
  userEmail?: string
}

const themeOptions: { id: ThemeName; color: string; label: { fr: string; en: string; ar: string } }[] = [
  { id: 'noir', color: '#17140f', label: { fr: 'Noir', en: 'Black', ar: 'أسود' } },
  { id: 'rose', color: '#b5405e', label: { fr: 'Rose Pearl', en: 'Rose Pearl', ar: 'وردي' } },
  { id: 'nude', color: '#8a6a2e', label: { fr: 'Nude Cream', en: 'Nude Cream', ar: 'نيود' } },
]

interface MeasurementField {
  key: keyof Omit<ProfileUpdate, 'current_size' | 'current_shoe_size'>
  labelKey: string
  placeholder: string
}

const measurementFields: MeasurementField[] = [
  { key: 'weight_kg', labelKey: 'profileWeight', placeholder: '60' },
  { key: 'bust_cm', labelKey: 'profileBust', placeholder: '90' },
  { key: 'waist_cm', labelKey: 'profileWaist', placeholder: '70' },
  { key: 'hip_cm', labelKey: 'profileHip', placeholder: '95' },
  { key: 'shoulder_cm', labelKey: 'profileShoulder', placeholder: '38' },
  { key: 'inseam_cm', labelKey: 'profileInseam', placeholder: '75' },
]

const clothingSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export default function ProfileScreen({ profile, garments, outfits, onProfileChanged, wardrobeMode, onWardrobeModeChanged, onGarmentsChanged, onNavigate, onSignOut, userEmail }: Props) {
  const optimizedConfirmOverlay = useOverlayClick(() => setShowOptimizedConfirm(false))
  const { t, locale, setLocale } = useI18n()
  const { categoryLabel } = useLabels()
  const { theme, setTheme } = useTheme()

  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [history, setHistory] = useState<SizeHistoryEntry[]>([])
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarOptimizing, setAvatarOptimizing] = useState(false)
  const [showOptimizedConfirm, setShowOptimizedConfirm] = useState(false)
  const [demoCount, setDemoCount] = useState(0)
  const [personalCount, setPersonalCount] = useState(0)
  const [allWearLogs, setAllWearLogs] = useState<WearLogEntry[]>([])
  const [demoGenerating, setDemoGenerating] = useState(false)
  const [demoDeleting, setDemoDeleting] = useState(false)
  const avatarFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) {
      setValues({
        current_size: profile.current_size || '',
        current_shoe_size: profile.current_shoe_size || '',
        height_cm: profile.height_cm || '',
        weight_kg: profile.weight_kg || '',
        bust_cm: profile.bust_cm || '',
        waist_cm: profile.waist_cm || '',
        hip_cm: profile.hip_cm || '',
        shoulder_cm: profile.shoulder_cm || '',
        inseam_cm: profile.inseam_cm || '',
      })
    }
  }, [profile])

  useEffect(() => { fetchSizeHistory().then(setHistory).catch(() => {}) }, [])
  useEffect(() => { fetchAllWearLogs().then(setAllWearLogs).catch(() => setAllWearLogs([])) }, [])

  useEffect(() => {
    if (wardrobeMode === 'demo') {
      Promise.all([countDemoGarments(), countPersonalGarments()])
        .then(([d, p]) => { setDemoCount(d); setPersonalCount(p) })
        .catch(() => { setDemoCount(0); setPersonalCount(0) })
    }
  }, [wardrobeMode])

  async function handleGenerateDemo() {
    try {
      setDemoGenerating(true)
      await deleteAllDemoGarments()
      const demoGarments = await buildDemoGarments()
      await createDemoGarments(demoGarments)
      const [d, p] = await Promise.all([countDemoGarments(), countPersonalGarments()])
      setDemoCount(d); setPersonalCount(p)
      onGarmentsChanged()
      showToast(t('demoGenerated'))
    } catch { showToast(t('commonError')) } finally { setDemoGenerating(false) }
  }

  async function handleDeleteDemo() {
    try {
      setDemoDeleting(true)
      await deleteAllDemoGarments()
      const [d, p] = await Promise.all([countDemoGarments(), countPersonalGarments()])
      setDemoCount(d); setPersonalCount(p)
      onGarmentsChanged()
      showToast(locale === 'fr' ? 'Pièces démo supprimées' : locale === 'ar' ? 'تم حذف القطع التجريبية' : 'Demo pieces removed')
    } catch { showToast(t('commonError')) } finally { setDemoDeleting(false) }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setAvatarUploading(true)
      const url = await uploadAvatar(file)
      await updateAvatar(url)
      showToast(t('avatarSaved'))
      onProfileChanged()
    } catch { showToast(t('commonError')) } finally { setAvatarUploading(false) }
  }

  async function handleGenerateOptimized() {
    setShowOptimizedConfirm(false)
    if (!profile?.avatar_url) { showToast(t('avatarOptimizedNoAvatar')); return }
    try {
      setAvatarOptimizing(true)
      const credits = await fetchFashnCredits()
      if (credits.total < 1) { showToast(t('avatarOptimizedNoCredits')); return }
      const runResult = await runFaceToModel(profile.avatar_url)
      if (runResult.error) throw new Error(runResult.error)
      const result = await pollUntilComplete(runResult.id)
      if (result.output && result.output.length > 0) {
        await updateAvatarOptimized(result.output[0])
        showToast(t('avatarOptimizedSaved'))
        onProfileChanged()
      } else { throw new Error('No output image') }
    } catch { showToast(t('avatarOptimizedError')) } finally { setAvatarOptimizing(false) }
  }

  async function pollUntilComplete(id: string): Promise<{ output: string[]; error: string | null }> {
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const status = await pollTryOnStatus(id)
      if (status.status === 'completed') return { output: status.output, error: null }
      if (status.status === 'failed') throw new Error(status.error || 'Generation failed')
    }
    throw new Error('Timeout')
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2000) }

  async function handleSave() {
    try {
      setSaving(true)
      const updates: ProfileUpdate = {
        current_size: values.current_size || '',
        current_shoe_size: values.current_shoe_size || '',
        height_cm: values.height_cm || '',
        weight_kg: values.weight_kg || '',
        bust_cm: values.bust_cm || '',
        waist_cm: values.waist_cm || '',
        hip_cm: values.hip_cm || '',
        shoulder_cm: values.shoulder_cm || '',
        inseam_cm: values.inseam_cm || '',
      }
      const sizeChanged = values.current_size !== (profile?.current_size || '')
      const shoeChanged = values.current_shoe_size !== (profile?.current_shoe_size || '')
      await updateProfile(updates)
      if (sizeChanged || shoeChanged) { await addSizeHistory(values.current_size || '', values.current_shoe_size || ''); const h = await fetchSizeHistory(); setHistory(h) }
      showToast(t('profileSaved')); onProfileChanged()
    } catch { showToast(t('commonError')) } finally { setSaving(false) }
  }

  async function handleDisplayModeChange(mode: 'simplified' | 'complete') {
    try {
      await updateProfile({ display_mode: mode })
      onProfileChanged()
    } catch { showToast(t('commonError')) }
  }

  const favorites = garments.filter((g) => g.favorite)

  // --- Wardrobe stats ---
  const wearCountByGarment = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const log of allWearLogs) {
      if (log.garment_id) counts[log.garment_id] = (counts[log.garment_id] || 0) + 1
    }
    return counts
  }, [allWearLogs])

  const totalValue = useMemo(() =>
    garments.reduce((sum, g) => sum + (g.purchase_price || 0), 0)
  , [garments])
  const pricedCount = useMemo(() => garments.filter((g) => g.purchase_price && g.purchase_price > 0).length, [garments])

  const topWorn = useMemo(() =>
    garments
      .map((g) => ({ g, count: wearCountByGarment[g.id] || 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  , [garments, wearCountByGarment])

  const neverWornCount = useMemo(() =>
    garments.filter((g) => !wearCountByGarment[g.id]).length
  , [garments, wearCountByGarment])

  const occasionBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const log of allWearLogs) {
      const occ = log.occasion || 'everyday'
      counts[occ] = (counts[occ] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [allWearLogs])
  const maxOccasionCount = occasionBreakdown.length > 0 ? occasionBreakdown[0][1] : 0

  const currency = locale === 'ar' ? t('currencyQARAr') : t('currencyQAR')

  function occasionLabelKey(o: string): string {
    const cap = o.charAt(0).toUpperCase() + o.slice(1)
    return 'occasion' + cap
  }

  function getFieldLabel(key: string): string {
    const labels: Record<string, { fr: string; en: string; ar: string }> = {
      profileCurrentSize: { fr: 'Taille actuelle', en: 'Current size', ar: 'المقاس الحالي' },
      profileCurrentShoeSize: { fr: 'Pointure', en: 'Shoe size', ar: 'مقاس الحذاء' },
      profileHeight: { fr: 'Taille (cm)', en: 'Height (cm)', ar: 'الطول (سم)' },
      profileWeight: { fr: 'Poids (kg)', en: 'Weight (kg)', ar: 'الوزن (كجم)' },
      profileBust: { fr: 'Tour de poitrine (cm)', en: 'Bust (cm)', ar: 'محيط الصدر (سم)' },
      profileWaist: { fr: 'Tour de taille (cm)', en: 'Waist (cm)', ar: 'محيط الخصر (سم)' },
      profileHip: { fr: 'Tour de hanches (cm)', en: 'Hip (cm)', ar: 'محيط الورك (سم)' },
      profileShoulder: { fr: 'Largeur épaules (cm)', en: 'Shoulder (cm)', ar: 'عرض الكتف (سم)' },
      profileInseam: { fr: 'Entrejambe (cm)', en: 'Inseam (cm)', ar: 'الرجل الداخلية (سم)' },
    }
    return labels[key] ? labels[key][locale] : key
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen">
      <header className="px-5 pt-4 pb-4 animate-fade-up">
        <p className="kicker mb-0.5">{t('appTagline')}</p>
        <h1 className="text-2xl title-display" style={{ color: 'var(--tc)' }}>{t('profileTitle')}</h1>
        {userEmail && (
          <div className="flex items-center gap-2 mt-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--tc-07)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-45)' }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <path d="M22 6l-10 7L2 6" />
              </svg>
            </div>
            <span className="text-xs font-sans" style={{ color: 'var(--tc-45)' }}>{userEmail}</span>
          </div>
        )}
      </header>

      {/* Wardrobe selector */}
      <section className="px-5 mb-6 animate-fade-up delay-1">
        <h2 className="text-base title-display mb-3" style={{ color: 'var(--tc)' }}>{t('wardrobeSelectorTitle')}</h2>
        <div className="glass p-3 flex gap-3">
          <button onClick={() => onWardrobeModeChanged('personal')}
            className="flex-1 flex flex-col items-center gap-2 py-3 rounded-xl transition-all duration-200"
            style={wardrobeMode === 'personal' ? { background: 'var(--tc-07)', border: '1.5px solid var(--tc)' } : { border: '1px solid var(--line)' }}>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc)' }}>
              <path d="M4 6l4-3 4 2 4-2 4 3-2 4-2-1.5V21h-8V8.5L6 10 4 6z" strokeLinejoin="round" />
            </svg>
            <span className="text-[10px] font-sans font-medium" style={{ color: 'var(--tc)' }}>{t('wardrobePersonal')}</span>
          </button>
          <button onClick={() => onWardrobeModeChanged('demo')}
            className="flex-1 flex flex-col items-center gap-2 py-3 rounded-xl transition-all duration-200"
            style={wardrobeMode === 'demo' ? { background: 'var(--tc-07)', border: '1.5px solid var(--tc)' } : { border: '1px solid var(--line)' }}>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc)' }}>
              <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
            </svg>
            <span className="text-[10px] font-sans font-medium" style={{ color: 'var(--tc)' }}>{t('wardrobeDemo')}</span>
          </button>
        </div>
        {wardrobeMode === 'demo' && (
          <div className="mt-3 space-y-2">
            <button onClick={handleGenerateDemo} disabled={demoGenerating}
              className="btn-gold w-full disabled:opacity-50 flex items-center justify-center gap-2">
              {demoGenerating ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /><span className="text-sm font-sans">{t('commonLoading')}</span></>
              ) : (
                <><svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" /></svg><span className="text-sm font-sans">{demoCount > 0 ? (locale === 'fr' ? 'Régénérer la démo' : locale === 'ar' ? 'إعادة توليد العرض' : 'Regenerate demo') : t('demoGenerate')}</span></>
              )}
            </button>
            {demoCount > 0 && (
              <button onClick={handleDeleteDemo} disabled={demoDeleting}
                className="w-full py-2.5 rounded-xl text-xs font-sans font-medium transition-all duration-200 disabled:opacity-50"
                style={{ border: '1px solid var(--line-strong)', color: 'var(--tc-60)' }}>
                {demoDeleting ? t('commonLoading') : (locale === 'fr' ? 'Supprimer les pièces de démonstration' : locale === 'ar' ? 'حذف القطع التجريبية' : 'Remove demo pieces')}
              </button>
            )}
            {(demoCount > 0 || personalCount > 0) && (
              <p className="text-[10px] font-sans text-center" style={{ color: 'var(--tc-45)' }}>
                {demoCount + personalCount} {t('demoPiecesLoaded')} ({demoCount} {locale === 'fr' ? 'démo' : 'demo'} + {personalCount} {locale === 'fr' ? 'personnelles' : 'personal'})
              </p>
            )}
          </div>
        )}
      </section>

      {/* Display mode selector */}
      <section className="px-5 mb-6 animate-fade-up delay-1">
        <h2 className="text-base title-display mb-1" style={{ color: 'var(--tc)' }}>{t('displayModeTitle')}</h2>
        <p className="text-[10px] font-sans mb-3" style={{ color: 'var(--tc-45)' }}>
          {(profile?.display_mode || 'simplified') === 'simplified' ? t('displayModeSimplifiedDesc') : t('displayModeCompleteDesc')}
        </p>
        <div className="glass p-3 flex gap-3">
          <button
            onClick={() => handleDisplayModeChange('simplified')}
            className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all duration-200"
            style={(profile?.display_mode || 'simplified') === 'simplified' ? { background: 'var(--tc-07)', border: '1.5px solid var(--tc)' } : { border: '1px solid var(--line)' }}>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc)' }}>
              <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="4" rx="1.5" /><rect x="14" y="10" width="7" height="11" rx="1.5" /><rect x="3" y="13" width="7" height="8" rx="1.5" />
            </svg>
            <span className="text-[10px] font-sans font-medium" style={{ color: 'var(--tc)' }}>{t('displayModeSimplified')}</span>
          </button>
          <button
            onClick={() => handleDisplayModeChange('complete')}
            className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all duration-200"
            style={profile?.display_mode === 'complete' ? { background: 'var(--tc-07)', border: '1.5px solid var(--tc)' } : { border: '1px solid var(--line)' }}>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc)' }}>
              <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span className="text-[10px] font-sans font-medium" style={{ color: 'var(--tc)' }}>{t('displayModeComplete')}</span>
          </button>
        </div>
      </section>

      {/* Measurements card */}
      <section className="px-5 mb-6 animate-fade-up delay-1">
        <div className="glass p-5">
          <h2 className="text-sm title-serif font-semibold mb-4" style={{ color: 'var(--tc)' }}>{t('profileChangeSize')}</h2>

          {/* Size + Shoe size + Height — special row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{getFieldLabel('profileCurrentSize')}</label>
              <select
                value={values.current_size || ''}
                onChange={(e) => setValues({ ...values, current_size: e.target.value })}
                className="input-field"
              >
                <option value="">—</option>
                {clothingSizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{getFieldLabel('profileCurrentShoeSize')}</label>
              <input
                value={values.current_shoe_size || ''}
                onChange={(e) => setValues({ ...values, current_shoe_size: e.target.value })}
                placeholder="38"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{getFieldLabel('profileHeight')}</label>
              <input
                value={values.height_cm || ''}
                onChange={(e) => setValues({ ...values, height_cm: e.target.value })}
                placeholder="165"
                className="input-field"
              />
            </div>
          </div>

          {/* Other measurements */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {measurementFields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>
                  {getFieldLabel(field.labelKey)}
                </label>
                <input
                  value={values[field.key] || ''}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className="input-field"
                />
              </div>
            ))}
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-gold w-full disabled:opacity-50">{saving ? t('formSaving') : t('profileSave')}</button>
        </div>
      </section>

      {/* Avatar */}
      <section className="px-5 mb-6 animate-fade-up delay-1">
        <h2 className="text-base title-display mb-3" style={{ color: 'var(--tc)' }}>{t('avatarTitle')}</h2>
        <div className="glass p-5">
          <p className="text-xs font-sans mb-3" style={{ color: 'var(--tc-45)' }}>{t('avatarSubtitle')}</p>
          <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          {profile?.avatar_url ? (
            <div className="space-y-3">
              <div className="relative aspect-[3/4] max-h-56 rounded-2xl overflow-hidden mx-auto" style={{ background: 'var(--tc-04)' }}>
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-contain" />
                {avatarUploading && <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(15,5,10,0.4)' }}><div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" /></div>}
              </div>
              <button onClick={() => avatarFileRef.current?.click()} disabled={avatarUploading}
                className="btn-outline w-full disabled:opacity-50">{t('avatarChange')}</button>
            </div>
          ) : (
            <button onClick={() => avatarFileRef.current?.click()} disabled={avatarUploading}
              className="w-full aspect-[3/1] rounded-2xl flex flex-col items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50"
              style={{ border: '2px dashed var(--tc-20)', color: 'var(--tc-30)' }}>
              {avatarUploading ? (
                <><div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--tc-20)', borderTopColor: 'var(--tc)' }} /><span className="text-xs font-sans">{t('commonLoading')}</span></>
              ) : (
                <><svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" /></svg><span className="text-xs font-sans">{t('avatarUpload')}</span></>
              )}
            </button>
          )}
          <p className="text-[10px] font-sans mt-2" style={{ color: 'var(--tc-30)' }}>{t('avatarHint')}</p>
        </div>
      </section>

      {/* Optimized Avatar */}
      <section className="px-5 mb-6 animate-fade-up delay-2">
        <h2 className="text-base title-display mb-3" style={{ color: 'var(--tc)' }}>{t('avatarOptimizedTitle')}</h2>
        <div className="glass p-5">
          <p className="text-xs font-sans mb-3" style={{ color: 'var(--tc-45)' }}>{t('avatarOptimizedSubtitle')}</p>
          {profile?.avatar_optimized_url ? (
            <div className="space-y-3">
              <div className="relative aspect-[3/4] max-h-56 rounded-2xl overflow-hidden mx-auto" style={{ background: 'var(--tc-04)' }}>
                <img src={profile.avatar_optimized_url} alt="Optimized avatar" className="w-full h-full object-contain" />
                {avatarOptimizing && <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(15,5,10,0.4)' }}><div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" /></div>}
              </div>
              <button onClick={() => setShowOptimizedConfirm(true)} disabled={avatarOptimizing || !profile?.avatar_url}
                className="btn-outline w-full disabled:opacity-50">{t('avatarOptimizedReplace')}</button>
            </div>
          ) : (
            <div className="space-y-3">
              <button onClick={() => setShowOptimizedConfirm(true)} disabled={avatarOptimizing || !profile?.avatar_url}
                className="btn-gold w-full disabled:opacity-50 flex items-center justify-center gap-2">
                {avatarOptimizing ? (
                  <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /><span className="text-sm font-sans">{t('avatarOptimizedGenerating')}</span></>
                ) : (
                  <><svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" /></svg><span className="text-sm font-sans">{t('avatarOptimizedGenerate')}</span></>
                )}
              </button>
              {!profile?.avatar_url && <p className="text-[10px] font-sans text-center" style={{ color: 'var(--tc-30)' }}>{t('avatarOptimizedNoAvatar')}</p>}
            </div>
          )}
        </div>
      </section>

      {/* Optimized avatar confirmation modal */}
      {showOptimizedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center glass-overlay" {...optimizedConfirmOverlay.overlayProps}>
          <div className="glass-sheet max-w-sm w-full mx-4 rounded-3xl animate-scale-in p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-sans text-center mb-5" style={{ color: 'var(--tc)' }}>{t('avatarOptimizedConfirm')}</p>
            <div className="flex gap-2">
              <button onClick={() => setShowOptimizedConfirm(false)} className="flex-1 btn-outline py-3">{t('avatarOptimizedConfirmNo')}</button>
              <button onClick={handleGenerateOptimized} className="flex-1 btn-gold py-3">{t('avatarOptimizedConfirmYes')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <section className="px-5 mb-6 animate-fade-up delay-2">
        <h2 className="text-base title-display mb-3" style={{ color: 'var(--tc)' }}>{t('profileStats')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { val: garments.length, label: t('profileTotalItems') },
            { val: favorites.length, label: t('profileFavorites') },
            { val: outfits.length, label: t('profileOutfits') },
          ].map((s, i) => (
            <div key={i} className="glass-card p-4 text-center">
              <p className="text-2xl title-display" style={{ color: 'var(--tc)' }}>{s.val}</p>
              <p className="text-[10px] font-sans mt-0.5" style={{ color: 'var(--tc-45)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Category breakdown */}
      <section className="px-5 mb-6 animate-fade-up delay-3">
        <h2 className="text-base title-display mb-3" style={{ color: 'var(--tc)' }}>{t('profileCategories')}</h2>
        <div className="glass p-4 space-y-3">
          {(['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories', 'bags', 'traditional'] as const).map((cat) => {
            const count = garments.filter((g) => g.category === cat).length
            const pct = garments.length > 0 ? (count / garments.length) * 100 : 0
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs font-sans w-28 flex-shrink-0" style={{ color: 'var(--tc-45)' }}>{categoryLabel(cat)}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--tc-07)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--tc-lg), var(--tc))' }} />
                </div>
                <span className="text-xs font-sans w-6 text-end" style={{ color: 'var(--tc-45)' }}>{count}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Wardrobe stats — value, top worn, never worn, occasion breakdown */}
      <section className="px-5 mb-6 animate-fade-up delay-3">
        <h2 className="text-base title-display mb-3" style={{ color: 'var(--tc)' }}>{t('statsTitle')}</h2>

        {/* Total value */}
        <div className="glass-card p-4 mb-3">
          <p className="text-xs font-sans font-semibold mb-1" style={{ color: 'var(--tc-45)' }}>{t('statsTotalValue')}</p>
          {pricedCount > 0 ? (
            <>
              <p className="text-2xl title-display" style={{ color: 'var(--tc)' }}>
                {Math.round(totalValue).toLocaleString(locale === 'ar' ? 'ar' : locale)} {currency}
              </p>
              <p className="text-[10px] font-sans mt-0.5" style={{ color: 'var(--tc-30)' }}>
                {t('statsTotalValueHint').replace('{n}', String(pricedCount))}
              </p>
            </>
          ) : (
            <p className="text-xs font-sans" style={{ color: 'var(--tc-30)' }}>{t('statsNoPrices')}</p>
          )}
        </div>

        {/* Top 5 most worn */}
        <div className="glass-card p-4 mb-3">
          <p className="text-xs font-sans font-semibold mb-2" style={{ color: 'var(--tc-45)' }}>{t('statsTopWorn')}</p>
          {topWorn.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {topWorn.map(({ g, count }) => (
                <div key={g.id} className="flex-shrink-0 w-16 text-center">
                  <div className="w-16 h-16 rounded-lg overflow-hidden mb-1" style={{ background: 'var(--tc-04)', border: '1px solid var(--line)' }}>
                    {g.photo_url ? (
                      <img src={g.photo_url} alt={g.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] title-display" style={{ color: 'var(--tc-30)' }}>
                        {g.category.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-sans font-bold" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                    {t('statsWornTimes').replace('{n}', String(count))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs font-sans" style={{ color: 'var(--tc-30)' }}>{t('statsNoWearData')}</p>
          )}
        </div>

        {/* Never worn — treasures to rediscover */}
        {neverWornCount > 0 && (
          <div className="glass-card p-4 mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-sans font-semibold mb-0.5" style={{ color: 'var(--tc)' }}>
                {t('statsNeverWorn').replace('{n}', String(neverWornCount))}
              </p>
              <button onClick={() => onNavigate('wardrobe')} className="text-[10px] font-sans font-medium" style={{ color: 'var(--warn)' }}>
                {t('statsNeverWornLink')}
              </button>
            </div>
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--brass)' }}>
              <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6-6.3 4.6L7 14 1 9.4h7.6z" />
            </svg>
          </div>
        )}

        {/* Occasion breakdown — bar chart */}
        {occasionBreakdown.length > 0 && (
          <div className="glass-card p-4">
            <p className="text-xs font-sans font-semibold mb-3" style={{ color: 'var(--tc-45)' }}>{t('statsOccasionBreakdown')}</p>
            <div className="space-y-2">
              {occasionBreakdown.map(([occ, count]) => {
                const pct = maxOccasionCount > 0 ? (count / maxOccasionCount) * 100 : 0
                return (
                  <div key={occ} className="flex items-center gap-2">
                    <span className="text-[10px] font-sans w-24 flex-shrink-0 truncate" style={{ color: 'var(--tc-45)' }}>{t(occasionLabelKey(occ))}</span>
                    <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--tc-07)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                    </div>
                    <span className="text-[10px] font-sans w-6 text-end" style={{ color: 'var(--tc-45)' }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Size history */}
      <section className="px-5 mb-6 animate-fade-up delay-4">
        <h2 className="text-base title-display mb-3" style={{ color: 'var(--tc)' }}>{t('profileSizeHistory')}</h2>
        {history.length === 0 ? (
          <div className="glass-card p-6 text-center"><p className="text-sm font-sans" style={{ color: 'var(--tc-45)' }}>{t('profileNoHistory')}</p></div>
        ) : (
          <div className="glass-card overflow-hidden">
            {history.map((h, i) => (
              <div key={h.id} className="flex items-center justify-between px-4 py-3" style={i > 0 ? { borderTop: '1px solid var(--line)' } : {}}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--tc-07)' }}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--tc)' }}>
                      <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6 5c2 0 3.5 1 4 2.5h2C12.5 6 14 5 16 5c3.5 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z" />
                    </svg>
                  </div>
                  <p className="text-sm font-sans" style={{ color: 'var(--tc)' }}>{h.size || '—'} {h.shoe_size && `· ${h.shoe_size}`}</p>
                </div>
                <span className="text-xs font-sans" style={{ color: 'var(--tc-45)' }}>
                  {new Date(h.changed_at).toLocaleDateString(locale === 'ar' ? 'ar' : locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Theme selector */}
      <section className="px-5 mb-6 animate-fade-up delay-4">
        <h2 className="text-base title-display mb-3" style={{ color: 'var(--tc)' }}>
          {locale === 'fr' ? 'Thème' : locale === 'en' ? 'Theme' : 'السمة'}
        </h2>
        <div className="glass p-3 flex gap-3">
          {themeOptions.map((opt) => (
            <button key={opt.id} onClick={() => setTheme(opt.id)}
              className="flex-1 flex flex-col items-center gap-2 py-3 rounded-xl transition-all duration-200"
              style={theme === opt.id ? { background: 'var(--tc-07)', border: '1.5px solid var(--tc)' } : { border: '1px solid var(--line)' }}>
              <div className="w-8 h-8 rounded-full" style={{ background: opt.color }} />
              <span className="text-[10px] font-sans font-medium" style={{ color: 'var(--tc)' }}>{opt.label[locale]}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Language */}
      <section className="px-5 mb-6 animate-fade-up delay-5">
        <h2 className="text-base title-display mb-3" style={{ color: 'var(--tc)' }}>{t('profileLanguage')}</h2>
        <div className="glass-card p-2">
          {(Object.keys(locales) as Locale[]).map((l) => (
            <button key={l} onClick={() => setLocale(l)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200"
              style={locale === l ? { background: 'var(--tc-07)' } : {}}>
              <span className="text-sm font-sans" style={locale === l ? { color: 'var(--tc)', fontWeight: 500 } : { color: 'var(--tc-45)' }}>{locales[l].label}</span>
              {locale === l && (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--tc)' }}>
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="px-5 mb-6 animate-fade-up delay-5">
        <h2 className="text-base title-display mb-3" style={{ color: 'var(--tc)' }}>{t('profileAbout')}</h2>
        <div className="glass p-5">
          <p className="text-sm font-sans leading-relaxed" style={{ color: 'var(--tc-45)' }}>{t('profileAboutText')}</p>
        </div>
      </section>

      {/* Sign out */}
      <section className="px-5 mb-8 animate-fade-up delay-4">
        <button
          onClick={() => { if (confirm(t('authLogoutConfirm'))) onSignOut() }}
          className="w-full py-3 rounded-xl text-sm font-sans font-semibold transition-all duration-200 active:scale-95"
          style={{ background: 'var(--danger-soft)', border: '1.5px solid rgba(184,67,79,0.22)', color: 'var(--danger)' }}>
          {t('authLogout')}
        </button>
      </section>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-sm font-sans font-medium animate-fade-in shadow-lg" style={{ background: 'var(--tc)', color: '#fff' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
