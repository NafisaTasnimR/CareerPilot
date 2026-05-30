'use client'

import { useState } from 'react'
import Navigation from './navigation'

interface AppShellProps {
    children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
    const [collapsed, setCollapsed] = useState(false)
    const sidebarWidth = collapsed ? '5rem' : '16rem'

    return (
        <div
            className="min-h-screen bg-[#131313] text-white"
            style={{ ['--sidebar-width' as string]: sidebarWidth }}
        >
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_20%_-10%,rgba(255,255,255,0.06),transparent_45%),radial-gradient(800px_circle_at_80%_0%,rgba(255,255,255,0.03),transparent_40%)]" />
            <Navigation
                collapsed={collapsed}
                onToggle={() => setCollapsed((prev) => !prev)}
            />
            <main className="app-shell-main relative px-4 sm:px-6 lg:px-10 pt-20 md:pt-10 pb-12">
                {children}
            </main>
        </div>
    )
}
