import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiClient, getApiErrorMessage } from "../services/api";

const statusLabels = ["To Do", "In Progress", "Done"];

const projectInit = { name: "", description: "", member_ids: [] };
const taskInit = {
  project_id: "",
  title: "",
  description: "",
  status: "To Do",
  assignee_id: "",
  due_date: "",
};

function fmtDate(value) {
  if (!value) return "No due date";
  return new Date(value).toLocaleString();
}

function statusBadge(status) {
  if (status === "Done") return "bg-green-100 text-green-700";
  if (status === "In Progress") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export function DashboardPage() {
  const { user, isAdmin } = useAuth();

  const [summary, setSummary] = useState({ total: 0, todo: 0, in_progress: 0, done: 0, overdue: 0 });
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [overdueTasks, setOverdueTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [projectForm, setProjectForm] = useState(projectInit);
  const [taskForm, setTaskForm] = useState(taskInit);
  const [savingProject, setSavingProject] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const calls = [
        apiClient.get("/tasks/dashboard"),
        apiClient.get("/projects"),
        apiClient.get("/tasks/me"),
      ];
      if (isAdmin) calls.push(apiClient.get("/auth/users"));

      const results = await Promise.all(calls);
      const dashboardData = results[0].data;
      const projectsData = results[1].data;
      const myTasks = results[2].data;

      setSummary(dashboardData.summary);
      setOverdueTasks(dashboardData.overdue_tasks || []);
      setProjects(projectsData || []);
      setTasks(myTasks || []);
      if (isAdmin) {
        setUsers(results[3].data || []);
      } else {
        setUsers([]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load dashboard."));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const grouped = useMemo(() => {
    return statusLabels.reduce((acc, label) => {
      acc[label] = tasks.filter((task) => task.status === label);
      return acc;
    }, {});
  }, [tasks]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === taskForm.project_id),
    [projects, taskForm.project_id]
  );

  const assignableUsers = useMemo(() => {
    if (!isAdmin || !selectedProject) return [];
    return users
      .filter((u) => selectedProject.member_ids.includes(u.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [isAdmin, selectedProject, users]);

  const updateStatus = async (taskId, status) => {
    setError("");
    setMessage("");
    try {
      await apiClient.patch(`/tasks/${taskId}/status`, { status });
      setMessage("Task status updated.");
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update task."));
    }
  };

  const toggleMember = (memberId) => {
    setProjectForm((prev) => ({
      ...prev,
      member_ids: prev.member_ids.includes(memberId)
        ? prev.member_ids.filter((id) => id !== memberId)
        : [...prev.member_ids, memberId],
    }));
  };

  const createProject = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSavingProject(true);
    try {
      await apiClient.post("/projects", projectForm);
      setProjectForm(projectInit);
      setMessage("Project created.");
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create project."));
    } finally {
      setSavingProject(false);
    }
  };

  const createTask = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSavingTask(true);
    try {
      await apiClient.post("/tasks", {
        ...taskForm,
        assignee_id: taskForm.assignee_id || null,
        due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
      });
      setTaskForm(taskInit);
      setMessage("Task created and assigned.");
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create task."));
    } finally {
      setSavingTask(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {message && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p>}
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total" value={summary.total} />
        <StatCard label="To Do" value={summary.todo} />
        <StatCard label="In Progress" value={summary.in_progress} />
        <StatCard label="Done" value={summary.done} />
        <StatCard label="Overdue" value={summary.overdue} alert />
      </section>

      {isAdmin && (
        <section className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={createProject} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Create Project & Team</h2>
            <input
              value={projectForm.name}
              onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Project name"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              value={projectForm.description}
              onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Description"
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="grid max-h-48 gap-2 overflow-y-auto rounded-md border border-gray-200 p-2 sm:grid-cols-2">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={projectForm.member_ids.includes(u.id)}
                    onChange={() => toggleMember(u.id)}
                  />
                  <span>{u.name} ({u.role})</span>
                </label>
              ))}
            </div>
            <button
              type="submit"
              disabled={savingProject}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {savingProject ? "Creating..." : "Create Project"}
            </button>
          </form>

          <form onSubmit={createTask} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Create & Assign Task</h2>
            <select
              required
              value={taskForm.project_id}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, project_id: e.target.value, assignee_id: "" }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <input
              required
              value={taskForm.title}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Task title"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              value={taskForm.description}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Task description"
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <select
                value={taskForm.status}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, status: e.target.value }))}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {statusLabels.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select
                value={taskForm.assignee_id}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, assignee_id: e.target.value }))}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                disabled={!taskForm.project_id}
              >
                <option value="">Unassigned</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={taskForm.due_date}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, due_date: e.target.value }))}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={savingTask}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {savingTask ? "Saving..." : "Create Task"}
            </button>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">My Projects</h2>
        {projects.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">No projects available yet.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {projects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`} className="rounded-lg border border-gray-200 p-3 text-sm hover:bg-gray-50">
                <p className="font-semibold text-gray-900">{project.name}</p>
                <p className="mt-1 text-gray-600">{project.description || "No description"}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{isAdmin ? "All Tasks" : "My Tasks"}</h2>
          {tasks.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">No tasks assigned.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {tasks.slice(0, 20).map((task) => {
                const canEdit = isAdmin || task.assignee_id === user?.id;
                return (
                  <article key={task.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <span className={`rounded px-2 py-1 text-xs font-medium ${statusBadge(task.status)}`}>{task.status}</span>
                    </div>
                    <p className="mt-1 text-gray-600">{task.description || "No description"}</p>
                    <p className="mt-2 text-xs text-gray-500">Due: {fmtDate(task.due_date)}</p>
                    {canEdit && (
                      <select
                        value={task.status}
                        onChange={(event) => updateStatus(task.id, event.target.value)}
                        className="mt-2 w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                      >
                        {statusLabels.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Overdue Tasks</h2>
          {overdueTasks.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">No overdue tasks.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {overdueTasks.map((task) => (
                <article key={task.id} className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                  <p className="font-medium text-gray-900">{task.title}</p>
                  <p className="mt-1 text-gray-700">{task.description || "No description"}</p>
                  <p className="mt-2 text-xs text-red-700">Due: {fmtDate(task.due_date)}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Task Status Buckets</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {statusLabels.map((label) => (
            <div key={label} className="rounded-lg border border-gray-200 p-3">
              <p className="text-sm font-semibold text-gray-800">{label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{grouped[label]?.length || 0}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, alert = false }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${alert ? "text-red-700" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
