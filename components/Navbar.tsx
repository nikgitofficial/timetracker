"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { HiMenu, HiX } from "react-icons/hi";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname(); // get current route
  const [isOpen, setIsOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [menuHeight, setMenuHeight] = useState(0);

  const navItems = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
    { name: "Login", path: "/login" },
    { name: "Register", path: "/register" },
  ];

  useEffect(() => {
    if (mobileMenuRef.current) {
      setMenuHeight(mobileMenuRef.current.scrollHeight);
    }
  }, []);

  return (
    <nav className="w-full fixed top-0 z-50 backdrop-blur-md bg-white/30 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <div
          className="flex items-center cursor-pointer"
          onClick={() => router.push("/")}
        >
          <Image
            src="/images/logov3.png"
            alt="NikNotes Logo"
            width={60}
            height={40}
            style={{ width: "auto", height: "auto" }}
            className="mr-2"
          />
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-6">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => router.push(item.path)}
              className={`relative font-medium italic transition-colors duration-200
                ${pathname === item.path ? "text-black" : "text-[#006400] hover:text-black"}
                before:content-[''] before:absolute before:-bottom-1 before:left-0 before:w-0 before:h-[2px] before:bg-black
                before:transition-all before:duration-300 hover:before:w-full`}
            >
              {item.name}
            </button>
          ))}
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-[#006400] focus:outline-none"
          >
            {isOpen ? <HiX size={28} /> : <HiMenu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        ref={mobileMenuRef}
        style={{
          maxHeight: isOpen ? `${menuHeight}px` : "0px",
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "translateY(0)" : "translateY(-10px)",
          transition: "all 0.3s ease-in-out",
          overflow: "hidden",
        }}
        className="md:hidden backdrop-blur-md bg-white/30"
      >
        <div className="flex flex-col px-4 py-4 gap-4">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                router.push(item.path);
                setIsOpen(false);
              }}
              className={`relative text-lg font-medium italic transition-colors duration-200
                ${pathname === item.path ? "text-black" : "text-[#006400] hover:text-black"}
                before:content-[''] before:absolute before:-bottom-1 before:left-0 before:w-0 
                before:h-[2px] before:bg-black before:transition-all before:duration-300 hover:before:w-full`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
