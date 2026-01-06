import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "./stores/auth-store";
import { useThemeStore } from "./stores/theme-store";
import { Moon, Sun, ClipboardList } from "lucide-react";

export function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { updatePassword } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => navigate("/"), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black p-4">
      <button
        onClick={toggle}
        className="absolute top-4 right-4 p-2 rounded-lg text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700"
      >
        {dark ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <ClipboardList size={32} className="text-blue-600" />
          <h1 className="text-2xl font-bold dark:text-white">Family Chores</h1>
        </div>
        {success ? (
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6 text-center">
            <h2 className="text-lg font-semibold dark:text-white mb-2">
              Password Updated
            </h2>
            <p className="text-gray-600 dark:text-neutral-400 mb-4">
              Redirecting you to the app...
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6 space-y-4"
          >
            <h2 className="text-lg font-semibold dark:text-white text-center">
              Set New Password
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
            <p className="text-center text-sm text-gray-600 dark:text-neutral-400">
              <Link
                to="/login"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Back to Sign In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
