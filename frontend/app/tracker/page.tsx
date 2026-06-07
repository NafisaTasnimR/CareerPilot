'use client'

import { useState } from 'react'
import AppShell from '@/components/app-shell'
import KanbanBoard from '@/components/tracker/kanban-board'
import CalendarTodo from '@/components/tracker/calendar-todo'
import ProgressDashboard from '@/components/tracker/progress-dashboard'
import NudgePanel from '@/components/tracker/nudge-panel'
import { getBackendUrl } from '@/lib/backend'

const TABS = [
  { id: 'kanban', label: 'Applications' },
  { id: 'calendar', label: 'Calendar & Goals' },
  { id: 'progress', label: 'Progress' },
  { id: 'nudges', label: 'AI Nudges' },
]

export default function TrackerPage() {
  const [activeTab, setActiveTab] = useState('kanban')
  const api = getBackendUrl()

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Track Progress</h1>
          <p className="text-gray-400">Manage your applications, goals, and career progress</p>
        </div>

        {/* Tabs */}
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

        {/* Tab content */}
        {activeTab === 'kanban' && <KanbanBoard api={api} />}
        {activeTab === 'calendar' && <CalendarTodo api={api} />}
        {activeTab === 'progress' && <ProgressDashboard api={api} />}
        {activeTab === 'nudges' && <NudgePanel api={api} />}
      </div>
    </AppShell>
  )
}