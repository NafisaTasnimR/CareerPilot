// components/AuthModal.tsx
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface AuthModalProps {
    isOpen: boolean;
    mode: "login" | "signup";
    onClose: () => void;
    onToggleMode: () => void;
}

export default function AuthModal({ isOpen, mode, onClose, onToggleMode }: AuthModalProps) {
    const router = useRouter();

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const title = mode === "signup" ? "Create an account" : "Log in to your account";
    const toggleText = mode === "signup" ? "Already have an account? Log in" : "Don't have an account? Sign up";

    const handleGoogleSignIn = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);

            // Sync user to backend (same as original handleGoogleSignUp)
            const idToken = await result.user.getIdToken();
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/me`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    firebase_uid: result.user.uid,
                    email: result.user.email,
                    full_name: result.user.displayName || "",
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Failed to sync user data.");
            }

            onClose();
            router.push("/dashboard");
        } catch (err) {
            console.error("Google sign-in error:", err);
            // Optionally show a toast or error message – here we just log
        }
    };

    return (
        <>
            {/* Backdrop with transparent blur */}
            <div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-all duration-300"
                onClick={onClose}
            />
            {/* Modal */}
            <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
                <div className="relative rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="p-8 pt-12">
                        <h2 className="text-2xl font-semibold text-white text-center mb-8">
                            {title}
                        </h2>

                        {/* Only Google option */}
                        <button
                            onClick={handleGoogleSignIn}
                            className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/30"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Continue with Google
                        </button>

                        <p className="mt-6 text-center text-sm text-gray-400">
                            <button
                                onClick={onToggleMode}
                                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                            >
                                {toggleText}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}