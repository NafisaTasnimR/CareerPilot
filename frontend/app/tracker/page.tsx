'use client'

import { useState } from 'react'
import AppShell from '@/components/app-shell'
import KanbanBoard from '@/components/tracker/kanban-board'
import CalendarTodo from '@/components/tracker/calendar-todo'
import ProgressDashboard from '@/components/tracker/progress-dashboard'
import NudgeWidget from '@/components/tracker/nudge-widget'
import { getBackendUrl } from '@/lib/backend'
import { useAuth } from '@/components/authentication/auth-provider'

const TABS = [
  { id: 'kanban', label: 'Applications' },
  { id: 'calendar', label: 'Calendar & Goals' },
  { id: 'progress', label: 'Progress' },
]

export default function TrackerPage() {
  const [activeTab, setActiveTab] = useState('kanban')
  const { user } = useAuth()
  const api = `${getBackendUrl()}/api`
  const userId = user?.uid || ''

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Track Progress
          </h1>
          <p className="text-gray-400">
            Manage your applications, goals, and career progress
          </p>
        </div>

        <div className="flex gap-2 mb-8 border-b border-gray-800">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${activeTab === tab.id
                ? 'border-white text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'kanban' && (
          <KanbanBoard userId={userId} api={api} />
        )}

        {activeTab === 'calendar' && (
          <CalendarTodo userId={userId} api={api} />
        )}

        {activeTab === 'progress' && (
          <ProgressDashboard userId={userId} api={api} />
        )}
      </div>

      <NudgeWidget userId={userId} api={`${getBackendUrl()}/api`} />
    </AppShell>
  )
}