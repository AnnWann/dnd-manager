import { Fragment, type ReactNode } from "react"

type Props = {
  text?: string | null
  className?: string
  emptyFallback?: string
}

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "blockquote"; lines: string[] }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "rule" }

const BLOCK_START = /^(?:#{1,6}\s+|>\s?|[-+*]\s+|\d+\.\s+|(?:---+|___+|\*\*\*+)\s*$)/
const INLINE_MARKDOWN = /(`[^`\n]+`|\*\*\*[^*\n]+?\*\*\*|___[^_\n]+?___|\*\*[^*\n]+?\*\*|__[^_\n]+?__|~~[^~\n]+?~~|\*[^*\n]+?\*|_[^_\n]+?_)/g

export function MarkdownText({
  text,
  className = "",
  emptyFallback = "",
}: Props) {
  const normalized = String(text ?? "").replace(/\r\n?/g, "\n").trim()
  const content = normalized || emptyFallback

  if (!content) return null

  const blocks = parseMarkdownBlocks(content)

  return (
    <div className={`min-w-0 break-words ${className}`}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  )
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split("\n")
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2].trim(),
      })
      index += 1
      continue
    }

    if (/^(?:---+|___+|\*\*\*+)\s*$/.test(line.trim())) {
      blocks.push({ type: "rule" })
      index += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""))
        index += 1
      }
      blocks.push({ type: "blockquote", lines: quoteLines })
      continue
    }

    if (/^[-+*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^[-+*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-+*]\s+/, "").trim())
        index += 1
      }
      blocks.push({ type: "unordered-list", items })
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, "").trim())
        index += 1
      }
      blocks.push({ type: "ordered-list", items })
      continue
    }

    const paragraphLines = [line]
    index += 1

    while (
      index < lines.length &&
      lines[index].trim() &&
      !BLOCK_START.test(lines[index])
    ) {
      paragraphLines.push(lines[index])
      index += 1
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join("\n"),
    })
  }

  return blocks
}

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  if (block.type === "heading") {
    const sizeClass =
      block.level <= 2
        ? "text-base"
        : block.level <= 4
          ? "text-sm"
          : "text-xs"

    return (
      <div
        key={index}
        role="heading"
        aria-level={block.level}
        className={`${index > 0 ? "mt-4" : ""} ${sizeClass} font-semibold leading-6 text-textH`}
      >
        {renderInlineMarkdown(block.text, `heading-${index}`)}
      </div>
    )
  }

  if (block.type === "rule") {
    return <hr key={index} className="my-4 border-border" />
  }

  if (block.type === "blockquote") {
    return (
      <blockquote
        key={index}
        className={`${index > 0 ? "mt-3" : ""} border-l-2 border-accentBorder pl-3 italic text-textMuted`}
      >
        {renderTextWithLineBreaks(block.lines.join("\n"), `quote-${index}`)}
      </blockquote>
    )
  }

  if (block.type === "unordered-list" || block.type === "ordered-list") {
    const List = block.type === "ordered-list" ? "ol" : "ul"
    const listClass = block.type === "ordered-list" ? "list-decimal" : "list-disc"

    return (
      <List
        key={index}
        className={`${index > 0 ? "mt-3" : ""} ${listClass} grid gap-1 pl-5`}
      >
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex} className="pl-1">
            {renderInlineMarkdown(item, `list-${index}-${itemIndex}`)}
          </li>
        ))}
      </List>
    )
  }

  return (
    <p key={index} className={index > 0 ? "mt-3" : ""}>
      {renderTextWithLineBreaks(block.text, `paragraph-${index}`)}
    </p>
  )
}

function renderTextWithLineBreaks(text: string, keyPrefix: string): ReactNode[] {
  return text.split("\n").flatMap((line, index, lines) => {
    const nodes = renderInlineMarkdown(line, `${keyPrefix}-${index}`)
    return index < lines.length - 1
      ? [...nodes, <br key={`${keyPrefix}-break-${index}`} />]
      : nodes
  })
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let tokenIndex = 0

  INLINE_MARKDOWN.lastIndex = 0

  while ((match = INLINE_MARKDOWN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    const key = `${keyPrefix}-${tokenIndex}`

    if (token.startsWith("***") || token.startsWith("___")) {
      nodes.push(
        <strong key={key} className="font-semibold text-textH">
          <em>{token.slice(3, -3)}</em>
        </strong>,
      )
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(
        <strong key={key} className="font-semibold text-textH">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith("~~")) {
      nodes.push(<del key={key}>{token.slice(2, -2)}</del>)
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-bg-subtle px-1 py-0.5 font-mono text-[0.9em] text-textH"
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    }

    lastIndex = match.index + token.length
    tokenIndex += 1
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))

  return nodes.map((node, index) => (
    <Fragment key={`${keyPrefix}-node-${index}`}>{node}</Fragment>
  ))
}
