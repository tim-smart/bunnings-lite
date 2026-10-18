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
