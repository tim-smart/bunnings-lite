import { Effect, Option, Stream } from "effect"
import { type Loader, Subscription } from "@effect/ui"
import { AsyncResult } from "effect/reactivity"
import { Viewport } from "./services/Viewport.ts"

/**
 * Sends `message` each time the page is scrolled to within a screen of its
 * end: when it gets there, and again when it is still there after the page
 * has grown. That is when a list loads its next page.
 */
export const bottomReached = <Msg>(message: Msg) =>
  Subscription.make(
    "browser/bottomReached",
    Stream.unwrap(
      Effect.map(Viewport, (viewport) =>
        viewport.changes.pipe(
          Stream.map(({ height, pageHeight, scrollY }) =>
            pageHeight - height <= scrollY + height ? pageHeight : -1,
          ),
          Stream.changes,
          Stream.filter((pageHeight) => pageHeight !== -1),
          Stream.map(() => message),
        ),
      ),
    ),
  )

/** Whether a list loader has a next page that nothing is loading yet. */
export const hasMore = (
  list: AsyncResult.AsyncResult<
    { readonly more: Loader.More<unknown> },
    unknown
  >,
): boolean =>
  Option.exists(
    AsyncResult.value(list),
    ({ more }) => more._tag === "Available",
  )

/** Sends whether the page is scrolled more than `offset` pixels down. */
export const scrolledPast = <Msg>(
  offset: number,
  message: (scrolled: boolean) => Msg,
) =>
  Subscription.make(
    "browser/scrolledPast",
    Stream.unwrap(
      Effect.map(Viewport, (viewport) =>
        viewport.changes.pipe(
          Stream.map(({ scrollY }) => scrollY > offset),
          Stream.changes,
          Stream.map(message),
        ),
      ),
    ),
  )
