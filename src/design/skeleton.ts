import type { H } from "./h"
import { skeletonClass } from "./classes"

/** A grey block standing in for content that is loading. */
export const skeleton = <Msg>(h: H<Msg>, className: string) =>
  h.div.class(skeletonClass(className))
