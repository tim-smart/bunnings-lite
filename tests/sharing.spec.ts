import { expect, test, type BrowserContext, type Page } from "@playwright/test"

const sharedRemote = "ws://127.0.0.1:65535/"

const seedRemote = (context: BrowserContext, remoteUrl: string) =>
  context.addInitScript((value) => {
    localStorage.setItem("remoteUrl", JSON.stringify({ _tag: "Some", value }))
  }, remoteUrl)

async function readSyncSettings(page: Page) {
  await page.getByRole("button", { name: "Sync settings" }).click()
  const settings = {
    remoteUrl: await page.getByLabel("Remote URL").inputValue(),
    identity: await page.getByLabel("Identity").inputValue(),
  }
  await page.getByRole("button", { name: "Close" }).click()
  return settings
}

async function createInvite(context: BrowserContext) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await seedRemote(context, sharedRemote)
  const page = await context.newPage()
  await page.goto("/")
  const settings = await readSyncSettings(page)

  await page.getByRole("button", { name: "Sync settings" }).click()
  await page.getByRole("button", { name: "Copy invite link" }).click()
  const link = new URL(
    await page.evaluate(() => navigator.clipboard.readText()),
  )
  await page.close()
  return { link, settings }
}

test("an invite link sets up another device with the same sync remote and identity", async ({
  context,
  browser,
}) => {
  const { link, settings } = await createInvite(context)

  // Secrets ride in the fragment, which browsers never send to a server.
  expect(link.search).toBe("")
  expect(link.pathname).toBe("/")
  expect(link.hash).not.toBe("")

  const friend = await browser.newContext({ baseURL: link.origin })
  const page = await friend.newPage()
  await page.goto(link.toString())

  const prompt = page.getByRole("dialog", { name: "Join shared sync?" })
  await expect(prompt).toContainText("127.0.0.1:65535")
  await prompt.getByRole("button", { name: "Join" }).click()

  await expect(prompt).toBeHidden()
  await expect.poll(() => new URL(page.url()).hash).toBe("")
  expect(await readSyncSettings(page)).toEqual(settings)
  await friend.close()
})

test("declining an invite keeps the device's existing sync settings", async ({
  context,
  browser,
}) => {
  const { link } = await createInvite(context)

  const friend = await browser.newContext({ baseURL: link.origin })
  await seedRemote(friend, "ws://127.0.0.1:65534/")
  const setup = await friend.newPage()
  await setup.goto("/")
  const existing = await readSyncSettings(setup)
  await setup.close()

  const page = await friend.newPage()
  await page.goto(link.toString())
  const prompt = page.getByRole("dialog", { name: "Join shared sync?" })
  await prompt.getByRole("button", { name: "Cancel" }).click()

  await expect(prompt).toBeHidden()
  await expect.poll(() => new URL(page.url()).hash).toBe("")
  expect(await readSyncSettings(page)).toEqual(existing)
  await friend.close()
})

test("joining while another tab is open asks to close it, then finishes", async ({
  context,
  browser,
}) => {
  const { link, settings } = await createInvite(context)

  const friend = await browser.newContext({ baseURL: link.origin })
  const otherTab = await friend.newPage()
  await otherTab.goto("/")
  const page = await friend.newPage()
  await page.goto(link.toString())
  const prompt = page.getByRole("dialog", { name: "Join shared sync?" })
  await prompt.getByRole("button", { name: "Join" }).click()

  // The other tab keeps the old sync data open, so it can't be discarded yet
  const waiting = page.getByText(/close .*tabs?/i)
  await expect(waiting).toBeVisible()

  await otherTab.close()
  await expect(waiting).toBeHidden()
  expect(await readSyncSettings(page)).toEqual(settings)
  await friend.close()
})

test("a join that fails to save its settings can be retried", async ({
  context,
  browser,
}) => {
  const { link, settings } = await createInvite(context)

  const friend = await browser.newContext({ baseURL: link.origin })
  // Saving the invite's remote fails, like a full storage quota, until the
  // tab allows it
  await friend.addInitScript((remote) => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (value.includes(remote) && !sessionStorage.getItem("allowWrites")) {
        throw new DOMException("Storage is full", "QuotaExceededError")
      }
      return setItem.call(this, key, value)
    }
  }, new URL(sharedRemote).host)
  const page = await friend.newPage()
  await page.goto(link.toString())
  const prompt = page.getByRole("dialog", { name: "Join shared sync?" })
  await prompt.getByRole("button", { name: "Join" }).click()

  // The app doesn't start with half the invite's settings
  const retry = page.getByRole("button", { name: "Retry" })
  await expect(retry).toBeVisible()
  await expect(page.getByRole("button", { name: "Sync settings" })).toBeHidden()

  await page.evaluate(() => sessionStorage.setItem("allowWrites", "1"))
  await retry.click()
  expect(await readSyncSettings(page)).toEqual(settings)
  await friend.close()
})

