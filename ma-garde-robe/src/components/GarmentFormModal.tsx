import { useState, useRef, useEffect, useMemo } from 'react'
import { useOverlayClick } from '../lib/useOverlayClick'
import { useI18n } from '../i18n/I18nContext'
import { useLabels, ALL_SEASONS, ALL_STYLES, ALL_STATUSES } from '../lib/labels'
import { createGarment, updateGarment, uploadPhoto, deletePhoto, uploadTrimmedPhoto } from '../lib/api'
import { fetchWearLogsForGarment, type WearLogEntry } from '../lib/api'
import { supabase } from '../lib/supabase'
import {
  clothingDictionary, colorDictionary, materialDictionary, sizeDictionary,
  sortDictionaryByLocale,
  localize, localizeKey, toEnglishKey, type DictEntry,
} from '../lib/clothingDictionary'
import type { Garment, NewGarment, Category, Season, GarmentStyle, GarmentStatus, Modesty, Formality, Pattern, Metallic, Occasion } from '../types'
import { StatusIcon } from './StatusIcon'
import Dropdown from './Dropdown'
import PhotoEditorModal from './PhotoEditorModal'
import WearLogModal from './WearLogModal'
import { formatWearSummary } from '../lib/recency'

interface Props {
  garment: Garment | null
  onClose: () => void
  onSaved: () => void
  displayMode?: 'simplified' | 'complete'
}

const emptyForm: NewGarment = {
  name: '', description: '', category: 'tops', size: '', color_primary: '', color_secondary: '',
  styles: [], season: 'all', brand: '', notes: '', favorite: false, photo_url: '', material: '',
  status: 'available',
  modesty: null, formality: null, pattern: 'solid', metallic: 'none', occasion_tags: [],
  purchase_price: null,
}

