import "@effect/ui/html/register"
import { assert, describe, it } from "@effect/vitest"
import { Component } from "@effect/ui"
import { Query, Story } from "@effect/ui/testing"
import { HtmlQuery } from "@effect/ui/html/testing"
import { AppMessage, AppNoDeps, FinishJoin, ReloadPage } from "./App.ts"
import type { AppRoute } from "./routes.ts"
import { JoinFailed } from "./sync/domain/Invite.ts"

const search = (query: string): AppRoute => ({
  _tag: "Search",
  params: {},
  query: { query },
})
const route = search("")
const routeChanged = (query: string) =>
  AppMessage.make({ _tag: "RouteChanged", route: search(query) })

describe("App", () => {
  it("holds the shell back until a pending join has finished", () => {
    Story.make(AppNoDeps, { route }, (s) =>
      s
        .expectExact(FinishJoin)
        .model((model) => assert.strictEqual(model.join, "Checking"))
        // Another tab still has the old journal open
        .next(FinishJoin, "Blocked")
        .check((story) =>
          assert.match(
            Query.textOf(story.get(HtmlQuery.role("heading"))),
            /Waiting to finish joining/,
          ),
        )
        .next(FinishJoin, "Finished")
        .model((model) => assert.strictEqual(model.join, "Ready"))
        .end(FinishJoin),
    )
  })

  it("offers a retry when the join can't be saved", () => {
    Story.make(AppNoDeps, { route }, (s) =>
      s
        .fail(FinishJoin, new JoinFailed())
        .model((model) => assert.strictEqual(model.join, "Failed"))
        .click(HtmlQuery.role("button", { name: "Retry" }))
        .expectExact(ReloadPage)
        .resolve(ReloadPage, Component.noop),
    )
  })

  it("counts every clear to home, including one that is never rendered", () => {
    Story.make(AppNoDeps, { route: search("hammer") }, (s) =>
      s
        // Cleared and searched again before the next render
        .send(routeChanged(""))
        .send(routeChanged("drill"))
        .model((model) => assert.strictEqual(model.searchesCleared, 1))
        .end(FinishJoin),
    )
  })

  it("keeps the search page when a search starts from home", () => {
    Story.make(AppNoDeps, { route }, (s) =>
      s
        .send(routeChanged("h"))
        .send(routeChanged("hammer"))
        .model((model) => assert.strictEqual(model.searchesCleared, 0))
        .end(FinishJoin),
    )
  })
})
