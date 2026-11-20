import { Effect, Schema, Stream } from "effect"
import { Query } from "@effect/ui"
import { Store } from "../../../server/src/domain/Bunnings.ts"
import { ApiError } from "../../rpc/domain/ApiError.ts"
import { Session } from "../../rpc/services/Session.ts"

/**
 * Every store, for searching by hand when the device's location is
 * unavailable. Only read while the store search is open, and kept for a
 * while after it closes.
 */
export class AllStores extends Query.Service<AllStores>()(
  "stores/AllStores",
  {
    args: {},
    success: Schema.Array(Store),
    error: ApiError,
    staleTime: "10 minutes",
    idleTimeToLive: "10 minutes",
  },
  Effect.gen(function* () {
    const session = yield* Session
    return () =>
      session.stream((client) => client.allStores()).pipe(Stream.runCollect)
  }),
) {}
