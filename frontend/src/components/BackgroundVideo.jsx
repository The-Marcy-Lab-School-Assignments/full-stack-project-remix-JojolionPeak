export default function BackgroundVideo() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute top-1/2 left-1/2 min-w-[120vw] min-h-[120vh] -translate-x-1/2 -translate-y-1/2 object-cover"
      >
        <source src="/bg/persona-loop.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-black/65" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
    </div>
  );
}