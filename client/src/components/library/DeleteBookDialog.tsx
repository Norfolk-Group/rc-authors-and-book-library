/**
 * DeleteBookDialog — Confirm and delete a book profile.
 * Requires typing the book title to confirm deletion.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

interface DeleteBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookTitle: string;
  onSuccess?: () => void;
}

export function DeleteBookDialog({
  open,
  onOpenChange,
  bookTitle,
  onSuccess,
}: DeleteBookDialogProps) {
  const [confirm, setConfirm] = useState("");
  const utils = trpc.useUtils();

  const deleteMutation = trpc.bookProfiles.deleteBook.useMutation({
    onSuccess: () => {
      toast.success(`"${bookTitle}" removed from your library.`);
      utils.bookProfiles.getMany.invalidate();
      utils.library.getStats.invalidate();
      onSuccess?.();
      onOpenChange(false);
      setConfirm("");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const canDelete = confirm.trim().toLowerCase() === bookTitle.trim().toLowerCase();

  return (
    <AlertDialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setConfirm(""); }}>
      <AlertDialogContent className="bg-[#1a1a2e] border border-[#3a1a1a] text-[#e8e8f0] shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-rose-400">
            <Trash2 className="w-5 h-5" />
            Delete Book
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[#a0a0c0]">
            This will permanently remove <span className="text-[#e8e8f0] font-semibold">"{bookTitle}"</span> and all its enrichment data from your library. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="confirm-title" className="text-[#a0a0c0] text-xs uppercase tracking-wider">
            Type the book title to confirm
          </Label>
          <Input
            id="confirm-title"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={bookTitle}
            className="bg-[#12122a] border-[#3a1a1a] text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:border-rose-500"
          />
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="border-[#2a2a4a] text-[#a0a0c0] bg-transparent hover:bg-[#2a2a4a] hover:text-[#e8e8f0] transition-all active:scale-95">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!canDelete || deleteMutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              if (canDelete) deleteMutation.mutate({ bookTitle });
            }}
            className="bg-rose-700 hover:bg-rose-600 text-white font-semibold shadow-[0_4px_0_#7f1d1d] hover:shadow-[0_2px_0_#7f1d1d] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
          >
            {deleteMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting…</>
            ) : (
              <><Trash2 className="w-4 h-4 mr-2" /> Delete Book</>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
