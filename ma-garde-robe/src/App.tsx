import { useState, useEffect } from 'react'
import { useI18n } from './i18n/I18nContext'
import { useAuth } from './auth/AuthContext'
import { fetchGarments, fetchAllGarments, fetchOutfits, fetchProfile, fetchEvents, linkOutfitToEvent, claimOrphanedData } from './lib/api'
import type { Garment, Outfit, Profile, Category, GarmentStatus, WardrobeMode, EventItem, Occasion } from './types'
import Home from './screens/Home'
import Wardrobe from './screens/Wardrobe'
import Stylist from './screens/Stylist'
import ProfileScreen from './screens/Profile'
import BottomNav from './components/BottomNav'
import TopBar from './components/TopBar'
import GarmentFormModal from './components/GarmentFormModal'
import BatchUploadModal from './components/BatchUploadModal'
import DraftCompletionFlow from './components/DraftCompletionFlow'
import EventsScreen from './screens/Events'
import AuthScreen from './screens/Auth'

export type Tab = 'home' | 'wardrobe' | 'stylist' | 'events' | 'profile'

export default function App() {
  const { t } = useI18n()
  const { session, loading: authLoading, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('wardrobe')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [tab])
  const [garments, setGarments] = useState<Garment[]>([])
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingGarment, setEditingGarment] = useState<Garment | null>(null)
  const [wardrobeFilter, setWardrobeFilter] = useState<{ cat: Category | 'all'; status: GarmentStatus | 'all' | 'unavailable' } | null>(null)
  const [wardrobeMode, setWardrobeMode] = useState<WardrobeMode>('personal')
  const [batchOpen, setBatchOpen] = useState(false)
  const [draftFlowOpen, setDraftFlowOpen] = useState(false)
  const [events, setEvents] = useState<EventItem[]>([])
  const [eventContext, setEventContext] = useState<{ eventId: string; occasion: Occasion; circle: string } | null>(null)
  const [dataClaimed, setDataClaimed] = useState(false)

  async function loadData() {
    if (!session) return
    try {
      setError(null)
      const [g, o, p, ev] = await Promise.all([
        wardrobeMode === 'demo' ? fetchAllGarments() : fetchGarments('personal'),
        fetchOutfits(),
        fetchProfile(),
        fetchEvents(),
      ])
      setGarments(g)
      setOutfits(o)
      setProfile(p)
      setEvents(ev)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  // Claim orphaned data on first login
  useEffect(() => {
    if (session && !dataClaimed) {
      claimOrphanedData().then(() => {
        setDataClaimed(true)
        loadData()
      }).catch(() => {
        setDataClaimed(true)
        loadData()
      })
    }
    if (!session) {
      setLoading(true)
      setDataClaimed(false)
    }
  }, [session])

  useEffect(() => {
    if (session && dataClaimed) loadData()
  }, [wardrobeMode, session, dataClaimed])

  function openAddForm() {
    setEditingGarment(null)
    setFormOpen(true)
  }

  function openEditForm(g: Garment) {
    setEditingGarment(g)
    setFormOpen(true)
  }

  function handleFormSaved() {
    setFormOpen(false)
    setEditingGarment(null)
    loadData()
  }

  // Auth gate
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--tc-20)', borderTopColor: 'var(--tc)' }} />
          <p className="text-sm font-sans" style={{ color: 'var(--tc-45)' }}>{t('commonLoading')}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--tc-20)', borderTopColor: 'var(--tc)' }} />
          <p className="text-sm font-sans" style={{ color: 'var(--tc-45)' }}>{t('commonLoading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="mb-4 font-sans" style={{ color: 'var(--tc)' }}>{t('commonError')}</p>
          <button onClick={loadData} className="btn-gold px-6 py-3">
            {t('commonRetry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28">
      <TopBar />
      {wardrobeMode === 'demo' && (
        <div className="px-5 py-1.5 text-center text-[10px] font-sans font-bold tracking-wide animate-fade-in"
          style={{ background: 'var(--ok)', color: '#fff' }}>
          {t('demoModeBadge')}
        </div>
      )}
      {tab === 'wardrobe' && (
        <>
          <Home garments={garments} outfits={outfits} profile={profile} events={events} onNavigate={setTab} onAdd={openAddForm} onEditItem={openEditForm}
            displayMode={profile?.display_mode || 'simplified'}
            onFilterWardrobe={(cat, status) => { setWardrobeFilter({ cat, status }); setTab('wardrobe') }}
            onPrepareEventOutfit={(ev) => { setEventContext({ eventId: ev.id, occasion: ev.occasion || 'everyday', circle: ev.circle }); setTab('stylist') }} />
          <Wardrobe garments={garments} onAdd={openAddForm} onBatchAdd={() => setBatchOpen(true)} onEdit={openEditForm} onRefresh={loadData}
            displayMode={profile?.display_mode || 'simplified'}
            onCompleteDrafts={() => setDraftFlowOpen(true)}
            initialCatFilter={wardrobeFilter?.cat} initialStatusFilter={wardrobeFilter?.status} />
        </>
      )}
      {tab === 'stylist' && (
        <Stylist garments={garments} outfits={outfits} profile={profile} onOutfitsChanged={loadData}
          displayMode={profile?.display_mode || 'simplified'}
          eventContext={eventContext}
          onOutfitSavedForEvent={(outfitId) => {
            if (eventContext) { linkOutfitToEvent(eventContext.eventId, outfitId).then(() => { loadData(); setEventContext(null) }).catch(() => {}) }
          }}
          onClearEventContext={() => setEventContext(null)} />
      )}
      {tab === 'events' && (
        <EventsScreen events={events} garments={garments} outfits={outfits} onRefresh={loadData}
          onPrepareOutfit={(ev) => { setEventContext({ eventId: ev.id, occasion: ev.occasion || 'everyday', circle: ev.circle }); setTab('stylist') }} />
      )}
      {tab === 'profile' && (
        <ProfileScreen profile={profile} garments={garments} outfits={outfits} onProfileChanged={loadData}
          wardrobeMode={wardrobeMode} onWardrobeModeChanged={setWardrobeMode} onGarmentsChanged={loadData}
          onNavigate={setTab} onSignOut={signOut} userEmail={session?.user?.email} />
      )}

      <BottomNav active={tab} onChange={setTab} />

      {formOpen && (
        <GarmentFormModal
          garment={editingGarment}
          displayMode={profile?.display_mode || 'simplified'}
          onClose={() => { setFormOpen(false); setEditingGarment(null); loadData() }}
          onSaved={handleFormSaved}
        />
      )}
      {batchOpen && (
        <BatchUploadModal
          onClose={() => setBatchOpen(false)}
          onComplete={() => { setBatchOpen(false); loadData() }}
        />
      )}
      {draftFlowOpen && (
        <DraftCompletionFlow
          drafts={garments.filter((g) => g.is_draft)}
          onClose={() => setDraftFlowOpen(false)}
          onComplete={() => loadData()}
          onGoToStylist={() => setTab('stylist')}
        />
      )}
    </div>
  )
}
