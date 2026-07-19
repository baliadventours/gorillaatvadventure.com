import { motion } from 'motion/react';

export default function Loader({ fullScreen = true }: { fullScreen?: boolean }) {
  return (
    <div className={fullScreen ? "fixed inset-0 z-[999] flex flex-col items-center justify-center bg-white" : "flex flex-col items-center justify-center p-12"}>
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="h-20 w-20 rounded-full border-4 border-orange-50"
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 h-20 w-20 rounded-full border-4 border-primary border-t-transparent"
        />
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 text-center"
      >
        <p className="text-sm font-black text-gray-900 tracking-tighter uppercase">Your Bali Wanderlust</p>
        <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-[0.2em]">Crafting your perfect trip...</p>
      </motion.div>
    </div>
  );
}
