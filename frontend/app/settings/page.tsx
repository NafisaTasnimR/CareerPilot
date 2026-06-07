'use client'

import AppShell from '@/components/app-shell'
import { useAuth } from '@/components/authentication/auth-provider'
import { User } from 'lucide-react'
import { useState, useEffect } from 'react'
import { updateProfile } from 'firebase/auth'

export default function SettingsPage() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [formData, setFormData] = useState({
        displayName: '',
        email: '',
        photoURL: '',
    })

    useEffect(() => {
        if (user) {
            setFormData({
                displayName: user.displayName || '',
                email: user.email || '',
                photoURL: user.photoURL || '',
            })
        }
    }, [user])

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        setLoading(true)
        setMessage('')
        try {
            await updateProfile(user, {
                displayName: formData.displayName,
                photoURL: formData.photoURL,
            })

            // Sync user data to backend
            const idToken = await user.getIdToken()
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/users/me`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    firebase_uid: user.uid,
                    email: user.email,
                    full_name: formData.displayName,
                }),
            })

            if (response.ok) {
                setMessage('Profile updated successfully!')
            } else {
                setMessage('Profile updated in Firebase, but sync with backend failed.')
            }
        } catch (error: any) {
            setMessage(`Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <AppShell>
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-semibold text-white">Settings</h1>
                    <p className="text-gray-400 mt-2">Manage your account</p>
                </div>

                {message && (
                    <div className={`p-4 rounded-lg ${message.includes('Error') ? 'bg-red-900/30 text-red-200' : 'bg-green-900/30 text-green-200'}`}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="rounded-xl border border-gray-700 bg-gray-900 p-6">
                        <h2 className="text-lg font-semibold text-white mb-6">Profile Information</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.displayName}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            displayName: e.target.value,
                                        })
                                    }
                                    className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white focus:outline-none focus:border-gray-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    disabled
                                    className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 cursor-not-allowed"
                                />
                                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Profile Picture URL
                                </label>
                                <input
                                    type="url"
                                    value={formData.photoURL}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            photoURL: e.target.value,
                                        })
                                    }
                                    placeholder="https://..."
                                    className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white focus:outline-none focus:border-gray-500 transition-colors"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-6 px-6 py-2 rounded-lg bg-gray-700 text-white font-medium transition-colors hover:bg-gray-600 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </AppShell>
    )
}