import { Loader } from "@effect/ui"

/**
 * Carried by every read the server prices or stocks for the chosen store.
 * Choosing another store invalidates it.
 */
export const SessionTag = Loader.Tag("rpc/Session")
