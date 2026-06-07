'use client'

import { useEffect, useState } from 'react'
import {
    Briefcase,
    BookOpen,
    Code,
    Zap,
    AlertCircle,
    Loader2,
    RefreshCcw,
} from 'lucide-react'
import { getBackendUrl, getAuthHeaders } from '@/lib/backend'

interface CVParsedItem {
    section: string
    content: string
}

interface CVEmbeddedSection {
    section: string
    items: CVParsedItem[]
}

interface CVEmbeddedDataResponse {
    file_id: string
    chunk_count: number
    collection: string
    sections: CVEmbeddedSection[]
}

const SECTION_ALIASES: Record<string, string[]> = {
    experience: ['experience', 'work experience', 'professional experience', 'employment history', 'career history'],
    education: ['education', 'education and training', 'academic background', 'academic history', 'qualifications'],
    skills: ['skills', 'technical skills', 'core skills', 'competencies', 'core competencies'],
    projects: ['projects', 'project experience', 'selected projects', 'project portfolio'],
}

function normalizeSectionKey(section: string) {
    const normalized = section.trim().toLowerCase()
    const entry = Object.entries(SECTION_ALIASES).find(([, aliases]) =>
        aliases.includes(normalized)
    )
    return entry?.[0] ?? normalized
}

const SUMMARY_LIMIT = 160

function summarizeContent(text: string, limit: number = SUMMARY_LIMIT) {
    const cleaned = text.replace(/\s+/g, ' ').trim()
    if (!cleaned) return ''
    if (cleaned.length <= limit) return cleaned

    const sentenceEnd = cleaned.search(/[.!?]/)
    if (sentenceEnd > 40 && sentenceEnd < limit) {
        return cleaned.slice(0, sentenceEnd + 1)
    }

    return `${cleaned.slice(0, limit).trim()}...`
}

function formatParsedContent(text: string) {
    const lines = text.split(/\n|EXPERIENCE|EDUCATION|SKILLS|PROJECTS/i)
        .map(line => line.trim())
        .filter(Boolean)

    return lines.map(line => {
        if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
            return (
                <div key={`bullet-${line}`} className="flex gap-2 mb-1">
                    <span className="text-white/40">•</span>
                    <p className="text-white/70">{line.substring(1).trim()}</p>
                </div>
            )
        }
        if (line.toLowerCase().startsWith('title:') || line.toLowerCase().startsWith('degree:')) {
            return <p key={`label-${line}`} className="text-white font-medium mb-1">{line}</p>
        }
        return <p key={`text-${line}`} className="text-white/70 mb-1">{line}</p>
    })
}

