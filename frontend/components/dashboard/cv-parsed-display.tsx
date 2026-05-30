'use client'

import { useEffect, useState } from 'react'
import {
    Briefcase,
    BookOpen,
    Code,
    Zap,
    AlertCircle,
    Loader2,
    Check,
    RefreshCcw,
} from 'lucide-react'
import { getBackendUrl } from '@/lib/backend'

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

    useEffect(() => {
        let cancelled = false

        async function loadResumeData() {
            setLoading(true)
            setError(null)

            try {
                const backendUrl = getBackendUrl()
                const response = await fetch(
                    `${backendUrl}/api/cv/embedded-data?file_id=${encodeURIComponent(fileId)}`
                )

                if (!response.ok) {
                    const payload = await response.json().catch(() => null)
                    throw new Error(payload?.detail || 'Failed to load resume data')
                }

                const data = (await response.json()) as CVEmbeddedDataResponse
                if (cancelled) {
                    return
                }

                const nextParsedData = {
                    experience: [] as CVParsedItem[],
                    education: [] as CVParsedItem[],
                    skills: [] as CVParsedItem[],
                    projects: [] as CVParsedItem[],
                }

                data.sections.forEach((section) => {
                    const sectionKey = normalizeSectionKey(section.section) as keyof typeof nextParsedData
                    if (sectionKey in nextParsedData) {
                        nextParsedData[sectionKey] = section.items
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
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        if (fileId) {
            loadResumeData()
        }

        return () => {
            cancelled = true
        }
    }, [fileId])

    const sectionConfig = [
        {
            key: 'experience',
            title: 'Experience',
            icon: Briefcase,
        },
        {
            key: 'education',
            title: 'Education',
            icon: BookOpen,
        },
        {
            key: 'skills',
            title: 'Skills',
            icon: Code,
        },
        {
            key: 'projects',
            title: 'Projects',
            icon: Zap,
        },
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 text-white/70 animate-spin mx-auto" />
                    <p className="text-white/70">Loading your resume...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                    <h1 className="text-3xl sm:text-4xl font-semibold text-white">
                        Your profile
                    </h1>
                    <p className="text-white/70 text-sm">
                        Resume: <span className="text-white">{fileName}</span>
                    </p>
                    <p className="text-xs text-white/50">
                        {collection ? `Indexed in ${collection}` : 'Live embedded data'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onReupload}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 bg-[#171717] text-white text-sm hover:border-white/35 transition-colors"
                >
                    <RefreshCcw className="w-4 h-4" />
                    Re-upload resume
                </button>
            </div>

            {error && (
                <div className="rounded-xl bg-white/5 border border-white/15 p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-white/70 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-white font-medium">Error loading resume</p>
                        <p className="text-white/70 text-sm mt-1">{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-white/15 bg-[#171717] p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/60 text-sm">Chunks extracted</p>
                            <p className="text-2xl font-semibold text-white mt-2">
                                {liveChunkCount}
                            </p>
                        </div>
                        <Zap className="w-6 h-6 text-white/45" />
                    </div>
                </div>
                <div className="rounded-xl border border-white/15 bg-[#171717] p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/60 text-sm">Sections</p>
                            <p className="text-2xl font-semibold text-white mt-2">4</p>
                        </div>
                        <Code className="w-6 h-6 text-white/45" />
                    </div>
                </div>
                <div className="rounded-xl border border-white/15 bg-[#171717] p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/60 text-sm">Indexed</p>
                            <p className="text-2xl font-semibold text-white mt-2">Yes</p>
                        </div>
                        <Check className="w-6 h-6 text-white/45" />
                    </div>
                </div>
                <div className="rounded-xl border border-white/15 bg-[#171717] p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/60 text-sm">Ready</p>
                            <p className="text-2xl font-semibold text-white mt-2">Yes</p>
                        </div>
                        <BookOpen className="w-6 h-6 text-white/45" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {sectionConfig.map((section) => {
                    const Icon = section.icon
                    const data =
                        parsedData[section.key as keyof typeof parsedData] || []

                    return (
                        <div
                            key={section.key}
                            className="rounded-xl border border-white/15 bg-[#171717] overflow-hidden"
                        >
                            <div className="border-b border-white/10 px-5 py-4 flex items-center gap-3 bg-[#141414]">
                                <Icon className="w-4 h-4 text-white/60" />
                                <h2 className="text-white font-semibold text-sm">
                                    {section.title}
                                </h2>
                                <span className="ml-auto bg-[#232323] text-white/70 text-xs font-medium px-2 py-1 rounded">
                                    {data.length}
                                </span>
                            </div>

                            <div className="p-5">
                                {data.length > 0 ? (
                                    <ul className="space-y-4">
                                        {data.map((item, idx) => (
                                            <li key={idx} className="space-y-1">
                                                <p className="font-medium text-white">
                                                    {item.section}
                                                </p>
                                                <p className="text-white/70 text-sm leading-relaxed">
                                                    {item.content}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-white/50 text-sm">
                                        No {section.title.toLowerCase()} found in your resume
                                    </p>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-white/15 bg-[#171717] p-6">
                    <h3 className="text-white font-semibold text-lg mb-2">
                        Find jobs
                    </h3>
                    <p className="text-white/70 text-sm mb-4">
                        Discover job opportunities tailored to your skills and experience.
                    </p>
                    <button className="text-white font-medium text-sm transition-colors">
                        Explore jobs
                    </button>
                </div>

                <div className="rounded-xl border border-white/15 bg-[#171717] p-6">
                    <h3 className="text-white font-semibold text-lg mb-2">
                        AI assistant
                    </h3>
                    <p className="text-white/70 text-sm mb-4">
                        Chat with your AI career co-pilot for personalized guidance.
                    </p>
                    <button className="text-white font-medium text-sm transition-colors">
                        Start chat
                    </button>
                </div>
            </div>
        </div>
    )
}
