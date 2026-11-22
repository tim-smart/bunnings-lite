import { Effect, Layer, Schema } from "effect"
import { Command, Component, Head, Router, UiSchema } from "@effect/ui"
import { HtmlHead } from "@effect/ui/html"
import { Reload } from "./browser/services/Reload.ts"
import { buttonClass } from "./design/classes.ts"
import { AppRoute } from "./routes.ts"
import { searchCleared } from "./search/domain/Search.ts"
import { Shell } from "./Shell.ts"
import { JoinFailed, JoinProgress } from "./sync/domain/Invite.ts"
import { PendingJoin } from "./sync/services/PendingJoin.ts"

export const AppMessage = UiSchema.TaggedEnum({
  RouteChanged: { route: AppRoute },
  JoinProgressed: { progress: JoinProgress },
  JoinFailed: {},
  Retry: {},
})

/**
 * Applies a join recorded before the last reload. It runs before the shell
 * mounts, because the shell's services open the journal the join replaces.
 */
export class FinishJoin extends Command.Service<FinishJoin>()(
  "App/FinishJoin",
  { args: {}, stream: true },
  Effect.gen(function* () {
    const join = yield* PendingJoin
    return () => join.finish
  }),
) {}

export class ReloadPage extends Command.Service<ReloadPage>()(
  "App/ReloadPage",
  { args: {} },
  Effect.gen(function* () {
    const page = yield* Reload
    return () => Effect.as(page.reload, Component.noop)
  }),
) {}

export const AppNoDeps = Component.define({
  name: "App",
  scoped: false,
  props: Schema.Struct({ route: AppRoute }),
  model: Schema.Struct({
    route: AppRoute,
    /**
     * How many times the search has been cleared back to the home page. The
     * search page starts over each time, without the last search's results.
     * It is counted here because every route change passes through `update`,
     * including a clear that is never rendered.
     */
    searchesCleared: Schema.Number,
    join: Schema.Literals(["Checking", "Blocked", "Failed", "Ready"]),
  }),
  message: AppMessage,
}).make({
  init: ($) =>
    $.set({ route: $.props.route, searchesCleared: 0, join: "Checking" }).run(
      FinishJoin.make().pipe(
        Command.match({
          onSuccess: (progress) => AppMessage.JoinProgressed({ progress }),
          onFailure: (_: JoinFailed) => AppMessage.JoinFailed(),
        }),
      ),
    ),
  update: (model, message, $) =>
    AppMessage.match(message, {
      RouteChanged: ({ route }) => ({
        ...model,
        route,
        searchesCleared:
          model.searchesCleared + (searchCleared(model.route, route) ? 1 : 0),
      }),
      JoinProgressed: ({ progress }) => ({
        ...model,
        join:
          progress === "Finished" ? ("Ready" as const) : ("Blocked" as const),
      }),
      JoinFailed: () => ({ ...model, join: "Failed" as const }),
      Retry: () => $.run(ReloadPage.make()),
    }),
  subscriptions: (model) => [
    Router.subscription(AppRoute, model.route, (route) =>
      AppMessage.RouteChanged({ route }),
    ),
  ],
  // A page names itself, and the app's name follows it
  head: () => [
    Head.title("Bunnings Lite"),
    Head.titleTemplate((title) => `${title} · Bunnings Lite`),
    HtmlHead.lang("en"),
  ],
  view: (model, h) => {
    switch (model.join) {
      case "Ready":
        return Shell(h, {
          key: "shell",
          props: {
            route: model.route,
            searchesCleared: model.searchesCleared,
          },
        })
      // Checking takes a moment, and says nothing unless it has to wait
      case "Checking":
        return h.div()
      case "Blocked":
        return h.main
          .class("mx-auto max-w-md space-y-4 p-6 text-white")
          .attr("role", "status")
          .children(
            h.h1
              .class("text-xl font-semibold")
              .children("Waiting to finish joining"),
            h.p("Close other Bunnings Lite tabs or windows to finish joining."),
            h.p("This page will continue automatically once they are closed."),
          )
      case "Failed":
        // The journal stays closed until every setting is saved, and the
        // recorded join is removed last, so a reload retries all of it.
        return h.main
          .class("mx-auto max-w-md space-y-4 p-6 text-white")
          .attr("role", "alert")
          .children(
            h.h1
              .class("text-xl font-semibold")
              .children("Could not finish joining"),
            h.p("Check that browser storage is available, then try again."),
            h.button
              .attr("type", "button")
              .class(buttonClass())
              .onClick(AppMessage.Retry())
              .children("Retry"),
          )
    }
  },
})

export const App = AppNoDeps.pipe(
  Component.provide([
    FinishJoin.layer.pipe(Layer.provide(PendingJoin.layer)),
    ReloadPage.layer,
  ]),
)
