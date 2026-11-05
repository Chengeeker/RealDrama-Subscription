const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const context = {md5: (value) => crypto.createHash("md5").update(value).digest("hex")};
vm.createContext(context);
for (const name of ["sdk", "hongguo"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "programs", `${name}.js`), "utf8"), context);
}
const calls = [];
context.hongguoSign = (parameters, body) => {
  const params = JSON.parse(parameters);
  assert.match(params.device_id, /^1[0-9]{15}$/);
  assert.match(params.iid, /^1[0-9]{15}$/);
  calls.push({params, body});
  return JSON.stringify({query: "signed=fixture", headers: {"X-Medusa": "synthetic"}});
};
let generator = context.hgRequest("/fixture", {value: "synthetic"}, null, {});
let request = generator.next();
assert.strictEqual(request.value.url, "https://api5-normal-sinfonlineb.fqnovel.com/fixture?signed=fixture");
assert.strictEqual(request.value.headers["X-Medusa"], "synthetic");
assert.strictEqual(request.value.body, calls[0].body);
let result = generator.next({status: 200, text: '{"code":0,"data":{"marker":"ok"}}'});
assert.strictEqual(result.done, true);
assert.strictEqual(result.value.marker, "ok");

generator = context.hgRequest("/fixture", null, null, {});
generator.next();
generator.next({status: 200, text: ""});
generator.next({status: 200, text: "   "});
assert.throws(() => generator.next({status: 200, text: ""}), /empty response/);

generator = context.hgRequest("/novel/player/video_model/v1/", {video_id: "synthetic"}, null, {});
generator.next();
for (let attempt = 0; attempt < 1; attempt++) {
  assert.strictEqual(generator.next({status: 200, text: ""}).done, false);
}
assert.throws(() => generator.next({status: 200, text: ""}), /empty response/);

for (const response of [{status: 403, text: ""}, {status: 200, text: '{"code":101000}'}]) {
  generator = context.hgRequest("/fixture", null, null, {});
  generator.next();
  const before = calls.length;
  assert.throws(() => generator.next(response));
  assert.strictEqual(calls.length, before);
}

delete context.hongguoSign;
generator = context.hgRequest("/fixture", null, null, {});
request = generator.next();
assert.strictEqual(request.value.headers["X-Medusa"], undefined);
assert.ok(request.value.headers["X-Gorgon"]);
console.log("hongguo signing capability, retry bounds and old-client compatibility checks passed");
