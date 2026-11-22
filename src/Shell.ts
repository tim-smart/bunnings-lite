import { Effect, Layer, Option, Schema, Stream } from "effect"
import { EventLog } from "effect/eventlog"
import { AsyncResult } from "effect/reactivity"
import { Command, Component, Head, Router, Subscription } from "@effect/ui"
import { DomCommand, Html } from "@effect/ui/html"
import { SessionLocation } from "../server/src/domain/Bunnings.ts"
import { buttonClass, inputClass } from "./design/classes.ts"
import { drawerLeft } from "./design/drawer.ts"
import { icon } from "./design/icons.ts"
import { ListFavoritesRefresh } from "./favorites/queries/ListFavorites.ts"
import { Favorites } from "./favorites/services/Favorites.ts"
import { FavoritesRepo } from "./favorites/services/FavoritesRepo.ts"
import { ProductPage } from "./pages/product/ProductPage.ts"
import { SearchPage } from "./pages/SearchPage.ts"
import { KnownProducts } from "./product/services/KnownProducts.ts"
import { AppRoute, queryOf } from "./routes.ts"
import { Session } from "./rpc/services/Session.ts"
import { searchArgs, searchDebounce } from "./search/domain/Search.ts"
import { SearchProducts } from "./search/queries/SearchProducts.ts"
import { StoreSearch } from "./stores/components/StoreSearch.ts"
import { StoreSearchPrompt } from "./stores/services/StoreSearchPrompt.ts"
import { InviteDialog } from "./sync/components/InviteDialog.ts"
import { SyncSettingsPanel } from "./sync/components/SyncSettingsPanel.ts"
import { Invites } from "./sync/services/Invites.ts"
import { SyncRemote } from "./sync/services/SyncRemote.ts"
import { SyncSettings } from "./sync/services/SyncSettings.ts"

/** The drawers `Shell` mounts for as long as they are on the screen. */
const Sheet = Schema.Literals(["syncSettings", "storeSearch"])

export const ShellMessage = Schema.TaggedUnion({
  SearchTyped: { text: Schema.String },
  SearchSubmitted: {},
  SearchWanted: {},
  SyncSettingsOpened: {},
  SyncSettingsClosed: {},
  InviteChanged: { open: Schema.Boolean },
  StoreSearchAsked: { asking: Schema.Boolean },
  StoreSearchAnswered: { store: Schema.Option(SessionLocation) },
  DrawerLeft: { drawer: Sheet },
})
const Message = ShellMessage

/**
 * Answers the store selector's search of every store with the store the
 * drawer came back with, or with none.
 */
export class AnswerStoreSearch extends Command.Service<AnswerStoreSearch>()(
  "Shell/AnswerStoreSearch",
  {
    args: { store: Schema.Option(SessionLocation) },
  },
  Effect.gen(function* () {
    const prompt = yield* StoreSearchPrompt
    return ({ store }) => Effect.as(prompt.answer(store), Component.noop)
  }),
) {}

const storeSearchAskedSubscription = Subscription.make(
  "Shell/storeSearchAsked",
  Stream.unwrap(
    Effect.map(StoreSearchPrompt, (prompt) =>
      prompt.asking.pipe(
        Stream.map((asking) =>
          Message.make({ _tag: "StoreSearchAsked", asking }),
        ),
      ),
    ),
  ),
)

const headerRef = Html.ref("header", "header")
const searchRef = Html.ref("search", "input")
const syncSettingsRef = Html.ref("sync-settings-open", "button")

const focusSyncSettings = DomCommand.focus(syncSettingsRef, () => Component.noop)
const noStoreFound = AnswerStoreSearch.make({ store: Option.none() })

/** Which drawer is open, if any. Only one is open at a time. */
const Drawer = Schema.NullOr(
  Schema.Literals(["syncSettings", "storeSearch", "invite"]),
)

const ShellModel = Schema.Struct({
  /** The drawer that is open. */
  drawer: Drawer,
  /** Drawers that were closed and are still sliding off the screen. */
  leaving: Schema.Array(Sheet),
})
type ShellModel = typeof ShellModel.Type

/** Opens `drawer`, which comes back up if it was still on its way out. */
const opened = (
  model: ShellModel,
  drawer: NonNullable<typeof Drawer.Type>,
): ShellModel => ({
  drawer,
  leaving: model.leaving.filter((sheet) => sheet !== drawer),
})

