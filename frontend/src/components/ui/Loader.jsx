import { Loader2 } from "lucide-react"

export function Loader({ className, size = 24 }) {
  return (
    <Loader2 className={`animate-spin text-primary ${className}`} size={size} />
  )
}
