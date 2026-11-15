import { Schema } from "effect"

/** A call to the Bunnings Lite server that didn't work, with the reason to show. */
export class ApiError extends Schema.TaggedError<ApiError>()("ApiError", {
  message: Schema.String,
}) {}
