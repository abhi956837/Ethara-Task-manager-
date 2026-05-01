import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const baseForm = {
  name: "",
  email: "",
  password: "",
  role: "member",
  admin_invite_code: "",
};

export function LoginSignupPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [form, setForm] = useState(baseForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isAuthenticated, login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || "/";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = isSignup ? await signup(form) : await login(form);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    navigate(redirectTo, { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          {isSignup ? "Create account" : "Login"}
        </h1>
        <p className="mt-1 text-sm text-gray-600">Team Task Manager</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {isSignup && (
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Full name"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          )}

          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Email"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />

          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Password"
            minLength={8}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />

          {isSignup && (
            <>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>

              {form.role === "admin" && (
                <input
                  type="password"
                  name="admin_invite_code"
                  value={form.admin_invite_code}
                  onChange={handleChange}
                  placeholder="Admin invite code"
                  minLength={8}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              )}
            </>
          )}

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSubmitting ? "Please wait..." : isSignup ? "Sign up" : "Login"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setIsSignup((prev) => !prev);
            setError("");
          }}
          className="mt-3 text-sm text-purple-700 underline"
        >
          {isSignup ? "Already have an account? Login" : "No account? Create one"}
        </button>
      </div>
    </main>
  );
}
