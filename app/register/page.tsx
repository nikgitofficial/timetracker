"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HiEye, HiEyeOff } from "react-icons/hi";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordStrength, setPasswordStrength] = useState<"Weak" | "Medium" | "Strong" | "">("");

  useEffect(() => {
    const pwd = form.password;
    if (!pwd) return setPasswordStrength("");

    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) strength++;
    if (/[@$!%*?&]/.test(pwd)) strength++;

    if (strength <= 1) setPasswordStrength("Weak");
    else if (strength === 2) setPasswordStrength("Medium");
    else setPasswordStrength("Strong");
  }, [form.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (passwordStrength === "Weak") {
      setError("Password is too weak");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      router.push("/login");
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength === "Weak") return "text-red-600";
    if (passwordStrength === "Medium") return "text-yellow-500";
    if (passwordStrength === "Strong") return "text-green-600";
    return "";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200 px-4">
      <div className="w-full max-w-md bg-white shadow-2xl rounded-2xl p-8 md:p-10 animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/images/logov3.png" alt="Logo" className="h-16 w-16 md:h-20 md:w-20 object-contain" />
        </div>

        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Create Your Account</h2>

        {error && (
          <p className="text-red-600 bg-red-50 border border-red-200 p-2 rounded mb-4 text-center">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-300 bg-white placeholder-gray-400 text-black p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full border border-gray-300  placeholder-gray-400 bg-white placeholder-black text-black p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            required
          />

          {/* Password field */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full border border-gray-300 placeholder-gray-400 bg-white placeholder-black text-black p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              {showPassword ? <HiEyeOff size={20} /> : <HiEye size={20} />}
            </button>
          </div>
          {passwordStrength && (
            <p className={`text-sm ${getStrengthColor()} font-semibold`}>Strength: {passwordStrength}</p>
          )}

          {/* Confirm Password field */}
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
              className="w-full border border-gray-300  placeholder-gray-400 bg-white placeholder-black text-black p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              {showConfirmPassword ? <HiEyeOff size={20} /> : <HiEye size={20} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-500">
          Already have an account?{" "}
          <a href="/login" className="text-green-600 hover:underline font-medium">
            Login
          </a>
        </p>
      </div>
    </div>
  );
}
