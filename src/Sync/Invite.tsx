import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Check, Copy, TriangleAlert } from "lucide-react"
import * as Option from "effect/Option"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { identityAtom, remoteUrlAtom } from "@/EventLog"
import { inviteLinkAtom, pendingInviteAtom, type Invite } from "./atoms"

export function CopyInviteButton() {
  const link = useAtomValue(inviteLinkAtom)
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="flex gap-2 text-amber-900">
        <TriangleAlert className="size-4 shrink-0 mt-0.5" />
        <span>
          An invite link gives full access to your synced favorites. Whoever has
          it can read, change and clear them, from any device, and it can't be
          revoked later. Only send it to people you trust.
        </span>
      </p>
      <Button
        variant="outline"
        disabled={Option.isNone(link)}
        onClick={() => {
          if (Option.isNone(link)) return
          navigator.clipboard.writeText(link.value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          })
        }}
      >
        {copied ? <Check /> : <Copy />}
        Copy invite link
      </Button>
      {Option.isNone(link) && (
        <p className="text-muted-foreground">
          Set a remote URL to create an invite.
        </p>
      )}
      {copied && (
        <p role="status" className="text-muted-foreground">
          Copied. Send it privately.
        </p>
      )}
    </div>
  )
}

export function InviteDialog() {
  const [pending, setPending] = useAtom(pendingInviteAtom)
  const dismiss = () => setPending(Option.none())
  // Keep the content rendered while the drawer animates closed
  const shown = useRef(pending)
  if (Option.isSome(pending)) shown.current = pending

  return (
    <Drawer
      open={Option.isSome(pending)}
      onOpenChange={(open) => {
        if (!open) dismiss()
      }}
    >
      <DrawerContent className="max-w-md mx-auto">
        {Option.isSome(shown.current) &&
          (shown.current.value._tag === "Valid" ? (
            <JoinPrompt invite={shown.current.value.invite} onDone={dismiss} />
          ) : (
            <InvalidInvite onDone={dismiss} />
          ))}
      </DrawerContent>
    </Drawer>
  )
}

function JoinPrompt({
  invite,
  onDone,
}: {
  readonly invite: Invite
  readonly onDone: () => void
}) {
  const [currentRemote, setRemoteUrl] = useAtom(remoteUrlAtom)
  const setIdentity = useAtomSet(identityAtom)

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Join shared sync?</DrawerTitle>
        <DrawerDescription>
          This invite connects this device to{" "}
          <span className="font-medium text-foreground">
            {invite.remoteUrl.host}
          </span>{" "}
          using the identity of whoever created it.
        </DrawerDescription>
      </DrawerHeader>
      <div className="px-4 text-sm flex flex-col gap-3">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>
            Everyone with this invite shares one set of favorites, with full
            access to read, change and clear them.
          </li>
          <li>
            Favorites already on this device will sync to the new remote, where
            the invite's creator can see them.
          </li>
          <li>Access can't be revoked later.</li>
          <li>
            This replaces this device's identity
            {Option.match(currentRemote, {
              onNone: () => null,
              onSome: (url) => ` and its current remote (${url.host})`,
            })}
            .
          </li>
        </ul>
        <p className="text-muted-foreground">
          Bunnings Lite can't check who made an invite. Only join if you know
          the sender and were expecting it.
        </p>
      </div>
      <DrawerFooter>
        <Button variant="outline" autoFocus onClick={onDone}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            setRemoteUrl(Option.some(invite.remoteUrl))
            setIdentity(invite.identity)
            onDone()
          }}
        >
          Join
        </Button>
      </DrawerFooter>
    </>
  )
}

function InvalidInvite({ onDone }: { readonly onDone: () => void }) {
  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Invite link not valid</DrawerTitle>
        <DrawerDescription>
          This link is incomplete or damaged, so your sync settings were left
          unchanged. Ask for a new invite.
        </DrawerDescription>
      </DrawerHeader>
      <DrawerFooter>
        <Button variant="outline" onClick={onDone}>
          Close
        </Button>
      </DrawerFooter>
    </>
  )
}
