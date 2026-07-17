"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { FrostGlassVariantProp, glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { Button } from "../button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DialogContent,
} from "../dialog";
import { LiquidGlass } from "./liquid-glass";

type GlassDialogContentProps = DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
} & FrostGlassVariantProp;

function GlassDialogContent({
  className,
  glassVariant = "liquid-refract",
  children,
  showCloseButton = true,
  ...props
}: GlassDialogContentProps) {
  if (glassVariant === "liquid-refract") {
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="dialog-overlay"
          className="fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          data-slot="glass-dialog-content"
          data-glass-variant={glassVariant}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl p-0 text-sm text-popover-foreground shadow-2xl ring-0 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          <LiquidGlass
            className={cn(
              "rounded-xl p-6",
              "[&_[data-slot=dialog-footer]]:-mx-6 [&_[data-slot=dialog-footer]]:-mb-6 [&_[data-slot=dialog-footer]]:mt-2 [&_[data-slot=dialog-footer]]:rounded-b-[inherit] [&_[data-slot=dialog-footer]]:bg-white/10 [&_[data-slot=dialog-footer]]:p-4 dark:[&_[data-slot=dialog-footer]]:bg-white/[0.04]",
              className,
            )}
          >
            {children}
            {showCloseButton && (
              <DialogPrimitive.Close
                data-slot="dialog-close"
                render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            )}
          </LiquidGlass>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    );
  }

  return (
    <DialogContent
      showCloseButton={showCloseButton}
      data-glass-variant={glassVariant}
      className={cn(glassVariantStyles[glassVariant], className)}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export {
  GlassDialogContent,
  Dialog as GlassDialog,
  DialogTrigger as GlassDialogTrigger,
  DialogClose as GlassDialogClose,
  DialogHeader as GlassDialogHeader,
  DialogFooter as GlassDialogFooter,
  DialogTitle as GlassDialogTitle,
  DialogDescription as GlassDialogDescription,
  DialogPortal as GlassDialogPortal,
  DialogOverlay as GlassDialogOverlay,
};
