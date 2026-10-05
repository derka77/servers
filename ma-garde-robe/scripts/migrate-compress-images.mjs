import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://psmpowcarlzvdnffqgeq.supabase.co'
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!ANON_KEY) {
  console.error('Missing VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
})

const MAX_DIMENSION = 1024
const QUALITY = 82

async function migrate() {
  const { data: files, error } = await supabase.storage
    .from('garments')
    .list('', { limit: 1000 })

  if (error) throw error
  if (!files || files.length === 0) {
    console.log('No files found.')
    return
  }

  let totalOriginal = 0
  let totalCompressed = 0
  let migrated = 0
  let transparencyChecked = 0

  for (const file of files) {
    const name = file.name
    const originalSize = file.metadata?.size || 0
    totalOriginal += originalSize

    try {
      const publicUrl = supabase.storage.from('garments').getPublicUrl(name).data.publicUrl
      const resp = await fetch(publicUrl)
      if (!resp.ok) {
        console.log(`SKIP ${name} (download failed: ${resp.status})`)
        continue
      }
      const buf = Buffer.from(await resp.arrayBuffer())

      const metadata = await sharp(buf).metadata()
      const hasAlpha = metadata.hasAlpha || metadata.channels === 4

      let processed
      if (hasAlpha) {
        processed = await sharp(buf)
          .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: QUALITY, alphaQuality: 90 })
          .toBuffer()
      } else {
        processed = await sharp(buf)
          .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: QUALITY })
          .toBuffer()
      }

      const compressedSize = processed.length
      totalCompressed += compressedSize

      const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1)
      console.log(`${name}: ${(originalSize / 1024).toFixed(1)} Ko -> ${(compressedSize / 1024).toFixed(1)} Ko (-${ratio}%) alpha=${hasAlpha}`)

      const { error: upErr } = await supabase.storage
        .from('garments')
        .upload(name, processed, {
          contentType: 'image/webp',
          upsert: true,
        })

      if (upErr) {
        console.log(`  UPLOAD ERROR: ${upErr.message}`)
        continue
      }

      migrated++

      if (hasAlpha && transparencyChecked < 2) {
        const checkMeta = await sharp(processed).metadata()
        const stillHasAlpha = checkMeta.hasAlpha || checkMeta.channels === 4
        console.log(`  Transparency preserved: ${stillHasAlpha}`)
        transparencyChecked++
      }
    } catch (e) {
      console.log(`ERROR ${name}: ${e.message}`)
    }
  }

  console.log('\n=== SUMMARY ===')
  console.log(`Files migrated: ${migrated}/${files.length}`)
  console.log(`Total original: ${(totalOriginal / 1024 / 1024).toFixed(2)} Mo`)
  console.log(`Total compressed: ${(totalCompressed / 1024 / 1024).toFixed(2)} Mo`)
  console.log(`Average before: ${(totalOriginal / files.length / 1024).toFixed(1)} Ko`)
  console.log(`Average after: ${(totalCompressed / files.length / 1024).toFixed(1)} Ko`)
  console.log(`Reduction: ${((1 - totalCompressed / totalOriginal) * 100).toFixed(1)}%`)
}

migrate().catch((e) => {
  console.error('Migration failed:', e)
  process.exit(1)
})
