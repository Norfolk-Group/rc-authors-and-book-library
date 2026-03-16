/**
 * AvatarUpload
 * -----------
 * Wraps any author avatar <img> with a hover overlay that lets the user
 * click to pick a local image file. The file is read as base64, sent to
 * the `authorProfiles.uploadPhoto` tRPC mutation, and the new S3 URL is
 * reflected immediately via an optimistic local state update.
 *
 * Usage:
 *   <AvatarUpload authorName="Adam Grant" currentPhotoUrl={photoUrl} size={64}>
 *     {(url) => <img src={url} className="w-16 h-16 rounded-full" />}
 *   </AvatarUpload>
 */

import { useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CameraIcon } from "@phosphor-icons/react";

interface AvatarUploadProps {
  authorName: string;
  currentPhotoUrl?: string | null;
  /** Rendered size in pixels — used to size the overlay ring */
  size?: number;
  /** Render prop: receives the current (possibly optimistically updated) URL */
  children: (photoUrl: string | null | undefined) => React.ReactNode;
  className?: string;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MimeType = (typeof ACCEPTED)[number];

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function AvatarUpload({
  authorName,
  currentPhotoUrl,
  size = 64,
  children,
  className,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [optimisticUrl, setOptimisticUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadMutation = trpc.authorProfiles.uploadPhoto.useMutation();
  const utils = trpc.useUtils();

  const displayUrl = optimisticUrl ?? currentPhotoUrl;

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input so the same file can be re-selected later
      e.target.value = "";

      if (!ACCEPTED.includes(file.type as MimeType)) {
        toast.error("Unsupported file type. Please use JPEG, PNG, WebP, or GIF.");
        return;
      }

      if (file.size > MAX_BYTES) {
        toast.error("Image too large — maximum size is 5 MB.");
        return;
      }

      // Optimistic preview using object URL
      const objectUrl = URL.createObjectURL(file);
      setOptimisticUrl(objectUrl);
      setUploading(true);

      try {
        // Read as base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Strip "data:image/...;base64," prefix
            resolve(result.split(",")[1] ?? "");
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const { url } = await uploadMutation.mutateAsync({
          authorName,
          imageBase64: base64,
          mimeType: file.type as MimeType,
        });

        // Replace object URL with permanent S3 URL
        setOptimisticUrl(url);
        URL.revokeObjectURL(objectUrl);

        // Invalidate author profiles so cards refresh
        void utils.authorProfiles.get.invalidate({ authorName });
        void utils.authorProfiles.getAllEnrichedNames.invalidate();

        toast.success("Avatar updated successfully.");
      } catch (err) {
        // Roll back optimistic update
        setOptimisticUrl(null);
        URL.revokeObjectURL(objectUrl);
        toast.error(err instanceof Error ? err.message : "Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [authorName, uploadMutation, utils]
  );

  return (
    <div
      className={`relative inline-block cursor-pointer group ${className ?? ""}`}
      style={{ width: size, height: size }}
      onClick={() => !uploading && fileInputRef.current?.click()}
      title="Click to upload a custom photo"
      role="button"
      aria-label={`Upload photo for ${authorName}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!uploading) fileInputRef.current?.click();
        }
      }}
    >
      {/* Render the avatar via the render prop */}
      {children(displayUrl)}

      {/* Hover / uploading overlay */}
      <div
        className={`absolute inset-0 rounded-full flex items-center justify-center transition-opacity duration-150 ${
          uploading
            ? "opacity-100 bg-black/50"
            : "opacity-0 group-hover:opacity-100 bg-black/40"
        }`}
        style={{ borderRadius: size >= 48 ? "50%" : "6px" }}
      >
        {uploading ? (
          <svg
            className="animate-spin text-white"
            width={size * 0.35}
            height={size * 0.35}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <CameraIcon
            size={size * 0.35}
            weight="bold"
            className="text-white drop-shadow"
          />
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />
    </div>
  );
}
