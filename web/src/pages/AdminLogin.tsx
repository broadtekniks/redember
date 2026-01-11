import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import Header from "../components/Header";
import Brand from "../components/Brand";

export default function AdminLogin() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  // Initialize theme once
  useEffect(() => {
    const html = document.documentElement;
    const prefersDark = window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    )?.matches;
    if (prefersDark) html.classList.add("dark");
  }, []);

  const onToggleTheme = useMemo(() => {
    return () => {
      document.documentElement.classList.toggle("dark");
    };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/admin");
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Login failed. Please check your credentials.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-stone-800 dark:text-stone-200 font-sans transition-colors duration-300 min-h-screen">
      <Header
        cartCount={0}
        onCheckout={null}
        checkoutDisabled={true}
        onToggleTheme={onToggleTheme}
      />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-[480px] bg-white dark:bg-[#2d1a1b] rounded-xl shadow-xl border border-[#e7cfd0] dark:border-[#3d2426] overflow-hidden mt-8">
          {/* Header Image / Brand Logo Area */}
          <div className="p-8 pb-0 text-center flex flex-col items-center">
            <div className="mb-4">
              <Brand size="xl" />
            </div>
            <h1 className="text-[#1b0d0e] dark:text-white tracking-tight text-3xl font-extrabold leading-tight">
              Admin Sign In
            </h1>
            <p className="text-[#9a4c50] dark:text-[#c08d90] mt-2 text-sm">
              Welcome back. Please enter your credentials.
            </p>
          </div>

          <div className="p-8">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="flex flex-col w-full">
                <label className="text-[#1b0d0e] dark:text-white text-sm font-semibold leading-normal pb-2">
                  Email Address
                </label>
                <input
                  className="form-input flex w-full min-w-0 resize-none overflow-hidden rounded-lg text-[#1b0d0e] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#e7cfd0] dark:border-[#3d2426] bg-background-light dark:bg-[#221011] h-12 placeholder:text-[#9a4c50] p-[15px] text-base font-normal leading-normal"
                  placeholder="Enter your email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* Password Field */}
              <div className="flex flex-col w-full">
                <label className="text-[#1b0d0e] dark:text-white text-sm font-semibold leading-normal pb-2">
                  Password
                </label>
                <div className="flex w-full items-stretch rounded-lg group">
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg rounded-r-none border-r-0 text-[#1b0d0e] dark:text-white focus:outline-0 focus:ring-0 border border-[#e7cfd0] dark:border-[#3d2426] bg-background-light dark:bg-[#221011] h-12 placeholder:text-[#9a4c50] p-[15px] text-base font-normal leading-normal"
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <div
                    className="text-[#9a4c50] flex border border-[#e7cfd0] dark:border-[#3d2426] bg-background-light dark:bg-[#221011] items-center justify-center pr-[15px] rounded-r-lg border-l-0 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-[24px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sign In Button */}
              <button
                className="w-full flex items-center justify-center rounded-lg h-12 px-4 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-red-700 transition-colors shadow-md mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
                type="submit"
                disabled={loading}
              >
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer decoration */}
      <footer className="py-10 text-center px-6">
        <p className="text-[#9a4c50] dark:text-[#c08d90] text-xs font-medium uppercase tracking-widest">
          Hand-Crafted Heat • Since 2023
        </p>
      </footer>
    </div>
  );
}
