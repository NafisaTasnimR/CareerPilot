'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Briefcase,
    FileText,
    Bot,
    LineChart,
    Settings,
    LogOut,
    Menu,
    X,
    User,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/jobs', label: 'Job Hunter', icon: Briefcase },
    { href: '/check-resume', label: 'Check Resume', icon: FileText },
    { href: '/assistant', label: 'AI Assistant', icon: Bot },
    { href: '/track-progress', label: 'Track Progress', icon: LineChart },
    { href: '/settings', label: 'Settings', icon: Settings },
]

interface NavigationProps {
    collapsed: boolean
    onToggle: () => void
}

export default function Navigation({ collapsed, onToggle }: NavigationProps) {
    const pathname = usePathname()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const showLabels = !collapsed || mobileMenuOpen

    const isActive = (href: string) => pathname === href

    return (
        <>
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 border-b border-gray-800 bg-[#1f2020] backdrop-blur">
                <div className="h-full px-4 flex items-center justify-between">
                    <Link href="/dashboard" className="text-white font-semibold">
                        CareerPilot
                    </Link>
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 rounded-md border border-gray-800 text-white"
                        aria-label="Toggle navigation"
                    >
                        {mobileMenuOpen ? (
                            <X className="w-5 h-5" />
                        ) : (
                            <Menu className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>

            {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
            )}

            <aside
                className={`app-shell-sidebar fixed top-0 left-0 z-50 h-full border-r border-gray-800 bg-[#1f2020] p-6 transition-transform md:translate-x-0 flex flex-col ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className={`flex items-center ${showLabels ? 'justify-between' : 'justify-center'} mb-8`}>
                    <Link
                        href="/dashboard"
                        className={`text-white font-semibold ${showLabels ? 'text-lg' : 'text-base'}`}
                    >
                        {showLabels ? 'CareerPilot' : 'CP'}
                    </Link>
                    {showLabels && (
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-gray-500" />
                    )}
                </div>

                <button
                    onClick={onToggle}
                    className="hidden md:flex items-center justify-center rounded-lg border border-gray-800 text-white hover:border-gray-600 px-2 py-2 mb-6 transition-colors"
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </button>

                {showLabels && (
                    <div className="text-xs tracking-[0.2em] text-white mb-4">
                        NAVIGATION
                    </div>
                )}

                <nav className="space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const active = isActive(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center ${showLabels ? 'gap-3 px-3' : 'justify-center px-2'} rounded-lg py-2 text-sm font-medium transition-colors ${active
                                    ? 'bg-[#111827] text-white'
                                    : 'text-white hover:bg-[#2d2e2e]'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {showLabels && <span>{item.label}</span>}
                            </Link>
                        )
                    })}
                </nav>

                <div className="mt-10 pt-6 border-t border-gray-800">
                    <button className={`flex items-center ${showLabels ? 'gap-3 px-3' : 'justify-center px-2'} rounded-lg py-2 text-sm font-medium text-white hover:bg-[#2d2e2e] w-full transition-colors`}>
                        <LogOut className="h-4 w-4" />
                        {showLabels && 'Log out'}
                    </button>
                </div>

                <div className={`mt-auto pt-8 flex items-center text-white text-sm ${showLabels ? 'gap-3' : 'justify-center'}`}>
                    <span className="h-9 w-9 rounded-full bg-[#111827] border border-gray-800 flex items-center justify-center text-xs text-white">
                        AR
                    </span>
                    {showLabels && (
                        <div>
                            <div className="text-white text-sm font-medium">Ari Rahman</div>
                            <div className="text-xs text-white">Free plan</div>
                        </div>
                    )}
                    {showLabels && <User className="ml-auto h-4 w-4 text-white" />}
                </div>
            </aside>
        </>
    )
}
