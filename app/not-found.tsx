"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function NotFound() {
  const items = ["🥑", "🍌", "🍅", "🥕", "🍞", "🧅", "🍎"];

  // Store random X positions generated ONLY on the client
  const [positions, setPositions] = useState<number[]>([]);

  useEffect(() => {
    const randoms = items.map(
      () => Math.random() * 300 - 150 // between -150 and +150
    );
    setPositions(randoms);
  }, []); // runs only on the client

  return (
    <div
      className="relative flex flex-col items-center justify-center h-screen text-center px-6 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #d4f5ff 0%, #fef6ff 100%)",
      }}
    >
      {/* Falling groceries - only render after client positions are ready */}
      {positions.length > 0 &&
        items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ y: -100, x: positions[i], opacity: 0 }}
            animate={{
              y: "110vh",
              x: positions[i],
              opacity: 1,
              rotate: [0, 20, -20, 20, 0],
            }}
            transition={{
              duration: 4 + Math.random() * 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
            className="absolute text-4xl select-none pointer-events-none"
          >
            {item}
          </motion.div>
        ))}

      {/* Animated grocery bag */}
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, delay: 0.3 }}
        className="mb-6 z-10"
      >
        <motion.div
          animate={{ rotate: [0, -6, 6, -6, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2l1 4h10l1-4" />
            <path d="M3 6h18l-1.5 14H4.5L3 6z" />
            <path d="M9 10v6" />
            <path d="M15 10v6" />
          </svg>
        </motion.div>
      </motion.div>

      <motion.h1
        className="text-6xl md:text-7xl font-extrabold text-green-600 z-10"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 160 }}
      >
        404
      </motion.h1>

      <motion.h2
        className="mt-4 text-xl md:text-2xl font-semibold text-gray-800 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Oops… your page fell out of the grocery bag!
      </motion.h2>

      <motion.p
        className="mt-3 text-lg md:text-xl text-gray-600 max-w-md z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        We checked every aisle — even the secret avocado section.  
        Still couldn't find it. 🥑💨
      </motion.p>

      <motion.a
        href="/"
        className="mt-8 inline-block rounded-2xl px-6 py-3 text-lg font-medium bg-green-600 text-white shadow-md hover:bg-green-700 z-10"
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.93 }}
      >
        Back to Home
      </motion.a>
    </div>
  );
}
