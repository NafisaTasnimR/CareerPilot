'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/app-shell'
import {
    Briefcase, Search, ExternalLink, Loader2,
    AlertCircle, SlidersHorizontal, MapPin,
    Clock, Building2, Banknote, Calendar, X, Bookmark, BookmarkCheck
} from 'lucide-react'
import { getBackendUrl } from '@/lib/backend'

type JobCard = {
    job_id: string
    title: string
    company: string
    location: string
    salary_range: string | null
    deadline: string | null
    redirect_url: string
    fit_score: number
    fit_reason: string
    missing_skills: string[]
    employment_type: string | null
    posted_at: string | null
    is_remote: boolean
}

const DEFAULT_QUERIES = [
    'Software engineer Bangladesh',
    'Developer remote',
    'Junior role remote',
    'Entry level Bangladesh',
    'Analyst remote',
    'Designer Bangladesh',
]

function FitScoreRing({ score }: { score: number }) {
    const color =
        score >= 70 ? '#4ade80' : score >= 40 ? '#facc15' : '#f87171'
    const label =
        score >= 70 ? 'Strong fit' : score >= 40 ? 'Moderate fit' : 'Low fit'
    const deg = score * 3.6

    return (
        <div className="flex flex-col items-center gap-1 shrink-0 min-w-[60px]">
            <div
                className="relative w-14 h-14 rounded-full"
                style={{
                    background: `conic-gradient(${color} ${deg}deg, #2a2b2b ${deg}deg)`,
                    padding: '3px',
                    borderRadius: '50%',
                }}
            >
                <div
                    className="w-full h-full rounded-full bg-[#1f2020] flex items-center justify-center"
                    style={{ borderRadius: '50%' }}
                >
                    <span className="text-xs font-bold text-white">{score}%</span>
                </div>
            </div>
            <span className="text-[10px] font-semibold" style={{ color }}>
                {label}
            </span>
        </div>
    )
}

function InfoPill({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ElementType
    label: string
    value: string
}) {
    return (
        <div className="flex items-center gap-1.5 rounded-lg border border-[#3a3b3b] bg-[#242525] px-2.5 py-1.5">
            <Icon className="w-3 h-3 text-gray-500 shrink-0" />
            <div className="min-w-0">
                <div className="text-[9px] text-gray-600 uppercase tracking-wider leading-none mb-0.5">{label}</div>
                <div className="text-[11px] text-gray-300 font-medium leading-none truncate max-w-[120px]">{value}</div>
            </div>
        </div>
    )
}

