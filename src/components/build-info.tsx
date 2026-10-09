import { GitCommitHorizontal } from "lucide-react";

/** Commit em produção — aparece ao passar o mouse no canto inferior direito. */
export function BuildInfo() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const message = process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0];
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const repo = process.env.VERCEL_GIT_REPO_SLUG;
  const href = sha && owner && repo ? `https://github.com/${owner}/${repo}/commit/${sha}` : undefined;

  return (
    <div className="group fixed bottom-0 right-0 z-[70] flex size-12 items-end justify-end p-2 hover:size-auto">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="pointer-events-none flex max-w-xs translate-y-1 items-center gap-2 rounded-full border border-hairline bg-card/95 px-3 py-1.5 font-mono text-[10.5px] text-subtle opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 hover:text-ink"
      >
        <GitCommitHorizontal className="size-3.5 shrink-0" />
        <span className="text-ink">{sha ? sha.slice(0, 7) : "local"}</span>
        {message && <span className="truncate">{message}</span>}
      </a>
    </div>
  );
}
