import * as EventLog from "@effect/experimental/EventLog"
import { FavoriteEvents } from "./Favorites/Events"

export class AllEvents extends EventLog.schema(FavoriteEvents) {}
