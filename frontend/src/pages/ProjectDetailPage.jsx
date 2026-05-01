import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiClient, getApiErrorMessage } from "../services/api";

const columns = ["To Do", "In Progress", "Done"];

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const groupedTasks = useMemo(() => {
    return columns.reduce((acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status);
      return acc;
    }, {});
  }, [tasks]);

  const loadProjectData = async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: projectData }, { data: tasksData }] = await Promise.all([
        apiClient.get(`/projects/${projectId}`),
        apiClient.get(`/tasks/project/${projectId}`),
      ]);
      setProject(projectData);
      setTasks(tasksData || []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load project details."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const updateTaskStatus = async (taskId, status) => {
    setError("");
    try {
      await apiClient.patch(`/tasks/${taskId}/status`, { status });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)));
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not update task status."));
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">Loading project...</div>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">{project?.name || "Project"}</h1>
        <p className="mt-1 text-sm text-gray-600">{project?.description || "No description"}</p>
      </section>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="grid gap-4 md:grid-cols-3">
        {columns.map((status) => (
          <div key={status} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-800">{status}</h2>
            <div className="space-y-3">
              {groupedTasks[status]?.map((task) => {
                const canEdit = user?.role === "admin" || (task.assignee_id && task.assignee_id === user?.id);
                return (
                  <article key={task.id} className="rounded-md border border-gray-200 p-3 text-sm">
                    <p className="font-medium text-gray-900">{task.title}</p>
                    <p className="mt-1 text-gray-600">{task.description || "No description"}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      Due: {task.due_date ? new Date(task.due_date).toLocaleString() : "N/A"}
                    </p>
                    {canEdit && (
                      <select
                        value={task.status}
                        onChange={(event) => updateTaskStatus(task.id, event.target.value)}
                        className="mt-2 w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                      >
                        {columns.map((statusOption) => (
                          <option key={statusOption} value={statusOption}>
                            {statusOption}
                          </option>
                        ))}
                      </select>
                    )}
                  </article>
                );
              })}
              {groupedTasks[status]?.length === 0 && <p className="text-xs text-gray-500">No tasks</p>}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
