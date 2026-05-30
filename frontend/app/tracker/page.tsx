"use client";
import KanbanBoard from "@/components/KanbanBoard";
import ProgressDashboard from "@/components/ProgressDashboard";
import NudgeBell from "@/components/NudgeBell";

const TEST_USER_ID = "test-user-123";

export default function TrackerPage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1>Tracker</h1>
        <NudgeBell userId={TEST_USER_ID} />
      </div>

      {/* Kanban */}
      <section style={{ marginBottom: "3rem" }}>
        <h2>Application Tracker</h2>
        <KanbanBoard userId={TEST_USER_ID} />
      </section>

      {/* Progress */}
      <section>
        <h2>Progress Dashboard</h2>
        <ProgressDashboard userId={TEST_USER_ID} />
      </section>

    </main>
  );
}