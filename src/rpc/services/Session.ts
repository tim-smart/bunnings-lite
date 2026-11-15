import { Context, Effect, Fiber, Layer, Option, Schema, Stream } from "effect"
import { KeyValueStore } from "effect/persistence"
import { SessionLocation } from "../../../server/src/domain/Bunnings.ts"
import { ApiError } from "../domain/ApiError.ts"
import { BunningsClient } from "./BunningsClient.ts"

const locationKey = "currentLocation"

const toApiError = (error: {
  readonly _tag: string
  readonly message?: string
}) =>
  new ApiError({
    message:
      error._tag === "Unauthorized"
        ? "The server didn't recognise this device. Reload the page to start again."
        : (error.message ?? "The request to Bunnings Lite failed."),
  })

type Client = BunningsClient["Service"]

/**
 * This device's session with the server, which prices and stocks everything
 * for one store. It logs in with the saved store when it is built and again
 * whenever the store changes, and every call waits for that login, so a
 * result never comes from the store before.
 */
export class Session extends Context.Service<
  Session,
  {
    /** The store this device shops at, if one was chosen. */
    readonly location: Effect.Effect<Option.Option<SessionLocation>>
    /** Saves the store and logs in with it. */
    readonly setLocation: (location: SessionLocation) => Effect.Effect<void>
    /** Runs a call once the session is logged in. */
    readonly use: <A, E extends { readonly _tag: string }>(
      f: (client: Client) => Effect.Effect<A, E>,
    ) => Effect.Effect<A, ApiError>
    /** Runs a streaming call once the session is logged in. */
    readonly stream: <A, E extends { readonly _tag: string }>(
      f: (client: Client) => Stream.Stream<A, E>,
    ) => Stream.Stream<A, ApiError>
  }
>()("rpc/Session") {
  static readonly layer = Layer.effect(
    Session,
    Effect.gen(function* () {
      const client = yield* BunningsClient
      const scope = yield* Effect.scope
      const store = KeyValueStore.toSchemaStore(
        yield* KeyValueStore.KeyValueStore,
        Schema.Option(SessionLocation),
      )
      // A value that no longer decodes is the same as no store chosen
      const location = store.get(locationKey).pipe(
        Effect.map(Option.flatten),
        Effect.orElseSucceed(() => Option.none<SessionLocation>()),
      )

      // A failed login isn't retried: the server falls back to its default
      // store, and the calls that follow report their own failures.
      const login = (location: Option.Option<SessionLocation>) =>
        Effect.forkIn(Effect.exit(client.login({ location })), scope)
      let pending = yield* Effect.flatMap(location, login)
      const loggedIn = Effect.suspend(() => Fiber.join(pending))

      return {
        location,
        setLocation: (location) =>
          Effect.gen(function* () {
            yield* Effect.orDie(store.set(locationKey, Option.some(location)))
            pending = yield* login(Option.some(location))
            yield* Fiber.join(pending)
          }),
        use: (f) =>
          loggedIn.pipe(
            Effect.andThen(Effect.suspend(() => f(client))),
            Effect.mapError(toApiError),
          ),
        stream: (f) =>
          Stream.fromEffect(loggedIn).pipe(
            Stream.flatMap(() => f(client)),
            Stream.mapError(toApiError),
          ),
      }
    }),
  ).pipe(Layer.provide(BunningsClient.layer))
}
