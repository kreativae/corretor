import { GitCommitHorizontal } from "lucide-react";

/** Repositório do commit: o da Vercel, GIT_REPO ("dono/repo") ou este projeto */
function repoSlug() {
  const { VERCEL_GIT_REPO_OWNER: owner, VERCEL_GIT_REPO_SLUG: slug, GIT_REPO } = process.env;
  if (owner && slug) return `${owner}/${slug}`;
  return GIT_REPO?.trim() || "kreativae/corretor";
}

/** Commit em produção — aparece ao passar o mouse no canto inferior direito. */
export function BuildInfo() {
  // Vercel: VERCEL_GIT_COMMIT_SHA · Coolify: SOURCE_COMMIT (disponível em tempo de execução)
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.SOURCE_COMMIT;
  const repo = repoSlug();
  const href = sha ? `https://github.com/${repo}/commit/${sha}` : undefined;

  return (
    <div className="group fixed bottom-0 right-0 z-[70] flex size-12 items-end justify-end p-2 hover:size-auto">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={sha}
        className="pointer-events-none flex translate-y-1 items-center gap-1.5 rounded-full border border-hairline bg-card/95 px-3 py-1.5 font-mono text-[10.5px] text-subtle opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 hover:text-ink"
      >
        <GitCommitHorizontal className="size-3.5 shrink-0" />
        <span className="text-ink">{sha ? `#${sha.slice(0, 7)}` : "local"}</span>
      </a>
    </div>
  );
}
