'use client'

import AppShell from '@/components/app-shell'

export default function AssistantPage() {
    return (
        <AppShell>
            <div className="max-w-4xl space-y-3">
                <h1 className="text-3xl sm:text-4xl font-semibold text-white">
                    AI Assistant
                </h1>
                <p className="text-gray-400">
                    This area will host your AI career assistant.
                </p>
            </div>
        </AppShell>
    )
}
