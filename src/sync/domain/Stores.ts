import { Schema } from "effect"
import { EventLog } from "effect/eventlog"

// What sync keeps in the key value store. A join writes these before the
// services that read them are built.
export const IdentityStore = {
  key: "identity",
  schema: EventLog.IdentitySchema,
}

export const RemoteUrlStore = {
  key: "remoteUrl",
  schema: Schema.Option(Schema.URL),
}

export const pendingJoinKey = "pendingJoin"

export const journalDatabase = "effect_event_journal"
