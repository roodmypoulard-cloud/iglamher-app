"use client";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import { updateAvatarAction } from "@/lib/account/avatar-actions";
import { CameraIcon } from "@/components/ui/icons";

/**
 * Profile-photo control: shows the current avatar (or the gold letter fallback),
 * with a camera button to pick a new image. Previews instantly, then persists.
 */
export function AvatarUpload({
  name,
  initialUrl,
  size = 64,
}: {
  name?: string | null;
  initialUrl?: string | null;
  size?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setError(null);

    const preview = URL.createObjectURL(file); // optimistic
    setUrl(preview);
    setBusy(true);

    const fd = new FormData();
    fd.append("avatar", file);
    try {
      const res = await updateAvatarAction(fd);
      if (res.ok) {
        setUrl(res.url);
      } else {
        setUrl(initialUrl ?? null); // roll back preview
        setError(res.error);
      }
    } catch {
      setUrl(initialUrl ?? null); // roll back preview on unexpected failure
      setError("Upload failed. Please try again.");
    } finally {
      // Guaranteed reset — the button can never stay stuck on "busy".
      setBusy(false);
      URL.revokeObjectURL(preview);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Change profile photo"
        className="group relative rounded-full transition-transform active:scale-95"
      >
        <Avatar src={url} name={name} size={size} priority />
        <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full rose-gradient text-[#2A1712] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
          {busy ? <Spinner size={12} /> : <CameraIcon width={13} height={13} />}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onPick}
        className="hidden"
      />
      {error && <p className="text-[11px] text-rose">{error}</p>}
    </div>
  );
}
