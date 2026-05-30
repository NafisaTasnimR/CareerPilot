'use client'

import { useState } from 'react'
import {
    Upload,
    AlertCircle,
    CheckCircle,
    Loader2,
    Check,
    FileText,
    ShieldCheck,
    Lock,
} from 'lucide-react'
import { getBackendUrl } from '@/lib/backend'

interface InitialCVUploadProps {
    onUploadSuccess?: (fileId: string, fileName: string, chunkCount: number) => void
}

export default function InitialCVUpload({
    onUploadSuccess,
}: InitialCVUploadProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [dragActive, setDragActive] = useState(false)

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const validateFile = (file: File): string | null => {
        const validTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ]
        const maxSize = 10 * 1024 * 1024 // 10MB

        if (!validTypes.includes(file.type)) {
            return 'Please upload a PDF or DOCX file'
        }

        if (file.size > maxSize) {
            return 'File size must be less than 10MB'
        }

        return null
    }

    const uploadFile = async (file: File) => {
        const validationError = validateFile(file)
        if (validationError) {
            setError(validationError)
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append('file', file)
            const backendUrl = getBackendUrl()

            const response = await fetch(`${backendUrl}/api/cv/upload`, {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.detail || 'Upload failed')
            }

            const data = await response.json()
            const fileId = data.file_id
            const fileName = data.file_name
            let chunkCount = 0

            // Then, ingest the file
            try {
                const ingestFormData = new FormData()
                ingestFormData.append('file', file)
                const ingestResponse = await fetch(
                    `${backendUrl}/api/cv/ingest?file_id=${encodeURIComponent(
                        fileId
                    )}&candidate_id=temp`,
                    {
                        method: 'POST',
                        body: ingestFormData,
                    }
                )

                if (!ingestResponse.ok) {
                    const ingestError = await ingestResponse.json()
                    console.error('Ingest error:', ingestError)
                    // Still consider upload successful even if ingest fails initially
                } else {
                    const ingestData = await ingestResponse.json()
                    console.log('Ingest successful:', ingestData)
                    chunkCount = ingestData.chunk_count ?? 0
                }
            } catch (ingestError) {
                console.error('Ingest request failed:', ingestError)
                // Don't fail the upload if ingest fails
            }

            setSuccess(true)
            onUploadSuccess?.(fileId, fileName, chunkCount)

            // Reset success after 2 seconds
            setTimeout(() => setSuccess(false), 2000)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Upload failed'
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        const files = e.dataTransfer.files
        if (files?.[0]) {
            uploadFile(files[0])
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files?.[0]) {
            uploadFile(files[0])
        }
    }

    const previewJobs = [
        {
            role: 'ML Engineer',
            company: 'Parium',
            match: '81%',
        },
        {
            role: 'Backend Engineer',
            company: 'Giri Lab',
            match: '79%',
        },
        {
            role: 'Data Engineer',
            company: 'Nova',
            match: '76%',
        },
    ]

    return (
        <div className="max-w-6xl mx-auto space-y-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-[#0f172a] px-3 py-1 text-xs text-slate-400">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                Welcome to CareerPilot
            </div>

            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8">
                <div className="space-y-6">
                    <div className="space-y-3">
                        <h1 className="text-4xl sm:text-5xl font-semibold text-white">
                            Your career co-pilot starts with your story
                        </h1>
                        <p className="text-gray-400 text-base sm:text-lg max-w-xl">
                            Upload your CV or resume to unlock AI-powered job hunting, fit
                            scoring, and a personalized career roadmap.
                        </p>
                    </div>

                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={`rounded-2xl border-2 border-dashed px-6 py-10 transition-all ${dragActive
                            ? 'border-cyan-400/70 bg-cyan-400/5'
                            : 'border-slate-700 bg-[#0f172a]'
                            }`}
                    >
                        <input
                            type="file"
                            accept=".pdf,.docx"
                            onChange={handleChange}
                            disabled={isLoading}
                            className="hidden"
                            id="cv-upload"
                        />
                        <label htmlFor="cv-upload" className="cursor-pointer block">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="h-12 w-12 rounded-2xl border border-slate-700 bg-[#111827] flex items-center justify-center">
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
                                    ) : success ? (
                                        <CheckCircle className="w-5 h-5 text-slate-100" />
                                    ) : (
                                        <Upload className="w-5 h-5 text-slate-300" />
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div className="text-slate-50 font-medium text-lg">
                                        {isLoading
                                            ? 'Uploading...'
                                            : success
                                                ? 'Upload successful'
                                                : 'Drop your CV here'}
                                    </div>
                                    <p className="text-slate-400 text-sm">
                                        Drag and drop your resume, or click to browse.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <span className="px-2 py-1 rounded-md border border-slate-700 bg-[#111827]">
                                        PDF
                                    </span>
                                    <span className="px-2 py-1 rounded-md border border-slate-700 bg-[#111827]">
                                        DOCX
                                    </span>
                                    <span className="px-2 py-1 rounded-md border border-slate-700 bg-[#111827]">
                                        Max 10MB
                                    </span>
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#111827] px-4 py-2 text-sm text-slate-100">
                                    <FileText className="h-4 w-4" />
                                    Browse Files
                                </div>
                            </div>
                        </label>
                    </div>

                    {error && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/40 p-4 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-red-200 text-sm font-medium">Upload failed</p>
                                <p className="text-red-300 text-sm mt-1">{error}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-700 bg-[#0f172a] p-5">
                        <h3 className="text-white font-semibold text-sm mb-4">What we extract</h3>
                        <ul className="space-y-3 text-sm text-slate-400">
                            {[
                                'Work experience, roles and responsibilities',
                                'Education, degrees and institutions',
                                'Technical and soft skills inventory',
                                'Projects, contributions and achievements',
                                'Certifications and languages',
                            ].map((item) => (
                                <li key={item} className="flex gap-2">
                                    <Check className="h-4 w-4 text-slate-500 mt-0.5" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-slate-700 bg-[#0f172a] p-5">
                        <h3 className="text-white font-semibold text-sm mb-4">
                            Unlocked after upload
                        </h3>
                        <ul className="space-y-3 text-sm text-slate-400">
                            {[
                                'Personalized job feed with fit scores',
                                'AI assistant grounded in your profile',
                                'Skill gap analysis and target roles',
                                'Tailored cover letter suggestions',
                                'Learning roadmap and progress tracking',
                            ].map((item) => (
                                <li key={item} className="flex gap-2">
                                    <Check className="h-4 w-4 text-slate-500 mt-0.5" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-slate-700 bg-[#0f172a] p-5 text-sm text-slate-400 flex gap-3">
                        <ShieldCheck className="h-4 w-4 text-slate-500 mt-0.5" />
                        <div>
                            <div className="text-slate-100 font-medium">Privacy first</div>
                            Your CV is stored securely and only used to personalize your
                            experience.
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Your Job Feed</h2>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-[#0f172a] px-3 py-1 text-xs text-slate-400">
                        <Lock className="h-3 w-3" />
                        Locked
                    </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4 opacity-60">
                    {previewJobs.map((job) => (
                        <div
                            key={job.role}
                            className="rounded-xl border border-slate-700 bg-[#0f172a] p-4"
                        >
                            <div className="text-sm text-slate-400">{job.company}</div>
                            <div className="text-white font-medium mt-1">{job.role}</div>
                            <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-400 rounded-full border border-slate-700 px-2 py-1">
                                Match {job.match}
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-sm text-slate-500">
                    Upload your resume to see job matches tailored to your profile.
                </p>
            </div>
        </div>
    )
}
