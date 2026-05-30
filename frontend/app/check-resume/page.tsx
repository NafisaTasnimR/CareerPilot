'use client'

import AppShell from '@/components/app-shell'
import InitialCVUpload from '@/components/cv-upload/initial-upload'

export default function CheckResumePage() {
    return (
        <AppShell>
            <InitialCVUpload />
        </AppShell>
    )
}
