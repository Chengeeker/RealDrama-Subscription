const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = {base64encode: (value) => Buffer.from(value).toString("base64")};
vm.createContext(context);
vm.runInContext([
  fs.readFileSync(path.join(__dirname, "..", "programs", "sdk.js"), "utf8"),
  fs.readFileSync(path.join(__dirname, "..", "programs", "hongguo.js"), "utf8"),
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

context.hgApp = function* () { throw new Error("App API unavailable"); };
for (const [category, slug] of [["short_play", "real-drama"], ["comic_series", "comic-drama"], ["ai_series", "ai-drama"]]) {
  for (const page of [1, 2]) {
    const generator = context.sourceExecute("catalog", {category, page}, {});
    const request = generator.next();
    assert.strictEqual(request.value.url, `https://hongguoduanju.com/category/${slug}${page > 1 ? `?page=${page}` : ""}`);
    const result = generator.next({status: 200, text: body({category_layout: null, "category_$": {
      recommendList: [{series_id: "123", series_name: "Synthetic"}],
      pagination: {totalPages: 3},
    }})});
    assert.strictEqual(result.done, true);
    assert.strictEqual(result.value.items[0].sourceId, "123");
    assert.strictEqual(result.value.page, page);
    assert.strictEqual(result.value.hasMore, true);
  }
}
console.log("hongguo catalog fallback request checks passed");

function resolveWeb(overrides = {}) {
  const generator = context.sourceExecute("resolve", {
    drama: {sourceId: "123456"}, chapter: {videoId: "654321"},
  }, {});
  assert.strictEqual(generator.next().value.url, "https://hongguoduanju.com/player/123456/654321");
  const step = generator.next({status: 200, text: body({
    player_layout: null,
    "player_(series_id)/(vid)/layout": null,
    "player_(series_id)/(vid)/page": {
      series_id: "123456", vid: "654321",
      publicVideoSeo: {available: true, seriesId: "123456", itemId: "654321"},
      ...overrides,
    },
  })});
  return {generator, step};
}
const flow = resolveWeb();
assert.strictEqual(flow.step.done, false);
assert.strictEqual(flow.step.value.url, "https://hongguoduanju.com/api/video/protected/fallback-play-info");
assert.strictEqual(flow.step.value.method, "POST");
assert.strictEqual(JSON.parse(flow.step.value.body).item_id, "654321");
const resolved = flow.generator.next({status: 200, text: JSON.stringify({
  main_url: "https://media.example/full-episode.mp4", base_resp: {StatusCode: 0},
})});
assert.strictEqual(resolved.done, true);
assert.strictEqual(resolved.value.url, "https://media.example/full-episode.mp4");

for (const response of [
  {status: 403, text: '{"error":"public_fallback_unavailable"}'},
  {status: 200, text: '{"main_url":"https://media.example/rejected.mp4","base_resp":{"StatusCode":1}}'},
]) {
  const rejected = resolveWeb();
  const fallback = rejected.generator.next(response);
  assert.strictEqual(fallback.done, false);
  assert.ok(fallback.value.url.startsWith("https://djapi.999888456.xyz/api/hongguo/play?"));
  assert.throws(() => rejected.generator.next({status: 403, text: ""}),
    (error) => error.sourceError === "http" && error.httpStatus === 403);
}
const legacy = resolveWeb({video_player_info: {main_url: "https://media.example/existing.mp4"}});
assert.strictEqual(legacy.step.done, true);
assert.strictEqual(legacy.step.value.url, "https://media.example/existing.mp4");
console.log("hongguo full playback and preview rejection checks passed");
