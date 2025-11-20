import { motion } from "framer-motion";

export default function SplashScreen({ onFinished }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      
      {/* Background Glow */}
      <motion.div
        initial={{ scale: 0, opacity: 0.1 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className="absolute h-64 w-64 rounded-full blur-3xl bg-white/20"
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.1 }}
        className="absolute h-72 w-72 rounded-full bg-red-600/20 blur-3xl"
      />

      {/* Logo */}
      <motion.div
        initial={{ scale: 2.3, y: -120, opacity: 0 }}
        animate={{
          scale: 1,
          y: 0,
          opacity: 1,
        }}
        transition={{
          duration: 0.9,
          type: "spring",
          stiffness: 160,
          damping: 18,
        }}
        className="relative flex flex-col items-center gap-3"
      >
        <span className="text-5xl font-extrabold tracking-[0.25em] text-white uppercase">
          ARMPAL
        </span>

        <span className="text-xs font-semibold tracking-[0.35em] text-red-500/90 uppercase">
          Strength • Progress • Control
        </span>
      </motion.div>

      {/* Subtext */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="absolute bottom-20 text-xs font-medium tracking-[0.25em] text-neutral-400 uppercase"
      >
        Your Strength. Your Progress. Your ArmPal.
      </motion.p>

      {/* Exit */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.9, duration: 0.01 }}
        onAnimationComplete={onFinished}
      />
    </div>
  );
}
