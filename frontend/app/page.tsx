'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
    const router = useRouter()

    useEffect(() => {
        const stored = localStorage.getItem('userCV')
        if (stored) {
            try {
                JSON.parse(stored)
                router.replace('/dashboard')
            } catch {
                router.replace('/cv-upload')
            }
        } else {
            router.replace('/cv-upload')
        }
    }, [router])

    // Show nothing while redirecting
    return null
}