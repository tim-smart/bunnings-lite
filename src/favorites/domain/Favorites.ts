import { Schema } from "effect"
import { EventLog } from "effect/eventlog"
import { ProductBaseInfo } from "../../../server/src/domain/Bunnings.ts"
import { FavoriteEvents } from "./Events.ts"

/** Every event the device's log holds. */
export const AllEvents = EventLog.schema(FavoriteEvents)

// The favourites as they are kept in the key value store, oldest first
export const FavoritesStore = {
  key: "favorites",
  schema: Schema.Array(ProductBaseInfo),
}
