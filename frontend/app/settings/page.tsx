'use client'

import AppShell from '@/components/app-shell'
import { User, Bell, Lock, LogOut, AlertCircle } from 'lucide-react'
import { useState } from 'react'

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('profile')
    const [formData, setFormData] = useState({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1 (555) 000-0000',
        location: 'San Francisco, CA',
    })

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Lock },
    ]

    return (
        <AppShell>
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-semibold text-white">Settings</h1>
                    <p className="text-gray-400 mt-2">Manage your account and preferences</p>
                </div>

                <div className="flex gap-2 border-b border-gray-800">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                    ? 'border-gray-200 text-gray-100'
                                    : 'border-transparent text-gray-400 hover:text-white'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        )
                    })}
                </div>

                {activeTab === 'profile' && (
                    <div className="space-y-6">
                        <div className="rounded-xl border border-slate-700 bg-[#0f172a] p-6">
                            <h2 className="text-lg font-semibold text-white mb-6">
                                Profile Information
                            </h2>

                            <div className="space-y-4">
                                {[
                                    { label: 'Full Name', value: 'name' },
                                    { label: 'Email', value: 'email' },
                                    { label: 'Phone', value: 'phone' },
                                    { label: 'Location', value: 'location' },
                                ].map((field) => (
                                    <div key={field.value}>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            {field.label}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData[field.value as keyof typeof formData]}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    [field.value]: e.target.value,
                                                })
                                            }
                                            className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-[#111827] text-white focus:outline-none focus:border-cyan-400/60 transition-colors"
                                        />
                                    </div>
                                ))}
                            </div>

                            <button className="mt-6 px-6 py-2 rounded-lg bg-[#111827] border border-slate-700 text-white font-medium transition-colors hover:border-cyan-400/60">
                                Save Changes
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="space-y-6">
                        <div className="rounded-xl border border-slate-700 bg-[#0f172a] p-6">
                            <h2 className="text-lg font-semibold text-white mb-6">
                                Notification Preferences
                            </h2>

                            <div className="space-y-4">
                                {[
                                    {
                                        title: 'Job Recommendations',
                                        description: 'Get notified about new job matches',
                                        enabled: true,
                                    },
                                    {
                                        title: 'Application Updates',
                                        description: 'Receive updates on your applications',
                                        enabled: true,
                                    },
                                    {
                                        title: 'Learning Resources',
                                        description:
                                            'Get suggestions for courses and learning materials',
                                        enabled: false,
                                    },
                                    {
                                        title: 'Weekly Summary',
                                        description: 'Receive a weekly summary of your progress',
                                        enabled: true,
                                    },
                                ].map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-4 rounded-lg bg-[#111827] border border-slate-700"
                                    >
                                        <div>
                                            <p className="text-white font-medium">{item.title}</p>
                                            <p className="text-gray-400 text-sm">{item.description}</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            defaultChecked={item.enabled}
                                            className="w-5 h-5 rounded border-gray-600 text-gray-200 focus:ring-gray-500 cursor-pointer"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="space-y-6">
                        <div className="rounded-xl border border-slate-700 bg-[#0f172a] p-6">
                            <h2 className="text-lg font-semibold text-white mb-6">
                                Change Password
                            </h2>

                            <div className="space-y-4">
                                {[
                                    { label: 'Current Password', type: 'password' },
                                    { label: 'New Password', type: 'password' },
                                    { label: 'Confirm Password', type: 'password' },
                                ].map((field) => (
                                    <div key={field.label}>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            {field.label}
                                        </label>
                                        <input
                                            type={field.type}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-[#111827] text-white focus:outline-none focus:border-cyan-400/60 transition-colors"
                                            placeholder="password"
                                        />
                                    </div>
                                ))}
                            </div>

                            <button className="mt-6 px-6 py-2 rounded-lg bg-[#111827] border border-slate-700 text-white font-medium transition-colors hover:border-cyan-400/60">
                                Update Password
                            </button>
                        </div>

                        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-red-400" />
                                Danger Zone
                            </h3>
                            <p className="text-gray-400 mb-4">
                                Delete your account and all associated data. This action cannot be
                                undone.
                            </p>
                            <button className="px-6 py-2 rounded-lg border border-red-500 text-red-300 hover:bg-red-500/10 font-medium transition-colors">
                                Delete Account
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    )
}
