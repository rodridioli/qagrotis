"use client"

import React, { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const OUTPUT_SIZE = 400 // 400x400 px
const VIEWPORT_SIZE = 320 // viewport CSS px (escalado para OUTPUT)

interface PhotoCropModalProps {
  file: File | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (file: File) => void
}

export function PhotoCropModal({ file, open, onOpenChange, onConfirm }: PhotoCropModalProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    if (!file) { setImgUrl(null); return }
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    const w = img.naturalWidth
    const h = img.naturalHeight
    setImgNatural({ w, h })
    const fitScale = Math.max(VIEWPORT_SIZE / w, VIEWPORT_SIZE / h)
    setMinScale(fitScale)
    setScale(fitScale)
    setOffset({ x: 0, y: 0 })
  }

  function clampOffset(next: { x: number; y: number }, currentScale: number) {
    if (!imgNatural) return next
    const sw = imgNatural.w * currentScale
    const sh = imgNatural.h * currentScale
    const maxX = Math.max(0, (sw - VIEWPORT_SIZE) / 2)
    const maxY = Math.max(0, (sh - VIEWPORT_SIZE) / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!imgNatural) return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || !dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    const next = { x: dragStart.current.ox + dx, y: dragStart.current.oy + dy }
    setOffset(clampOffset(next, scale))
  }

  function onPointerUp() {
    setDragging(false)
    dragStart.current = null
  }

  function onScaleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = parseFloat(e.target.value)
    setScale(next)
    setOffset((prev) => clampOffset(prev, next))
  }

  async function handleConfirm() {
    if (!imgRef.current || !imgNatural || !file) return
    const canvas = document.createElement("canvas")
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    // mapa: ponto central da viewport -> ponto na imagem natural
    // viewport center = (VIEWPORT_SIZE/2, VIEWPORT_SIZE/2)
    // imagem desenhada na viewport: top-left em (VIEWPORT_SIZE/2 - sw/2 + offset.x, ...)
    // sourceX = (VIEWPORT_SIZE/2 - VIEWPORT_SIZE/2 - offset.x + sw/2) / scale = (sw/2 - offset.x) / scale ... mais simples:
    // pixel viewport (vx,vy) corresponde a img (ix,iy):
    // vx = topLeftX + ix*scale  =>  ix = (vx - topLeftX) / scale
    const sw = imgNatural.w * scale
    const sh = imgNatural.h * scale
    const topLeftX = VIEWPORT_SIZE / 2 - sw / 2 + offset.x
    const topLeftY = VIEWPORT_SIZE / 2 - sh / 2 + offset.y
    const sourceX = (0 - topLeftX) / scale
    const sourceY = (0 - topLeftY) / scale
    const sourceW = VIEWPORT_SIZE / scale
    const sourceH = VIEWPORT_SIZE / scale

    ctx.drawImage(imgRef.current, sourceX, sourceY, sourceW, sourceH, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    const isPng = file.type === "image/png"
    const mime = isPng ? "image/png" : "image/jpeg"
    const ext = isPng ? "png" : "jpg"
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.92))
    if (!blob) return
    const cropped = new File([blob], `avatar.${ext}`, { type: mime })
    onConfirm(cropped)
    onOpenChange(false)
  }

  const sw = imgNatural ? imgNatural.w * scale : 0
  const sh = imgNatural ? imgNatural.h * scale : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar foto de perfil</DialogTitle>
          <p className="text-xs text-text-secondary">
            Arraste para reposicionar e use o controle abaixo para ampliar. A imagem final terá 400×400 px.
          </p>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative overflow-hidden rounded-full bg-neutral-grey-100 ring-1 ring-border-default"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {imgUrl && (
              <img
                ref={imgRef}
                src={imgUrl}
                alt=""
                onLoad={handleImgLoad}
                draggable={false}
                style={{
                  position: "absolute",
                  left: VIEWPORT_SIZE / 2 - sw / 2 + offset.x,
                  top: VIEWPORT_SIZE / 2 - sh / 2 + offset.y,
                  width: sw,
                  height: sh,
                  maxWidth: "none",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>

          <div className="flex w-full items-center gap-3">
            <span className="text-xs text-text-secondary">Zoom</span>
            <input
              type="range"
              min={minScale}
              max={minScale * 4}
              step={0.01}
              value={scale}
              onChange={onScaleChange}
              className="flex-1 accent-brand-primary"
              aria-label="Zoom"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!imgNatural}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
