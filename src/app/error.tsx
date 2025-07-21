'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">Error</h1>
        <p className="text-muted-foreground mb-4">Something went wrong!</p>
        <button
          onClick={() => reset()}
          className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/80"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