/**
 * Closes the open drawer. One that `Shell` mounts stays mounted while it
 * slides away, until `DrawerLeft`.
 */
const closed = (model: ShellModel): ShellModel =>
  model.drawer === null || model.drawer === "invite"
    ? { ...model, drawer: null }
    : {
        drawer: null,
        leaving: [
          ...model.leaving.filter((sheet) => sheet !== model.drawer),
          model.drawer,
        ],
      }

const ShellDef = Component.define({
  name: "Shell",
  scoped: false,
  props: Schema.Struct({
    route: AppRoute,
    /** Starts the search page over when it changes. */
    searchesCleared: Schema.Number,
  }),
  model: ShellModel,
  message: Message,
  // The search itself belongs to the search page. It is watched here as
  // well, for the search box to show while it is running.
  queries: {
    results: {
      query: SearchProducts,
      debounce: searchDebounce,
      args: (_model, props) => searchArgs(props.route),
    },
  },
})

// Typing in the search box searches from any page
const searchTyped = ShellDef.update("SearchTyped", (_model, { text }, $) => {
  const { route } = $.props
  return route._tag === "Search"
    ? // A new search starts without the last one's filters
      $.run(
        Router.patchSearch(AppRoute, route, {
          query: text,
          priceMin: undefined,
          priceMax: undefined,
          ratingMin: undefined,
          ratingMax: undefined,
        }).pipe(Command.asNoop),
      )
    : $.run(
        Router.push(
          AppRoute,
          AppRoute.make({ _tag: "Search", search: { query: text } }),
        ).pipe(Command.asNoop),
      )
})

// An invite takes the place of whichever drawer is open
const inviteChanged = ShellDef.update("InviteChanged", (model, { open }, $) => {
  if (open) {
    const next = opened(closed(model), "invite")
    // The selector is still waiting to hear from its search
    return model.drawer === "storeSearch" ? $.set(next).run(noStoreFound) : next
  }
  // An invite has nothing on the page that opened it, so focus goes to the
  // button for what it was about
  return model.drawer === "invite"
    ? $.set(closed(model)).run(focusSyncSettings)
    : model
})

const storeSearchAsked = ShellDef.update(
  "StoreSearchAsked",
  (model, { asking }, $) => {
    if (!asking) {
      // Without an answer when the page that asked has gone
      return model.drawer === "storeSearch" ? closed(model) : model
    }
    if (model.drawer === null) return opened(model, "storeSearch")
    // Asked just as another drawer opened, which keeps its place
    return model.drawer === "storeSearch" ? model : $.run(noStoreFound)
  },
)

// Closed here first, so the page is live before the selector hears
const storeSearchAnswered = ShellDef.update(
  "StoreSearchAnswered",
  (model, { store }, $) =>
    $.set(model.drawer === "storeSearch" ? closed(model) : model).run(
      AnswerStoreSearch.make({ store }),
    ),
)

const logo = ShellDef.fragment((h, minimize: boolean) =>
  h.div
    .class(
      "row-start-1",
      minimize
        ? "col-start-1 justify-self-start"
        : "col-start-2 justify-self-center pt-8 md:pt-12",
    )
    .children(
      h.a
        .attr("href", "/")
        .class(
          "block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
        )
        .children(
          h.img
            .attr("src", "/logo.svg")
            .attr("alt", "Bunnings Logo")
            .attr("width", "150")
            .attr("height", "50")
            .class(
              "block w-auto transition-[height,opacity] hover:opacity-90 active:opacity-80",
              minimize ? "h-[30px] md:h-[34px]" : "h-[50px] md:h-[60px]",
            ),
        ),
    ),
)

const syncSettingsButton = ShellDef.fragment((h) =>
  h.div.class("col-start-3 row-start-1 self-start justify-self-end").children(
    h.button
      .ref(syncSettingsRef)
      .attr("type", "button")
      .attr("aria-label", "Sync settings")
      .class(
        "grid size-10 cursor-pointer place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
      )
      .onClick(Message.make({ _tag: "SyncSettingsOpened" }))
      .children(icon(h, "settings2", { class: "size-5" })),
  ),
)

