"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Minimal Web Speech API types (not in lib.dom.d.ts by default in all TS versions)
interface SpeechRecognitionResultItem {
  readonly transcript: string
  readonly confidence: number
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionResultItem
}
interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList
  readonly resultIndex: number
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognitionClass(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as Record<string, unknown>
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null) as (new () => SpeechRecognitionInstance) | null
}

export interface UseSpeechRecognitionOptions {
  lang?: string
  onTranscript: (text: string, isFinal: boolean) => void
  onEnd?: () => void
  onError?: (message: string) => void
}

export function useSpeechRecognition({
  lang = "pt-BR",
  onTranscript,
  onEnd,
  onError,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Keep callbacks in refs to avoid stale closures
  const onTranscriptRef = useRef(onTranscript)
  const onEndRef = useRef(onEnd)
  const onErrorRef = useRef(onError)
  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])
  useEffect(() => { onEndRef.current = onEnd }, [onEnd])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  useEffect(() => {
    setIsSupported(getSpeechRecognitionClass() !== null)
  }, [])

  const start = useCallback(() => {
    const SR = getSpeechRecognitionClass()
    if (!SR) return

    recognitionRef.current?.abort()

    const recognition = new SR()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event) => {
      let interim = ""
      let final = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) final += r[0].transcript
        else interim += r[0].transcript
      }
      if (final) onTranscriptRef.current(final, true)
      else if (interim) onTranscriptRef.current(interim, false)
    }

    recognition.onerror = (event) => {
      const msg =
        event.error === "not-allowed" ? "Permissão de microfone negada." :
        event.error === "no-speech" ? "Nenhuma fala detectada." :
        `Erro no reconhecimento: ${event.error}`
      onErrorRef.current?.(msg)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      onEndRef.current?.()
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [lang])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  // Cleanup on unmount
  useEffect(() => () => { recognitionRef.current?.abort() }, [])

  return { isListening, isSupported, start, stop }
}
