"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { FrostGlassVariantProp, glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

import { LiquidGlass } from "./liquid-glass";

type GlassTooltipContentProps = TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset"> &
  FrostGlassVariantProp;

function GlassTooltipContent({
  className,
  glassVariant = "liquid-refract",
  children,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  ...props
}: GlassTooltipContentProps) {
  if (glassVariant === "liquid-refract") {
    return (
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner
          align={align}
          alignOffset={alignOffset}
          side={side}
          sideOffset={sideOffset}
          className="isolate z-50"
        >
          <LiquidGlass className="rounded-md">
            <TooltipPrimitive.Popup
              data-slot="glass-tooltip-content"
              data-glass-variant={glassVariant}
              className={cn(
                "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 px-3 py-1.5 text-xs text-foreground bg-transparent shadow-none ring-0 has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                className,
              )}
              {...props}
            >
              {children}
              <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-white/30 fill-white/30 data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
            </TooltipPrimitive.Popup>
          </LiquidGlass>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    );
  }

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="glass-tooltip-content"
          data-glass-variant={glassVariant}
          className={cn(
            "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            glassVariantStyles[glassVariant],
            className,
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

const GlassTooltip = TooltipPrimitive.Root;
const GlassTooltipTrigger = TooltipPrimitive.Trigger;
const GlassTooltipProvider = TooltipPrimitive.Provider;

export {
  GlassTooltipContent,
  GlassTooltip,
  GlassTooltipTrigger,
  GlassTooltipProvider,
};
