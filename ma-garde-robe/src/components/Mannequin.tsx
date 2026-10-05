/**
 * Croquis de mannequin (silhouette féminine, vue de face).
 * viewBox 200×400 — la scène du studio est au même ratio 1:2, ce qui permet
 * d'aligner les zones de vêtements (index.css, .studio-piece-*) sur l'anatomie :
 *   épaules y≈80 (20 %) · taille y≈165 (41 %) · hanches y≈222 (55 %)
 *   genoux y≈300 (75 %) · chevilles y≈378 (94 %) · mains y≈250 (63 %)
 */
export default function Mannequin({ className }: { className?: string }) {
  return (
    <div className={`studio-mannequin ${className || ''}`} aria-hidden="true" style={{ color: 'var(--tc)' }}>
      <svg viewBox="0 0 200 400" fill="none" preserveAspectRatio="xMidYMax meet">
        {/* Ombre au sol */}
        <ellipse cx="100" cy="393" rx="50" ry="4" fill="currentColor" opacity="0.07" />

        <g fill="currentColor" opacity="0.09">
          {/* Tête */}
          <ellipse cx="100" cy="25" rx="15" ry="19" />
          {/* Cou */}
          <path d="M93 42 Q100 47 107 42 L109 60 L91 60 Z" />
          {/* Torse (épaules 60→140, taille 70→130, hanches 58→142) */}
          <path d="M91 60 C78 62 66 68 62 80 C60 100 64 135 70 165 C72 172 71 178 68 185 C62 200 57 210 58 222 C62 234 80 240 100 240 C120 240 138 234 142 222 C143 210 138 200 132 185 C129 178 128 172 130 165 C136 135 140 100 138 80 C134 68 122 62 109 60 Z" />
          {/* Jambe gauche */}
          <path d="M58 222 C54 255 60 282 66 300 C71 326 73 354 75 378 L73 392 L90 392 L90 378 C90 352 92 326 91 300 C91 278 96 252 100 240 C80 240 62 234 58 222 Z" />
          {/* Jambe droite */}
          <path d="M142 222 C146 255 140 282 134 300 C129 326 127 354 125 378 L127 392 L110 392 L110 378 C110 352 108 326 109 300 C109 278 104 252 100 240 C120 240 138 234 142 222 Z" />
          {/* Bras gauche (légèrement écarté du corps) */}
          <path d="M62 80 C52 94 46 128 43 165 C41 192 39 220 37 244 L47 246 C50 220 53 192 55 165 C57 138 61 112 66 100 C64 92 63 86 62 80 Z" />
          <ellipse cx="42" cy="252" rx="5.5" ry="8" />
          {/* Bras droit */}
          <path d="M138 80 C148 94 154 128 157 165 C159 192 161 220 163 244 L153 246 C150 220 147 192 145 165 C143 138 139 112 134 100 C136 92 137 86 138 80 Z" />
          <ellipse cx="158" cy="252" rx="5.5" ry="8" />
        </g>
      </svg>
    </div>
  )
}
