const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let now = 1700000000000;
const context = {
  Date: {now: () => now},
  base64bytes: value => [...Buffer.from(value, 'base64')],
  base64decode: value => Buffer.from(value, 'base64').toString(),
};
vm.createContext(context);
for (const name of ['sdk', 'hongguo', 'hongguo-web']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'programs', name + '.js'), 'utf8'), context);
}
const response = value => ({status: 200, text: JSON.stringify(value)});
const state = {};
let flow = context.hgSearch({query: ' synthetic ', page: 2}, state);
assert.match(flow.next().value.url, /\/api\/search\/result\?/);
const search = {pageNum: 2, hasMore: true, totalPages: 3, searchList: [
  {series_id: '123', series_name: 'Synthetic'}, {series_id: '123'}, {series_id: 'bad'},
]};
let result = flow.next(response(search));
assert.equal(result.value.items.length, 1);
assert.equal(result.value.page, 2);
assert.equal(result.value.hasMore, true);
result.value.items[0].title = 'mutated';
assert.equal(context.hgSearch({query: 'synthetic', page: 2}, state).next().value.items[0].title, 'Synthetic');
assert.equal(context.hgSearch({query: 'synthetic', page: 2, force: true}, state).next().done, false);
assert.equal(context.hgSearch({query: 'synthetic', page: 1}, state).next().done, false);
now += 60000;
assert.equal(context.hgSearch({query: 'synthetic', page: 2}, state).next().done, false);
for (const value of [{...search, pageNum: 1}, {...search, hasMore: 'true'}, {...search, searchList: []}, {code: 1, ...search}]) {
  flow = context.hgSearch({query: 'synthetic', page: 2}, {}); flow.next();
  assert.throws(() => flow.next(response(value)));
}
for (const page of [0, -1, 1.5, 101]) {
  assert.throws(() => context.hgSearch({query: 'synthetic', page}, {}).next());
}
const cache = {};
for (let i = 0; i < 20; i++) context.hgRemember(cache, String(i), {items: [i]});
assert.equal(cache.hgCache.length, 8);
now -= 1;
assert.equal(context.hgCached(cache, '19', false), null);
const key = '0123456789abcdef0123456789abcdef';
function spade(flat) {
  const raw = [0]; let even = flat ? 246 : 250, odd = 85;
  for (const [i, value] of [...Buffer.from('0' + key)].entries()) {
    const old = i % 2 ? odd : even;
    const next = old ^ ((value + 21 + i.toString(2).replace(/0/g, '').length) & 255);
    raw.push(next); if (i % 2) odd = next; else even = next;
  }
  raw[0] = raw[1] ^ raw[2] ^ (flat ? 48 : 49);
  if (!flat) raw.push(120 ^ raw[32] ^ raw[33]);
  return Buffer.from(raw).toString('base64');
}
assert.equal(context.hgFlatContentKey(spade(true)), key);
assert.equal(context.hgContentKey(spade(false)), key);
const media = 'https://media.example/full.mp4';
const flat = {codec_type: 'h265', width: 720, height: 1280, spade_a: spade(true), main_url: media, backup_url: media};
const nested = {codec_type: 'h264', video_meta: {width: 1080, height: 1920}, encrypt_info: {spade_a: spade(false)}, main_url: Buffer.from(media + '?backup').toString('base64')};
result = context.hgChoices({video_list: [flat, nested, {...flat, codec_type: 'bytevc2'}]});
assert.equal(result.length, 2);
assert.equal(result[0].height, 720);
assert.equal(result[1].height, 1080);
assert.equal(result[1].key, key);
assert.equal(context.hgChoices({video_list: [{...flat, spade_a: undefined}]}).length, 0);
assert.equal(context.hgChoices({video_list: [{...flat, spade_a: undefined, encrypt: false}]}).length, 1);
assert.equal(context.hgChoices({video_list: [{...flat, main_url: 'https://media.example/video/public/preview', backup_url: ''}]}).length, 0);
assert.equal(context.hgMediaAddress('encrypted', 'seed'), '');
context.hongguoMediaURL = () => media;
assert.equal(context.hgMediaAddress('encrypted', 'seed'), media);
for (const url of ['http://api.example/', 'https://api.fqnovel.com.evil/', 'https://user@api.fqnovel.com/', 'https://api.fqnovel.com:444/']) assert.throws(() => context.hgFallbackAddress(url));
const model = {video_id: 'model-id', video_duration: 80, fallback_api: 'https://api5-normal-hl.fqnovel.com/fallback'};
for (const [id, duration, valid] of [['model-id', 80, true], ['wrong', 80, false], ['model-id', 10, false]]) {
  flow = context.hgModelChoices(model); flow.next();
  const data = {video_info: {data: {video_id: id, video_duration: duration, video_list: [flat]}}};
  if (valid) assert.equal(flow.next(response(data)).value.length, 1);
  else assert.throws(() => flow.next(response(data)));
}
context.hongguoRegisterRequest = () => JSON.stringify({type: 'http', method: 'POST', url: 'https://log5-applog-lf.fqnovel.com/service/2/device_register/', bodyBase64: 'fixture', cdid: 'fixture'});
const signed = [];
context.hongguoSign = (params, body) => {
  signed.push(JSON.parse(params));
  return JSON.stringify({query: 'signed=fixture', headers: {}});
};
flow = context.hgResolve({chapter: {videoId: '123'}, quality: 720}, {});
assert.equal(flow.next().value.bodyBase64, 'fixture');
let step = flow.next({status: 200, text: '{"device_id":1234567890123456789,"install_id":9876543210123456789}'});
assert.match(step.value.url, /multi_video_model/);
assert.equal(signed.at(-1).device_id, '1234567890123456789');
assert.equal(signed.at(-1).iid, '9876543210123456789');
assert.equal(signed.at(-1).version_name, '7.1.3.32');
step = flow.next({status: 200, text: ''});
assert.match(step.value.url, /^https:\/\/api5-normal-hl\.fqnovel\.com/);
assert.equal(signed.at(-1).device_id, signed.at(-2).device_id);
result = flow.next(response({data: {'123': {video_model: {video_list: [flat]}}}}));
assert.equal(result.done, true);
assert.equal(result.value.decryptionKey, key);
flow = context.sourceExecute('resolve', {chapter: {videoId: '123'}}, {}); flow.next();
assert.throws(() => flow.next({status: 429, text: ''}), error => error.httpStatus === 429);
delete context.hongguoRegisterRequest;
flow = context.hgResolve({chapter: {videoId: '123'}}, {});
assert.match(flow.next().value.url, /\/video_model\//);
console.log('search pagination/cache, model formats, safe fallback, registered route and old-client checks passed');
