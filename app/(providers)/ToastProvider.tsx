"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type ToastType = "create" | "update" | "delete" | "error";

type Toast = {
  message: string;
  type: ToastType;
};

type ToastContext = {
  showToast: (message: string, type?: ToastType) => void;
};

const Context = createContext<ToastContext | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (message: string, type: ToastType = "create") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <Context.Provider value={{ showToast }}>
      {children}

      {/* Global Toast UI (same as your design) */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 px-4 sm:px-6 py-2 sm:py-3 rounded-lg shadow-lg text-white z-50 text-sm sm:text-base max-w-[90%] sm:max-w-md text-center
            ${
              toast.type === "create"
                ? "bg-green-600"
                : toast.type === "update"
                ? "bg-blue-600"
                : toast.type === "delete"
                ? "bg-red-600"
                : "bg-gray-800"
            } animate-slide-in`}
        >
          {toast.message}
        </div>
      )}

      <style jsx>{`
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        @keyframes slide-in {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </Context.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
};