// Started by playwright.config.ts from tests/support/sync-server.ts
const syncServer = "ws://127.0.0.1:65533/"

// Answers the product API with one product titled after the search query
const mockApi = (context: BrowserContext) =>
  context.routeWebSocket(/65531/, (ws) => {
    ws.onMessage((raw) => {
      for (const line of String(raw).split("\n").filter(Boolean)) {
        const msgs = JSON.parse(line)
        for (const msg of Array.isArray(msgs) ? msgs : [msgs]) {
          if (msg._tag === "Ping") {
            ws.send(JSON.stringify({ _tag: "Pong" }))
            continue
          }
          if (msg._tag !== "Request") continue
          if (msg.tag !== "login" && msg.tag !== "search") continue
          const value =
            msg.tag === "login"
              ? {
                  id: "s1",
                  token: { expires: Date.now() + 86_400_000, token: "t" },
                  location: {
                    _tag: "Unset",
                    country: "New Zealand",
                    website: "NZ",
                    code: "9489",
                    region: "NI_Zone_9",
                    state: "NI",
                  },
                }
              : {
                  totalCount: 1,
                  facets: [],
                  results: [
                    {
                      id: msg.payload.query.replaceAll(" ", "-"),
                      title: msg.payload.query,
                      url: "https://example.com/p",
                      images: [
                        {
                          mime: "image/jpeg",
                          sequence: "0",
                          thumbnailUrl: "https://example.com/t.jpg",
                          url: "https://example.com/i.jpg",
                        },
                      ],
                      price: 20,
                      numberOfReviews: 1,
                      rating: 4,
                    },
                  ],
                }
          ws.send(
            JSON.stringify({
              _tag: "Exit",
              requestId: msg.id,
              exit: { _tag: "Success", value },
            }),
          )
        }
      }
    })
  })

test("joining another identity on the same server discards this device's favorites", async ({
  browser,
}) => {
  const openDevice = async (remoteUrl?: string) => {
    const context = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await mockApi(context)
    if (remoteUrl) await seedRemote(context, remoteUrl)
    const page = await context.newPage()
    await page.goto("/")
    return page
  }
  const favorite = async (page: Page, title: string) => {
    await page.goto(`/?query=${encodeURIComponent(title)}`)
    await page.getByRole("button", { name: "Toggle favorite" }).click()
    await page.getByAltText("Bunnings Logo").click()
    await expect(page.getByText(title)).toBeVisible()
  }
  const copyInviteLink = async (page: Page) => {
    await page.getByRole("button", { name: "Sync settings" }).click()
    await page.getByRole("button", { name: "Copy invite link" }).click()
    const link = await page.evaluate(() => navigator.clipboard.readText())
    await page.getByRole("button", { name: "Close" }).click()
    return link
  }
  const openInvite = async (page: Page, link: string) => {
    await page.goto(link)
    return page.getByRole("dialog", { name: "Join shared sync?" })
  }
  const join = async (page: Page, link: string) => {
    const prompt = await openInvite(page, link)
    await prompt.getByRole("button", { name: "Join" }).click()
    await expect(prompt).toBeHidden()
  }

  const owner = await openDevice(syncServer)
  await favorite(owner, "Shared Hammer")
  const invite = await copyInviteLink(owner)

  const friend = await openDevice(syncServer)
  await favorite(friend, "Friend Drill")
  // Proves the friend's favorite reached the server under their own identity,
  // so the friend's device has sync progress recorded for this server. The
  // checker starts without a remote, so it syncs from scratch when it joins.
  const checker = await openDevice()
  await join(checker, await copyInviteLink(friend))
  await expect(checker.getByText("Friend Drill")).toBeVisible()

  const prompt = await openInvite(friend, invite)
  await expect(prompt).toContainText(/discard/i)
  await prompt.getByRole("button", { name: "Cancel" }).click()
  await friend.reload()
  await expect(friend.getByText("Friend Drill")).toBeVisible()

  await join(friend, invite)
  await expect(friend.getByText("Shared Hammer")).toBeVisible()
  await expect(friend.getByText("Friend Drill")).toBeHidden()
  await friend.reload()
  await expect(friend.getByText("Shared Hammer")).toBeVisible()
  await expect(friend.getByText("Friend Drill")).toBeHidden()

  // Once the friend's new favorite reaches the owner, anything else the friend
  // uploaded would have arrived too.
  await favorite(friend, "Joined Saw")
  await expect(owner.getByText("Joined Saw")).toBeVisible()
  await expect(owner.getByText("Friend Drill")).toBeHidden()
  // The friend's old identity keeps its data on the server
  await expect(checker.getByText("Friend Drill")).toBeVisible()
})
