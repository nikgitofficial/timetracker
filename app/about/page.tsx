"use client";

import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen bg-[#FDD20D] font-sans">
      <Navbar />

      {/* Add padding-top to avoid overlapping the navbar */}
      <main className="flex flex-1 flex-col items-center justify-start px-4 pt-24 md:pt-32 pb-16 text-center space-y-10">
        {/* Heading */}
        <h1>time tracker</h1>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 animate-fade-up animate-delay-200">
          <button
            onClick={() => router.push("/register")}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition-all hover:shadow-lg"
          >
            Get Started
          </button>
          <button
            onClick={() => router.push("/contact")}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition-all hover:shadow-lg"
          >
            Contact Us
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
