// Repository stores for publish-core: GitHub for real, memory for tests and the local preview.
import { HttpError } from "./publish-core.mjs";

const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

/** Commits go to one branch of one repository through the GitHub API (no git binary needed). */
export function githubStore({ token, repo, branch = "main", fetchImpl = fetch }) {
  if (!token || !repo) throw new HttpError(500, "not_configured", "Publishing isn't set up on this site yet.");
  const base = `https://api.github.com/repos/${repo}`;

  async function api(method, path, body, accept = "application/vnd.github+json") {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: accept,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "runtime-ready-publisher",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res;
  }
  const fail = async (res, what) => {
    console.error(`GitHub ${what} failed: ${res.status}`);
    throw new HttpError(502, "github_error", "Couldn't reach the website repository. Try again in a minute.");
  };

  return {
    async readFile(path, ref = branch) {
      const res = await api("GET", `/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`, null, "application/vnd.github.raw+json");
      if (res.status === 404) return null;
      if (!res.ok) await fail(res, "read");
      return res.text();
    },

    async history(path, limit = 30) {
      const q = `sha=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}&per_page=${limit}`;
      const res = await api("GET", `/commits?${q}`);
      if (!res.ok) await fail(res, "history");
      const rows = await res.json();
      return rows.map((c) => ({
        sha: c.sha,
        at: c.commit.committer?.date || c.commit.author?.date,
        message: String(c.commit.message).split("\n")[0],
      }));
    },

    async commit(files, message) {
      const refRes = await api("GET", `/git/ref/heads/${encodePath(branch)}`);
      if (!refRes.ok) await fail(refRes, "ref");
      const headSha = (await refRes.json()).object.sha;
      const headRes = await api("GET", `/git/commits/${headSha}`);
      if (!headRes.ok) await fail(headRes, "commit read");
      const baseTree = (await headRes.json()).tree.sha;

      const treeRes = await api("POST", "/git/trees", {
        base_tree: baseTree,
        tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })),
      });
      if (!treeRes.ok) await fail(treeRes, "tree");
      const tree = (await treeRes.json()).sha;

      const commitRes = await api("POST", "/git/commits", { message, tree, parents: [headSha] });
      if (!commitRes.ok) await fail(commitRes, "commit");
      const sha = (await commitRes.json()).sha;

      const moveRes = await api("PATCH", `/git/refs/heads/${encodePath(branch)}`, { sha, force: false });
      if (moveRes.status === 422 || moveRes.status === 409) {
        throw new HttpError(409, "conflict", "Someone else published at the same moment. Retrying.");
      }
      if (!moveRes.ok) await fail(moveRes, "ref update");
      return sha;
    },
  };
}

/** In-memory repository with the same behaviour, used by tests and the local preview. */
export function memoryStore(seed = {}) {
  const commits = []; // oldest first: {sha, at, message, files: {path: content}}
  let counter = 0;
  const initial = { ...seed };
  const fileAt = (path, upto) => {
    for (let i = upto - 1; i >= 0; i--) if (path in commits[i].files) return commits[i].files[path];
    return path in initial ? initial[path] : null;
  };
  return {
    commits,
    async readFile(path, ref) {
      if (!ref) return fileAt(path, commits.length);
      const i = commits.findIndex((c) => c.sha === ref);
      if (i < 0) return null;
      return fileAt(path, i + 1);
    },
    async history(path, limit = 30) {
      return commits
        .filter((c) => path in c.files)
        .reverse()
        .slice(0, limit)
        .map(({ sha, at, message }) => ({ sha, at, message }));
    },
    async commit(files, message) {
      counter += 1;
      const sha = counter.toString(16).padStart(40, "0");
      commits.push({ sha, at: new Date().toISOString(), message, files: Object.fromEntries(files.map((f) => [f.path, f.content])) });
      return sha;
    },
    /** What a visitor would see if the site last deployed `ms` milliseconds ago. */
    deployedFile(path, ms = 0) {
      const cutoff = Date.now() - ms;
      let n = 0;
      while (n < commits.length && Date.parse(commits[n].at) <= cutoff) n++;
      return fileAt(path, n);
    },
  };
}
