const fallbackBackendUrl = 'http://127.0.0.1:8000'

export function getBackendUrl() {
    return (process.env.NEXT_PUBLIC_BACKEND_URL || fallbackBackendUrl).replace(/\/$/, '')
}
