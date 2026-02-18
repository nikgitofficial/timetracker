"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HiEye, HiEyeOff } from "react-icons/hi";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.email || !form.password) {
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);
    console.log("=== FRONTEND LOGIN START ===");
    
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ⭐ CRITICAL: Added this
        body: JSON.stringify(form),
      });

      console.log("Login response:", res.status);
      console.log("Cookies after login:", document.cookie);

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // Small delay to ensure cookies are set
      setTimeout(() => {
        console.log("Cookies after delay:", document.cookie);
        console.log("=== FRONTEND LOGIN END ===");
        router.push("/dashboard");
      }, 100);
      
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white shadow-2xl rounded-3xl p-8 md:p-10">
          <div className="flex justify-center mb-6">
            <img src="/images/logov3.png" alt="Logo" className="h-16 w-16 md:h-20 md:w-20" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6 text-center">
            Login to Your Account
          </h2>
          {error && (
            <p className="text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg mb-5 text-center">
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 bg-white placeholder-gray-400 text-gray-900 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 bg-white placeholder-gray-400 text-gray-900 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
              >
                {showPassword ? <HiEyeOff size={20} /> : <HiEye size={20} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
          <div className="mt-6 text-center text-gray-500 text-sm space-y-2">
            <p>Don't have an account? <a href="/register" className="text-blue-600 hover:underline">Sign Up</a></p>
            <p>Forgot password <a href="/forgot-password" className="text-blue-600 hover:underline">click here</a></p>
            <p><a href="/" className="text-blue-600 hover:underline">Back to Home</a></p>
          </div>
        </div>
      </main>
    </div>
  );
}

