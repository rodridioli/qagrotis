"use client"

import { useRouter } from "next/navigation"
import { UserAvatar } from "@/components/equipe/EquipePerformanceCard"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface IndividualAvatarUser {
  id: string
  name: string
  photoPath: string | null
  email?: string
}

interface Props {
  secao: string
  users: IndividualAvatarUser[]
  selectedUserId: string
}

const AVATAR_SIZE = 44

export function IndividualActiveUserAvatarStrip({ secao, users, selectedUserId }: Props) {
  const router = useRouter()

  function select(id: string) {
    if (id === selectedUserId) return
    router.push(`/individual/${secao}?userId=${encodeURIComponent(id)}`)
  }

  return (
    <TooltipProvider>
      <div
        className="flex w-full flex-wrap items-center justify-start gap-y-2 pl-2"
        role="toolbar"
        aria-label="Selecionar usuário para visualizar dados"
      >
        {users.map((u, idx) => {
          const selected = u.id === selectedUserId
          return (
            <Tooltip key={u.id}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    aria-label={`${u.name}${selected ? " (selecionado)" : ""}`}
                    onClick={() => select(u.id)}
                    className={cn(
                      "relative rounded-full border-[3px] border-surface-card bg-surface-card shadow-sm transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2",
                      selected
                        ? "z-20 scale-110 border-brand-primary ring-2 ring-brand-primary/35"
                        : "z-10 hover:z-30 hover:scale-105",
                    )}
                    style={{ marginLeft: idx === 0 ? 0 : -12 }}
                  />
                }
              >
                <UserAvatar name={u.name} photoPath={u.photoPath} size={AVATAR_SIZE} />
              </TooltipTrigger>
              <TooltipContent>{u.name}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
