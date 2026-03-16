import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, ExternalLink } from "lucide-react";
import { useEffect } from "react";

interface CoverLightboxProps {
  coverUrl: string | null;
  title: string;
  author?: string;
  amazonUrl?: string;
  color?: string;
  onClose: () => void;
}

export function CoverLightbox({ coverUrl, title, author, amazonUrl, color = "hsl(var(--primary))", onClose }: CoverLightboxProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="lightbox-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      >
        {/* Cover panel */}
        <motion.div
          key="lightbox-panel"
          initial={{ opacity: 0, scale: 0.3, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.3, y: 40 }}
          transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
          className="relative flex flex-col items-center gap-4 p-6 rounded-2xl shadow-2xl"
          style={{ background: "hsl(var(--card))", border: `2px solid ${color}44`, maxWidth: "90vw" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Cover image */}
          {coverUrl ? (
            <motion.img
              src={coverUrl}
              alt={title}
              className="rounded-xl shadow-2xl object-cover"
              style={{ maxHeight: "70vh", maxWidth: "min(400px, 80vw)", border: `3px solid ${color}33` }}
              initial={{ rotateY: -15, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
              loading="lazy"
            />
          ) : (
            <motion.div
              className="rounded-xl shadow-2xl flex items-center justify-center"
              style={{ width: 280, height: 392, backgroundColor: color + "22", border: `3px solid ${color}33` }}
              initial={{ rotateY: -15, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
            >
              <BookOpen className="w-16 h-16" style={{ color, opacity: 0.5 }} />
            </motion.div>
          )}

          {/* Title and author */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-base font-semibold text-card-foreground leading-snug max-w-[320px]">{title}</h3>
            {author && (
              <p className="text-sm text-muted-foreground mt-1">by {author}</p>
            )}
          </motion.div>

          {/* Amazon link */}
          {amazonUrl && (
            <motion.a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#FF9900" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View on Amazon
            </motion.a>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
