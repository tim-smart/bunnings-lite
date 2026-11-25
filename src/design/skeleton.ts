import type { Html } from "@effect/ui/html"
import { skeletonClass } from "./classes"

/** A grey block standing in for content that is loading. */
export const Skeleton = <Msg>(h: Html.H<Msg>, className: string) =>
  h.div.class(skeletonClass(className))
