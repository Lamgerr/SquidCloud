import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Drawer as DrawerPrimitive } from "vaul"
import { X } from "@/lib/icon-map"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

const DialogContext = React.createContext<{ isMobile: boolean }>({ isMobile: false })

const Dialog = ({ children, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) => {
  const isMobile = useIsMobile()
  const Root = isMobile ? DrawerPrimitive.Root : DialogPrimitive.Root
  const { onOpenChange: _onOpenChange, ...rest } = props as any
  const handleOpenChange = React.useCallback((open: boolean) => {
    _onOpenChange?.(open)
  }, [_onOpenChange])
  return (
    <DialogContext.Provider value={{ isMobile }}>
      <Root {...rest} onOpenChange={handleOpenChange}>{children}</Root>
    </DialogContext.Provider>
  )
}
Dialog.displayName = "Dialog"

const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>((props, ref) => {
  const { isMobile } = React.useContext(DialogContext)
  const Trigger = isMobile ? DrawerPrimitive.Trigger : DialogPrimitive.Trigger
  return <Trigger ref={ref} {...(props as any)} />
})
DialogTrigger.displayName = "DialogTrigger"

const DialogPortal = ({ children }: { children: React.ReactNode }) => {
  const { isMobile } = React.useContext(DialogContext)
  const Portal = isMobile ? DrawerPrimitive.Portal : DialogPrimitive.Portal
  return <Portal>{children}</Portal>
}

const DialogClose = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>((props, ref) => {
  const { isMobile } = React.useContext(DialogContext)
  const Close = isMobile ? DrawerPrimitive.Close : DialogPrimitive.Close
  return <Close ref={ref} {...(props as any)} />
})
DialogClose.displayName = "DialogClose"

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const { isMobile } = React.useContext(DialogContext)
  if (isMobile) {
    return (
      <DrawerPrimitive.Overlay
        ref={ref as any}
        className={cn("fixed inset-0 z-50 bg-black/55 backdrop-blur-sm", className)}
        {...(props as any)}
      />
    )
  }
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/55",
        "opacity-0 data-[state=open]:opacity-100",
        "transition-opacity duration-200 ease-out",
        className
      )}
      {...props}
    />
  )
})
DialogOverlay.displayName = "DialogOverlay"

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => {
  const { isMobile } = React.useContext(DialogContext)
  
  // Custom z-index extraction logic for overlaid dialogs (like BYOK prompt over preview)
  const zIndexMatches = className?.match(/z-\[?\d+\]?/);
  const zIndexClass = zIndexMatches ? zIndexMatches[0] : "z-50";

  if (isMobile) {
    return (
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 bg-black/55 backdrop-blur-sm" />
        <DrawerPrimitive.Content
          ref={ref as any}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 mt-24",
            "flex flex-col rounded-t-[20px]",
            "bg-card/80 backdrop-blur-2xl border border-white/10 border-b-0 shadow-2xl",
            "max-h-[85vh] overflow-y-auto",
            zIndexClass,
            className
          )}
          {...(props as any)}
        >
          <div className="mx-auto mt-4 h-1 w-9 rounded-full bg-white/20" />
          {children}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    )
  }

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-black/55",
          "opacity-0 data-[state=open]:opacity-100",
          "transition-opacity duration-200 ease-out",
          zIndexClass !== "z-50" ? zIndexClass : undefined
        )}
      />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg gap-4 p-5 shadow-2xl",
          "translate-x-[-50%] translate-y-[-50%]",
          "rounded-[20px]",
          "bg-card/80 backdrop-blur-2xl border border-white/10",
          "scale-[0.96] opacity-0 data-[state=open]:opacity-100 data-[state=open]:scale-100",
          "transition-[opacity,transform] duration-200 ease-out",
          "will-change-transform will-change-opacity",
          "max-h-[85vh] overflow-y-auto",
          zIndexClass,
          className
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            className={cn(
              "absolute right-4 top-4 h-8 w-8 rounded-[8px] flex items-center justify-center z-10",
              "bg-white/10 hover:bg-destructive/20 hover:text-destructive",
              "text-muted-foreground border border-white/10",
              "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-2",
              "transition-all"
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const { isMobile } = React.useContext(DialogContext)
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5",
        isMobile ? "text-left" : "text-center sm:text-left",
        className
      )}
      {...props}
    />
  )
}
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const { isMobile } = React.useContext(DialogContext)
  return (
    <div
      className={cn(
        isMobile
          ? "flex flex-col gap-3 mt-4"
          : "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2.5",
        className
      )}
      {...props}
    />
  )
}
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => {
  const { isMobile } = React.useContext(DialogContext)
  const Title = isMobile ? DrawerPrimitive.Title : DialogPrimitive.Title
  return (
    <Title
      ref={ref as any}
      className={cn(
        "font-semibold leading-tight tracking-tight",
        isMobile ? "text-lg text-foreground" : "text-base text-foreground",
        className
      )}
      {...(props as any)}
    />
  )
})
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  const { isMobile } = React.useContext(DialogContext)
  const Description = isMobile ? DrawerPrimitive.Description : DialogPrimitive.Description
  return (
    <Description
      ref={ref as any}
        className={cn(
          "text-sm leading-relaxed",
          "text-muted-foreground",
          className
        )}
        {...(props as any)}
      />
  )
})
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
