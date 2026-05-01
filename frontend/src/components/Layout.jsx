import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function navClass({ isActive }) {
  return isActive
    ? "rounded-md bg-purple-100 px-3 py-2 text-sm font-medium text-purple-700"
    : "rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100";
}

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-purple-700">
            Team Task Manager
          </Link>
          <nav className="flex items-center gap-2">
            <NavLink to="/" end className={navClass}>
              Dashboard
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navClass}>
                Admin Panel
              </NavLink>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm">
          Logged in as <span className="font-semibold">{user?.name}</span> ({user?.role})
        </div>
        <Outlet />
      </main>
    </div>
  );
}
