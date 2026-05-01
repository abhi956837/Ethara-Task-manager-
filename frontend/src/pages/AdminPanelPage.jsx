import { useEffect, useMemo, useState } from "react";
import { TaskCreateForm } from "../components/TaskCreateForm";
import { apiClient, getApiErrorMessage } from "../services/api";

const initialProjectForm = {
  name: "",
  description: "",
  member_ids: [],
};

export function AdminPanelPage() {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [memberDraft, setMemberDraft] = useState({ project_id: "", member_ids: [] });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);

  const sortedUsers = useMemo(() => [...users].sort((a, b) => a.name.localeCompare(b.name)), [users]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === memberDraft.project_id),
    [projects, memberDraft.project_id]
  );

  const availableMembers = useMemo(() => {
    if (!selectedProject) return sortedUsers;
    return sortedUsers.filter((user) => !selectedProject.member_ids.includes(user.id));
  }, [selectedProject, sortedUsers]);

  const loadAdminData = async () => {
    setError("");
    try {
      const [{ data: usersData }, { data: projectsData }] = await Promise.all([
        apiClient.get("/auth/users"),
        apiClient.get("/projects"),
      ]);
      setUsers(usersData);
      setProjects(projectsData);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load admin data."));
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const toggleMember = (userId) => {
    setProjectForm((prev) => {
      const exists = prev.member_ids.includes(userId);
      return {
        ...prev,
        member_ids: exists ? prev.member_ids.filter((id) => id !== userId) : [...prev.member_ids, userId],
      };
    });
  };

  const toggleDraftMember = (userId) => {
    setMemberDraft((prev) => {
      const exists = prev.member_ids.includes(userId);
      return {
        ...prev,
        member_ids: exists ? prev.member_ids.filter((id) => id !== userId) : [...prev.member_ids, userId],
      };
    });
  };

  const createProject = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingProject(true);
    try {
      await apiClient.post("/projects", projectForm);
      setMessage("Project created.");
      setProjectForm(initialProjectForm);
      await loadAdminData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create project."));
    } finally {
      setSavingProject(false);
    }
  };

  const addMembers = async (event) => {
    event.preventDefault();
    if (!memberDraft.project_id || memberDraft.member_ids.length === 0) return;

    setMessage("");
    setError("");
    setSavingMembers(true);

    try {
      await apiClient.post(`/projects/${memberDraft.project_id}/members`, {
        member_ids: memberDraft.member_ids,
      });
      setMessage("Team members added.");
      setMemberDraft((prev) => ({ ...prev, member_ids: [] }));
      await loadAdminData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update members."));
    } finally {
      setSavingMembers(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p>}
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Create Project</h2>
        <form onSubmit={createProject} className="mt-4 space-y-3">
          <input
            value={projectForm.name}
            onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Project name"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            value={projectForm.description}
            onChange={(event) => setProjectForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Description"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />

          <div>
            <p className="mb-2 text-sm font-medium text-gray-800">Assign initial members</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {sortedUsers.map((user) => (
                <label key={user.id} className="flex items-center gap-2 rounded-md border border-gray-200 p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={projectForm.member_ids.includes(user.id)}
                    onChange={() => toggleMember(user.id)}
                  />
                  <span>
                    {user.name} ({user.role})
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProject}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {savingProject ? "Creating..." : "Create Project"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Manage Project Team</h2>
        <form onSubmit={addMembers} className="mt-4 space-y-3">
          <select
            value={memberDraft.project_id}
            onChange={(event) => setMemberDraft({ project_id: event.target.value, member_ids: [] })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          {memberDraft.project_id && (
            <div className="grid gap-2 sm:grid-cols-2">
              {availableMembers.length === 0 ? (
                <p className="text-sm text-gray-600">All users are already in this project.</p>
              ) : (
                availableMembers.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 rounded-md border border-gray-200 p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={memberDraft.member_ids.includes(user.id)}
                      onChange={() => toggleDraftMember(user.id)}
                    />
                    <span>
                      {user.name} ({user.role})
                    </span>
                  </label>
                ))
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={savingMembers || memberDraft.member_ids.length === 0}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {savingMembers ? "Saving..." : "Add Members"}
          </button>
        </form>
      </section>

      <TaskCreateForm projects={projects} users={users} onCreated={loadAdminData} />
    </div>
  );
}
