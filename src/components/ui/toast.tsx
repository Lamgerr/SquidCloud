import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "@/lib/icon-map"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "pointer-events-none fixed inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[100]",
      "flex max-h-screen flex-col items-end gap-3",
      "sm:inset-x-auto sm:right-6 sm:top-[calc(env(safe-area-inset-top)+1.5rem)] sm:max-w-[380px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  [
    // Base layout — monochromatic dark glass
    "group pointer-events-auto relative flex w-full items-start gap-3.5",
    "overflow-hidden rounded-2xl p-4 pr-12",
    // Surface
    "bg-zinc-950/80 backdrop-blur-xl",
    "border border-white/[0.08]",
    "shadow-[0_10px_40px_-12px_rgba(0,0,0,0.75)]",
    "ring-1 ring-inset ring-white/[0.04]",
    // Swipe / state transitions
    "transition-all duration-300 ease-out",
    "data-[swipe=cancel]:translate-x-0",
    "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
    "data-[swipe=move]:transition-none",
    "data-[swipe=end]:animate-ios-toast-swipe",
    "data-[state=open]:animate-in data-[state=open]:slide-in-from-top-3 data-[state=open]:fade-in-0",
    "data-[state=closed]:pointer-events-none data-[state=closed]:animate-out",
    "data-[state=closed]:slide-out-to-right-8 data-[state=closed]:fade-out-0",
    // Monochrome left accent stripe
    "before:absolute before:inset-y-4 before:left-0 before:w-[3px]",
    "before:rounded-full before:bg-gradient-to-b",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "before:from-white/70 before:to-white/10",
        destructive:
          "border-white/20 ring-white/[0.08] before:from-white before:to-white/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
))
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center",
      "rounded-lg border border-white/10 bg-white/[0.06] px-3",
      "text-sm font-medium text-zinc-100",
      "transition-colors hover:bg-white/[0.14]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
      "disabled:pointer-events-none disabled:opacity-50",
      "group-[.destructive]:border-white/20 group-[.destructive]:hover:bg-white/20",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-3 top-3",
      "rounded-lg bg-white/[0.06] p-1.5 shadow-sm",
      "text-zinc-400 opacity-100 transition-all",
      "hover:bg-white/[0.12] hover:text-zinc-100",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
      "md:opacity-0 md:group-hover:opacity-100",
      "group-[.destructive]:bg-white/10 group-[.destructive]:text-zinc-200",
      "group-[.destructive]:hover:text-white",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(
      "text-[0.9rem] font-semibold tracking-tight text-zinc-50",
      className
    )}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(
      "text-[0.8125rem] leading-relaxed text-zinc-400",
      className
    )}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>
type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
