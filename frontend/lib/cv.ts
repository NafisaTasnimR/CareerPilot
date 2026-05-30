import { supabase } from './supabase'

export interface CVData {
    file_id: string
    file_name: string
    chunk_count: number
    collection: string
    ids: string[]
    uploaded_at: string
}

export interface ParsedCV {
    experience: string[]
    education: string[]
    skills: string[]
    projects: string[]
}

/**
 * Get user's CV data from Supabase
 */
export async function getUserCV(userId: string): Promise<CVData | null> {
    try {
        const { data, error } = await supabase
            .from('user_cvs')
            .select('*')
            .eq('user_id', userId)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows returned
                return null
            }
            throw error
        }

        return data
    } catch (error) {
        console.error('Error fetching user CV:', error)
        return null
    }
}

/**
 * Save CV metadata to Supabase
 */
export async function saveCV(
    userId: string,
    cvData: Omit<CVData, 'uploaded_at'>
): Promise<CVData | null> {
    try {
        const { data, error } = await supabase
            .from('user_cvs')
            .insert([
                {
                    user_id: userId,
                    file_id: cvData.file_id,
                    file_name: cvData.file_name,
                    chunk_count: cvData.chunk_count,
                    collection: cvData.collection,
                    ids: cvData.ids,
                    uploaded_at: new Date().toISOString(),
                },
            ])
            .select()
            .single()

        if (error) throw error
        return data
    } catch (error) {
        console.error('Error saving CV:', error)
        return null
    }
}

/**
 * Parse CV metadata into sections
 */
export function parseMetadata(metadata: Record<string, any>[]): ParsedCV {
    const parsed: ParsedCV = {
        experience: [],
        education: [],
        skills: [],
        projects: [],
    }

    metadata.forEach((meta) => {
        const section = meta.section?.toLowerCase()
        if (section && parsed[section as keyof ParsedCV]) {
            parsed[section as keyof ParsedCV].push(meta.content || '')
        }
    })

    return parsed
}