// Extract a clean name from a filename (e.g. "robe_ete_2024.jpg" → "Robe ete 2024")
function filenameToName(filename: string): string {
  const base = filename.split('/').pop() || filename
  const noExt = base.replace(/\.[^/.]+$/, '')
  return noExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export default function GarmentFormModal({ garment, onClose, onSaved, displayMode = 'complete' }: Props) {
  const { overlayProps } = useOverlayClick(onClose)
  const isSimplified = displayMode === 'simplified'
  const { t, locale } = useI18n()
  const { seasonLabel, styleLabel, statusLabel } = useLabels()
  const [form, setForm] = useState<NewGarment>(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showCrop, setShowCrop] = useState(false)
  const [removingBg, setRemovingBg] = useState(false)
  const [backgroundRemoved, setBackgroundRemoved] = useState(false)
  const [showBgConfirmation, setShowBgConfirmation] = useState(false)
  const [pendingCropImage, setPendingCropImage] = useState<string | null>(null)
  const [editRotation, setEditRotation] = useState(0)
  const [editFlipped, setEditFlipped] = useState(false)
  const [editTransform, setEditTransform] = useState(false)
  const editImgRef = useRef<HTMLImageElement>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  useEffect(() => { if (isSimplified) setShowAdvanced(false) }, [isSimplified])
  const [showWearLog, setShowWearLog] = useState(false)
  const [wearLogs, setWearLogs] = useState<WearLogEntry[]>([])
  const wearLogRef = useRef<HTMLButtonElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!showBgConfirmation) return
    const timer = setTimeout(() => setShowBgConfirmation(false), 2000)
    return () => clearTimeout(timer)
  }, [showBgConfirmation])

  useEffect(() => {
    if (garment) {
      setForm({
        name: garment.name, description: garment.description, category: garment.category,
        size: garment.size, color_primary: garment.color_primary, color_secondary: garment.color_secondary,
        styles: garment.styles, season: garment.season, brand: garment.brand, notes: garment.notes,
        favorite: garment.favorite, photo_url: garment.photo_url, material: garment.material || '',
        status: garment.status || 'available',
        modesty: garment.modesty || null, formality: garment.formality || null,
        pattern: garment.pattern || 'solid', metallic: garment.metallic || 'none',
        occasion_tags: garment.occasion_tags || [],
        purchase_price: garment.purchase_price ?? null,
      })
      fetchWearLogsForGarment(garment.id).then(setWearLogs).catch(() => setWearLogs([]))
    }
  }, [garment])

  const categoryItems = useMemo(() => {
    const cat = clothingDictionary.find((c) => c.key === form.category)
    return cat ? cat.items : []
  }, [form.category])

  const photoCropAspectRatio = form.category === 'bottoms' ? 0.55
    : form.category === 'shoes' ? 1.8
      : form.category === 'bags' ? 0.75
        : form.category === 'dresses' ? 0.55
          : 0.85

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true); setError(null)
      const url = await uploadPhoto(file)
      setBackgroundRemoved(false)
      setForm((f) => {
        const derivedName = f.name.trim() ? f.name : filenameToName(file.name)
        return { ...f, photo_url: url, name: derivedName }
      })
      setPendingCropImage(url)
      setShowCrop(true)
    } catch { setError(t('commonError')) } finally { setUploading(false) }
  }

  async function handleCropConfirm(croppedBase64: string) {
    try {
      setUploading(true); setError(null)
      const base64Data = croppedBase64.split(',')[1]
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'image/png' })
      const publicUrl = await uploadTrimmedPhoto(blob)
      if (form.photo_url && !form.photo_url.startsWith('data:')) {
        try { await deletePhoto(form.photo_url) } catch { /* ignore */ }
      }
      const updatedForm = { ...form, photo_url: publicUrl }
      setForm(updatedForm)
      setPendingCropImage(publicUrl)
      setShowCrop(false)
      if (garment) { await updateGarment(garment.id, updatedForm) }
    } catch { setError(t('commonError')) } finally { setUploading(false) }
  }

  function handleCropCancel() {
    setShowCrop(false)
  }

  async function handleRemoveBg() {
    const imageToSend = pendingCropImage || form.photo_url
    if (!imageToSend) return
    try {
      setRemovingBg(true); setError(null)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY as string

      const isBase64 = imageToSend.startsWith('data:')
      const body = isBase64 ? { imageBase64: imageToSend } : { imageUrl: imageToSend }

      const resp = await fetch(`${supabaseUrl}/functions/v1/photoroom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}))
        throw new Error(errBody.error || `HTTP ${resp.status}`)
      }
      const blob = await resp.blob()
      if (!blob || blob.size === 0) throw new Error('No image returned')
      const bitmap = await createImageBitmap(blob)
      const checkCanvas = document.createElement('canvas')
      checkCanvas.width = 64
      checkCanvas.height = 64
      const checkContext = checkCanvas.getContext('2d', { willReadFrequently: true })
      if (!checkContext) throw new Error('Transparency verification unavailable')
      checkContext.drawImage(bitmap, 0, 0, 64, 64)
      bitmap.close()
      const pixels = checkContext.getImageData(0, 0, 64, 64).data
      const hasTransparency = Array.from({ length: 64 * 64 }, (_, index) => pixels[index * 4 + 3]).some((alpha) => alpha < 255)
      if (!hasTransparency) throw new Error('The returned image has no transparent pixels')

      const publicUrl = await uploadTrimmedPhoto(blob)

      // Delete old photo if it existed
      if (form.photo_url) { try { await deletePhoto(form.photo_url) } catch { /* ignore */ } }

      setForm((f) => ({ ...f, photo_url: publicUrl }))
      setPendingCropImage(publicUrl)
      setBackgroundRemoved(true)
      setShowBgConfirmation(true)
      console.info('[Ma Garde-Robe] Fond supprimé: PNG avec pixels transparents vérifié.')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('commonError'))
    } finally { setRemovingBg(false) }
  }

  async function handleEditTransformSave() {
    const img = editImgRef.current
    if (!img || !form.photo_url) return
    try {
      setUploading(true); setError(null)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      if (editRotation % 360 !== 0) ctx.rotate((editRotation * Math.PI) / 180)
      if (editFlipped) ctx.scale(-1, 1)
      ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2)
      ctx.restore()
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Failed to export image')
      const { data: sd2 } = await supabase.auth.getSession()
      const uid2 = sd2?.session?.user?.id || 'anonymous'
      const filename = `${uid2}/${Date.now()}-edited.png`
      const { error: upErr } = await supabase.storage.from('garments').upload(filename, blob, { contentType: 'image/png' })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('garments').getPublicUrl(filename)
      try { await deletePhoto(form.photo_url) } catch { /* ignore */ }
      const updatedForm = { ...form, photo_url: data.publicUrl }
      setForm(updatedForm)
      setPendingCropImage(data.publicUrl)
      setEditRotation(0)
      setEditFlipped(false)
      setEditTransform(false)
      if (garment) { await updateGarment(garment.id, updatedForm) }
    } catch { setError(t('commonError')) } finally { setUploading(false) }
  }

  async function handleRemovePhoto() {
    if (form.photo_url) { try { await deletePhoto(form.photo_url) } catch { /* ignore */ } }
    setForm((f) => ({ ...f, photo_url: '' }))
  }

  function toggleStyle(s: GarmentStyle) {
    setForm((f) => ({ ...f, styles: f.styles.includes(s) ? f.styles.filter((x) => x !== s) : [...f.styles, s] }))
  }

  function pickSuggestion(item: DictEntry) {
    setForm((f) => ({ ...f, name: localize(item, locale) }))
    setShowSuggestions(false)
    nameInputRef.current?.blur()
  }

  function handleColorPrimaryChange(val: string) {
    setForm({ ...form, color_primary: val })
  }
  function handleColorSecondaryChange(val: string) {
    setForm({ ...form, color_secondary: val })
  }

  function handleSizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, size: e.target.value.toUpperCase() })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('formRequired')); return }
    try {
      setSaving(true); setError(null)
      if (garment) { await updateGarment(garment.id, form) } else { await createGarment(form) }
      onSaved()
    } catch { setError(t('commonError')) } finally { setSaving(false) }
  }

  const sortedColors = useMemo(() => sortDictionaryByLocale(colorDictionary, locale), [locale])
  const sortedMaterials = useMemo(() => sortDictionaryByLocale(materialDictionary, locale), [locale])

  const nameMatchesCategory = useMemo(() => {
    if (!form.name.trim()) return true
    return categoryItems.some((item) => localize(item, locale).toLowerCase() === form.name.toLowerCase())
  }, [form.name, categoryItems, locale])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center glass-overlay" {...overlayProps}>
      <div className="glass-sheet w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-4xl sm:rounded-3xl animate-slide-up sm:animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--tc-20)' }} />
        </div>

        <div className="sticky top-0 glass-sheet px-5 py-3 flex items-center justify-between z-10" style={{ borderBottom: '1px solid var(--line)' }}>
          <h2 className="text-lg title-display" style={{ color: 'var(--tc)' }}>
            {garment ? t('formEdit') : t('formNew')}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90" style={{ background: 'var(--tc-07)', color: 'var(--tc-45)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Photo */}
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            {form.photo_url ? (
              <div className="space-y-2">
                <div className="relative aspect-[3/4] max-h-48 rounded-2xl overflow-hidden" style={{ background: 'var(--tc-04)' }}>
                  <img ref={editImgRef} src={form.photo_url} alt="" className="w-full h-full object-contain pointer-events-none" style={editTransform ? { transform: `rotate(${editRotation}deg) scaleX(${editFlipped ? -1 : 1})` } : undefined} crossOrigin="anonymous" />
                  {uploading && <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(15,5,10,0.4)' }}><div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" /></div>}
                  <button type="button" onClick={handleRemovePhoto} className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-sm" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--tc)' }}><path d="M6 6l12 12M6 18L18 6" /></svg>
                  </button>
                </div>
                {backgroundRemoved && showBgConfirmation && (
                  <div className="rounded-lg px-3 py-2 text-[11px] font-sans font-semibold text-center" style={{ background: 'rgba(31,120,82,0.95)', color: '#fff' }}>
                    Fond supprimé — PNG transparent vérifié
                  </div>
                )}
                {editTransform ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setEditRotation((r) => (r + 90) % 360)}
                      className="py-2.5 rounded-lg text-xs font-sans font-semibold transition-transform active:scale-95"
                      style={{ background: 'var(--tc-07)', color: 'var(--tc)' }}>
                      {t('formRotate')}
                    </button>
                    <button type="button" onClick={() => setEditFlipped((f) => !f)}
                      className="py-2.5 rounded-lg text-xs font-sans font-semibold transition-transform active:scale-95"
                      style={{ background: 'var(--tc-07)', color: 'var(--tc)' }}>
                      {t('formMirror')}
                    </button>
                    <button type="button" onClick={handleEditTransformSave} disabled={uploading}
                      className="py-2.5 rounded-lg text-xs font-sans font-semibold transition-transform active:scale-95 disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                      {uploading ? t('commonLoading') : t('formSavePhoto')}
                    </button>
                    <button type="button" onClick={() => { setEditTransform(false); setEditRotation(0); setEditFlipped(false) }}
                      className="py-2.5 rounded-lg text-xs font-sans font-semibold transition-transform active:scale-95"
                      style={{ background: 'var(--tc-07)', color: 'var(--tc)' }}>
                      {t('formCancel')}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => { setBackgroundRemoved(false); setPendingCropImage(form.photo_url); setShowCrop(true) }}
                      className="py-2.5 rounded-lg text-xs font-sans font-semibold transition-transform active:scale-95"
                      style={{ background: 'var(--tc-07)', color: 'var(--tc)' }}>
                      {t('formCrop')}
                    </button>
                    <button type="button" onClick={() => setEditTransform(true)}
                      className="py-2.5 rounded-lg text-xs font-sans font-semibold transition-transform active:scale-95"
                      style={{ background: 'var(--tc-07)', color: 'var(--tc)' }}>
                      {t('formRotate')} / {t('formMirror')}
                    </button>
                    <button type="button" onClick={handleRemoveBg} disabled={removingBg}
                      className="py-2.5 rounded-lg text-xs font-sans font-semibold transition-transform active:scale-95 disabled:opacity-50"
                      style={{ background: 'var(--tc-07)', color: 'var(--tc)' }}>
                      {removingBg ? t('formRemovingBg') : t('formRemoveBg')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full aspect-[3/1] rounded-2xl flex flex-col items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                style={{ border: '2px dashed var(--tc-20)', color: 'var(--tc-30)' }}>
                {uploading ? (
                  <><div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--tc-20)', borderTopColor: 'var(--tc)' }} /><span className="text-xs font-sans">{t('formUploading')}</span></>
                ) : (
                  <><svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M4 16l4-4 4 4 8-8M20 8v8h-8" /></svg><span className="text-xs font-sans">{t('formPhotoHint')}</span></>
                )}
              </button>
            )}
          </div>

          {/* Wear summary — compact line at top, clickable to scroll to history */}
          {garment && (
            <button
              type="button"
              ref={wearLogRef}
              onClick={() => setShowWearLog(true)}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl transition-all duration-200"
              style={{ background: 'var(--tc-04)', border: '1px solid var(--line)' }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tc-45)' }}>
                <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              <span className="text-xs font-sans font-medium" style={{ color: wearLogs.length > 0 ? 'var(--tc)' : 'var(--tc-30)' }}>
                {formatWearSummary(wearLogs.length, wearLogs.length > 0 ? wearLogs[0].worn_date : null, locale)}
              </span>
            </button>
          )}

          {/* Category selector — wrap layout */}
          <div>
            <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formCategory')}</label>
            <div className="flex gap-2 flex-wrap">
              {clothingDictionary.map((cat) => {
                const isActive = form.category === cat.key
                return (
                  <button key={cat.key} type="button"
                    onClick={() => setForm({ ...form, category: cat.key as Category })}
                    className={`pill ${isActive ? 'pill-active' : 'pill-idle'}`}>
                    {localize(cat.label, locale)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Name with suggestions */}
          <div className="relative">
            <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formName')}</label>
            <input
              ref={nameInputRef}
              className="input-field"
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={t('formNamePlaceholder')}
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 py-1 rounded-xl animate-scale-in shadow-lg z-20 overflow-hidden max-h-60 overflow-y-auto" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line)' }}>
                {filteredSuggestions.map((item, i) => {
                  const isSelected = localize(item, locale).toLowerCase() === form.name.toLowerCase()
                  return (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); pickSuggestion(item) }}
                      className="w-full text-left px-4 py-2.5 transition-all duration-150"
                      style={{
                        color: 'var(--tc)',
                        background: isSelected ? 'var(--tc-07)' : 'transparent',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      <span className="text-sm font-sans">{localize(item, locale)}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {!nameMatchesCategory && form.name.trim() && !showSuggestions && (
              <p className="text-[10px] font-sans mt-1" style={{ color: 'var(--danger)' }}>
                {locale === 'fr' ? 'Ce nom ne correspond pas à la catégorie sélectionnée' : locale === 'en' ? 'This name does not match the selected category' : 'هذا الاسم لا يطابق الفئة المحددة'}
              </p>
            )}
          </div>

          {/* Size — majuscules auto + suggestions rapides */}
          <div>
            <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formSize')}</label>
            <input className="input-field" value={form.size} onChange={handleSizeChange} placeholder={t('profileSizePlaceholder')} />
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {sizeDictionary.map((s, i) => (
                <button key={i} type="button" onClick={() => setForm({ ...form, size: localize(s, locale) })}
                  className="px-2.5 py-1 rounded-lg text-xs font-sans font-medium transition-all duration-150"
                  style={form.size === localize(s, locale)
                    ? { background: 'var(--tc)', color: '#fff' }
                    : { background: 'var(--tc-07)', color: 'var(--tc-45)' }}>
                  {localize(s, locale)}
                </button>
              ))}
            </div>
          </div>

          {/* Material */}
          <div>
            <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{locale === 'fr' ? 'Matière' : locale === 'en' ? 'Material' : 'الخامة'}</label>
            <Dropdown
              value={form.material}
              options={sortedMaterials.map((m) => ({ value: m.en, label: localize(m, locale) }))}
              onChange={(val) => setForm({ ...form, material: val })}
            />
          </div>

          {/* Colors — sorted alphabetically, stored as English keys */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formColorPrimary')}</label>
              <Dropdown
                value={form.color_primary}
                options={sortedColors.map((c) => ({ value: c.en, label: localize(c, locale) }))}
                onChange={handleColorPrimaryChange}
              />
            </div>
            <div>
              <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formColorSecondary')}</label>
              <Dropdown
                value={form.color_secondary}
                options={sortedColors.map((c) => ({ value: c.en, label: localize(c, locale) }))}
                onChange={handleColorSecondaryChange}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formStatus')}</label>
            <div className="flex gap-2 flex-wrap">
              {ALL_STATUSES.map((s) => {
                const isActive = form.status === s
                return (
                  <button key={s} type="button"
                    onClick={() => setForm({ ...form, status: s })}
                    className={`pill flex items-center gap-1.5 ${isActive ? 'pill-active' : 'pill-idle'}`}>
                    <StatusIcon status={s} className="w-3.5 h-3.5" />
                    {statusLabel(s)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Season */}
          <div>
            <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formSeason')}</label>
            <Dropdown
              value={form.season}
              options={ALL_SEASONS.map((s) => ({ value: s, label: seasonLabel(s) }))}
              onChange={(val) => setForm({ ...form, season: val as Season })}
            />
          </div>

          {/* Styles */}
          <div>
            <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formStyles')}</label>
            <div className="flex flex-wrap gap-2">
              {ALL_STYLES.map((s) => {
                const active = form.styles.includes(s)
                return (
                  <button key={s} type="button" onClick={() => toggleStyle(s)}
                    className={`pill ${active ? 'pill-active' : 'pill-idle'}`}>
                    {styleLabel(s)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Brand */}
          <div>
            <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formBrand')} <span style={{ color: 'var(--tc-30)' }}>({t('commonOptional')})</span></label>
            <input className="input-field" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formNotes')} <span style={{ color: 'var(--tc-30)' }}>({t('commonOptional')})</span></label>
            <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          {/* Advanced details — collapsible */}
          <div>
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
                {/* Modesty */}
                <div>
                  <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formModesty')} <span style={{ color: 'var(--tc-30)' }}>({t('commonOptional')})</span></label>
                  <div className="flex gap-2 flex-wrap">
                    {(['full_coverage', 'moderate', 'revealing'] as Modesty[]).map((m) => (
                      <button key={m} type="button"
                        onClick={() => setForm({ ...form, modesty: form.modesty === m ? null : m })}
                        className={`pill ${form.modesty === m ? 'pill-active' : 'pill-idle'}`}>
                        {t('modesty' + m.charAt(0).toUpperCase() + m.slice(1))}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Formality */}
                <div>
                  <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formFormality')} <span style={{ color: 'var(--tc-30)' }}>({t('commonOptional')})</span></label>
                  <Dropdown
                    value={form.formality || ''}
                    options={[{ value: '', label: t('commonNone') }, ...(['very_casual', 'casual', 'smart_casual', 'business', 'evening', 'ceremonial'] as Formality[]).map((f) => ({ value: f, label: t('formality' + f.charAt(0).toUpperCase() + f.slice(1)) }))]}
                    onChange={(val) => setForm({ ...form, formality: (val || null) as Formality | null })}
                  />
                </div>
                {/* Pattern */}
                <div>
                  <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formPattern')}</label>
                  <Dropdown
                    value={form.pattern}
                    options={(['solid', 'striped', 'floral', 'geometric', 'polka_dot', 'animal_print', 'embroidered', 'sequined', 'abstract', 'plaid'] as Pattern[]).map((p) => ({ value: p, label: t('pattern' + p.charAt(0).toUpperCase() + p.slice(1)) }))}
                    onChange={(val) => setForm({ ...form, pattern: val as Pattern })}
                  />
                </div>
                {/* Metallic */}
                <div>
                  <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: 'var(--tc-45)' }}>{t('formMetallic')}</label>
                  <div className="flex gap-2 flex-wrap">
                    {(['none', 'gold', 'silver', 'mixed'] as Metallic[]).map((m) => (
                      <button key={m} type="button"
                        onClick={() => setForm({ ...form, metallic: m })}
                        className={`pill ${form.metallic === m ? 'pill-active' : 'pill-idle'}`}>
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
                      const active = form.occasion_tags?.includes(o)
                      return (
                        <button key={o} type="button"
                          onClick={() => setForm({ ...form, occasion_tags: active ? (form.occasion_tags || []).filter((x) => x !== o) : [...(form.occasion_tags || []), o] })}
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
                    value={form.purchase_price ?? ''}
                    onChange={(e) => setForm({ ...form, purchase_price: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    placeholder={t('formPurchasePricePlaceholder')}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Favorite */}
          <button type="button" onClick={() => setForm({ ...form, favorite: !form.favorite })}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-200"
            style={form.favorite ? { background: 'var(--tc-07)', borderColor: 'var(--tc-30)', color: 'var(--tc)' } : { background: 'rgba(255,255,255,0.8)', borderColor: 'var(--tc-10)', color: 'var(--tc-30)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill={form.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
              <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6 5c2 0 3.5 1 4 2.5h2C12.5 6 14 5 16 5c3.5 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z" />
            </svg>
            <span className="text-sm font-sans font-medium">{t('formFavorite')}</span>
          </button>

          {/* Wear log button — only in edit mode */}
          {garment && (
            <button type="button" onClick={() => setShowWearLog(true)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200"
              style={{ background: 'var(--tc-04)', borderColor: 'var(--tc-10)', color: 'var(--tc)' }}>
              <span className="flex items-center gap-2 text-sm font-sans font-medium">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                {t('wearLogWorn')}
              </span>
              {wearLogs.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-bold" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                  {wearLogs.length}× {t('wearLogTimes')}
                </span>
              ) : (
                <span className="text-[10px] font-sans" style={{ color: 'var(--tc-30)' }}>{t('wearLogEmpty')}</span>
              )}
            </button>
          )}

          {error && <p className="text-sm font-sans" style={{ color: 'var(--danger)' }}>{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-outline py-3">{t('formCancel')}</button>
            <button type="submit" disabled={saving} className="flex-1 btn-gold disabled:opacity-50">{saving ? t('formSave') : t('formSave')}</button>
          </div>
        </form>
      </div>
      {showCrop && pendingCropImage && (
        <PhotoEditorModal
          imageSrc={pendingCropImage}
          cropAspectRatio={photoCropAspectRatio}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
      {showWearLog && garment && (
        <WearLogModal
          garmentId={garment.id}
          onClose={() => setShowWearLog(false)}
          onLogged={() => { fetchWearLogsForGarment(garment.id).then(setWearLogs).catch(() => {}) }}
        />
      )}
    </div>
  )
}
