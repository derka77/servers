export type Category =
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'outerwear'
  | 'shoes'
  | 'accessories'
  | 'bags'
  | 'traditional'

export type Season = 'all' | 'spring' | 'summer' | 'autumn' | 'winter'

export type GarmentStyle =
  | 'casual'
  | 'formal'
  | 'sport'
  | 'streetwear'
  | 'classic'
  | 'bohemian'
  | 'minimalist'
  | 'luxury'

export type GarmentStatus = 'available' | 'needs_ironing' | 'at_cleaning' | 'in_alteration'

export type Modesty = 'full_coverage' | 'moderate' | 'revealing'

export type Formality = 'very_casual' | 'casual' | 'smart_casual' | 'business' | 'evening' | 'ceremonial'

export type Pattern = 'solid' | 'striped' | 'floral' | 'geometric' | 'polka_dot' | 'animal_print' | 'embroidered' | 'sequined' | 'abstract' | 'plaid'

export type Metallic = 'none' | 'gold' | 'silver' | 'mixed'

export type Occasion =
  | 'everyday'
  | 'work'
  | 'brunch'
  | 'evening_out'
  | 'wedding_guest'
  | 'henna_party'
  | 'eid'
  | 'ramadan_gathering'
  | 'majlis'
  | 'beach'
  | 'travel'
  | 'sport'

export interface Garment {
  id: string
  name: string
  description: string
  category: Category
  size: string
  color_primary: string
  color_secondary: string
  styles: GarmentStyle[]
  season: Season
  brand: string
  notes: string
  favorite: boolean
  photo_url: string
  material: string
  status: GarmentStatus
  wardrobe: 'personal' | 'demo'
  is_demo: boolean
  is_draft: boolean
  modesty: Modesty | null
  formality: Formality | null
  pattern: Pattern
  metallic: Metallic
  occasion_tags: Occasion[]
  purchase_price: number | null
  created_at: string
  updated_at: string
}

export interface Outfit {
  id: string
  name: string
  theme: string
  garment_ids: string[]
  notes: string
  created_at: string
}

export interface WearLogEntry {
  id: string
  garment_id: string | null
  outfit_id: string | null
  worn_date: string
  occasion: Occasion | null
  event_name: string
  circle: string
  note: string
  created_at: string
}

export type NewWearLog = Omit<WearLogEntry, 'id' | 'created_at'>

export interface Profile {
  id: number
  current_size: string
  current_shoe_size: string
  height_cm: string
  weight_kg: string
  bust_cm: string
  waist_cm: string
  hip_cm: string
  shoulder_cm: string
  inseam_cm: string
  avatar_url: string
  avatar_optimized_url: string
  display_mode: 'simplified' | 'complete'
  updated_at: string
}

export interface SizeHistoryEntry {
  id: string
  size: string
  shoe_size: string
  changed_at: string
}

export type NewGarment = Omit<Garment, 'id' | 'created_at' | 'updated_at' | 'wardrobe' | 'is_demo' | 'is_draft'> & { wardrobe?: 'personal' | 'demo'; is_demo?: boolean; is_draft?: boolean }
export type GarmentUpdate = Partial<Omit<NewGarment, 'id' | 'created_at' | 'updated_at'>>

export type WardrobeMode = 'personal' | 'demo'

export type EventStatus = 'upcoming' | 'past' | 'worn'

export interface EventItem {
  id: string
  name: string
  date: string
  occasion: Occasion | null
  circle: string
  outfit_id: string | null
  status: EventStatus
  note: string
  created_at: string
  updated_at: string
}

export type NewEvent = Omit<EventItem, 'id' | 'created_at' | 'updated_at'>
