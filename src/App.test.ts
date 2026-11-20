import "@effect/ui/html/register"
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { Component } from "@effect/ui"
import { Scene, Story } from "@effect/ui/testing"
import { HtmlLocator, HtmlScene } from "@effect/ui/html/testing"
import { AppMessage, AppNoDeps, FinishJoin, ReloadPage } from "./App.ts"
import type { AppRoute } from "./routes.ts"
import { Shell } from "./Shell.ts"
import { JoinFailed } from "./sync/domain/Invite.ts"

const search = (query: string): AppRoute => ({
  _tag: "Search",
  params: {},
  search: { query },
})
const route = search("")
const routeChanged = (query: string) =>
  AppMessage.make({ _tag: "RouteChanged", route: search(query) })

const heading = HtmlLocator.role("heading")

describe("App", () => {
  it.effect("holds the shell back until a pending join has finished", () =>
    Effect.gen(function* () {
      const s = yield* HtmlScene.make(AppNoDeps, { route })
      s.expectExact(FinishJoin)
        .expect(heading)
        .toBeAbsent()
        // Another tab still has the old journal open
        .next(FinishJoin, "Blocked")
        .expect(heading)
        .toHaveText(/Waiting to finish joining/)
        .next(FinishJoin, "Finished")
        .expect(heading)
        .toBeAbsent()
      assert.strictEqual(Scene.children(s.view, Shell).length, 1)
      s.end(FinishJoin)
    }),
  )

  it.effect("offers a retry when the join can't be saved", () =>
    Effect.gen(function* () {
      const s = yield* HtmlScene.make(AppNoDeps, { route })
      s.fail(FinishJoin, new JoinFailed())
        .expect(HtmlLocator.role("alert"))
        .toExist()
        .click(HtmlLocator.role("button", { name: "Retry" }))
        .expectExact(ReloadPage)
        .resolve(ReloadPage, Component.noop)
    }),
  )

  it.effect(
    "counts every clear to home, including one that is never rendered",
    () =>
      Effect.gen(function* () {
        const s = yield* Story.make(AppNoDeps, { route: search("hammer") })
        // Cleared and searched again before the next render
        s.send(routeChanged("")).send(routeChanged("drill"))
        assert.strictEqual(s.model.searchesCleared, 1)
        s.end(FinishJoin)
      }),
  )

  it.effect("keeps the search page when a search starts from home", () =>
    Effect.gen(function* () {
      const s = yield* Story.make(AppNoDeps, { route })
      s.send(routeChanged("h")).send(routeChanged("hammer"))
      assert.strictEqual(s.model.searchesCleared, 0)
      s.end(FinishJoin)
    }),
  )
})
