import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

execFileSync(process.execPath, ["scripts/build.mjs"], {
  stdio: "inherit",
  env: { ...process.env, CF_PAGES_COMMIT_SHA: "test123456789", CF_PAGES_BRANCH: "test-branch" },
});
const version = JSON.parse(readFileSync("dist/version.json", "utf8"));
assert.equal(version.commit, "test123456789");
assert.equal(version.shortCommit, "test123");
assert.equal(version.branch, "test-branch");
assert.ok(Number.isFinite(Date.parse(version.builtAt)));
assert.ok(readFileSync("dist/config.js", "utf8").includes('window.MAXIWA_BUILD_VERSION = {"app":"metrixverity","commit":"test123456789"'));
for (const file of ["index.html", "maxiwa.html", "dashboard.html", "dashboard/index.html", "executive/index.html"]) {
  const html = readFileSync(`dist/${file}`, "utf8");
  const localAssets = [...html.matchAll(/(?:src|href)=["']((?:\.\/|\/)?(?:css\/[^"']+\.css|js\/[^"']+\.js|config\.js)(?:\?[^"']*)?)["']/g)];
  assert.ok(localAssets.length > 0, file);
  assert.ok(localAssets.every((match) => match[1].endsWith("?v=test123")), file);
  assert.ok(!/https?:\/\/[^"']+\?v=test123/.test(html));
}
console.log("ok - Build identifies exact commit and branch, versions local assets, and preserves clean routes");
