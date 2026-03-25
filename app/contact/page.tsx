"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.name || !form.email || !form.message) {
      setError("All fields are required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send message");
        setLoading(false);
        return;
      }

      setSuccess("Message sent successfully!");
      setForm({ name: "", email: "", message: "" });
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-50 to-gray-200 font-sans text-gray-900">
      <Navbar />

      {/* Spacer to prevent content overlapping fixed navbar */}
      <div className="h-20 md:h-24" />

      <main className="flex flex-1 flex-col items-center justify-start px-4 py-16 space-y-12 w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight animate-fade-in mb-4">
            Get in Touch
          </h1>
          <p className="text-gray-700 text-lg md:text-xl animate-fade-in delay-100">
            Have questions, feedback, or ideas? Fill out the form below and our team will respond promptly.  
            We love hearing from <span className="font-semibold text-blue-600">developers, students, and creators</span> alike.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-10 w-full">
          {/* Contact Form */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 bg-white shadow-2xl rounded-2xl p-8 md:p-10 flex flex-col gap-5 animate-fade-in delay-200"
          >
            {error && (
              <p className="text-red-600 bg-red-50 border border-red-200 p-2 rounded text-center">
                {error}
              </p>
            )}
            {success && (
              <p className="text-green-600 bg-green-50 border border-green-200 p-2 rounded text-center">
                {success}
              </p>
            )}

            <input
              type="text"
              placeholder="Your Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 text-gray-900 transition"
              required
            />
            <input
              type="email"
              placeholder="Email Address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 text-gray-900 transition"
              required
            />
            <textarea
              placeholder="Your Message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 text-gray-900 transition resize-none h-36"
              required
            ></textarea>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md transition-all hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Send Message"}
            </button>
          </form>

          {/* Contact Info */}
          <div className="flex-1 bg-white shadow-2xl rounded-2xl p-8 md:p-10 flex flex-col gap-6 animate-fade-in delay-300">
            <h2 className="text-2xl font-bold mb-4">Contact Information</h2>
            <p>
              <span className="font-semibold">Address:</span> Purok ASCI, BRGY-1, Nasipit ADN
            </p>
            <p>
              <span className="font-semibold">Phone:</span> +63 951 419 0949
            </p>
            <p>
              <span className="font-semibold">Email:</span> nikkopacenio@gmail.com
            </p>
            <p className="mt-4 text-gray-600">
              We aim to respond to all inquiries within <span className="font-medium">24 hours</span>.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
