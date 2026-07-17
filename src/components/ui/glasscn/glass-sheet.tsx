"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";

import { FrostGlassVariantProp, glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { Button } from "../button";
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetContent,
} from "../sheet";
import { LiquidGlass } from "./liquid-glass";

type GlassSheetContentProps = SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
} & FrostGlassVariantProp;

function GlassSheetContent({
  className,
  glassVariant = "liquid-refract",
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: GlassSheetContentProps) {
  if (glassVariant === "liquid-refract") {
    return (
      <SheetPrimitive.Portal>
        <SheetPrimitive.Backdrop
          data-slot="sheet-overlay"
          className="fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs"
        />
        <SheetPrimitive.Popup
          data-slot="glass-sheet-content"
          data-side={side}
          data-glass-variant={glassVariant}
          className={cn(
            "fixed z-50 flex flex-col gap-4 p-0 text-popover-foreground shadow-2xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
            className,
          )}
          {...props}
        >
          <LiquidGlass
            className={cn(
              "flex h-full w-full flex-col gap-4 p-6",
              side === "left" && "rounded-r-3xl",
              side === "right" && "rounded-l-3xl",
              side === "top" && "rounded-b-3xl",
              side === "bottom" && "rounded-t-3xl",
              "[&_[data-slot=sheet-footer]]:-mx-6 [&_[data-slot=sheet-footer]]:-mb-6 [&_[data-slot=sheet-footer]]:mt-auto [&_[data-slot=sheet-footer]]:rounded-b-[inherit] [&_[data-slot=sheet-footer]]:bg-white/10 [&_[data-slot=sheet-footer]]:p-4 dark:[&_[data-slot=sheet-footer]]:bg-white/[0.04]",
              className,
            )}
          >
            {children}
            {showCloseButton && (
              <SheetPrimitive.Close
                data-slot="sheet-close"
                render={<Button variant="ghost" className="absolute top-3 right-3" size="icon-sm" />}
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </SheetPrimitive.Close>
            )}
          </LiquidGlass>
        </SheetPrimitive.Popup>
      </SheetPrimitive.Portal>
    );
  }

  return (
    <SheetContent
      side={side}
      showCloseButton={showCloseButton}
      data-glass-variant={glassVariant}
      className={cn(glassVariantStyles[glassVariant], className)}
      {...props}
    >
      {children}
    </SheetContent>
  );
}

export {
  GlassSheetContent,
  Sheet as GlassSheet,
  SheetTrigger as GlassSheetTrigger,
  SheetClose as GlassSheetClose,
  SheetHeader as GlassSheetHeader,
  SheetFooter as GlassSheetFooter,
  SheetTitle as GlassSheetTitle,
  SheetDescription as GlassSheetDescription,
};
