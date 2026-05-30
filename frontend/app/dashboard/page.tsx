'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/app-shell'
import InitialCVUpload from '@/components/cv-upload/initial-upload'
import DashboardContent from '@/components/dashboard/cv-parsed-display'

export default function DashboardPage() {
    const [hasCVUploaded, setHasCVUploaded] = useState(false)
    const [cvData, setCVData] = useState<{
        fileId: string
        fileName: string
        chunkCount: number
    } | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Check if user has CV uploaded (from localStorage or session)
        // In a real app, this would check Supabase or session storage
        const storedCV = localStorage.getItem('userCV')
        if (storedCV) {
            try {
                const parsed = JSON.parse(storedCV)
                setCVData(parsed)
                setHasCVUploaded(true)
            } catch (error) {
                console.error('Error parsing stored CV:', error)
            }
        }
        setIsLoading(false)
    }, [])

    const handleUploadSuccess = (
        fileId: string,
        fileName: string,
        chunkCount: number
    ) => {
        const cvData = {
            fileId,
            fileName,
            chunkCount,
        }
        localStorage.setItem('userCV', JSON.stringify(cvData))
        setCVData(cvData)
        setHasCVUploaded(true)
    }

    const handleReupload = () => {
        localStorage.removeItem('userCV')
        setCVData(null)
        setHasCVUploaded(false)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-gray-700 border-t-gray-500 rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <AppShell>
            {!hasCVUploaded ? (
                <InitialCVUpload onUploadSuccess={handleUploadSuccess} />
            ) : (
                cvData && (
                    <DashboardContent
                        fileId={cvData.fileId}
                        fileName={cvData.fileName}
                        chunkCount={cvData.chunkCount}
                        onReupload={handleReupload}
                    />
                )
            )}
        </AppShell>
    )
}
