import { useState, useMemo, useEffect } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { useLabels, ALL_CATEGORIES, ALL_SEASONS, ALL_STYLES, ALL_STATUSES } from '../lib/labels'
import { completeDraft, fetchProfile } from '../lib/api'
import { clothingDictionary, colorDictionary, localize, sortDictionaryByLocale, sizeDictionary, materialDictionary } from '../lib/clothingDictionary'
import Dropdown from './Dropdown'
import { StatusIcon } from './StatusIcon'
import type { Garment, Category, Season, GarmentStyle, GarmentStatus, Modesty, Formality, Pattern, Metallic, Occasion } from '../types'

interface Props {
  drafts: Garment[]
  onClose: () => void
  onComplete: () => void
  onGoToStylist: () => void
}

function filenameToName(filename: string): string {
  const base = filename.split('/').pop() || filename
  const noExt = base.replace(/\.[^/.]+$/, '')
  return noExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export default function DraftCompletionFlow({ drafts, onClose, onComplete, onGoToStylist }: Props) {
  const { t, locale } = useI18n()
  const { categoryLabel, seasonLabel, styleLabel, statusLabel } = useLabels()
  const [index, setIndex] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [showDone, setShowDone] = useState(false)

  // Essential fields
  const [category, setCategory] = useState<Category>('tops')
  const [colorPrimary, setColorPrimary] = useState('')
  const [colorConfidence, setColorConfidence] = useState(0)
  const [size, setSize] = useState('')
  const [name, setName] = useState('')
  const [lastUsedCategory, setLastUsedCategory] = useState<Category>('tops')

  // Advanced fields — persisted across drafts
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [styles, setStyles] = useState<GarmentStyle[]>([])
  const [material, setMaterial] = useState('')
  const [season, setSeason] = useState<Season>('all')
  const [status, setStatus] = useState<GarmentStatus>('available')
  const [modesty, setModesty] = useState<Modesty | null>(null)
  const [formality, setFormality] = useState<Formality | null>(null)
  const [pattern, setPattern] = useState<Pattern>('solid')
  const [metallic, setMetallic] = useState<Metallic>('none')
  const [occasionTags, setOccasionTags] = useState<Occasion[]>([])
  const [purchasePrice, setPurchasePrice] = useState<string>('')

  const sortedColors = useMemo(() => sortDictionaryByLocale(colorDictionary, locale), [locale])
  const sortedMaterials = useMemo(() => sortDictionaryByLocale(materialDictionary, locale), [locale])
  const currentDraft = drafts[index]

  useEffect(() => {
    fetchProfile().then((p) => {
      if (p?.current_size) setSize(p.current_size)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!currentDraft) return
    setCategory(lastUsedCategory)
    setColorPrimary(currentDraft.color_primary || '')
    setColorConfidence(0)
    if (currentDraft.photo_url) {
      setName(filenameToName(currentDraft.photo_url))
    }
  }, [index, currentDraft, lastUsedCategory])

  if (!currentDraft && !showDone) {
    if (drafts.length > 0) {
      setShowDone(true)
    }
  }

  if (showDone || (index >= drafts.length && drafts.length > 0)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,5,10,0.5)', backdropFilter: 'blur(8px)' }}>
        <div className="glass-sheet w-full max-w-sm mx-4 rounded-3xl p-8 flex flex-col items-center text-center animate-scale-in">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--accent)' }}>
            <svg viewBox="0 0 24 24" className="w-9 h-9" fill="none" stroke="var(--on-accent)" strokeWidth={2.5}>
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-xl title-display mb-2" style={{ color: 'var(--tc)' }}>{t('draftDone')}</h2>
          <p className="text-sm font-sans mb-6" style={{ color: 'var(--tc-45)' }}>
            {t('draftDoneMsg').replace('{n}', String(completedCount))}
          </p>
          <button onClick={() => { onComplete(); onGoToStylist() }} className="w-full btn-gold py-3 mb-2">
            {t('draftGoStylist')}
          </button>
          <button onClick={() => { onComplete(); onClose() }} className="w-full btn-outline py-3">
            {t('commonClose')}
          </button>
        </div>
      </div>
    )
  }

  if (!currentDraft) return null

  const toggleStyle = (s: GarmentStyle) => {
    setStyles((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  const toggleOccasion = (o: Occasion) => {
    setOccasionTags((prev) => prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o])
  }

  const handleValidate = async () => {
    setSaving(true)
    try {
      await completeDraft(currentDraft.id, {
        name: name.trim() || filenameToName(currentDraft.photo_url || ''),
        category,
        color_primary: colorPrimary,
        size,
        ...(showAdvanced ? {
          styles,
          material: material || undefined,
          season,
          status,
          modesty,
          formality,
          pattern,
          metallic,
          occasion_tags: occasionTags,
          purchase_price: purchasePrice === '' ? null : parseFloat(purchasePrice),
        } : {}),
      })
      setLastUsedCategory(category)
      setCompletedCount((c) => c + 1)
      setIndex((i) => i + 1)
    } catch {
      // stay on current
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    setIndex((i) => i + 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(250,247,243,0.98)' }}>
      {/* Header with progress */}
      <div className="flex items-center justify-between px-5 py-4 pt-5" style={{ borderBottom: '1px solid var(--line)' }}>
        <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--tc-07)' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--tc)' }}><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span className="text-sm font-sans font-semibold" style={{ color: 'var(--tc)' }}>{t('draftProgress').replace('{current}', String(index + 1)).replace('{total}', String(drafts.length))}</span>
        <div className="w-9" />
      </div>

      {/* Progress bar */}
      <div className="h-1" style={{ background: 'var(--tc-07)' }}>
        <div className="h-full transition-all duration-300" style={{ width: `${((index) / drafts.length) * 100}%`, background: 'var(--accent)' }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Photo */}
        <div className="aspect-[3/4] max-h-[45vh] rounded-2xl overflow-hidden mx-auto mb-5" style={{ background: 'var(--tc-04)' }}>
          <img src={currentDraft.photo_url} alt="" className="w-full h-full object-contain" />
        </div>

        {/* Category chips */}
        <div className="mb-4">
          <label className="block text-xs font-sans font-semibold mb-2" style={{ color: 'var(--tc-45)' }}>{t('draftCategory')}</label>
          <div className="flex gap-2 flex-wrap">
            {ALL_CATEGORIES.map((c) => {
              const cat = clothingDictionary.find((cd) => cd.key === c)
              const isActive = category === c
              return (
                <button key={c} type="button"
                  onClick={() => setCategory(c)}
                  className={`pill ${isActive ? 'pill-active' : 'pill-idle'}`}>
                  {cat ? localize(cat.label, locale) : c}
                </button>
              )
            })}
          </div>
        </div>

        {/* Color */}
        <div className="mb-4">
          <label className="block text-xs font-sans font-semibold mb-2" style={{ color: 'var(--tc-45)' }}>
            {t('draftColor')}
            {colorConfidence > 0 && (
              <span className="ml-2 text-[10px] font-normal" style={{ color: 'var(--tc-30)' }}>
                {t('draftColorDetected').replace('{n}', String(colorConfidence))}
              </span>
            )}
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {sortedColors.map((c) => {
              const isActive = colorPrimary === c.en
              return (
                <button key={c.en} type="button"
                  onClick={() => setColorPrimary(c.en)}
                  className={`pill ${isActive ? 'pill-active' : 'pill-idle'}`}>
                  {localize(c, locale)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Size */}
        <div className="mb-4">
          <label className="block text-xs font-sans font-semibold mb-2" style={{ color: 'var(--tc-45)' }}>{t('draftSize')}</label>
          <input
            className="input-field"
            value={size}
            onChange={(e) => setSize(e.target.value.toUpperCase())}
            placeholder={t('profileSizePlaceholder')}
          />
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {sizeDictionary.map((s, i) => (
              <button key={i} type="button" onClick={() => setSize(localize(s, locale))}
                className="px-2.5 py-1 rounded-lg text-xs font-sans font-medium transition-all duration-150"
                style={size === localize(s, locale)
                  ? { background: 'var(--tc)', color: '#fff' }
                  : { background: 'var(--tc-07)', color: 'var(--tc-45)' }}>
                {localize(s, locale)}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-xs font-sans font-semibold mb-2" style={{ color: 'var(--tc-45)' }}>{t('draftName')}</label>
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('formNamePlaceholder')}
          />
        </div>

        {/* Advanced details — collapsible, persists across drafts */}
        <div className="mb-4">
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200"
            style={{ background: 'var(--tc-04)', border: '1px solid var(--line)' }}>
            <span className="text-xs font-sans font-semibold" style={{ color: 'var(--tc-45)' }}>{t('formAdvancedDetails')}</span>
            <svg viewBox="0 0 24 24" className={`w-4 h-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--tc-45)' }}>
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-4 p-3 rounded-xl" style={{ background: 'var(--tc-04)', border: '1px solid var(--line)' }}>
              {/* Styles */}
              <div>
                <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formStyles')}</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_STYLES.map((s) => {
                    const active = styles.includes(s)
                    return (
                      <button key={s} type="button" onClick={() => toggleStyle(s)}
                        className={`pill ${active ? 'pill-active' : 'pill-idle'}`}>
                        {styleLabel(s)}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Material */}
              <div>
                <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{locale === 'fr' ? 'Matière' : locale === 'en' ? 'Material' : 'الخامة'}</label>
                <Dropdown
                  value={material}
                  options={sortedMaterials.map((m) => ({ value: m.en, label: localize(m, locale) }))}
                  onChange={(val) => setMaterial(val)}
                />
              </div>
              {/* Season */}
              <div>
                <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formSeason')}</label>
                <Dropdown
                  value={season}
                  options={ALL_SEASONS.map((s) => ({ value: s, label: seasonLabel(s) }))}
                  onChange={(val) => setSeason(val as Season)}
                />
              </div>
              {/* Status */}
              <div>
                <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formStatus')}</label>
                <div className="flex gap-2 flex-wrap">
                  {ALL_STATUSES.map((s) => {
                    const isActive = status === s
                    return (
                      <button key={s} type="button"
                        onClick={() => setStatus(s)}
                        className={`pill flex items-center gap-1.5 ${isActive ? 'pill-active' : 'pill-idle'}`}>
                        <StatusIcon status={s} className="w-3.5 h-3.5" />
                        {statusLabel(s)}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Modesty */}
              <div>
                <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formModesty')} <span style={{ color: 'var(--tc-30)' }}>({t('commonOptional')})</span></label>
                <div className="flex gap-2 flex-wrap">
                  {(['full_coverage', 'moderate', 'revealing'] as Modesty[]).map((m) => (
                    <button key={m} type="button"
                      onClick={() => setModesty(modesty === m ? null : m)}
                      className={`pill ${modesty === m ? 'pill-active' : 'pill-idle'}`}>
                      {t('modesty' + m.charAt(0).toUpperCase() + m.slice(1))}
                    </button>
                  ))}
                </div>
              </div>
              {/* Formality */}
              <div>
                <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formFormality')} <span style={{ color: 'var(--tc-30)' }}>({t('commonOptional')})</span></label>
                <Dropdown
                  value={formality || ''}
                  options={[{ value: '', label: t('commonNone') }, ...(['very_casual', 'casual', 'smart_casual', 'business', 'evening', 'ceremonial'] as Formality[]).map((f) => ({ value: f, label: t('formality' + f.charAt(0).toUpperCase() + f.slice(1)) }))]}
                  onChange={(val) => setFormality((val || null) as Formality | null)}
                />
              </div>
              {/* Pattern */}
              <div>
                <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formPattern')}</label>
                <Dropdown
                  value={pattern}
                  options={(['solid', 'striped', 'floral', 'geometric', 'polka_dot', 'animal_print', 'embroidered', 'sequined', 'abstract', 'plaid'] as Pattern[]).map((p) => ({ value: p, label: t('pattern' + p.charAt(0).toUpperCase() + p.slice(1)) }))}
                  onChange={(val) => setPattern(val as Pattern)}
                />
              </div>
              {/* Metallic */}
              <div>
                <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formMetallic')}</label>
                <div className="flex gap-2 flex-wrap">
                  {(['none', 'gold', 'silver', 'mixed'] as Metallic[]).map((m) => (
                    <button key={m} type="button"
                      onClick={() => setMetallic(m)}
                      className={`pill ${metallic === m ? 'pill-active' : 'pill-idle'}`}>
                      {t('metallic' + m.charAt(0).toUpperCase() + m.slice(1))}
                    </button>
                  ))}
                </div>
              </div>
              {/* Occasion tags */}
              <div>
                <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formOccasionTags')} <span style={{ color: 'var(--tc-30)' }}>({t('commonOptional')})</span></label>
                <div className="flex gap-2 flex-wrap">
                  {(['everyday', 'work', 'brunch', 'evening_out', 'wedding_guest', 'henna_party', 'eid', 'ramadan_gathering', 'majlis', 'beach', 'travel', 'sport'] as Occasion[]).map((o) => {
                    const active = occasionTags.includes(o)
                    return (
                      <button key={o} type="button"
                        onClick={() => toggleOccasion(o)}
                        className={`pill ${active ? 'pill-active' : 'pill-idle'}`}>
                        {t('occasion' + o.charAt(0).toUpperCase() + o.slice(1))}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Purchase price */}
              <div>
                <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formPurchasePrice')} <span style={{ color: 'var(--tc-30)' }}>({t('commonOptional')})</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder={t('formPurchasePricePlaceholder')}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-5 py-4 pb-6 space-y-2" style={{ borderTop: '1px solid var(--line)', background: 'rgba(255,255,255,0.9)' }}>
        <button onClick={handleValidate} disabled={saving} className="w-full btn-gold py-3.5 disabled:opacity-50">
          {saving ? t('commonLoading') : t('draftValidate')}
        </button>
        <button onClick={handleSkip} className="w-full btn-outline py-3">
          {t('draftSkip')}
        </button>
      </div>
    </div>
  )
}
