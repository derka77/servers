import { useState, useRef, useEffect } from 'react'
import { useOverlayClick } from '../lib/useOverlayClick'
import { useI18n } from '../i18n/I18nContext'

interface Props {
  imageSrc: string
  onCancel: () => void
  onConfirm: (croppedBase64: string) => void
  cropAspectRatio?: number
}

type Point = { x: number; y: number }
type Crop = { x: number; y: number; w: number; h: number }
type Corner = 'tl' | 'tr' | 'bl' | 'br'

export default function PhotoEditorModal({ imageSrc, onCancel, onConfirm, cropAspectRatio = 1 }: Props) {
  const { overlayProps } = useOverlayClick(onCancel)
  const { t } = useI18n()
  const imageRef = useRef<HTMLImageElement>(null)
  const outputRef = useRef<HTMLCanvasElement>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>({ x: 10, y: 10, w: 80, h: 80 })
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 })
  const [drag, setDrag] = useState<{ corner: Corner | 'move'; start: Point; original: Crop } | null>(null)
  const [rotation, setRotation] = useState(0)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    let revoke: string | null = null
    if (!imageSrc.startsWith('data:') && !imageSrc.startsWith('blob:')) {
      fetch(imageSrc)
        .then((r) => r.blob())
        .then((blob) => {
          revoke = URL.createObjectURL(blob)
          setBlobUrl(revoke)
        })
        .catch(() => setBlobUrl(imageSrc))
    }
    return () => { if (revoke) URL.revokeObjectURL(revoke) }
  }, [imageSrc])

  const displaySrc = blobUrl || imageSrc

  function handleImageLoad() {
    const image = imageRef.current
    if (!image) return
    const maxWidth = Math.min(image.parentElement?.clientWidth || 340, 420)
    const maxHeight = 360
    const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight)
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale
    setImageSize({ w: width, h: height })
    // Initial crop: covers most of the image, respects aspect ratio as a starting point
    const cropWidth = Math.min(width * 0.85, height * 0.85 * cropAspectRatio)
    const cropHeight = Math.min(cropWidth / cropAspectRatio, height * 0.85)
    const actualCropW = Math.min(cropWidth, width * 0.85)
    const actualCropH = Math.min(cropHeight, height * 0.85)
    setCrop({
      x: (width - actualCropW) / 2,
      y: (height - actualCropH) / 2,
      w: actualCropW,
      h: actualCropH,
    })
  }

  function getPoint(event: React.PointerEvent): Point {
    const rect = imageRef.current!.getBoundingClientRect()
    const scaleX = imageSize.w / rect.width
    const scaleY = imageSize.h / rect.height
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY }
  }

  function detectCorner(point: Point): Corner | 'move' | null {
    const handleDistance = 22
    const nearLeft = Math.abs(point.x - crop.x) < handleDistance
    const nearRight = Math.abs(point.x - (crop.x + crop.w)) < handleDistance
    const nearTop = Math.abs(point.y - crop.y) < handleDistance
    const nearBottom = Math.abs(point.y - (crop.y + crop.h)) < handleDistance
    if (nearLeft && nearTop) return 'tl'
    if (nearRight && nearTop) return 'tr'
    if (nearLeft && nearBottom) return 'bl'
    if (nearRight && nearBottom) return 'br'
    if (point.x >= crop.x && point.x <= crop.x + crop.w && point.y >= crop.y && point.y <= crop.y + crop.h) return 'move'
    return null
  }

  function handlePointerDown(event: React.PointerEvent) {
    const point = getPoint(event)
    const corner = detectCorner(point)
    if (!corner) return
    setDrag({ corner, start: point, original: crop })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!drag) return
    const point = getPoint(event)
    const dx = point.x - drag.start.x
    const dy = point.y - drag.start.y
    const o = drag.original
    const minSize = 40

    if (drag.corner === 'move') {
      setCrop({
        ...o,
        x: Math.max(0, Math.min(imageSize.w - o.w, o.x + dx)),
        y: Math.max(0, Math.min(imageSize.h - o.h, o.y + dy)),
      })
      return
    }

    // Free-form: each corner moves independently, opposite corner stays fixed
    if (drag.corner === 'tl') {
      const newX = Math.max(0, Math.min(o.x + o.w - minSize, o.x + dx))
      const newY = Math.max(0, Math.min(o.y + o.h - minSize, o.y + dy))
      setCrop({ x: newX, y: newY, w: o.x + o.w - newX, h: o.y + o.h - newY })
    } else if (drag.corner === 'tr') {
      const newW = Math.max(minSize, Math.min(imageSize.w - o.x, o.w + dx))
      const newY = Math.max(0, Math.min(o.y + o.h - minSize, o.y + dy))
      setCrop({ x: o.x, y: newY, w: newW, h: o.y + o.h - newY })
    } else if (drag.corner === 'bl') {
      const newX = Math.max(0, Math.min(o.x + o.w - minSize, o.x + dx))
      const newH = Math.max(minSize, Math.min(imageSize.h - o.y, o.h + dy))
      setCrop({ x: newX, y: o.y, w: o.x + o.w - newX, h: newH })
    } else if (drag.corner === 'br') {
      const newW = Math.max(minSize, Math.min(imageSize.w - o.x, o.w + dx))
      const newH = Math.max(minSize, Math.min(imageSize.h - o.y, o.h + dy))
      setCrop({ x: o.x, y: o.y, w: newW, h: newH })
    }
  }

  function handleConfirm() {
    const image = imageRef.current
    const canvas = outputRef.current
    if (!image || !canvas || !imageSize.w || !imageSize.h) return

    const scaleX = image.naturalWidth / imageSize.w
    const scaleY = image.naturalHeight / imageSize.h
    const srcW = Math.round(crop.w * scaleX)
    const srcH = Math.round(crop.h * scaleY)
    const srcX = Math.round(crop.x * scaleX)
    const srcY = Math.round(crop.y * scaleY)

    // Output canvas always uses the category's standard aspect ratio
    const targetW = 900
    const targetH = Math.round(targetW / cropAspectRatio)

    // After rotation, the content's effective dimensions swap for 90° turns
    const quarterTurn = Math.abs(rotation % 180) === 90
    const fitW = quarterTurn ? srcH : srcW
    const fitH = quarterTurn ? srcW : srcH

    // Scale cropped content to fit inside the target frame (object-contain)
    const scale = Math.min(targetW / fitW, targetH / fitH)
    const drawW = srcW * scale
    const drawH = srcH * scale

    canvas.width = targetW
    canvas.height = targetH
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, targetW, targetH)
    context.save()
    context.translate(targetW / 2, targetH / 2)
    if (rotation % 360 !== 0) context.rotate((rotation * Math.PI) / 180)
    if (flipped) context.scale(-1, 1)
    context.drawImage(image, srcX, srcY, srcW, srcH, -drawW / 2, -drawH / 2, drawW, drawH)
    context.restore()
    onConfirm(canvas.toDataURL('image/png'))
  }

  const imageStyle = imageSize.w ? { width: imageSize.w, height: imageSize.h } : { width: 'min(100%, 420px)', height: 'auto' }
  const cropStyle = imageSize.w ? {
    left: `${(crop.x / imageSize.w) * 100}%`,
    top: `${(crop.y / imageSize.h) * 100}%`,
    width: `${(crop.w / imageSize.w) * 100}%`,
    height: `${(crop.h / imageSize.h) * 100}%`,
  } : undefined

  // Mirror flip preview — instant scaleX, no edge disappearance
  const previewTransform = `scaleX(${flipped ? -1 : 1}) rotate(${rotation}deg)`

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center glass-overlay" {...overlayProps}>
      <div className="glass-sheet w-full max-w-lg rounded-t-4xl sm:rounded-3xl animate-slide-up sm:animate-scale-in" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: 'var(--tc-20)' }} /></div>
        <div className="px-5 pt-2 pb-5 max-h-[90vh] overflow-y-auto">
          <h3 className="text-base title-display mb-1 text-center" style={{ color: 'var(--tc)' }}>Recadrer la photo</h3>
          <p className="text-xs font-sans text-center mb-1" style={{ color: 'var(--tc-45)' }}>Déplacez le cadre ou tirez un coin pour redimensionner</p>
          <p className="text-[10px] font-sans text-center mb-3" style={{ color: 'var(--tc-30)' }}>L'image sera ajustée au format standard de la catégorie</p>

          {/* Crop area — original image, no transform */}
          <div className="flex justify-center mb-3">
            <div className="relative overflow-hidden rounded-xl leading-none" style={{ width: imageSize.w || 'min(100%, 420px)', maxWidth: '100%' }}>
              <img ref={imageRef} src={displaySrc} alt="Photo à recadrer" onLoad={handleImageLoad} className="block max-w-full select-none" style={imageStyle} draggable={false} />
              {imageSize.w > 0 && (
                <div className="absolute border-2 pointer-events-auto touch-none" style={{ ...cropStyle, borderColor: '#ffffff', boxShadow: '0 0 0 9999px rgba(15,5,10,0.48)', cursor: drag?.corner === 'move' ? 'move' : 'crosshair' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => setDrag(null)}>
                  <span className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-sm border-2 border-white" style={{ background: '#ffffff' }} />
                  <span className="absolute -right-1.5 -top-1.5 w-3 h-3 rounded-sm border-2 border-white" style={{ background: '#ffffff' }} />
                  <span className="absolute -left-1.5 -bottom-1.5 w-3 h-3 rounded-sm border-2 border-white" style={{ background: '#ffffff' }} />
                  <span className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-sm border-2 border-white" style={{ background: '#ffffff' }} />
                </div>
              )}
            </div>
          </div>
          <canvas ref={outputRef} className="hidden" />

          {/* Live preview of flipped/rotated result */}
          {(flipped || rotation !== 0) && (
            <div className="mb-3 flex flex-col items-center">
              <p className="text-[10px] font-sans font-semibold mb-1" style={{ color: 'var(--tc-45)' }}>Aperçu</p>
              <div className="relative w-28 h-28 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: 'var(--tc-04)', border: '1px solid var(--line)' }}>
                <img
                  src={displaySrc}
                  alt="Aperçu"
                  className="max-w-full max-h-full object-contain transition-transform duration-200"
                  style={{ transform: previewTransform }}
                  draggable={false}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 mb-3">
            <button onClick={() => setRotation((r) => (r + 90) % 360)}
              className="flex-1 py-2 rounded-lg text-xs font-sans font-semibold transition-transform active:scale-95"
              style={{ background: 'var(--tc-07)', color: 'var(--tc)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 1 1-3-6.7M21 3v5h-5" /></svg>
              {t('formRotate')}
            </button>
            <button onClick={() => setFlipped((f) => !f)}
              className={`flex-1 py-2 rounded-lg text-xs font-sans font-semibold transition-all active:scale-95 ${flipped ? 'btn-gold' : ''}`}
              style={flipped ? undefined : { background: 'var(--tc-07)', color: 'var(--tc)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 4v16M8 8L4 12l4 4M16 8l4 4-4 4" /></svg>
              {t('formRotationHorizontal')}
            </button>
            <button onClick={() => { setFlipped(false); setRotation(0) }}
              className="px-3 py-2 rounded-lg text-xs font-sans font-semibold transition-transform active:scale-95"
              style={{ background: 'var(--tc-07)', color: 'var(--tc)' }}>
              0°
            </button>
          </div>
          <div className="flex gap-3"><button onClick={onCancel} className="flex-1 btn-outline py-3">Annuler</button><button onClick={handleConfirm} disabled={!imageSize.w} className="flex-1 btn-gold py-3 disabled:opacity-50">Confirmer</button></div>
        </div>
      </div>
    </div>
  )
}
