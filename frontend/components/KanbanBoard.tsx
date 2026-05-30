"use client";
import { useState, useEffect } from "react";
import { DndContext, DragEndEvent } from "@dnd-kit/core";

const COLUMNS = ["Applied", "Interviewing", "Offer", "Rejected"];
const API = process.env.NEXT_PUBLIC_API_URL;

export default function KanbanBoard({ userId }: { userId: string }) {
  const [apps, setApps] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/kanban?user_id=${userId}`)
      .then(r => r.json()).then(setApps);
  }, [userId]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const newStatus = over.id as string;
    await fetch(`${API}/kanban/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setApps(prev => prev.map(a => a.id === active.id ? { ...a, status: newStatus } : a));
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div style={{ display: "flex", gap: "1rem" }}>
        {COLUMNS.map(col => (
          <div key={col} style={{ flex: 1, background: "#f5f5f5", borderRadius: 8, padding: 12 }}>
            <h3>{col}</h3>
            {apps.filter(a => a.status === col).map(app => (
              <div key={app.id} draggable
                style={{ background: "#fff", padding: 10, marginBottom: 8, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <strong>{app.role}</strong>
                <p style={{ margin: 0, fontSize: 13, color: "#666" }}>{app.company}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </DndContext>
  );
}