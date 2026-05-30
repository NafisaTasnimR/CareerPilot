"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function ProgressDashboard({ userId }: { userId: string }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/progress/stats?user_id=${userId}`)
      .then(r => r.json()).then(setStats);
  }, [userId]);

  if (!stats) return <p>Loading...</p>;

  const chartData = Object.entries(stats.status_breakdown || {}).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {[
          { label: "Total applications", value: stats.total_applications },
          { label: "This week", value: stats.weekly_applications },
          { label: "Tasks done", value: `${stats.tasks_completed}/${stats.tasks_total}` },
          { label: "Roadmap", value: `${stats.roadmap_percent}%` },
        ].map(card => (
          <div key={card.label} style={{ flex: 1, minWidth: 140, background: "#f9f9f9", borderRadius: 8, padding: 16 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#888" }}>{card.label}</p>
            <h2 style={{ margin: 0 }}>{card.value}</h2>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}