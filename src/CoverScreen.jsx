import { motion } from "framer-motion";

export default function CoverScreen({ onEnterApp }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="max-w-md w-full px-8 flex flex-col items-center gap-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-4"
        >
          <h1 className="text-5xl font-extrabold tracking-[0.25em] uppercase">
            ARMPAL
          </h1>

          <p className="text-sm text-neutral-400 text-center tracking-wide">
            Track your PRs, master your hook, and grow freaky strong.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="w-full flex flex-col gap-3"
        >
          <button
            onClick={onEnterApp}
            className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition font-semibold tracking-wide uppercase"
          >
            Get Started
          </button>

          <button
            onClick={onEnterApp}
            className="w-full py-3 rounded-2xl border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-900/60 active:scale-[0.98] transition text-neutral-300 tracking-wide uppercase text-sm"
          >
            I already have an account
          </button>
        </motion.div>
      </div>
    </div>
  );
}
