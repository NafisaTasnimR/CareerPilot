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
import { getBackendUrl, getAuthHeaders, getAuthToken } from '@/lib/backend'
import { auth } from '@/lib/firebase'

interface InitialCVUploadProps {
    onUploadSuccess?: (fileId: string, fileName: string, chunkCount: number) => void
}

type UploadStage = 'idle' | 'uploading' | 'parsing' | 'indexing' | 'done' | 'error'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export default function InitialCVUpload({
    onUploadSuccess,
}: InitialCVUploadProps) {
    const [error, setError] = useState<string | null>(null)
    const [warning, setWarning] = useState<string | null>(null)
    const [dragActive, setDragActive] = useState(false)
    const [stage, setStage] = useState<UploadStage>('idle')

    const isProcessing = stage === 'uploading' || stage === 'parsing' || stage === 'indexing'
    const isSuccess = stage === 'done'

    const stepOrder: UploadStage[] = ['uploading', 'parsing', 'indexing']
    const steps = [
        {
            key: 'uploading' as UploadStage,
            label: 'Upload resume',
            description: 'Securely transferring your file.',
        },
        {
            key: 'parsing' as UploadStage,
            label: 'Parse sections',
            description: 'Extracting experience, skills, and education.',
        },
        {
            key: 'indexing' as UploadStage,
            label: 'Index for search',
            description: 'Embedding your resume in the CV knowledge base.',
        },
    ]

    const getStepStatus = (stepKey: UploadStage) => {
        if (stage === 'done') return 'complete'
        const stepIndex = stepOrder.indexOf(stepKey)
        const currentIndex = stepOrder.indexOf(stage)
        if (stepIndex === -1 || currentIndex === -1) return 'pending'
        if (stepIndex < currentIndex) return 'complete'
        if (stepIndex === currentIndex) return 'active'
        return 'pending'
    }

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
        if (isProcessing) return
        const validationError = validateFile(file)
        if (validationError) {
            setError(validationError)
            setStage('error')
            return
        }

        setError(null)
        setWarning(null)
        setStage('uploading')

        try {
            const formData = new FormData()
            formData.append('file', file)
            const backendUrl = getBackendUrl()
            const user = auth.currentUser
            if (!user) {
                throw new Error('You must be logged in to upload a CV.')
            }
            const idToken = await user.getIdToken(true)

            const response = await fetch(`${backendUrl}/api/cv/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                },
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

            setStage('parsing')

            // Then, ingest the file
            try {
                const ingestFormData = new FormData()
                ingestFormData.append('file', file)
                const ingestResponse = await fetch(
                    `${backendUrl}/api/cv/ingest?file_id=${encodeURIComponent(
                        fileId
                    )}`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${idToken}`,
                        },
                        body: ingestFormData,
                    }
                )

                if (!ingestResponse.ok) {
                    const ingestError = await ingestResponse.json()
                    console.error('Ingest error:', ingestError)
                    setWarning('Parsing could not finish. You can re-upload to retry.')
                    // Still consider upload successful even if ingest fails initially
                } else {
                    const ingestData = await ingestResponse.json()
                    console.log('Ingest successful:', ingestData)
                    chunkCount = ingestData.chunk_count ?? 0
                }
            } catch (ingestError) {
                console.error('Ingest request failed:', ingestError)
                setWarning('Parsing could not finish. You can re-upload to retry.')
                // Don't fail the upload if ingest fails
            }

            setStage('indexing')
            await wait(700)
            setStage('done')

            if (onUploadSuccess) {
                await wait(500)
                onUploadSuccess(fileId, fileName, chunkCount)
            } else {
                setTimeout(() => {
                    setStage('idle')
                    setWarning(null)
                }, 2500)
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Upload failed'
            setError(message)
            setStage('error')
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
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#171717] px-3 py-1 text-xs text-white/60">
                <span className="h-2 w-2 rounded-full bg-white/60" />
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
                            ? 'border-white/40 bg-white/5'
                            : 'border-white/10 bg-[#171717]'
                            }`}
                    >
                        <input
                            type="file"
                            accept=".pdf,.docx"
                            onChange={handleChange}
                            disabled={isProcessing}
                            className="hidden"
                            id="cv-upload"
                        />
                        <label htmlFor="cv-upload" className="cursor-pointer block">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="h-12 w-12 rounded-2xl border border-white/10 bg-[#1a1a1a] flex items-center justify-center">
                                    {isProcessing ? (
                                        <Loader2 className="w-5 h-5 text-white/70 animate-spin" />
                                    ) : isSuccess ? (
                                        <CheckCircle className="w-5 h-5 text-white" />
                                    ) : (
                                        <Upload className="w-5 h-5 text-white/70" />
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div className="text-white font-medium text-lg">
                                        {stage === 'uploading'
                                            ? 'Uploading your resume'
                                            : stage === 'parsing'
                                                ? 'Parsing your resume'
                                                : stage === 'indexing'
                                                    ? 'Indexing your resume'
                                                    : isSuccess
                                                        ? 'Resume ready'
                                                        : 'Drop your CV here'}
                                    </div>
                                    <p className="text-white/60 text-sm">
                                        Drag and drop your resume, or click to browse.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-white/60">
                                    <span className="px-2 py-1 rounded-md border border-white/10 bg-[#1a1a1a]">
                                        PDF
                                    </span>
                                    <span className="px-2 py-1 rounded-md border border-white/10 bg-[#1a1a1a]">
                                        DOCX
                                    </span>
                                    <span className="px-2 py-1 rounded-md border border-white/10 bg-[#1a1a1a]">
                                        Max 10MB
                                    </span>
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-2 text-sm text-white">
                                    <FileText className="h-4 w-4" />
                                    Browse Files
                                </div>
                            </div>
                        </label>
                    </div>

                    {stage !== 'idle' && (
                        <div className="rounded-2xl border border-white/10 bg-[#171717] p-5">
                            <h3 className="text-white font-semibold text-sm mb-4">Processing status</h3>
                            <ul className="space-y-3">
                                {steps.map((step) => {
                                    const status = getStepStatus(step.key)
                                    return (
                                        <li key={step.key} className="flex items-start gap-3">
                                            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-[#1a1a1a]">
                                                {status === 'complete' ? (
                                                    <Check className="h-3.5 w-3.5 text-white" />
                                                ) : status === 'active' ? (
                                                    <Loader2 className="h-3.5 w-3.5 text-white/70 animate-spin" />
                                                ) : (
                                                    <span className="h-2 w-2 rounded-full bg-white/20" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm text-white">{step.label}</p>
                                                <p className="text-xs text-white/60">{step.description}</p>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    )}

                    {error && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/40 p-4 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-red-200 text-sm font-medium">Upload failed</p>
                                <p className="text-red-300 text-sm mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {warning && !error && (
                        <div className="rounded-xl bg-white/5 border border-white/15 p-4 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-white/70 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-white text-sm font-medium">Parsing delayed</p>
                                <p className="text-white/60 text-sm mt-1">{warning}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-[#171717] p-5">
                        <h3 className="text-white font-semibold text-sm mb-4">What we extract</h3>
                        <ul className="space-y-3 text-sm text-white/60">
                            {[
                                'Work experience, roles and responsibilities',
                                'Education, degrees and institutions',
                                'Technical and soft skills inventory',
                                'Projects, contributions and achievements',
                                'Certifications and languages',
                            ].map((item) => (
                                <li key={item} className="flex gap-2">
                                    <Check className="h-4 w-4 text-white/40 mt-0.5" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#171717] p-5">
                        <h3 className="text-white font-semibold text-sm mb-4">
                            Unlocked after upload
                        </h3>
                        <ul className="space-y-3 text-sm text-white/60">
                            {[
                                'Personalized job feed with fit scores',
                                'AI assistant grounded in your profile',
                                'Skill gap analysis and target roles',
                                'Tailored cover letter suggestions',
                                'Learning roadmap and progress tracking',
                            ].map((item) => (
                                <li key={item} className="flex gap-2">
                                    <Check className="h-4 w-4 text-white/40 mt-0.5" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#171717] p-5 text-sm text-white/60 flex gap-3">
                        <ShieldCheck className="h-4 w-4 text-white/40 mt-0.5" />
                        <div>
                            <div className="text-white font-medium">Privacy first</div>
                            Your CV is stored securely and only used to personalize your
                            experience.
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Your Job Feed</h2>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#171717] px-3 py-1 text-xs text-white/60">
                        <Lock className="h-3 w-3" />
                        Locked
                    </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4 opacity-60">
                    {previewJobs.map((job) => (
                        <div
                            key={job.role}
                            className="rounded-xl border border-white/10 bg-[#171717] p-4"
                        >
                            <div className="text-sm text-white/60">{job.company}</div>
                            <div className="text-white font-medium mt-1">{job.role}</div>
                            <div className="mt-3 inline-flex items-center gap-2 text-xs text-white/60 rounded-full border border-white/10 px-2 py-1">
                                Match {job.match}
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-sm text-white/50">
                    Upload your resume to see job matches tailored to your profile.
                </p>
            </div>
        </div>
    )
}
