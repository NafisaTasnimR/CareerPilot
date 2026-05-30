"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function NudgeBell({ userId }: { userId: string }) {
  const [nudges, setNudges] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`${API}/nudges?user_id=${userId}&seen=false`)
      .then(r => r.json()).then(setNudges);
  }, [userId]);

  const unseen = nudges.filter(n => !n.seen).length;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22 }}>
        🔔
        {unseen > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, background: "red", color: "#fff", borderRadius: "50%", fontSize: 11, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {unseen}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 36, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", borderRadius: 10, padding: 12, width: 280, zIndex: 100 }}>
          {nudges.length === 0 ? <p style={{ margin: 0, fontSize: 13 }}>No new nudges!</p> : nudges.map(n => (
            <div key={n.id} style={{ marginBottom: 8, padding: 8, background: "#f0f4ff", borderRadius: 6, fontSize: 13 }}>
              {n.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}