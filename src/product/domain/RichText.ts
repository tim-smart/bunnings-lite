/**
 * Product descriptions and reviews arrive as third-party HTML and Markdown.
 * This turns them into a tree of the few elements worth keeping, so nothing
 * else in the source can reach the page: unknown tags are unwrapped, scripts
 * and the like are dropped with their content, and the only attribute kept
 * is a link's `href`, when it is a web, mail or phone address.
 */
export type RichNode =
  | { readonly type: "text"; readonly text: string }
  | {
      readonly type: "element"
      readonly tag: RichTag
      readonly href?: string
      readonly children: ReadonlyArray<RichNode>
    }

const tags = [
  "p",
  "br",
  "hr",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "u",
  "a",
  "code",
  "pre",
  "blockquote",
  "sup",
  "sub",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
] as const
export type RichTag = (typeof tags)[number]

const allowed: ReadonlySet<string> = new Set(tags)
const renamed: Readonly<Record<string, RichTag>> = {
  b: "strong",
  i: "em",
  // The page already has its own headings above these
  h1: "h3",
  h2: "h3",
}
const blockTags: ReadonlySet<string> = new Set([
  "p",
  "hr",
  "ul",
  "ol",
  "pre",
  "blockquote",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
])
const voidTags: ReadonlySet<string> = new Set(["br", "hr"])
// Dropped along with everything inside them
const droppedTags: ReadonlySet<string> = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "template",
  "noscript",
  "svg",
  "math",
  "head",
  "title",
  "form",
  "select",
  "textarea",
  "button",
])
// Unwrapped, but they still separate paragraphs
const breakingTags: ReadonlySet<string> = new Set([
  "div",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
])

const entities: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  ndash: "\u2013",
  mdash: "\u2014",
  hellip: "\u2026",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  deg: "\u00b0",
  times: "\u00d7",
  frac12: "\u00bd",
  frac14: "\u00bc",
  frac34: "\u00be",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  bull: "\u2022",
  middot: "\u00b7",
}

const decodeEntities = (text: string): string =>
  text.replace(
    /&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi,
    (match, name: string) => {
      if (name[0] !== "#") return entities[name.toLowerCase()] ?? match
      const code =
        name[1] === "x" || name[1] === "X"
          ? Number.parseInt(name.slice(2), 16)
          : Number.parseInt(name.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match
    },
  )

const safeHref = (href: string | undefined): string | undefined => {
  if (href === undefined) return undefined
  const trimmed = decodeEntities(href).trim()
  return /^(https?:\/\/|mailto:|tel:)/i.test(trimmed) ? trimmed : undefined
}

const hrefOf = (attributes: string): string | undefined => {
  const match = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
    attributes,
  )
  return match === null ? undefined : (match[1] ?? match[2] ?? match[3])
}

type Frame = {
  readonly tag: RichTag | undefined
  readonly href: string | undefined
  readonly children: Array<RichNode>
}

const text = (value: string): RichNode => ({ type: "text", text: value })

const element = (
  tag: RichTag,
  children: ReadonlyArray<RichNode>,
  href?: string,
): RichNode =>
  href === undefined
    ? { type: "element", tag, children }
    : { type: "element", tag, href, children }

const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g

// Reads the source as HTML, keeping the allowed elements and all of the text
const parseHtml = (source: string, keepElements: boolean): Array<RichNode> => {
  const stack: Array<Frame> = [
    { tag: undefined, href: undefined, children: [] },
  ]
  const top = () => stack[stack.length - 1]
  const close = () => {
    const frame = stack.pop()!
    top().children.push(element(frame.tag!, frame.children, frame.href))
  }
  const closeTo = (tag: string, within?: ReadonlySet<string>) => {
    for (let i = stack.length - 1; i > 0; i--) {
      const open = stack[i].tag!
      if (open === tag) {
        while (stack.length > i) close()
        return
      }
      if (within !== undefined && within.has(open)) return
    }
  }

  let dropping: string | undefined
  let depth = 0
  let last = 0
  for (const match of source.matchAll(token)) {
    const before = source.slice(last, match.index)
    last = match.index + match[0].length
    if (dropping === undefined && before !== "") {
      top().children.push(text(decodeEntities(before)))
    }
    if (match[2] === undefined) continue
    const closing = match[1] === "/"
    const name = match[2].toLowerCase()

    if (dropping !== undefined) {
      if (name === dropping) depth += closing ? -1 : 1
      if (depth === 0) dropping = undefined
      continue
    }
    if (droppedTags.has(name)) {
      if (!closing && !match[3].trimEnd().endsWith("/")) {
        dropping = name
        depth = 1
      }
      continue
    }
    if (breakingTags.has(name)) {
      top().children.push(text("\n\n"))
      continue
    }
    const tag = renamed[name] ?? name
    if (!keepElements || !allowed.has(tag)) continue
    if (closing) {
      closeTo(tag)
      continue
    }
    if (voidTags.has(tag)) {
      top().children.push(element(tag as RichTag, []))
      continue
    }
    // HTML lets these go unclosed before the next one opens
    if (tag === "li") closeTo("li", new Set(["ul", "ol"]))
    if (tag === "p") closeTo("p")
    stack.push({
      tag: tag as RichTag,
      href: tag === "a" ? safeHref(hrefOf(match[3])) : undefined,
      children: [],
    })
  }
  const rest = source.slice(last)
  if (dropping === undefined && rest !== "") {
    top().children.push(text(decodeEntities(rest)))
  }
  while (stack.length > 1) close()
  return stack[0].children
}