const searchBox = ShellDef.fragment(
  (h, query: string, minimize: boolean, loading: boolean) =>
    h.div
      .class(
        "col-span-3 row-start-2",
        minimize && "md:col-span-1 md:col-start-2 md:row-start-1",
      )
      .children(
        h.div
          .class("relative w-full mx-auto", minimize ? "max-w-2xl" : "max-w-xl")
          .children(
            icon(h, loading ? "loaderCircle" : "search", {
              class: Html.classNames(
                "pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-primary",
                loading && "animate-spin",
              ),
            }),
            h.form
              .attr("role", "search")
              .onSubmit(Message.make({ _tag: "SearchSubmitted" }))
              .children(
                h.input
                  .ref(searchRef)
                  .attr("type", "search")
                  .attr("aria-label", "Search for products")
                  .attr("placeholder", "Search for products...")
                  // Only on the home page, which is there to search from. The
                  // Router focuses it after each navigation that finds it, and
                  // on a phone that brings the keyboard up over the page.
                  .attr("autofocus", minimize ? undefined : "")
                  .class(
                    inputClass(
                      Html.classNames(
                        "w-full pl-12 pr-4 border-2 border-card rounded-lg bg-card text-base md:text-base hover:border-card focus-visible:border-secondary focus-visible:ring-3 focus-visible:ring-secondary/20",
                        minimize ? "h-11 md:h-12" : "h-13 md:h-14 md:text-lg",
                      ),
                    ),
                  )
                  .value(query)
                  .onInput(({ value }) =>
                    Message.make({ _tag: "SearchTyped", text: value }),
                  ),
              ),
          ),
      ),
)

/** The logo, the sync settings button and the search box. */
const header = ShellDef.fragment((h) => {
  const { route } = h.props
  const query = queryOf(route)
  // The header shrinks once there is something else to look at
  const minimize = route._tag !== "Search" || query.trim() !== ""
  const loading =
    searchArgs(route) !== undefined &&
    (AsyncResult.isInitial(h.queries.results) || h.queries.results.waiting)

  return h.header
    .ref(headerRef)
    .class("px-3 sm:px-6 text-white")
    .children(
      h.div
        .class(
          "container mx-auto max-w-7xl grid grid-cols-[1fr_auto_1fr] items-center gap-x-6",
          minimize
            ? "py-3 gap-y-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:py-4"
            : "pt-4 pb-12 gap-y-10 md:pb-16 md:gap-y-12",
        )
        .children(
          logo(h, minimize),
          syncSettingsButton(h),
          searchBox(h, query, minimize, loading),
        ),
    )
})

// A page that fails stays failed until the app starts again, so the way out
// is a full page load, which a link with a `target` is.
const pageFailed = ShellDef.fragment((h, route: AppRoute) =>
  h.div
    .attr("role", "alert")
    .class(
      "mt-6 flex flex-col items-center gap-2 rounded-xl bg-card px-6 py-14 text-center",
    )
    .children(
      h.h1.class("text-lg font-bold").children("Something went wrong"),
      h.p
        .class("text-sm text-muted-foreground")
        .children("This page hit a problem and couldn't be shown."),
      h.a
        .attr("href", AppRoute.print(route))
        .attr("target", "_top")
        .class(buttonClass({ class: "mt-3" }))
        .children("Reload"),
    ),
)

const notFound = ShellDef.fragment((h) =>
  h.div
    .class(
      "mt-6 flex flex-col items-center gap-2 rounded-xl bg-card px-6 py-14 text-center",
    )
    .key("not-found")
    .children(
      h.h1.class("text-lg font-bold").children("Page not found"),
      h.p
        .class("text-sm text-muted-foreground")
        .children("That address doesn't lead anywhere."),
      h.a
        .attr("href", "/")
        .class(buttonClass({ class: "mt-3" }))
        .children("Back to search"),
    ),
)

/** The page the route names. */
const page = ShellDef.fragment((h, route: AppRoute) => {
  const failed = () => pageFailed(h, route)
  return AppRoute.match(route, {
    Search: (route) =>
      SearchPage(h, {
        // A new search page for each search after clearing to home, so it
        // can't show the last search's results while the next one loads. A
        // search started from home keeps the page, so it is still debounced.
        key: `search:${h.props.searchesCleared}`,
        props: { route },
        onEmit: () => Message.make({ _tag: "SearchWanted" }),
        fallback: failed,
      }),
    Product: (route) =>
      ProductPage(h, {
        key: `product:${route.params.id}`,
        props: { id: route.params.id },
        fallback: failed,
      }),
    NotFound: () => notFound(h),
  })
})

