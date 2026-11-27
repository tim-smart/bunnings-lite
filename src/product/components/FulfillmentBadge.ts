import { Layer, Option, Schema } from "effect"
import { Session } from "../../rpc/services/Session.ts"
import { AsyncResult } from "effect/reactivity"
import { Component } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { badgeClass } from "../../design/classes.ts"
import { Icon } from "../../design/icons.ts"
import { GetFulfillment } from "../queries/GetFulfillment.ts"

/**
 * Where a product is in the chosen store, or that the store is out of it. It
 * shows nothing until that is known, and its wrapper hides while empty.
 */
export const FulfillmentBadgeNoDeps = Html.component({
  name: "FulfillmentBadge",
  props: Schema.Struct({
    id: Schema.String,
    /** Also say so when the product is in stock with no known aisle. */
    showAvailable: Schema.Boolean,
    /** Classes for the wrapper, which places the badge. */
    class: Schema.String,
  }),
  model: Schema.Struct({}),
  message: Schema.Never,
  queries: {
    fulfillment: {
      query: GetFulfillment,
      dropPrevious: true,
      args: ({ props }) => ({ id: props.id }),
    },
  },
}).make({
  init: () => ({}),
  update: ($) => $.model,
  view: (h) => {
    const fulfillment = Option.flatten(AsyncResult.value(h.queries.fulfillment))
    const badge = Option.match(fulfillment, {
      onNone: () => undefined,
      onSome: (info) => {
        if (!info.isAvailable) {
          return h.span
            .class(
              badgeClass(
                "h-7 rounded-full border-0 bg-orange-100 px-2.5 text-orange-800 dark:bg-orange-400/15 dark:text-orange-300",
              ),
            )
            .children("Out of stock")
        }
        if (Option.isSome(info.location)) {
          const { aisle, bay } = info.location.value
          return h.span
            .class(
              badgeClass(
                "h-7 rounded-full border-0 bg-primary/10 px-2.5 text-primary tabular-nums",
              ),
            )
            .children(Icon(h, "mapPin"), `Aisle ${aisle}/${bay}`)
        }
        if (!h.props.showAvailable) return undefined
        return h.span
          .class(
            badgeClass(
              "h-7 rounded-full border-0 bg-green-100 px-2.5 text-green-800 dark:bg-green-400/15 dark:text-green-300",
            ),
          )
          .children("Available")
      },
    })
    return h.div.class(h.props.class).children(badge)
  },
})

export const FulfillmentBadge = FulfillmentBadgeNoDeps.pipe(
  Component.provide(GetFulfillment.layer.pipe(Layer.provide(Session.layer))),
)
