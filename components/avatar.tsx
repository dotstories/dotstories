/** Round profile picture, or the first letter when there is none. */
export default function Avatar({ src, name, size = 28 }: { src: string | null | undefined; name: string; size?: number }) {
  const style = { width: size, height: size };
  if (src)
    // eslint-disable-next-line @next/next/no-img-element -- user uploads, already compressed
    return <img src={src} alt={`${name}'s picture`} style={style} className="rounded-full object-cover" />;
  return (
    <span
      aria-hidden
      style={{ ...style, fontSize: size / 2.4 }}
      className="grid place-items-center rounded-full bg-[var(--cds-layer-02)] font-semibold uppercase"
    >
      {name.slice(0, 1)}
    </span>
  );
}
