const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const requests = [];
const context = {
  requests,
  resolveURL: (base, reference) => new URL(reference, base).toString(),
  query: (params) => Object.keys(params).sort().map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join("&"),
  url: (value) => typeof value === "string" && /^https:\/\//.test(value) ? value : "",
  http: function* (address, options) {
    requests.push({address, headers: options.headers});
    const response = yield {type: "http", url: address, headers: options.headers};
    if (!response || response.status !== 200) throw new Error("HTTP failed");
    return response.text;
  },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "programs", "crj91.js"), "utf8"), context);

for (const host of ["91crdj.com", "www.91crdj.com", "91crdjai.com", "www.91crdjai.com"]) {
  assert.strictEqual(context.crjPath(`https://${host}/duanju/123-sample/1/`), "/duanju/123-sample/1/");
}
assert.throws(() => context.crjPath("https://91crdjai.com.evil.example/duanju/123-sample/1/"));
assert.strictEqual(context.crjCover("https://91crdj.com/cover.jpg"), "https://91crdjai.com/cover.jpg");

let generator = context.sourceExecute("catalog", {}, {});
let step = generator.next();
assert.strictEqual(step.value.url, "https://91crdjai.com/duanju/");
assert.strictEqual(step.value.headers.Referer, "https://91crdjai.com/");
step = generator.next({status: 200, text: '<a class="card" href="/duanju/123-sample/" data-track-item-name="Synthetic"><h3>Synthetic</h3><img src="/cover.jpg"></a>'});
assert.strictEqual(step.done, true);
assert.strictEqual(step.value.items.length, 1);
assert.strictEqual(step.value.items[0].cover, "https://91crdjai.com/cover.jpg");

generator = context.sourceExecute("detail", {drama: {sourceId: "duanju/123-sample"}}, {});
step = generator.next();
assert.strictEqual(step.value.url, "https://91crdjai.com/duanju/123-sample/");
step = generator.next({status: 200, text: '<h1 class="detail-title">Synthetic</h1><div class="d-poster"><img src="/cover.jpg"></div><div class="ep-grid"><a href="https://91crdjai.com/duanju/123-sample/1/">1</a></div><p id="viBody">fixture</p>'});
assert.strictEqual(step.done, true);
assert.strictEqual(step.value.chapters.length, 1);
assert.strictEqual(step.value.chapters[0].pageURL, "https://91crdjai.com/duanju/123-sample/1/");

generator = context.sourceExecute("resolve", {
  drama: {sourceId: "duanju/123-sample"},
  chapter: {pageURL: "https://91crdj.com/duanju/123-sample/1/"},
}, {});
step = generator.next();
assert.strictEqual(step.value.url, "https://91crdjai.com/videos/123/episodes/1/playback");
assert.strictEqual(step.value.headers.Referer, "https://91crdjai.com/");
step = generator.next({status: 200, text: JSON.stringify({data: {src: "https://media.example/video.m3u8"}})});
assert.strictEqual(step.done, true);
assert.strictEqual(step.value.url, "https://media.example/video.m3u8");
assert.strictEqual(step.value.headers.Referer, "https://91crdjai.com/");
console.log("crj91 source compatibility checks passed");
