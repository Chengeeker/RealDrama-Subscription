const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = {};
vm.createContext(context);
vm.runInContext([
  fs.readFileSync(path.join(__dirname, "..", "programs", "sdk.js"), "utf8"),
  fs.readFileSync(path.join(__dirname, "..", "programs", "hongguo-web.js"), "utf8"),
  "globalThis.__hgRouter = hgRouter;",
].join("\n"), context);

const body = (loaderData) => `window._ROUTER_DATA = ${JSON.stringify({loaderData})};`;
const parsed = context.__hgRouter(body({
  category_layout: null,
  "category_$": {recommendList: Array.from({length: 24}, (_, index) => ({series_id: String(index + 1)}))},
}), ["category_page", "category_"]);
assert.strictEqual(parsed.recommendList.length, 24);

const parsedWithObjectLayout = context.__hgRouter(body({
  category_layout: {shell: true},
  "category_$": {recommendList: [{series_id: "1"}]},
}), ["category_page", "category_"]);
assert.strictEqual(parsedWithObjectLayout.recommendList[0].series_id, "1");
console.log("hongguo web router checks passed");
