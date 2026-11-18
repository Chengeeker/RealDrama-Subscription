const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'programs/sdk.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'programs/douyin.js'), 'utf8'), context);
const id = '7412345678901234567';
const expiry = Math.floor(Date.now() / 1000) + 600;
const expired = Math.floor(Date.now() / 1000) - 60;
const avc = 'https://v1.example.com/avc.mp4?expires=' + expiry;
const hevc = 'https://v2.example.com/hevc.mp4?expires=' + expiry;
const bad = 'https://v3.example.com/old.mp4?expires=' + expired;
const row = {
  aweme_id: id, desc: 'synthetic sample', author: { nickname: 'Tester' },
  video: {height: 1080, duration: 15000, cover: {url_list: ['https://img.example.com/cover.jpg']},
    play_addr_h264: {height: 720, url_list: [avc, avc]},
    play_addr_265: {height: 1080, url_list: [hevc]},
    play_addr_lowbr: {height: 540, url_list: [bad]}}
};
let variants = context.dyVariants(row);
assert.equal(variants.length, 2, 'duplicate and expired URLs are excluded');
assert.equal(variants[0].url, avc, 'AVC wins over higher-resolution HEVC');
assert.equal(context.dyLinkFresh(bad), false);
const state = {};
let generator = context.sourceExecute('catalog', {source:'douyin', category:'jingxuan', page:1}, state);
let next = generator.next();
assert.equal(next.done, false);
assert.equal(new URL(next.value.url).pathname, '/aweme/v2/web/module/feed/');
next = generator.next({status:200,text:JSON.stringify({aweme_list:[row],has_more:false})});
assert.equal(next.done, true);
assert.equal(next.value.items.length, 1);
const drama = next.value.items[0];
assert.equal(JSON.parse(drama.releaseStatus).c.length, 2);
generator = context.sourceExecute('resolve', {source:'douyin', drama, quality:0},state);
next = generator.next();
assert.equal(next.done, true, 'fresh feed playback does not require detail API');
assert.equal(next.value.url, avc);
assert.deepEqual(Array.from(next.value.variants, item => item.url), [avc,hevc]);
assert.equal(next.value.headers.Referer,'https://www.douyin.com/video/'+id);
const stale = {...drama,releaseStatus:JSON.stringify({...JSON.parse(drama.releaseStatus), t: Date.now()-300000})};
state.rows[id].storedAt = Date.now()-300000;
generator = context.sourceExecute('resolve', {source:'douyin',drama:stale,quality:0},state);
next=generator.next();
assert.equal(next.done,false,'expired metadata re-fetches video detail');
assert.equal(new URL(next.value.url).pathname,'/aweme/v1/web/aweme/detail/');
const fresh = JSON.parse(JSON.stringify(row));
fresh.video.play_addr_h264.url_list=['https://v1.example.com/fresh.mp4?expires='+expiry];
next=generator.next({status:200,text:JSON.stringify({aweme_detail:fresh})});
assert.equal(next.done,true);
assert.match(next.value.url,/fresh\.mp4/);
generator=context.sourceExecute('resolve',{source:'douyin',drama,quality:0,force:true},state);
next=generator.next();
assert.equal(next.done,false,'force refresh bypasses fresh cache');
const onlyHevc={video:{height:1080,play_addr_265:{url_list:[hevc]}}};
assert.equal(context.dySelect(context.dyVariants(onlyHevc),0).url,hevc,'HEVC stays fallback when AVC unavailable');
console.log('Douyin source tests passed: catalog, AVC priority, cache freshness, token expiry, fallback URLs, force refresh, video referer');