"use client"

import { useRouter } from "next/navigation"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"

interface SelectableUser {
  id: string
  name: string
}

interface Props {
  users: SelectableUser[]
  selectedUserId: string
  selfId: string
}

export default function IndividualUserSelector({ users, selectedUserId, selfId }: Props) {
  const router = useRouter()

  function handleChange(value: string | null) {
    if (!value) return
    if (value === selfId) {
      router.push("/individual")
    } else {
      router.push(`/individual?userId=${encodeURIComponent(value)}`)
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-1.5">
      <label className="text-sm font-medium text-text-primary">Visualizar dados de</label>
      <Select value={selectedUserId} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecionar usuário" />
        </SelectTrigger>
        <SelectPopup>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  )
}
