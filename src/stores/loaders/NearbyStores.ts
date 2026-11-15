import * as Geolocation from "@effect/platform-browser/Geolocation"
import { Effect, Schema, Stream } from "effect"
import { Loader } from "@effect/ui"
import { Store } from "../../../server/src/domain/Bunnings.ts"
import { ApiError } from "../../rpc/domain/ApiError.ts"
import { Session } from "../../rpc/services/Session.ts"

/** The ten stores closest to where the device is. Asks for its location. */
export class NearbyStores extends Loader.Service<NearbyStores>()(
  "stores/NearbyStores",
  {
    args: {},
    success: Schema.Array(Store),
    error: ApiError,
    staleTime: "5 minutes",
  },
  Effect.gen(function* () {
    const geolocation = yield* Geolocation.Geolocation
    const session = yield* Session
    return () =>
      geolocation.getCurrentPosition().pipe(
        // A browser without geolocation throws, where one that refuses fails
        Effect.catchCause(() =>
          Effect.fail(
            new ApiError({ message: "The device's location is unavailable." }),
          ),
        ),
        Effect.flatMap(({ coords }) =>
          session
            .stream((client) =>
              client.stores({
                latitude: coords.latitude,
                longitude: coords.longitude,
              }),
            )
            .pipe(Stream.take(10), Stream.runCollect),
        ),
      )
  }),
) {}
