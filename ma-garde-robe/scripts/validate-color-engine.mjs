import { pairScore, outfitScore } from '../src/lib/outfitEngine.ts'

const tests = [
  {
    name: 'a. Bordeaux + Green (complémentaire désaturée)',
    pieces: [
      { color: 'Burgundy', role: 'main', slot: 'top' },
      { color: 'Green', role: 'main', slot: 'bottom' },
    ],
    expected: '~82 (accepté)',
  },
  {
    name: 'b. Red + Green (complémentaire saturée)',
    pieces: [
      { color: 'Red', role: 'main', slot: 'top' },
      { color: 'Green', role: 'main', slot: 'bottom' },
    ],
    expected: '30 (rejeté via override)',
  },
  {
    name: 'c. White + Navy blue + Camel (neutres classiques)',
    pieces: [
      { color: 'White', role: 'main', slot: 'top' },
      { color: 'Navy blue', role: 'main', slot: 'bottom' },
      { color: 'Camel', role: 'accessory', slot: 'bag' },
    ],
    expected: '≥ 90',
  },
  {
    name: 'd. Light blue + Blush pink + Grey (pastels doux)',
    pieces: [
      { color: 'Light blue', role: 'main', slot: 'top' },
      { color: 'Blush pink', role: 'main', slot: 'bottom' },
      { color: 'Grey', role: 'accessory', slot: 'bag' },
    ],
    expected: '≥ 80',
  },
  {
    name: 'e. Orange + Pink + Purple (3 vifs sans relation)',
    pieces: [
      { color: 'Orange', role: 'main', slot: 'top' },
      { color: 'Pink', role: 'main', slot: 'bottom' },
      { color: 'Purple', role: 'main', slot: 'outerwear' },
    ],
    expected: '< 50',
  },
]

console.log('=== VALIDATION DES 5 TENUES ===\n')
for (const t of tests) {
  const result = outfitScore(t.pieces)
  console.log(`${t.name}`)
  console.log(`  Score: ${result.score}/100 | Rating: ${result.rating} | Advice: ${result.advice || 'none'}`)
  console.log(`  Attendu: ${t.expected}`)
  console.log()
}
