import { cn } from "@/lib/utils"

const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"

const buttonVariants = {
  default:
    "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
  outline:
    "border border-input bg-background text-foreground hover:bg-muted hover:border-primary/40 dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/90 active:bg-secondary/80",
  link: "text-primary underline-offset-4 hover:underline",
}

const buttonSizes = {
  default: "h-9 px-4 py-2 has-[>svg]:px-3",
  lg: "h-11 rounded-md px-6 text-[15px] has-[>svg]:px-5",
}

export const buttonClass = (options?: {
  readonly variant?: keyof typeof buttonVariants
  readonly size?: keyof typeof buttonSizes
  readonly class?: string
}) =>
  cn(
    buttonBase,
    buttonVariants[options?.variant ?? "default"],
    buttonSizes[options?.size ?? "default"],
    options?.class,
  )

export const inputClass = (extra?: string) =>
  cn(
    "flex h-10 w-full rounded-md border border-input bg-card px-3 py-1 text-base text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground hover:border-primary/40 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-muted md:text-sm",
    extra,
  )

export const badgeClass = (extra?: string) =>
  cn(
    "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden border-transparent bg-primary text-primary-foreground",
    extra,
  )

export const cardClass = (extra?: string) =>
  cn("bg-card text-card-foreground flex flex-col gap-6 rounded-xl py-6", extra)

export const skeletonClass = (extra?: string) =>
  cn("bg-foreground/[0.07] animate-pulse rounded-md", extra)

export const labelClass = (extra?: string) =>
  cn(
    "flex items-center gap-2 text-sm leading-none font-medium select-none",
    extra,
  )
