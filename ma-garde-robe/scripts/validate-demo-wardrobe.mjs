import { buildDemoGarments, getStaticDemoCount, getDemoPieceBreakdown } from '../src/lib/demoWardrobe.ts'

const pieces = await buildDemoGarments()
console.log(`Total pieces: ${pieces.length}`)
console.log(`Static (without fetch): ${getStaticDemoCount()}\n`)

const breakdown = getDemoPieceBreakdown()
console.log('=== BY CATEGORY (static only) ===')
for (const [cat, count] of Object.entries(breakdown.byCategory).sort()) {
  console.log(`  ${cat}: ${count}`)
}
console.log(`  TOTAL: ${Object.values(breakdown.byCategory).reduce((a, b) => a + b, 0)}`)

console.log('\n=== BY COLOR FAMILY (static only) ===')
for (const [family, count] of Object.entries(breakdown.byColorFamily).sort()) {
  console.log(`  ${family}: ${count}`)
}
console.log(`  TOTAL: ${Object.values(breakdown.byColorFamily).reduce((a, b) => a + b, 0)}`)

console.log('\n=== BY STATUS ===')
const byStatus = {}
for (const p of pieces) {
  byStatus[p.status] = (byStatus[p.status] || 0) + 1
}
for (const [s, c] of Object.entries(byStatus)) {
  console.log(`  ${s}: ${c}`)
}

console.log('\n=== SLOT COVERAGE CHECK ===')
const cats = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'traditional']
for (const cat of cats) {
  const found = pieces.filter((p) => p.category === cat)
  console.log(`  ${cat}: ${found.length > 0 ? 'YES (' + found.length + ' pieces)' : 'NO'}`)
}

console.log('\n=== REAL PHOTOS vs SVG ===')
const withPhotos = pieces.filter((p) => p.photo_url && !p.photo_url.startsWith('data:image/svg+xml'))
const withSVG = pieces.filter((p) => p.photo_url && p.photo_url.startsWith('data:image/svg+xml'))
console.log(`  Real photos: ${withPhotos.length}`)
console.log(`  SVG fallback: ${withSVG.length}`)

console.log('\n=== TRADITIONAL ===')
const trad = pieces.filter((p) => p.category === 'traditional')
for (const p of trad) {
  console.log(`  ${p.name} — ${p.color_primary}`)
}

console.log('\n=== TARGET CHECK ===')
console.log(`  Static target: 87 (20 real + 67 SVG) — got: ${getStaticDemoCount()}`)
console.log(`  Total target: 100 (87 + 13 API) — got: ${pieces.length}`)

console.log('\n=== ENCODEURI CHECK (apostrophe URLs) ===')
const apostropheUrls = withPhotos.filter((p) => p.photo_url.includes('%27') || p.photo_url.includes("'"))
for (const p of apostropheUrls) {
  console.log(`  ${p.name}: ${p.photo_url.substring(0, 80)}...`)
}
