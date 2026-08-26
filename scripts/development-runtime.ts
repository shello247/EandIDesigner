import path from "node:path";

export type GitWorktreeRecord = {
  path: string;
  branch?: string;
};

export function parseGitWorktreeList(output: string): GitWorktreeRecord[] {
  const records: GitWorktreeRecord[] = [];
  let current: GitWorktreeRecord | undefined;

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      if (current) records.push(current);
      current = { path: line.slice("worktree ".length) };
      continue;
    }

    if (line.startsWith("branch ") && current) {
      current.branch = line.slice("branch ".length);
    }
  }

  if (current) records.push(current);
  return records;
}

export function findCanonicalMainWorktree(
  worktrees: GitWorktreeRecord[]
): GitWorktreeRecord {
  const canonical = worktrees.find(
    (worktree) => worktree.branch === "refs/heads/main"
  );

  if (!canonical) {
    throw new Error(
      "Unable to locate the canonical main worktree. Refusing to choose a database implicitly."
    );
  }

  return canonical;
}

export function toPrismaSqliteFileUrl(databasePath: string): string {
  return `file:${path.resolve(databasePath).replaceAll("\\", "/")}`;
}

export function resolveDevelopmentDatabaseUrl({
  canonicalDatabasePath,
  explicitOverride
}: {
  canonicalDatabasePath: string;
  explicitOverride?: string;
}): string {
  const override = explicitOverride?.trim();
  return override || toPrismaSqliteFileUrl(canonicalDatabasePath);
}
