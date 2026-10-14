"use client";

import { Button, InlineNotification, TextInput } from "@carbon/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { saveUsername, savePicture } from "@/actions/profile";
import { compressImage } from "@/lib/compress-image";
import { uploadFile } from "@/lib/upload-client";
import Avatar from "./avatar";

type Props = { username: string; image: string | null; email: string | null };

export default function ProfileForm({ username, image, email }: Props) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [picture, setPicture] = useState(image);
  const [name, setName] = useState(username); // the form resets to this after saving
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const run = (job: () => Promise<{ error?: string } | void>, done: string) =>
    start(async () => {
      setMessage(null);
      try {
        const r = await job();
        if (r?.error) return setMessage({ kind: "error", text: r.error });
        setMessage({ kind: "success", text: done });
        router.refresh();
      } catch (e) {
        setMessage({ kind: "error", text: e instanceof Error ? e.message : "Something went wrong." });
      }
    });

  const onPicture = (f: File | undefined) =>
    f &&
    run(async () => {
      const small = await compressImage(f, { max: 512, square: true });
      const { key } = await uploadFile(small);
      const r = await savePicture(key);
      if (r.image) setPicture(r.image);
      return r;
    }, "Picture saved.");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Avatar src={picture} name={name} size={72} />
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="sr-only"
          aria-label="Profile picture"
          onChange={(e) => onPicture(e.target.files?.[0])}
        />
        <Button kind="tertiary" size="md" disabled={pending} onClick={() => file.current?.click()}>
          Change picture
        </Button>
      </div>

      <form
        className="flex items-end gap-3"
        action={(form) =>
          run(async () => {
            const r = await saveUsername(form.get("username"));
            if (r.username) setName(r.username);
            return r;
          }, "Username saved.")
        }
      >
        <TextInput
          id="username"
          name="username"
          labelText="Username"
          helperText="Letters, numbers, dots and underscores. Up to 20."
          defaultValue={name}
          maxLength={20}
          pattern="[A-Za-z0-9._]{1,20}"
          required
        />
        <Button type="submit" disabled={pending}>
          Save
        </Button>
      </form>

      {email && <TextInput id="email" labelText="Email" value={email} readOnly />}

      {message && (
        <InlineNotification
          kind={message.kind}
          title={message.text}
          lowContrast
          hideCloseButton
          role={message.kind === "error" ? "alert" : "status"}
        />
      )}
    </div>
  );
}