const inlineMark =
  /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\s][^*\n]*)\*|`([^`\n]+)`/g

// Markdown's inline marks: links, bold, emphasis and code
const inline = (source: string): Array<RichNode> => {
  const nodes: Array<RichNode> = []
  let last = 0
  for (const match of source.matchAll(inlineMark)) {
    if (match.index > last) nodes.push(text(source.slice(last, match.index)))
    last = match.index + match[0].length
    if (match[1] !== undefined) {
      const href = safeHref(match[2])
      nodes.push(
        href === undefined
          ? text(match[1])
          : element("a", inline(match[1]), href),
      )
    } else if (match[3] !== undefined || match[4] !== undefined) {
      nodes.push(element("strong", inline(match[3] ?? match[4]!)))
    } else if (match[5] !== undefined) {
      nodes.push(element("em", inline(match[5])))
    } else {
      nodes.push(element("code", [text(match[6]!)]))
    }
  }
  if (last < source.length) nodes.push(text(source.slice(last)))
  return nodes
}

const marked = (nodes: ReadonlyArray<RichNode>): Array<RichNode> =>
  nodes.flatMap((node) =>
    node.type === "text"
      ? inline(node.text)
      : node.tag === "code" || node.tag === "pre"
        ? [node]
        : [element(node.tag, marked(node.children), node.href)],
  )

const isBlank = (nodes: ReadonlyArray<RichNode>) =>
  nodes.every((node) => node.type === "text" && node.text.trim() === "")

// Groups the top level into blocks: Markdown's paragraphs, lists and
// headings from the loose text, and the block elements as they are
const blocks = (nodes: ReadonlyArray<RichNode>): Array<RichNode> => {
  const out: Array<RichNode> = []
  let paragraph: Array<RichNode> = []
  let list:
    { readonly tag: "ul" | "ol"; readonly items: Array<RichNode> } | undefined

  const flushParagraph = () => {
    if (!isBlank(paragraph)) out.push(element("p", marked(paragraph)))
    paragraph = []
  }
  const flushList = () => {
    if (list !== undefined) out.push(element(list.tag, list.items))
    list = undefined
  }
  const flush = () => {
    flushParagraph()
    flushList()
  }

  for (const node of nodes) {
    if (node.type === "element") {
      if (blockTags.has(node.tag)) {
        flush()
        out.push(...marked([node]))
      } else {
        flushList()
        paragraph.push(node)
      }
      continue
    }
    const lines = node.text.split("\n")
    lines.forEach((line, index) => {
      // A line of loose text starts where the last one ended or after a break
      const startsLine = index > 0 || paragraph.length === 0
      const item = startsLine
        ? /^\s*(?:([-*+\u2022])|\d+[.)])\s+(.*)$/.exec(line)
        : null
      const heading = startsLine ? /^\s*(#{1,6})\s+(.*)$/.exec(line) : null
      if (item !== null) {
        flushParagraph()
        const tag = item[1] === undefined ? "ol" : "ul"
        if (list !== undefined && list.tag !== tag) flushList()
        list ??= { tag, items: [] }
        list.items.push(element("li", inline(item[2])))
      } else if (heading !== null) {
        flush()
        const level = Math.max(3, heading[1].length)
        out.push(element(`h${level}` as RichTag, inline(heading[2])))
      } else if (line.trim() === "") {
        // A blank line between two others ends the paragraph
        if (index > 0 && index < lines.length - 1) flush()
        else if (paragraph.length > 0) paragraph.push(text(" "))
      } else {
        flushList()
        paragraph.push(text(index > 0 ? `\n${line}` : line))
      }
    })
  }
  flush()
  return out
}

/**
 * Parses third-party text into safe blocks. With `html`, the allowed HTML
 * elements in it are kept; without, every tag is removed and only the
 * Markdown is read.
 */
export const parseRichText = (
  source: string,
  options: { readonly html: boolean },
): ReadonlyArray<RichNode> => blocks(parseHtml(source, options.html))
