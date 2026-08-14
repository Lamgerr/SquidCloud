import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

const BottomSheet = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
)
BottomSheet.displayName = "BottomSheet"

const BottomSheetTrigger = DrawerPrimitive.Trigger

const BottomSheetPortal = DrawerPrimitive.Portal

const BottomSheetClose = DrawerPrimitive.Close

const BottomSheetOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[100] bg-black/40 backdrop-blur-[3px] bs-overlay",
      className
    )}
    {...props}
  />
))
BottomSheetOverlay.displayName = DrawerPrimitive.Overlay.displayName

const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    /** Hide the drag handle (e.g. for full-bleed content). */
    hideHandle?: boolean
    /** Hide the floating close button in the top-right corner. */
    hideClose?: boolean
    /** Accessory node rendered on the right side of the header row. */
    headerAccessory?: React.ReactNode
  }
>(({ className, children, hideHandle, hideClose, headerAccessory, ...props }, ref) => (
  <BottomSheetPortal>
    <BottomSheetOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-[101] mt-16 flex h-auto max-h-[94dvh] flex-col rounded-t-[28px] border border-white/10 border-b-0 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.55)] backdrop-blur-2xl [overscroll-behavior-y:contain] bs-content",
        className
      )}
      style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      {...props}
    >
      {!hideHandle && (
        <div
          aria-hidden
          className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/25 bs-handle"
        />
      )}
      {children}
      {!hideClose && (
        <BottomSheetClose
          render={
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full bg-black/30 text-white/90 backdrop-blur-sm hover:bg-black/50 hover:text-white"
            />
          }
        >
          <XIcon className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </BottomSheetClose>
      )}
    </DrawerPrimitive.Content>
  </BottomSheetPortal>
))
BottomSheetContent.displayName = "BottomSheetContent"

const BottomSheetHeader = ({
  className,
  title,
  subtitle,
  accessory,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  accessory?: React.ReactNode
}) => (
  <div
    className={cn(
      "flex items-start justify-between gap-3 px-5 pb-3 pt-1",
      className
    )}
    {...props}
  >
    <div className="min-w-0 flex-1">
      {title && (
        <h3 className="truncate text-[17px] font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {subtitle}
        </p>
      )}
      {!title && !subtitle && props.children}
    </div>
    {(accessory || headerAccessory) && (
      <div className="shrink-0">{accessory || headerAccessory}</div>
    )}
  </div>
)
BottomSheetHeader.displayName = "BottomSheetHeader"

const BottomSheetBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "min-h-0 flex-1 overflow-y-auto px-5 py-1 [-webkit-overflow-scrolling:touch]",
      className
    )}
    {...props}
  />
)
BottomSheetBody.displayName = "BottomSheetBody"

const BottomSheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "shrink-0 border-t border-border/60 bg-card/40 px-5 pb-1 pt-3",
      className
    )}
    {...props}
  />
)
BottomSheetFooter.displayName = "BottomSheetFooter"

const BottomSheetTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-[17px] font-semibold leading-none tracking-tight text-foreground",
      className
    )}
    {...props}
  />
))
BottomSheetTitle.displayName = DrawerPrimitive.Title.displayName

const BottomSheetDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
BottomSheetDescription.displayName = DrawerPrimitive.Description.displayName

export {
  BottomSheet,
  BottomSheetPortal,
  BottomSheetOverlay,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetBody,
  BottomSheetFooter,
  BottomSheetTitle,
  BottomSheetDescription,
}
