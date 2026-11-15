import { Context, Layer, Stream } from "effect"

/**
 * Values handed to the app in the URL fragment, such as `#invite=...`. A
 * fragment is never sent to a server, and it is removed from the address bar
 * as soon as it is read.
 */
export class UrlFragment extends Context.Service<
  UrlFragment,
  {
    /**
     * The value of `name` the page was opened with, if any, then each one a
     * later fragment change brings. An installed app reuses its window for a
     * new link, which only changes the fragment.
     */
    readonly values: (name: string) => Stream.Stream<string>
  }
>()("browser/UrlFragment") {
  // Built before the Router, so the fragment is gone before anything else
  // reads the URL.
  static readonly layer = Layer.sync(UrlFragment, () => {
    const take = (): URLSearchParams => {
      const params = new URLSearchParams(location.hash.slice(1))
      if (location.hash !== "") {
        history.replaceState(
          history.state,
          "",
          location.pathname + location.search,
        )
      }
      return params
    }
    const initial = take()
    return {
      values: (name) =>
        Stream.concat(
          Stream.sync(() => initial),
          Stream.fromEventListener(window, "hashchange").pipe(Stream.map(take)),
        ).pipe(
          Stream.map((params) => params.get(name)),
          Stream.filter((value) => value !== null),
        ),
    }
  })
}
