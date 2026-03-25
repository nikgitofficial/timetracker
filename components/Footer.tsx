"use client";

import Image from "next/image";
import { HiOutlineMail, HiOutlineGlobeAlt } from "react-icons/hi";
import { FaGithub } from "react-icons/fa";
import { useEffect, useState } from "react";

export default function Footer() {
  const [year, setYear] = useState<number | null>(null);

  // Set year on client side to prevent hydration mismatch
  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="w-full backdrop-blur-md bg-white/30 mt-10">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center text-[#006400] text-sm italic">
        
        {/* Logo + Text */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => window.location.href = "/"}
        >
          <Image
            src="/images/logov3.png"
            alt="NikNotes Logo"
            width={50}
            height={30}
            className="w-auto h-auto" // maintain aspect ratio
          />
          <p>© {year ?? "…"} NikNotes. All rights reserved.</p>
        </div>

        {/* Links + Social Icons */}
        <div className="flex gap-4 mt-2 md:mt-0 items-center">
{["Privacy", "Terms", "Contact"].map((item) => (
  <a
    key={item}
    href={item.toLowerCase()}
    className="relative group text-[#006400] hover:text-black transition-colors duration-200"
  >
    {item}
    <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-black transition-all duration-300 group-hover:w-full"></span>
  </a>
))}



          {/* Social Icons */}
          <a
            href="https://github.com/nikgitofficial"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#006400] hover:text-gray-700 transition-colors"
            title="GitHub"
          >
            <FaGithub size={20} />
          </a>

          <a
            href="mailto:nickforjobacc@gmail.com"
            className="text-[#006400] hover:text-gray-700 transition-colors"
            title="Email"
          >
            <HiOutlineMail size={20} />
          </a>

          <a
            href="https://nikkport.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#006400] hover:text-gray-700 transition-colors"
            title="Portfolio"
          >
            <HiOutlineGlobeAlt size={20} />
          </a>
        </div>
      </div>
    </footer>
  );
}
