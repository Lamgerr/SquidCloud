import * as React from "react"

import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("lg-shimmer", className)}
      {...props}
    />
  )
}

export { Skeleton }
