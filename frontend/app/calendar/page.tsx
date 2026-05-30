"use client";
import { useState, useEffect } from "react";

const TEST_USER_ID = "test-user-123";
const API = process.env.NEXT_PUBLIC_API_URL;

export default function CalendarPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [newTask, setNewTask] = useState("");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    fetch(`${API}/calendar/goals?user_id=${TEST_USER_ID}`)
      .then(r => r.json()).then(setGoals);
    fetch(`${API}/calendar/tasks?user_id=${TEST_USER_ID}`)
      .then(r => r.json()).then(setTasks);
  }, []);

  const addGoal = async () => {
    if (!newGoal.trim()) return;
    const res = await fetch(`${API}/calendar/goals?user_id=${TEST_USER_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newGoal, deadline }),
    });
    const created = await res.json();
    setGoals(prev => [...prev, created]);
    setNewGoal("");
    setDeadline("");
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    const res = await fetch(`${API}/calendar/tasks?user_id=${TEST_USER_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTask }),
    });
    const created = await res.json();
    setTasks(prev => [...prev, created]);
    setNewTask("");
  };

  const toggleGoal = async (id: string, completed: boolean) => {
    await fetch(`${API}/calendar/goals/${id}?completed=${!completed}`, { method: "PATCH" });
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !completed } : g));
  };

  const toggleTask = async (id: string, completed: boolean) => {
    await fetch(`${API}/calendar/tasks/${id}/complete?completed=${!completed}`, { method: "PATCH" });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !completed } : t));
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 800 }}>
      <h1>Calendar & To-Do</h1>

      {/* Goals */}
      <section style={{ marginBottom: "2rem" }}>
        <h2>Goals</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={newGoal}
            onChange={e => setNewGoal(e.target.value)}
            placeholder="New goal..."
            style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd" }}
          />
          <input
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd" }}
          />
          <button onClick={addGoal}
            style={{ padding: "8px 16px", borderRadius: 6, background: "#6366f1", color: "#fff", border: "none", cursor: "pointer" }}>
            Add
          </button>
        </div>
        {goals.map(goal => (
          <div key={goal.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f9f9f9", borderRadius: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={goal.completed} onChange={() => toggleGoal(goal.id, goal.completed)} />
            <span style={{ flex: 1, textDecoration: goal.completed ? "line-through" : "none", color: goal.completed ? "#aaa" : "#000" }}>
              {goal.title}
            </span>
            {goal.deadline && <span style={{ fontSize: 12, color: "#888" }}>📅 {goal.deadline}</span>}
          </div>
        ))}
      </section>

      {/* Tasks */}
      <section>
        <h2>Tasks</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            placeholder="New task..."
            style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd" }}
          />
          <button onClick={addTask}
            style={{ padding: "8px 16px", borderRadius: 6, background: "#6366f1", color: "#fff", border: "none", cursor: "pointer" }}>
            Add
          </button>
        </div>
        {tasks.map(task => (
          <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f9f9f9", borderRadius: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id, task.completed)} />
            <span style={{ textDecoration: task.completed ? "line-through" : "none", color: task.completed ? "#aaa" : "#000" }}>
              {task.title}
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}