function extractSkillTags(items: CVParsedItem[], maxTags = 12) {
    const tags: string[] = []
    const seen = new Set<string>()

    items.forEach((item) => {
        const cleaned = (item.content || '')
            .replace(/\u2022/g, ' ')
            .replace(/[()]/g, ' ')
        cleaned
            .split(/[,/;|\n]/)
            .map((token) => token.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .forEach((token) => {
                if (tags.length >= maxTags) return
                if (token.length > 36) return
                if (token.split(' ').length > 4) return
                const key = token.toLowerCase()
                if (seen.has(key)) return
                seen.add(key)
                tags.push(token)
            })
    })

    return tags
}

function getHighlights(items: CVParsedItem[], maxItems = 3) {
    return items.slice(0, maxItems).map((item) => ({
        label: item.section || 'Highlight',
        summary: summarizeContent(item.content),
    }))
}

interface DashboardProps {
    fileId: string
    fileName: string
    chunkCount: number
    onReupload?: () => void
}

export default function DashboardContent({
    fileId,
    fileName,
    chunkCount,
    onReupload,
}: DashboardProps) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [collection, setCollection] = useState<string | null>(null)
    const [liveChunkCount, setLiveChunkCount] = useState(chunkCount)
    const [parsedData, setParsedData] = useState<{
        experience: CVParsedItem[]
        education: CVParsedItem[]
        skills: CVParsedItem[]
        projects: CVParsedItem[]
    }>({
        experience: [],
        education: [],
        skills: [],
        projects: [],
    })
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
    const [pagination, setPagination] = useState({ limit: 50, offset: 0 })

    useEffect(() => {
        let cancelled = false

        async function loadResumeData() {
            setLoading(true)
            setError(null)

            try {
                const backendUrl = getBackendUrl()
                const queryParams = new URLSearchParams({
                    file_id: fileId,
                    limit: pagination.limit.toString(),
                    offset: pagination.offset.toString(),
                })
                // Get authentication headers (Firebase token)
                const authHeaders = await getAuthHeaders()
                const response = await fetch(
                    `${backendUrl}/api/cv/embedded-data?${queryParams}`,
                    {
                        headers: {
                            'Authorization': authHeaders['Authorization'],
                        },
                    }
                )

                if (!response.ok) {
                    const payload = await response.json().catch(() => null)
                    throw new Error(payload?.detail || 'Failed to load resume data')
                }

                const data = (await response.json()) as CVEmbeddedDataResponse
                if (cancelled) return

                const nextParsedData = {
                    experience: [] as CVParsedItem[],
                    education: [] as CVParsedItem[],
                    skills: [] as CVParsedItem[],
                    projects: [] as CVParsedItem[],
                }

                data.sections.forEach((section) => {
                    const sectionKey = normalizeSectionKey(section.section) as keyof typeof nextParsedData
                    if (sectionKey in nextParsedData) {
                        nextParsedData[sectionKey] = section.items.filter(item => item.content && item.content.trim().length > 0)
                    }
                })

                setParsedData(nextParsedData)
                setCollection(data.collection)
                setLiveChunkCount(data.chunk_count)
            } catch (fetchError) {
                if (!cancelled) {
                    const message =
                        fetchError instanceof Error
                            ? fetchError.message
                            : 'Failed to load resume data'
                    setError(message)
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        if (fileId) loadResumeData()
        return () => { cancelled = true }
    }, [fileId, pagination])

    const sectionConfig = [
        { key: 'experience', title: 'Experience', icon: Briefcase },
        { key: 'education', title: 'Education', icon: BookOpen },
        { key: 'skills', title: 'Skills', icon: Code },
        { key: 'projects', title: 'Projects', icon: Zap },
    ]

    const splitSkills = (text: string) => {
        return text
            .split(/,|\s{2,}| - /)
            .map(s => s.trim())
            .filter(Boolean)
    }

    const skillTags = splitSkills(parsedData.skills.map(s => s.content).join(', '))

    const toggleSection = (key: string) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-white/40 mx-auto" />
                    <p className="text-white/40 text-sm">Loading your resume...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4 max-w-sm">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
                    <p className="text-white/60 text-sm">{error}</p>
                    {onReupload && (
                        <button
                            onClick={onReupload}
                            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white border border-white/15 rounded-lg px-4 py-2 transition-colors"
                        >
                            <RefreshCcw className="w-4 h-4" />
                            Re-upload CV
                        </button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-white font-semibold text-xl">Your Resume</h1>
                    <p className="text-white/50 text-sm mt-1">
                        {fileName} · {liveChunkCount} sections indexed
                        {collection && <span className="text-white/30"> · {collection}</span>}
                    </p>
                </div>
                {onReupload && (
                    <button
                        onClick={onReupload}
                        className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white border border-white/15 hover:border-white/30 rounded-lg px-3 py-2 transition-colors shrink-0"
                    >
                        <RefreshCcw className="w-3.5 h-3.5" />
                        Re-upload
                    </button>
                )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-white/15 bg-[#171717] p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/60 text-sm">Experience entries</p>
                            <p className="text-2xl font-semibold text-white mt-2">{parsedData.experience.length}</p>
                        </div>
                        <Briefcase className="w-6 h-6 text-white/45" />
                    </div>
                </div>
                <div className="rounded-xl border border-white/15 bg-[#171717] p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/60 text-sm">Education entries</p>
                            <p className="text-2xl font-semibold text-white mt-2">{parsedData.education.length}</p>
                        </div>
                        <BookOpen className="w-6 h-6 text-white/45" />
                    </div>
                </div>
                <div className="rounded-xl border border-white/15 bg-[#171717] p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/60 text-sm">Skill tags</p>
                            <p className="text-2xl font-semibold text-white mt-2">{skillTags.length}</p>
                        </div>
                        <Code className="w-6 h-6 text-white/45" />
                    </div>
                </div>
                <div className="rounded-xl border border-white/15 bg-[#171717] p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/60 text-sm">Projects</p>
                            <p className="text-2xl font-semibold text-white mt-2">{parsedData.projects.length}</p>
                        </div>
                        <Zap className="w-6 h-6 text-white/45" />
                    </div>
                </div>
            </div>

            {/* CV sections grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {sectionConfig.map((section) => {
                    const Icon = section.icon
                    const data = parsedData[section.key as keyof typeof parsedData] || []
                    const isExpanded = Boolean(expandedSections[section.key])
                    const highlights = getHighlights(data, 3)
                    const isSkills = section.key === 'skills'

                    return (
                        <div key={section.key} className="rounded-xl border border-white/15 bg-[#171717] overflow-hidden">
                            <div className="border-b border-white/10 px-5 py-4 flex items-center gap-3 bg-[#141414]">
                                <Icon className="w-4 h-4 text-white/60" />
                                <div>
                                    <h2 className="text-white font-semibold text-sm">{section.title}</h2>
                                    <p className="text-xs text-white/50">{data.length} entries</p>
                                </div>
                                {data.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => toggleSection(section.key)}
                                        className="ml-auto inline-flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors"
                                    >
                                        {isExpanded ? 'Hide details' : 'Show details'}
                                        {isExpanded ? (
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                            </svg>
                                        ) : (
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                            </div>
                            <div className="p-5">
                                {data.length > 0 ? (
                                    <div className="space-y-4">
                                        {isSkills ? (
                                            <div className="flex flex-wrap gap-2">
                                                {skillTags.length > 0 ? (
                                                    skillTags
                                                        .slice(0, isExpanded ? 18 : 12)
                                                        .map((tag) => (
                                                            <span
                                                                key={tag}
                                                                className="rounded-full border border-white/10 bg-[#202020] px-3 py-1 text-xs text-white/80"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))
                                                ) : (
                                                    <p className="text-white/50 text-sm">No skills found in your resume</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {highlights.map((highlight, idx) => (
                                                    <div key={`${section.key}-highlight-${idx}`} className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-1">
                                                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{highlight.label}</p>
                                                        <p className="text-white/80 text-sm leading-relaxed">{highlight.summary}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {isExpanded && (
                                            <div className="pt-4 border-t border-white/10 space-y-6">
                                                {data.map((item, idx) => (
                                                    <div key={`${section.key}-detail-${idx}`} className="space-y-2">
                                                        {item.section && <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{item.section}</p>}
                                                        <div className="text-sm leading-relaxed">{formatParsedContent(item.content)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                        <Icon className="w-8 h-8 text-white/20 mb-2" />
                                        <p className="text-white/40 text-sm">No {section.title.toLowerCase()} found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Quick action cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-white/15 bg-[#171717] p-6">
                    <h3 className="text-white font-semibold text-lg mb-2">Find jobs</h3>
                    <p className="text-white/70 text-sm mb-4">
                        Discover job opportunities tailored to your skills and experience.
                    </p>
                    <a href="/jobs" className="text-white font-medium text-sm transition-colors hover:text-white/70">
                        Explore jobs →
                    </a>
                </div>
                <div className="rounded-xl border border-white/15 bg-[#171717] p-6">
                    <h3 className="text-white font-semibold text-lg mb-2">AI assistant</h3>
                    <p className="text-white/70 text-sm mb-4">
                        Chat with your AI career co-pilot for personalized guidance.
                    </p>
                    <a href="/assistant" className="text-white font-medium text-sm transition-colors hover:text-white/70">
                        Start chat →
                    </a>
                </div>
            </div>
        </div>
    )
}