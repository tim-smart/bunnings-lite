import { Effect, Schema } from "effect"
import { Loader } from "@effect/ui"
import { SessionLocation } from "../../../server/src/domain/Bunnings.ts"
import { SessionTag } from "../../rpc/domain/SessionTag.ts"
import { Session } from "../../rpc/services/Session.ts"

/** The store this device shops at, if one was chosen. */
export class CurrentStore extends Loader.Service<CurrentStore>()(
  "stores/CurrentStore",
  {
    args: {},
    success: Schema.Option(SessionLocation),
    error: Schema.Never,
    staleTime: "1 hour",
    tags: [SessionTag],
  },
  Effect.gen(function* () {
    const session = yield* Session
    return () => session.location
  }),
) {}
