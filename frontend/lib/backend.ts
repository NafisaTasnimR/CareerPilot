import { auth } from '@/lib/firebase'

const fallbackBackendUrl = 'http://127.0.0.1:8000'

export function getBackendUrl() {
    return (process.env.NEXT_PUBLIC_BACKEND_URL || fallbackBackendUrl).replace(/\/$/, '')
}

/*export async function getAuthHeaders() {
    const user = auth.currentUser
    if (!user) {
        throw new Error('User not authenticated')
    }
    const idToken = await user.getIdToken()
    return {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
    }
}*/

export async function getAuthToken() {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')
    const idToken = await user.getIdToken()
    return { Authorization: `Bearer ${idToken}` }
}

export async function getAuthHeaders() {
    const token = await getAuthToken()
    return { ...token, 'Content-Type': 'application/json' }
}

export async function authenticatedFetch(
    url: string,
    options: RequestInit = {}
) {
    const headers = await getAuthHeaders()
    return fetch(url, {
        ...options,
        headers: {
            ...headers,
            ...(options.headers || {})
        }
    })
}