/**
 * The invite dialog is always mounted, to hear of invites. The other drawers
 * are mounted while they are open, and then until they have slid away.
 */
const drawers = ShellDef.fragment((h, { drawer, leaving }: ShellModel) => {
  const shown = (sheet: typeof Sheet.Type) =>
    drawer === sheet || leaving.includes(sheet)
  return [
    InviteDialog(h, {
      key: "invite",
      onEmit: ({ _tag }) =>
        Message.make({ _tag: "InviteChanged", open: _tag === "Opened" }),
    }),
    shown("syncSettings") &&
      SyncSettingsPanel(h, {
        key: "sync-settings",
        props: { open: drawer === "syncSettings" },
        onEmit: () => Message.make({ _tag: "SyncSettingsClosed" }),
      }),
    shown("storeSearch") &&
      StoreSearch(h, {
        key: "store-search",
        props: { open: drawer === "storeSearch" },
        onEmit: ({ store }) =>
          Message.make({ _tag: "StoreSearchAnswered", store }),
      }),
  ] as const
})

const shellView = ShellDef.view((model, h) =>
  h.div(
    // A drawer is a modal: nothing behind it can be reached while it is open
    h.div
      .class("flex min-h-screen flex-col bg-brand")
      .children(
        header(h),
        h.main
          .class("flex-1 bg-canvas px-3 sm:px-6 pb-24")
          .children(
            h.div
              .class("container mx-auto max-w-7xl")
              .children(page(h, h.props.route)),
          ),
      ),
    ...drawers(h, model),
  ),
)

/**
 * The frame around every page: the header with the logo, the search box and
 * the sync settings, and the page the route names. It is mounted once any
 * pending join is finished, and provides the services its pages share.
 *
 * The drawers are mounted here too, because only one is open at a time. An
 * invite can arrive at any moment, and closes whichever is open.
 */
export const ShellNoDeps = ShellDef.make({
  init: () => ({ drawer: null, leaving: [] }),
  update: {
    SearchTyped: searchTyped,
    SearchSubmitted: (_model, _message, $) =>
      $.run(DomCommand.blur(searchRef, () => Component.noop)),
    SearchWanted: (_model, _message, $) =>
      $.run(
        DomCommand.focus(searchRef, () => Component.noop, { preventScroll: true }),
        DomCommand.scrollIntoView(headerRef, () => Component.noop, {
          behavior: "smooth",
          block: "start",
        }),
      ),
    SyncSettingsOpened: (model) =>
      model.drawer === null ? opened(model, "syncSettings") : model,
    // The host hands focus back to the button that opened it
    SyncSettingsClosed: (model) =>
      model.drawer === "syncSettings" ? closed(model) : model,
    InviteChanged: inviteChanged,
    StoreSearchAsked: storeSearchAsked,
    StoreSearchAnswered: storeSearchAnswered,
    DrawerLeft: (model, { drawer }) => ({
      ...model,
      leaving: model.leaving.filter((sheet) => sheet !== drawer),
    }),
  },
  subscriptions: (model) => [
    storeSearchAskedSubscription,
    ...model.leaving.map((drawer) =>
      drawerLeft(drawer, Message.make({ _tag: "DrawerLeft", drawer })),
    ),
  ],
  head: (_model, { route }) =>
    route._tag === "NotFound" ? [Head.title("Page not found")] : [],
  view: shellView,
})

// One of each for the whole app. A component below that provides the same
// Layer gets the one built here: the session's login, the open journal and
// the connection to the sync remote aren't made twice.
const Shared = Layer.mergeAll(
  Session.layer,
  KnownProducts.layer,
  SyncSettings.layer,
  FavoritesRepo.layer,
  EventLog.layerRegistry,
  Favorites.layer,
  SyncRemote.layer,
  Invites.layer,
  StoreSearchPrompt.layer,
)

export const Shell = ShellNoDeps.pipe(
  Component.provide(
    Layer.mergeAll(
      SearchProducts.layer,
      AnswerStoreSearch.layer,
      ListFavoritesRefresh,
    ).pipe(Layer.provideMerge(Shared)),
  ),
)
