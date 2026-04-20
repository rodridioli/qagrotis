
"use client"

import React, { useRef, useEffect } from "react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type AutoResizeTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export function AutoResizeTextarea({ className, ...props }: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resize = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  useEffect(() => {
    resize()
  }, [props.value])

  return (
    <Textarea
      {...props}
      ref={textareaRef}
      onInput={(e) => {
        resize()
        props.onInput?.(e)
      }}
      className={cn(
        "max-h-[min(50vh,28rem)] resize-none overflow-x-hidden overflow-y-auto transition-[height] duration-200",
        className
      )}
    />
  )
}
