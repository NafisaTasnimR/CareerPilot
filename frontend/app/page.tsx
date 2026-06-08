// app/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Upload, Cpu, Compass, ArrowDown, UserPlus } from "lucide-react";
import AuthModal from "@/components/authentication/auth-modal";

const PilotCapIcon = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 7L14 10H10L12 7Z" fill="currentColor" stroke="currentColor" strokeWidth="1" />
    <path d="M8 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 15H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

const StarsBackground = () => {
  const [stars, setStars] = useState<Array<{ id: number; style: React.CSSProperties }>>([]);

  useEffect(() => {
    const starArray = Array.from({ length: 220 }, (_, i) => {
      const size = Math.random() * 2.5 + 0.5;
      return {
        id: i,
        style: {
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: `${size}px`,
          height: `${size}px`,
          animationDuration: `${Math.random() * 4 + 2}s`,
          animationDelay: `${Math.random() * 6}s`,
          opacity: Math.random() * 0.5 + 0.2,
        },
      };
    });
    setStars(starArray);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {stars.map((star) => (
        <div key={star.id} className="absolute bg-white rounded-full animate-twinkle" style={star.style} />
      ))}
    </div>
  );
};

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

interface StepSectionProps {
  number: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  detail: string;
  isLast?: boolean;
}

const StepSection = ({ number, icon, title, subtitle, description, detail, isLast }: StepSectionProps) => {
  const { ref, visible } = useScrollReveal();

  return (
    <section className="min-h-screen flex flex-col items-center justify-center relative px-6 py-24">
      <div
        ref={ref}
        className={`max-w-3xl w-full mx-auto transition-all duration-1000 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"
          }`}
      >
        <div className="flex items-center gap-3 mb-8">
          <span className="text-xs font-mono tracking-[0.3em] uppercase text-white/50">
            STEP {number}
          </span>
          <div className="h-px flex-1 max-w-[60px] bg-white/20" />
        </div>

        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 bg-white/[0.06] border border-white/[0.12]">
          <div className="text-white/80">{icon}</div>
        </div>

        <h2 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tight mb-4">
          {title}
        </h2>
        <p className="text-xl md:text-2xl font-light mb-10 text-white/60">
          {subtitle}
        </p>

        <p className="text-lg text-white/40 leading-relaxed mb-8 max-w-2xl">
          {description}
        </p>

        <div className="inline-flex items-start gap-3 px-5 py-4 rounded-xl text-sm text-white/50 leading-relaxed max-w-xl bg-white/[0.04] border border-white/[0.08]">
          <span className="text-white/40 shrink-0 mt-0.5"></span>
          {detail}
        </div>
      </div>

      {!isLast && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20 animate-bounce-slow">
          <ArrowDown className="w-4 h-4" />
        </div>
      )}
    </section>
  );
};

