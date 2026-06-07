"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser)

        // Sync user to Supabase on every login
        if (currentUser) {
            try {
                const idToken = await currentUser.getIdToken()
                await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/me`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        firebase_uid: currentUser.uid,
                        email: currentUser.email,
                        full_name: currentUser.displayName || '',
                    }),
                })
            } catch (e) {
                console.error('User sync failed:', e)
            }
        }

        setLoading(false)
    })

    return () => unsubscribe()
}, [])


    useEffect(() => {
        if (!loading) {
            const publicPaths = ["/"]; // Add other public paths like /login if they exist
            const isPublicPath = publicPaths.includes(pathname);

            if (!user && !isPublicPath) {
                router.push("/");
            } else if (user && pathname === "/") {
                router.push("/dashboard");
            }
        }
    }, [user, loading, pathname, router]);

    const logout = async () => {
        await auth.signOut();
        router.push("/");
    };

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
