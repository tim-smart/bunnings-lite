import type { View } from "@effect/ui"
import { skeletonClass } from "./classes"

/** A grey block standing in for content that is loading. */
export const Skeleton = <Msg>(h: View.H<Msg>, className: string) =>
  h.div.class(skeletonClass(className))