export default function LandingPage() {
  const heroReveal = useScrollReveal();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"login" | "signup">("signup");

  const openModal = (mode: "login" | "signup") => {
    setModalMode(mode);
    setModalOpen(true);
  };

  const toggleModalMode = () => {
    setModalMode(prev => prev === "signup" ? "login" : "signup");
  };

  return (
    <div className="relative bg-black text-white overflow-x-hidden">
      <StarsBackground />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-5 border-b border-white/[0.06] backdrop-blur-md bg-black/40">
        <div className="flex items-center gap-2">
          <span className="text-lg tracking-tight text-white/90 font-regular">CareerPilot</span>
        </div>

        <nav className="flex items-center gap-1">
          <button
            onClick={() => openModal("login")}
            className="group flex items-center px-4 py-2 text-sm text-white/40 hover:text-white rounded-lg transition-all duration-200 hover:bg-white/[0.06]"
          >
            Login
          </button>
          <button
            onClick={() => openModal("signup")}
            className="group flex items-center px-4 py-2 text-sm text-white/40 hover:text-white rounded-lg transition-all duration-200 hover:bg-white/[0.06]"
          >
            Sign Up
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24">
        <div
          ref={heroReveal.ref}
          className={`max-w-4xl mx-auto transition-all duration-1200 ease-out ${heroReveal.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
        >
          <h1 className="text-6xl md:text-8xl font-black leading-none tracking-tighter text-white mb-6">
            Pilot Your
            <br />
            Career Path
          </h1>

          <p className="text-lg md:text-xl text-white/40 max-w-xl mx-auto leading-relaxed mb-14">
            Upload your CV once. Get job matches, skill gap analysis, a personalised
            roadmap, and cover letters — all based on your real profile.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => openModal("signup")}
              className="px-8 py-3.5 rounded-full text-sm font-medium text-white border border-white/20 bg-white/[0.07] hover:bg-white/[0.12] transition-all duration-200 tracking-wide"
            >
              Get Started Free
            </button>
            <button
              onClick={() => document.getElementById("step-1")?.scrollIntoView({ behavior: "smooth" })}
              className="px-8 py-3.5 rounded-full text-sm font-medium text-white/30 hover:text-white/60 transition-colors duration-200 tracking-wide"
            >
              See how it works
            </button>
          </div>
        </div>

        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 70%)"
        }} />

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent animate-scroll-line" />
        </div>
      </section>

      {/* Step 1 */}
      <div id="step-1">
        <StepSection
          number="01"
          icon={<Upload className="w-7 h-7" />}
          title="Upload Your CV"
          subtitle="PDF or DOCX — we handle both."
          description="Drop your existing CV and CareerPilot reads it in full — your experience, education, skills, and projects, exactly as you wrote them."
          detail="Supports PDF and DOCX. Your file is stored securely and never shared. Re-upload anytime to keep your profile current."
        />
      </div>

      {/* Step 2 */}
      <StepSection
        number="02"
        icon={<Cpu className="w-7 h-7" />}
        title="We Learn Who You Are"
        subtitle="Every feature is built around your real background."
        description="Your CV is broken into sections and indexed so that every job match, skill gap, and cover letter is grounded in your actual experience — not a generic template."
        detail="This is what makes CareerPilot different. Nothing is made up. Every answer is based on what you have actually done."
      />

      {/* Step 3 */}
      <StepSection
        number="03"
        icon={<Compass className="w-7 h-7" />}
        title="Your Co-pilot Takes Over"
        subtitle="Find jobs. Close skill gaps. Stay on track."
        description="Search for live job openings and see how well each one matches your profile. Ask your AI assistant anything about your career. Track every application on a Kanban board. Set weekly goals and get reminders when you go quiet."
        detail="Job Hunter, AI Assistant, Skill Gap Analysis, Cover Letter Generator, Application Tracker, and Progress Dashboard — all in one place."
        isLast
      />

      {/* CTA */}
      <section className="relative min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase text-white/20 mb-6">Ready to fly?</p>
          <h2 className="text-5xl md:text-6xl font-black text-white leading-tight mb-10">
            Your next role
            <br />
            <span className="text-white/30">is one upload away.</span>
          </h2>
          <button
            onClick={() => openModal("signup")}
            className="inline-flex items-center gap-2 px-10 py-4 rounded-full text-sm font-medium text-white border border-white/20 bg-white/[0.07] hover:bg-white/[0.13] transition-all duration-200 tracking-wide"
          >
            <UserPlus className="w-4 h-4" />
            Create Free Account
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/[0.06] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/30 font-regular">CareerPilot</span>
          </div>
          <p className="text-xs text-white/15">
            {new Date().getFullYear()} CareerPilot
          </p>
        </div>
      </footer>

      <AuthModal
        isOpen={modalOpen}
        mode={modalMode}
        onClose={() => setModalOpen(false)}
        onToggleMode={toggleModalMode}
      />

      <style jsx global>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; background: #000; }

        @keyframes twinkle {
          0%   { opacity: 0.15; transform: scale(1); }
          50%  { opacity: 0.9;  transform: scale(1.3); }
          100% { opacity: 0.15; transform: scale(1); }
        }
        .animate-twinkle { animation: twinkle infinite ease-in-out; }

        @keyframes bounce-slow {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%       { transform: translateX(-50%) translateY(6px); }
        }
        .animate-bounce-slow { animation: bounce-slow 2s infinite ease-in-out; }

        @keyframes scroll-line {
          0%   { opacity: 0; transform: scaleY(0); transform-origin: top; }
          50%  { opacity: 1; transform: scaleY(1); }
          100% { opacity: 0; transform: scaleY(0); transform-origin: bottom; }
        }
        .animate-scroll-line { animation: scroll-line 2s infinite ease-in-out; }
      `}</style>
    </div>
  );
}