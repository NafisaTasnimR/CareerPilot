'use client'

import { useRouter } from 'next/navigation'
import AppShell from '@/components/app-shell'
import InitialCVUpload from '@/components/cv-upload/initial-upload'

export default function CVUploadPage() {
    const router = useRouter()

    const handleUploadSuccess = (fileId: string, fileName: string, chunkCount: number) => {
        localStorage.setItem('userCV', JSON.stringify({ fileId, fileName, chunkCount }))
        router.push('/dashboard')
    }

    return (
        <AppShell>
            <InitialCVUpload onUploadSuccess={handleUploadSuccess} />
        </AppShell>
    )
}