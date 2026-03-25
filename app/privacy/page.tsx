"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />

      <main className="flex flex-1 flex-col max-w-4xl mx-auto px-4 py-16 space-y-8">
       <h1 className="mt-8 md:mt-12 text-4xl md:text-5xl font-extrabold text-gray-800 text-center animate-fade-in">
       Privacy Policy
       </h1>


        <section className="space-y-6 animate-fade-in delay-100">
          <p className="text-gray-700 text-lg leading-relaxed">
            At <span className="font-semibold">NikNotes</span>, your privacy is important to us. This privacy policy explains how we collect, use, and protect your personal information when you use our services.
          </p>

          <h2 className="text-2xl font-bold text-gray-800">Information We Collect</h2>
          <p className="text-gray-700 leading-relaxed">
            We may collect information such as your name, email address, and any notes you create when you register or use our services. We also automatically collect technical data like your IP address and browser type to improve our service.
          </p>

          <h2 className="text-2xl font-bold text-gray-800">How We Use Your Information</h2>
          <p className="text-gray-700 leading-relaxed">
            Your information is used to provide and improve our services, communicate with you about your account, and ensure the security and functionality of the platform. We do not sell your personal information to third parties.
          </p>

          <h2 className="text-2xl font-bold text-gray-800">Cookies & Tracking</h2>
          <p className="text-gray-700 leading-relaxed">
            NikNotes uses cookies and similar technologies to enhance your experience, remember preferences, and analyze usage patterns. You can disable cookies in your browser settings, though some features may not work properly.
          </p>

          <h2 className="text-2xl font-bold text-gray-800">Data Security</h2>
          <p className="text-gray-700 leading-relaxed">
            We implement appropriate security measures to protect your information from unauthorized access, alteration, or disclosure. However, no method of transmission over the internet or electronic storage is 100% secure.
          </p>

          <h2 className="text-2xl font-bold text-gray-800">Contact Us</h2>
          <p className="text-gray-700 leading-relaxed">
            If you have any questions or concerns about this Privacy Policy or our practices, please contact us at: <br />
            <span className="font-semibold">Email:</span> nikkopacenio@gmail.com <br />
            <span className="font-semibold">Phone:</span> +63 951 419 0949 <br />
            <span className="font-semibold">Address:</span> Purok ASCI, Brgy-1, Nasipit ADN
          </p>

          <p className="text-gray-700 leading-relaxed text-sm">
            This policy is effective as of January 2026 and may be updated from time to time. Please check this page periodically for any changes.
          </p>
        </section>
        
       
      </main>

      <Footer />
    </div>
  );
}
