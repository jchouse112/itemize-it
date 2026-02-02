import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-asphalt text-white">
      <h1 className="text-6xl font-bold text-safety-orange mb-4">404</h1>
      <p className="text-xl text-concrete mb-8">Page not found</p>
      <Link
        href="/"
        className="px-6 py-3 bg-safety-orange text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        Go Home
      </Link>
    </div>
  );
}
