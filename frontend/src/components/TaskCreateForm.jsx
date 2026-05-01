import { useMemo, useState } from "react";
import { apiClient, getApiErrorMessage } from "../services/api";

const initialForm = {
  project_id: "",
  title: "",
  description: "",
  status: "To Do",
  assignee_id: "",
  due_date: "",
};

export function TaskCreateForm({ projects, users, onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sortedProjects = useMemo(() => [...projects].sort((a, b) => a.name.localeCompare(b.name)), [projects]);

  const assignees = useMemo(() => {
    if (!form.project_id) return [];
    const selectedProject = projects.find((project) => project.id === form.project_id);
    if (!selectedProject) return [];

    return users
      .filter((user) => selectedProject.member_ids.includes(user.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [form.project_id, projects, users]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "project_id" ? { assignee_id: "" } : {}),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSaving(true);

    try {
      const payload = {
        ...form,
        assignee_id: form.assignee_id || null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      };
      await apiClient.post("/tasks", payload);
      setForm(initialForm);
      setMessage("Task created.");
      onCreated?.();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create task."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Create Task</h3>

      <select
        name="project_id"
        value={form.project_id}
        onChange={handleChange}
        required
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">Select project</option>
        {sortedProjects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>

      <input
        name="title"
        value={form.title}
        onChange={handleChange}
        placeholder="Task title"
        required
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <textarea
        name="description"
        value={form.description}
        onChange={handleChange}
        placeholder="Task description"
        rows={3}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <select
          name="status"
          value={form.status}
          onChange={handleChange}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option>To Do</option>
          <option>In Progress</option>
          <option>Done</option>
        </select>

        <select
          name="assignee_id"
          value={form.assignee_id}
          onChange={handleChange}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          disabled={!form.project_id}
        >
          <option value="">Unassigned</option>
          {assignees.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.role})
            </option>
          ))}
        </select>

        <input
          type="datetime-local"
          name="due_date"
          value={form.due_date}
          onChange={handleChange}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSaving ? "Saving..." : "Create Task"}
      </button>
    </form>
  );
}
