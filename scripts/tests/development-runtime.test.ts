import { describe, expect, it } from "vitest";
import {
  findCanonicalMainWorktree,
  parseGitWorktreeList,
  resolveDevelopmentDatabaseUrl,
  toPrismaSqliteFileUrl
} from "../development-runtime";

describe("development runtime", () => {
  it("finds the canonical main worktree without truncating paths with spaces", () => {
    const worktrees = parseGitWorktreeList(
      [
        "worktree C:/Workspace/Application Folders/Main Application/EI_Designer",
        "HEAD abc123",
        "branch refs/heads/main",
        "",
        "worktree C:/Workspace/Application Folders/Working Branches/example",
        "HEAD def456",
        "branch refs/heads/codex/example",
        ""
      ].join("\n")
    );

    expect(findCanonicalMainWorktree(worktrees)).toEqual({
      path: "C:/Workspace/Application Folders/Main Application/EI_Designer",
      branch: "refs/heads/main"
    });
  });

  it("fails closed when a canonical main worktree is unavailable", () => {
    expect(() =>
      findCanonicalMainWorktree([
        {
          path: "C:/Workspace/example",
          branch: "refs/heads/codex/example"
        }
      ])
    ).toThrow(/canonical main worktree/i);
  });

  it("builds an absolute Prisma SQLite URL", () => {
    // Absolute filesystem paths use the host OS's syntax. Keep the Windows
    // separator conversion covered locally and a native absolute path on CI.
    const windows = process.platform === "win32";
    const databasePath = windows ? "C:\\Workspace\\prisma\\dev.db" : "/workspace/prisma/dev.db";
    const expected = windows ? "file:C:/Workspace/prisma/dev.db" : "file:/workspace/prisma/dev.db";
    expect(toPrismaSqliteFileUrl(databasePath)).toBe(expected);
  });

  it("uses only the dedicated explicit database override", () => {
    expect(
      resolveDevelopmentDatabaseUrl({
        canonicalDatabasePath: "C:\\Workspace\\prisma\\dev.db",
        explicitOverride: " file:D:/Approved/test.db "
      })
    ).toBe("file:D:/Approved/test.db");
  });
});
