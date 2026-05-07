import { cn } from "@/lib/utils"

/** Ícone nativo de `date` / `time` alinhado à direita (Chromium/WebKit). */
export function inputNativePickerRightClassName(extra?: string) {
  return cn(
    "w-full min-w-0 pr-10 relative",
    "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3",
    "[&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2",
    "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100",
    "[&::-webkit-calendar-picker-indicator]:size-4",
    extra,
  )
}
