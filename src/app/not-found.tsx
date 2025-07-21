export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
        <p className="text-muted-foreground mb-4">Page not found</p>
        <a 
          href="/" 
          className="text-primary hover:text-primary/80 underline"
        >
          Return to home
        </a>
      </div>
    </div>
  );
}
