'use client';

const APP_VERSION = '1.0.0';
const BUILD_DATE = 'Jan 20, 2026';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left: Branding & Copyright */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm text-slate-500">
            <a
              href="https://cabin.com.sg"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors font-medium"
            >
              <img src="/cabin-logo.png" alt="Cabin" className="h-7 w-auto" />
              <span>A Cabin Tool</span>
            </a>
            <span className="hidden sm:inline text-slate-300">·</span>
            <span>&copy; {new Date().getFullYear()} Cabin</span>
          </div>

          {/* Center: Status */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Operational</span>
            </span>
          </div>

          {/* Right: Version & Meta */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm text-slate-400">
            <span>v{APP_VERSION}</span>
            <span className="hidden sm:inline text-slate-300">·</span>
            <span>Updated {BUILD_DATE}</span>
            <span className="hidden sm:inline text-slate-300">·</span>
            <a
              href="https://github.com/isaacclaude-ui/Task-Pulse/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-teal-600 transition-colors"
            >
              Report issue
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
