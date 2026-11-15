import type { View } from "@effect/ui"

/**
 * The view helper of any component, for functions that build a piece of view
 * without being a component: icons, buttons, a drawer.
 */
export type H<Msg> = View.Helper<Msg, unknown> & View.Tags<View.Registered, Msg>
