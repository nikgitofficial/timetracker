"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-100 to-gray-200">
      <Navbar />

      <main className="flex flex-1 flex-col items-center justify-start px-4 py-16">
        <div className="max-w-4xl bg-white shadow-2xl rounded-2xl p-8 md:p-10 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 mb-6 text-center">
            Terms & Conditions
          </h1>

          <p className="text-gray-600 mb-4">
            Welcome to <span className="font-semibold">NikNotes</span>. By using our website and services, you agree to comply with and be bound by the following terms and conditions:
          </p>

          <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-2">1. Acceptance of Terms</h2>
          <p className="text-gray-600 mb-4">
            By accessing or using NikNotes, you agree to these terms. If you do not agree, do not use our services.
          </p>

          <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-2">2. User Accounts</h2>
          <p className="text-gray-600 mb-4">
            Users must provide accurate information when creating accounts and are responsible for maintaining the confidentiality of their login credentials.
          </p>

          <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-2">3. Privacy</h2>
          <p className="text-gray-600 mb-4">
            Your personal information is handled according to our Privacy Policy. We do not share your information with third parties without consent.
          </p>

          <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-2">4. User Conduct</h2>
          <p className="text-gray-600 mb-4">
            You agree not to misuse our services, post offensive content, or engage in illegal activities while using NikNotes.
          </p>

          <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-2">5. Intellectual Property</h2>
          <p className="text-gray-600 mb-4">
            All content, design, and features of NikNotes are owned by us or our licensors. Users may not copy, distribute, or modify without permission.
          </p>

          <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-2">6. Limitation of Liability</h2>
          <p className="text-gray-600 mb-4">
            NikNotes is provided “as is.” We are not liable for any damages resulting from the use or inability to use our services.
          </p>

          <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-2">7. Changes to Terms</h2>
          <p className="text-gray-600 mb-4">
            We may update these terms at any time. Continued use of the service constitutes acceptance of updated terms.
          </p>

          <p className="text-gray-600 mt-6">
            If you have questions about these Terms & Conditions, please <a href="/contact" className="text-blue-600 hover:underline">contact us</a>.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
