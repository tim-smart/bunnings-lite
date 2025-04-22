import { useEffect, useMemo, useRef } from "react"

export function useScrollBottom(f: () => void) {
  const bottomRef = useRef(false)
  const fn = useMemo(() => f, [])

  useEffect(() => {
    const onscroll = () => {
      const scrolledTo = window.scrollY + window.innerHeight
      const threshold = 500
      const isReachBottom = document.body.scrollHeight - threshold <= scrolledTo
      if (isReachBottom && !bottomRef.current) {
        bottomRef.current = true
        fn()
      } else if (!isReachBottom) {
        bottomRef.current = false
      }
    }
    window.addEventListener("scroll", onscroll)
    return () => {
      window.removeEventListener("scroll", onscroll)
    }
  }, [bottomRef, fn])
}
