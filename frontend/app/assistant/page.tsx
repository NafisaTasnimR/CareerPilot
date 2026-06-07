'use client'

import { useEffect, useRef, useState } from 'react'
import AppShell from '@/components/app-shell'
import { Send, Plus, Copy, Check } from 'lucide-react'
import { getBackendUrl, getAuthHeaders } from '@/lib/backend'

type AssistantMessage = {
    role: 'user' | 'assistant'
    content: string
}

type StoredCV = {
    fileId?: string
}

// ─── Minimal markdown renderer ───────────────────────────────────────────────
// Handles: **bold**, `inline code`, ```code blocks```, bullet lists, headings
function MarkdownContent({ content }: { content: string }) {
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

    const copyCode = async (text: string, idx: number) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(text)
                setCopiedIdx(idx)
                setTimeout(() => setCopiedIdx(null), 2000)
            } catch {
                // ignore
            }
        }
    }

    // Split on fenced code blocks first
    const fenceRegex = /```([a-z]*)\n?([\s\S]*?)```/g
    const parts: Array<{ type: 'text' | 'code'; lang?: string; content: string }> = []

    let last = 0
    let match: RegExpExecArray | null
    let codeIdx = 0

    while ((match = fenceRegex.exec(content)) !== null) {
        if (match.index > last) {
            parts.push({ type: 'text', content: content.slice(last, match.index) })
        }
        parts.push({ type: 'code', lang: match[1] || 'text', content: match[2].trimEnd() })
        last = match.index + match[0].length
    }
    if (last < content.length) {
        parts.push({ type: 'text', content: content.slice(last) })
    }

    return (
        <div className="space-y-3">
            {parts.map((part, pi) => {
                if (part.type === 'code') {
                    const idx = codeIdx++
                    return (
                        <div key={pi} className="relative rounded-xl overflow-hidden border border-white/10">
                            {/* Header bar */}
                            <div className="flex items-center justify-between bg-white/5 px-4 py-2 text-xs text-gray-400">
                                <span className="font-mono uppercase tracking-wider">{part.lang}</span>
                                <button
                                    onClick={() => void copyCode(part.content, idx)}
                                    className="inline-flex items-center gap-1.5 hover:text-gray-200 transition-colors"
                                >
                                    {copiedIdx === idx ? (
                                        <><Check className="h-3.5 w-3.5 text-green-400" /><span className="text-green-400">Copied</span></>
                                    ) : (
                                        <><Copy className="h-3.5 w-3.5" />Copy</>
                                    )}
                                </button>
                            </div>
                            <pre className="overflow-x-auto bg-[#0d0d0d] p-4 text-sm font-mono text-gray-200 leading-relaxed">
                                <code>{part.content}</code>
                            </pre>
                        </div>
                    )
                }

                // Render prose: group consecutive table lines, then render line by line
                return (
                    <div key={pi} className="space-y-2">
                        {groupLines(part.content.split('\n')).map((group, gi) => {
                            // ── Table group ──
                            if (group.type === 'table') {
                                const [headerRow, , ...bodyRows] = group.lines  // skip separator row
                                const headers = parseTableRow(headerRow)
                                return (
                                    <div key={gi} className="overflow-x-auto rounded-xl border border-white/10 my-3">
                                        <table className="w-full text-sm border-collapse">
                                            <thead>
                                                <tr className="border-b border-white/10 bg-white/5">
                                                    {headers.map((h, hi) => (
                                                        <th
                                                            key={hi}
                                                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400"
                                                        >
                                                            {renderInline(h)}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bodyRows.map((row, ri) => {
                                                    const cells = parseTableRow(row)
                                                    return (
                                                        <tr
                                                            key={ri}
                                                            className="border-b border-white/6 last:border-0 hover:bg-white/3 transition-colors"
                                                        >
                                                            {cells.map((cell, ci) => (
                                                                <td
                                                                    key={ci}
                                                                    className="px-4 py-3 text-sm leading-6 text-gray-300 align-top"
                                                                >
                                                                    {renderInline(cell)}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            }

                            // ── Prose lines ──
                            return group.lines.map((line, li) => {
                                const key = `${gi}-${li}`

                                // Empty line → spacer
                                if (!line.trim()) return <div key={key} className="h-1" />

                                // Horizontal rule: --- or ***
                                if (/^[-*]{3,}\s*$/.test(line.trim())) {
                                    return <hr key={key} className="border-white/10 my-2" />
                                }

                                // Heading: #### ### ## #
                                const headingMatch = line.match(/^(#{1,4})\s+(.+)/)
                                if (headingMatch) {
                                    const level = headingMatch[1].length
                                    const text = headingMatch[2]
                                    const cls =
                                        level === 1
                                            ? 'text-lg font-semibold text-white mt-2'
                                            : level === 2
                                                ? 'text-base font-semibold text-gray-100 mt-1'
                                                : level === 3
                                                    ? 'text-sm font-semibold text-gray-200'
                                                    : 'text-xs font-medium text-gray-300'
                                    return <p key={key} className={cls}>{renderInline(text)}</p>
                                }

                                // Bullet list item: - or *
                                const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)/)
                                if (bulletMatch) {
                                    return (
                                        <div key={key} className="flex gap-2.5 items-start">
                                            <span className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-400" />
                                            <span className="text-sm leading-7 text-gray-200">{renderInline(bulletMatch[1])}</span>
                                        </div>
                                    )
                                }

                                // Numbered list: 1. 2.
                                const numberedMatch = line.match(/^(\d+)\.\s+(.+)/)
                                if (numberedMatch) {
                                    return (
                                        <div key={key} className="flex gap-2.5 items-start">
                                            <span className="mt-0.5 text-xs font-mono text-gray-500 flex-shrink-0 w-4">{numberedMatch[1]}.</span>
                                            <span className="text-sm leading-7 text-gray-200">{renderInline(numberedMatch[2])}</span>
                                        </div>
                                    )
                                }

                                // Normal paragraph line
                                return (
                                    <p key={key} className="text-sm leading-7 text-gray-200">
                                        {renderInline(line)}
                                    </p>
                                )
                            })
                        })}
                    </div>
                )
            })}
        </div>
    )
}

// Group consecutive lines: table rows get their own group, everything else is prose
type LineGroup = { type: 'prose' | 'table'; lines: string[] }

function groupLines(lines: string[]): LineGroup[] {
    const groups: LineGroup[] = []
    let i = 0
    while (i < lines.length) {
        const line = lines[i]
        // A table block: current line starts with |, next line is a separator (|---|)
        if (
            line.trim().startsWith('|') &&
            lines[i + 1] &&
            /^\|[\s|:_-]+\|/.test(lines[i + 1].trim())
        ) {
            const tableLines: string[] = []
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i])
                i++
            }
            groups.push({ type: 'table', lines: tableLines })
        } else {
            // Prose: collect until we hit a table block
            const proseLines: string[] = []
            while (
                i < lines.length &&
                !(
                    lines[i].trim().startsWith('|') &&
                    lines[i + 1] &&
                    /^\|[\s|:_-]+\|/.test(lines[i + 1]?.trim() ?? '')
                )
            ) {
                proseLines.push(lines[i])
                i++
            }
            if (proseLines.length) groups.push({ type: 'prose', lines: proseLines })
        }
    }
    return groups
}

// Parse a markdown table row string into cell strings
function parseTableRow(row: string): string[] {
    return row
        .split('|')
        .slice(1, -1)           // drop leading/trailing empty splits
        .map((cell) => cell.trim())
}

// Render inline markdown: **bold**, *italic*, `code`
function renderInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = []
    // Pattern: **bold**, *italic*, `code`
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g
    let last = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
        if (match.index > last) {
            parts.push(text.slice(last, match.index))
        }
        if (match[2]) {
            parts.push(<strong key={match.index} className="font-semibold text-white">{match[2]}</strong>)
        } else if (match[3]) {
            parts.push(<em key={match.index} className="italic text-gray-300">{match[3]}</em>)
        } else if (match[4]) {
            parts.push(
                <code key={match.index} className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-mono text-amber-300">
                    {match[4]}
                </code>
            )
        }
        last = match.index + match[0].length
    }
    if (last < text.length) {
        parts.push(text.slice(last))
    }
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AssistantPage() {
    const [messages, setMessages] = useState<AssistantMessage[]>([])
    const [query, setQuery] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fileId] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null
        try {
            const storedCV = window.localStorage.getItem('userCV')
            if (!storedCV) return null
            const parsed = JSON.parse(storedCV) as StoredCV
            return parsed.fileId ?? null
        } catch {
            return null
        }
    })
    const messagesEndRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const sendMessage = async () => {
        const trimmedQuery = query.trim()
        if (!trimmedQuery || isSending) return

        const userMessage: AssistantMessage = { role: 'user', content: trimmedQuery }
        setMessages((c) => [...c, userMessage])
        setQuery('')
        setError(null)
        setIsSending(true)

        try {
            const authHeaders = await getAuthHeaders()
            const response = await fetch(`${getBackendUrl()}/api/assistant/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeaders['Authorization'],
                },
                body: JSON.stringify({
                    query: trimmedQuery,
                    file_id: fileId,
                    history: messages.map(m => ({ role: m.role, content: m.content }))
                }),
            })

            if (!response.ok) {
                const payload = await response.json().catch(() => null)
                throw new Error(payload?.detail || 'Failed to contact assistant')
            }

            const data = (await response.json()) as { response?: string }
            setMessages((c) => [
                ...c,
                {
                    role: 'assistant',
                    content: data.response?.trim() || 'No response returned from the assistant.',
                },
            ])
        } catch (sendError) {
            const message = sendError instanceof Error ? sendError.message : 'Failed to contact assistant'
            setError(message)
        } finally {
            setIsSending(false)
        }
    }

    return (
        <AppShell>
            {/* Full-height flex column: messages scroll, input sticks to bottom */}
            <div className="flex flex-col h-[calc(100vh-var(--app-shell-header-height,64px))]">

                {/* ── Scrollable message area ── */}
                <div className="flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">

                        {messages.length === 0 && (
                            <p className="text-sm text-gray-500">
                                Ask a question about your CV, a job description, or your next career move.
                            </p>
                        )}

                        {messages.map((message, index) => {
                            if (message.role === 'user') {
                                return (
                                    <div key={`user-${index}`} className="flex justify-end">
                                        <div className="max-w-[75%] rounded-2xl bg-[#2a2a2a] px-5 py-3.5 text-sm leading-7 text-gray-100">
                                            {message.content}
                                        </div>
                                    </div>
                                )
                            }

                            // Assistant: render directly on page background, left-aligned
                            return (
                                <div key={`assistant-${index}`} className="w-full">
                                    <MarkdownContent content={message.content} />
                                </div>
                            )
                        })}

                        {isSending && (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="inline-flex gap-1">
                                    <span className="animate-bounce [animation-delay:0ms]">·</span>
                                    <span className="animate-bounce [animation-delay:150ms]">·</span>
                                    <span className="animate-bounce [animation-delay:300ms]">·</span>
                                </span>
                                Thinking
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* ── Sticky input bar ── */}
                <div className="border-t border-white/6 bg-[#1a1a1a]/80 backdrop-blur-sm px-4 py-4">
                    <div className="mx-auto max-w-3xl space-y-2">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                aria-label="More"
                                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/6 text-gray-200 hover:bg-white/10 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                            </button>

                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        void sendMessage()
                                    }
                                }}
                                placeholder="Ask anything"
                                className="flex-1 rounded-full bg-[#232323] px-5 py-3 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-white/10"
                            />

                            <button
                                type="button"
                                onClick={() => void sendMessage()}
                                disabled={isSending || !query.trim()}
                                aria-label="Send message"
                                className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#f2f2f2] text-[#1d1d1d] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>

                        {error && (
                            <div className="rounded-lg bg-red-950/40 border border-red-800/30 px-4 py-2 text-sm text-red-300">
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    )
}