'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/app-shell'
import DashboardContent from '@/components/dashboard/cv-parsed-display'
import { Loader2 } from 'lucide-react'

export default function DashboardPage() {
    const router = useRouter()
    const [cvData, setCVData] = useState<{
        fileId: string
        fileName: string
        chunkCount: number
    } | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const storedCV = localStorage.getItem('userCV')
        if (storedCV) {
            try {
                const parsed = JSON.parse(storedCV)
                setCVData(parsed)
            } catch {
                // Corrupted data — send to upload
                router.replace('/cv-upload')
                return
            }
        } else {
            // No CV — send to upload
            router.replace('/cv-upload')
            return
        }
        setIsLoading(false)
    }, [router])

    const handleReupload = () => {
        localStorage.removeItem('userCV')
        router.push('/cv-upload')
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#131313]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-500 mx-auto" />
                    <p className="text-gray-400 text-sm">Loading...</p>
                </div>
            </div>
        )
    }

    if (!cvData) return null

    return (
        <AppShell>
            <DashboardContent
                fileId={cvData.fileId}
                fileName={cvData.fileName}
                chunkCount={cvData.chunkCount}
                onReupload={handleReupload}
            />
        </AppShell>
    )
}