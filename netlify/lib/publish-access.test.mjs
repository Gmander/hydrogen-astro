import assert from "node:assert/strict";
import { test } from "node:test";
import publish from "../functions/publish.mjs";

test("supplemental invitations preserve existing accounts and reject folder collisions", async () => {
  const keys = ["GITHUB_TOKEN", "FIREBASE_API_KEY", "PUBLISH_UPLOADERS", "PUBLISH_UPLOADERS_ADDITIONAL"];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  try {
    Object.assign(process.env, {
      GITHUB_TOKEN: "test", FIREBASE_API_KEY: "test",
      PUBLISH_UPLOADERS: "owner@example.com:owner",
      PUBLISH_UPLOADERS_ADDITIONAL: "new@example.com:new,owner@example.com:changed,collision@example.com:owner"
    });
    globalThis.fetch = async (_url, options) => Response.json({
      users: [{ email: JSON.parse(options.body).idToken, emailVerified: true, localId: "test" }]
    });
    const request = email => publish(new Request("https://example.com/api?action=unknown", {
      headers: { Authorization: "Bearer " + email }
    }));
    // Unknown actions reach routing only after authorization.
    assert.equal((await request("owner@example.com")).status, 404);
    assert.equal((await request("new@example.com")).status, 404);
    assert.equal((await request("collision@example.com")).status, 403);
    assert.equal((await request("stranger@example.com")).status, 403);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

