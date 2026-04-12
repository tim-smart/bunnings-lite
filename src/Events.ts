import { FavoriteEvents } from "./Favorites/Events"
import * as EventLog from "effect/unstable/eventlog/EventLog"

export const AllEvents = EventLog.schema(FavoriteEvents)