function JobCardItem({ job, userId }: { job: JobCard; userId: string | null }) {
    const [saved, setSaved] = useState(false)
    const [saving, setSaving] = useState(false)

    async function handleSave() {
        if (!userId || saved) return
        setSaving(true)
        try {
            const res = await fetch(`${getBackendUrl()}/api/jobs/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job_id: job.job_id,
                    title: job.title,
                    company: job.company,
                    redirect_url: job.redirect_url,
                    fit_score: job.fit_score,
                    user_id: userId,
                }),
            })
            if (res.ok) setSaved(true)
        } catch {}
        finally { setSaving(false) }
    }

    const postedLabel = job.posted_at
        ? (() => {
              try {
                  const d = new Date(job.posted_at)
                  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
                  if (diff === 0) return 'Today'
                  if (diff === 1) return 'Yesterday'
                  if (diff < 30) return `${diff}d ago`
                  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              } catch {
                  return null
              }
          })()
        : null

    const deadlineLabel = job.deadline
        ? (() => {
              try {
                  const d = new Date(job.deadline)
                  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              } catch {
                  return null
              }
          })()
        : null

    const employmentLabel = job.employment_type
        ? job.employment_type
              .replace('FULLTIME', 'Full-time')
              .replace('PARTTIME', 'Part-time')
              .replace('INTERN', 'Internship')
              .replace('CONTRACTOR', 'Contract')
        : null

    let sourceHost = ''
    try {
        sourceHost = new URL(job.redirect_url).hostname.replace('www.', '')
    } catch {
        sourceHost = ''
    }

    return (
        <div className="group rounded-xl border border-[#3a3b3b] bg-[#1f2020] hover:border-[#4a4b4b] hover:bg-[#222323] transition-all duration-200">
            {/* Top section */}
            <div className="p-5 pb-4">
                <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="text-white font-semibold text-sm leading-snug">
                                {job.title}
                            </h3>
                            <button
                                onClick={handleSave}
                                disabled={saving || saved || !userId}
                                className={`shrink-0 p-1.5 rounded-lg border transition-all duration-150 ${
                                    saved
                                        ? 'text-emerald-400 bg-emerald-950/30 border-emerald-900/40 cursor-default'
                                        : 'text-gray-500 hover:text-white bg-transparent hover:bg-[#2a2b2b] border-transparent hover:border-[#3a3b3b]'
                                } disabled:opacity-40`}
                                title={saved ? 'Saved to tracker' : 'Save to tracker'}
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : saved ? (
                                    <BookmarkCheck className="w-4 h-4" />
                                ) : (
                                    <Bookmark className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                                <Building2 className="w-3 h-3 text-gray-600" />
                                {job.company}
                            </span>
                            <span className="text-gray-700">·</span>
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                                <MapPin className="w-3 h-3 text-gray-600" />
                                {job.location || 'Bangladesh'}
                            </span>
                            {job.is_remote && (
                                <>
                                    <span className="text-gray-700">·</span>
                                    <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 rounded-md px-1.5 py-0.5">
                                        Remote
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                    <FitScoreRing score={job.fit_score} />
                </div>
            </div>

            {/* Info pills */}
            <div className="px-5 pb-4">
                <div className="flex flex-wrap gap-2">
                    <InfoPill
                        icon={Banknote}
                        label="Salary"
                        value={job.salary_range || 'Not specified'}
                    />
                    <InfoPill
                        icon={Calendar}
                        label="Deadline"
                        value={deadlineLabel || 'Not specified'}
                    />
                    <InfoPill
                        icon={Briefcase}
                        label="Type"
                        value={employmentLabel || 'Not specified'}
                    />
                    {postedLabel && (
                        <InfoPill
                            icon={Clock}
                            label="Posted"
                            value={postedLabel}
                        />
                    )}
                </div>
            </div>

            {/* AI Analysis */}
            <div className="mx-5 mb-4 rounded-lg bg-[#242525] border border-[#3a3b3b] px-3.5 py-3 space-y-3">
                <div className="text-[10px] tracking-widest text-gray-600 uppercase">AI Analysis</div>
                <p className="text-xs text-gray-400 leading-relaxed italic">
                    "{job.fit_reason}"
                </p>

                {job.missing_skills && job.missing_skills.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="text-[10px] tracking-widest text-gray-600 uppercase">
                            Skill gaps
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {job.missing_skills.map((skill) => (
                                <span
                                    key={skill}
                                    className="inline-flex items-center gap-1 text-[11px] text-gray-300 bg-[#2a1f1f] border border-[#4a2a2a] rounded-md px-2 py-0.5"
                                >
                                    <span className="text-[#8a4a4a]">✕</span>
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {job.missing_skills && job.missing_skills.length === 0 && job.fit_score >= 80 && (
                    <span className="inline-flex text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 rounded-md px-2 py-0.5">
                        ✓ Strong profile match — no major gaps
                    </span>
                )}

                {job.missing_skills && job.missing_skills.length === 0 && job.fit_score < 80 && (
                    <span className="inline-flex text-[11px] text-gray-400 bg-[#2a2b2b] border border-[#3a3b3b] rounded-md px-2 py-0.5">
                        No specific skill gaps identified
                    </span>
                )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-4 flex items-center justify-between">
                <a
                    href={job.redirect_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-white bg-[#2a2b2b] hover:bg-[#303131] border border-[#4a4b4b] hover:border-[#5b5c5c] rounded-lg px-4 py-2 transition-all duration-150 font-medium"
                >
                    Apply now
                    <ExternalLink className="w-3 h-3" />
                </a>
                {sourceHost && (
                    <span className="text-[10px] text-gray-600">
                        via {sourceHost}
                    </span>
                )}
            </div>
        </div>
    )
}

function ScoreFilterBar({
    filter,
    setFilter,
    total,
}: {
    filter: 'all' | 'strong' | 'moderate' | 'low'
    setFilter: (f: 'all' | 'strong' | 'moderate' | 'low') => void
    total: number
}) {
    const options = [
        { key: 'all', label: `All (${total})` },
        { key: 'strong', label: '🟢 Strong (70%+)' },
        { key: 'moderate', label: '🟡 Moderate (40–69%)' },
        { key: 'low', label: '🔴 Low (<40%)' },
    ] as const

    return (
        <div className="flex flex-wrap gap-2">
            {options.map((o) => (
                <button
                    key={o.key}
                    onClick={() => setFilter(o.key)}
                    className={`text-[11px] rounded-lg px-3 py-1.5 border transition-all ${
                        filter === o.key
                            ? 'bg-[#2a2b2b] border-[#5b5c5c] text-white'
                            : 'bg-transparent border-[#3a3b3b] text-gray-500 hover:text-gray-300 hover:border-[#4a4b4b]'
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    )
}

export default function JobsPage() {
    const [query, setQuery] = useState('')
    const [jobs, setJobs] = useState<JobCard[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searched, setSearched] = useState(false)
    const [fileId, setFileId] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'strong' | 'moderate' | 'low'>('all')
    const [suggestedQueries, setSuggestedQueries] = useState<string[]>(DEFAULT_QUERIES)

    useEffect(() => {
        const stored = localStorage.getItem('userCV')
        if (!stored) return

        try {
            const parsed = JSON.parse(stored)
            setFileId(parsed.fileId)

            // Build dynamic suggestions from cached feed roles
            const buildSuggestions = (roles: { title: string }[]) => {
                return roles.flatMap(r => [
                    `${r.title} remote`,
                    `${r.title} Bangladesh`,
                ]).slice(0, 6)
            }

            // Try cache first — no API call needed
            const cacheKey = `jobFeed_${parsed.fileId}`
            const cached = localStorage.getItem(cacheKey)
            if (cached) {
                try {
                    const roles = JSON.parse(cached)
                    if (Array.isArray(roles) && roles.length > 0) {
                        setSuggestedQueries(buildSuggestions(roles))
                        return
                    }
                } catch {}
            }

            // Cache miss — fetch feed and update suggestions
            fetch(`${getBackendUrl()}/api/jobs/feed?file_id=${encodeURIComponent(parsed.fileId)}`)
                .then(res => res.ok ? res.json() : null)
                .then(roles => {
                    if (Array.isArray(roles) && roles.length > 0) {
                        // Store in cache for next time
                        localStorage.setItem(cacheKey, JSON.stringify(roles))
                        setSuggestedQueries(buildSuggestions(roles))
                    }
                })
                .catch(() => {}) // silently keep defaults on error
        } catch {}

        // TODO: replace with real Supabase auth user id
        setUserId('test-user-123')
    }, [])

    async function handleSearch(overrideQuery?: string) {
        const q = (overrideQuery ?? query).trim()
        if (!q) return
        if (!fileId) {
            setError('No CV found. Please upload your CV from the Dashboard first.')
            return
        }

        setQuery(q)
        setLoading(true)
        setError(null)
        setSearched(true)
        setFilter('all')

        try {
            const res = await fetch(`${getBackendUrl()}/api/jobs/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q, file_id: fileId }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.detail || `Error ${res.status}`)
            }
            setJobs(await res.json())
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Search failed. Please try again.')
            setJobs([])
        } finally {
            setLoading(false)
        }
    }

    const filteredJobs = jobs.filter((j) => {
        if (filter === 'strong') return j.fit_score >= 70
        if (filter === 'moderate') return j.fit_score >= 40 && j.fit_score < 70
        if (filter === 'low') return j.fit_score < 40
        return true
    })

    return (
        <AppShell>
            <div className="max-w-3xl mx-auto space-y-5">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#2a2b2b] border border-[#3a3b3b] flex items-center justify-center">
                        <Briefcase className="w-4 h-4 text-gray-300" />
                    </div>
                    <div>
                        <h1 className="text-white font-semibold text-lg leading-none">Job Hunter</h1>
                        <p className="text-gray-500 text-xs mt-0.5">
                            Live jobs from Bangladesh & remote — scored against your CV
                        </p>
                    </div>
                </div>

                {/* No CV warning */}
                {!fileId && (
                    <div className="flex items-start gap-3 rounded-xl border border-yellow-900/40 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-400">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>
                            Upload your CV from the{' '}
                            <a href="/dashboard" className="underline underline-offset-2 hover:text-yellow-300">
                                Dashboard
                            </a>{' '}
                            first to get personalised fit scores.
                        </span>
                    </div>
                )}

                {/* Search bar */}
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder='e.g. "Senior accountant remote"'
                        className="w-full bg-[#1f2020] border border-[#3a3b3b] rounded-xl pl-10 pr-28 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#5b5c5c] transition-colors"
                    />
                    <button
                        onClick={() => handleSearch()}
                        disabled={loading || !query.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-[#2a2b2b] hover:bg-[#303131] disabled:opacity-40 border border-[#3a3b3b] text-white text-xs font-medium rounded-lg px-3 py-1.5 transition-all"
                    >
                        {loading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Search className="w-3.5 h-3.5" />
                        )}
                        Search
                    </button>
                </div>

                {/* Dynamic suggested queries */}
                <div className="space-y-2">
                    <p className="text-[10px] tracking-widest text-gray-600 uppercase">
                        Quick searches
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {suggestedQueries.map((q) => (
                            <button
                                key={q}
                                onClick={() => handleSearch(q)}
                                className="text-xs text-gray-400 hover:text-white bg-[#1f2020] hover:bg-[#2a2b2b] border border-[#3a3b3b] hover:border-[#4a4b4b] rounded-lg px-3 py-1.5 transition-all"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span className="flex-1">{error}</span>
                        <button onClick={() => setError(null)}>
                            <X className="w-4 h-4 hover:text-red-300" />
                        </button>
                    </div>
                )}

                {/* Loading skeleton */}
                {loading && (
                    <div className="space-y-3">
                        <p className="text-xs text-gray-600 animate-pulse">
                            Searching live jobs and scoring against your CV…
                        </p>
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="rounded-xl border border-[#3a3b3b] bg-[#1f2020] p-5 animate-pulse space-y-3"
                            >
                                <div className="flex gap-4">
                                    <div className="flex-1 space-y-2 pt-1">
                                        <div className="h-3.5 bg-[#2a2b2b] rounded w-2/3" />
                                        <div className="h-3 bg-[#2a2b2b] rounded w-1/3" />
                                    </div>
                                    <div className="w-14 h-14 rounded-full bg-[#2a2b2b]" />
                                </div>
                                <div className="flex gap-2">
                                    {[1, 2, 3].map((j) => (
                                        <div key={j} className="h-9 w-28 bg-[#2a2b2b] rounded-lg" />
                                    ))}
                                </div>
                                <div className="h-20 bg-[#2a2b2b] rounded-lg" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Results */}
                {!loading && searched && jobs.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <ScoreFilterBar
                                filter={filter}
                                setFilter={setFilter}
                                total={jobs.length}
                            />
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                                <SlidersHorizontal className="w-3 h-3" />
                                Sorted by fit score
                            </div>
                        </div>

                        {filteredJobs.length === 0 ? (
                            <div className="text-center py-10 text-sm text-gray-500">
                                No jobs in this category. Try a different filter.
                            </div>
                        ) : (
                            filteredJobs.map((job) => (
                                <JobCardItem key={job.job_id} job={job} userId={userId} />
                            ))
                        )}
                    </div>
                )}

                {/* Empty state */}
                {!loading && searched && jobs.length === 0 && !error && (
                    <div className="text-center py-16 space-y-3">
                        <div className="w-12 h-12 rounded-full bg-[#2a2b2b] border border-[#3a3b3b] flex items-center justify-center mx-auto">
                            <Briefcase className="w-5 h-5 text-gray-600" />
                        </div>
                        <p className="text-gray-400 text-sm">No jobs found for this query.</p>
                        <p className="text-gray-600 text-xs">
                            Try a broader search — e.g. "developer Bangladesh"
                        </p>
                    </div>
                )}
            </div>
        </AppShell>
    )
}