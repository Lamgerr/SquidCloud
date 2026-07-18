import * as React from "react"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { AlertTriangle, Info } from "@/lib/icon-map"
import { cn } from "@/lib/utils"

export function Toaster() {
  const { toasts } = useToast()
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia("(max-width: 640px)")
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)

    setIsMobile(mediaQuery.matches)

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const { className, duration, variant, ...toastProps } = props
        const resolvedDuration = duration ?? (isMobile ? 3600 : 5600)
        const resolvedClassName = cn(
          "touch-pan-y",
          isMobile
            ? "w-full max-w-[min(92vw,380px)]"
            : "w-full max-w-[380px]",
          className
        )

        const Icon =
          variant === "destructive"
            ? AlertTriangle
            : Info

        return (
          <Toast
            key={id}
            {...toastProps}
            variant={variant}
            duration={resolvedDuration}
            className={resolvedClassName}
          >
            <Icon
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0",
                variant === "destructive"
                  ? "text-zinc-100"
                  : "text-zinc-400"
              )}
            />
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
