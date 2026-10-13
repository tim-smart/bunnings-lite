import { FavoriteEvents } from "./Favorites/Events"
import * as EventLog from "effect/eventlog/EventLog"

export const AllEvents = EventLog.schema(FavoriteEvents)
