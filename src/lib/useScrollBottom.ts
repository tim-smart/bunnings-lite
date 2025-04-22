import { useEffect, useRef } from "react"

export function useScrollBottom(f: () => void) {
  const bottomRef = useRef(false)

  useEffect(() => {
    let scrollHeight = document.body.scrollHeight

    const onscroll = () => {
      const scrolledTo = window.scrollY + window.innerHeight
      const threshold = window.innerHeight

      const newScrollHeight = document.body.scrollHeight
      const scrollHeightChanged = scrollHeight !== newScrollHeight
      scrollHeight = newScrollHeight

      const isReachBottom = newScrollHeight - threshold <= scrolledTo

      if (isReachBottom && (!bottomRef.current || scrollHeightChanged)) {
        bottomRef.current = true
        f()
      } else if (!isReachBottom) {
        bottomRef.current = false
      }
    }

    window.addEventListener("scroll", onscroll)

    return () => {
      window.removeEventListener("scroll", onscroll)
    }
  }, [bottomRef])
}
