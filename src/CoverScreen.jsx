import { motion } from "framer-motion";

export default function CoverScreen({ onEnterApp }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-6">
      <div className="max-w-md w-full flex flex-col items-center gap-12">

        {/* Title Block */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <h1 className="text-5xl font-extrabold tracking-[0.25em] uppercase">
            ARMPAL
          </h1>

          <p className="text-neutral-400 text-sm leading-relaxed tracking-wide max-w-xs">
            Track your PRs, master your technique, and grow freaky strong.
          </p>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: "easeOut" }}
          className="w-full flex flex-col gap-4"
        >
          <button
            onClick={onEnterApp}
            className="
              w-full py-3 rounded-2xl 
              bg-red-600 hover:bg-red-500 
              active:scale-[0.97] 
              transition font-semibold tracking-wide uppercase shadow-lg shadow-red-700/30
            "
          >
            Get Started
          </button>

          <button
            onClick={onEnterApp}
            className="
              w-full py-3 rounded-2xl border 
              border-neutral-700 hover:border-neutral-500 
              hover:bg-neutral-900/60 active:scale-[0.97]
              transition text-neutral-300 tracking-wide uppercase text-sm
            "
          >
            I Already Have an Account
          </button>
        </motion.div>
      </div>
    </div>
  );
}
