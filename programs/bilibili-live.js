"use strict";
// SPDX-License-Identifier: MIT
var BILI_LIVE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36";
var BILI_LIVE_WBI = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
var BILI_LIVE_MEDIA_HOST = /(?:\.bilivideo\.(?:com|cn)|\.biliapi\.net|\.hdslb\.com|\.edge\.mountaintoys\.cn)$/i;

function biliLiveClean(value) {
  return String(value || "").replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function biliLiveSecure(value) {
  value = String(value || "");
  if (value.indexOf("//") === 0) return "https:" + value;
  return value.replace(/^http:/i, "https:");
}
function biliLiveId(row) {
  return String((row || {}).roomid || (row || {}).room_id || (row || {}).id || "");
}
function biliLiveDrama(row, category) {
  var roomId = biliLiveId(row);
  if (!/^\d{1,16}$/.test(roomId) || Number(roomId) <= 0) return null;
  var parent = biliLiveClean((row || {}).area_v2_parent_name || (row || {}).parent_area_name || "");
  var area = biliLiveClean((row || {}).area_v2_name || (row || {}).area_name || "");
  var areaName = parent && area && parent !== area ? parent + " / " + area : area || parent || category || "直播";
  var uid = String((row || {}).uid || (row || {}).mid || "");
  return {
    id: "bilibili-live:" + roomId,
    source: "bilibili-live",
    sourceId: roomId,
    title: biliLiveClean((row || {}).title || "") || "哔哩哔哩直播",
    description: areaName,
    cover: biliLiveSecure((row || {}).cover || (row || {}).user_cover || ""),
    episodes: 1,
    category: areaName,
    tags: ["直播", areaName],
    vip: false,
    heat: String((row || {}).online || ""),
    views: String((row || {}).online || ""),
    creatorId: /^\d{1,16}$/.test(uid) ? uid : "",
    creatorName: biliLiveClean((row || {}).uname || (row || {}).username || ""),
    creatorAvatar: biliLiveSecure((row || {}).face || (row || {}).cover_from_user || "")
  };
}
function biliLivePage(rows, page, hasMore, category) {
  var seen = {}, items = [];
  array(rows).forEach(function(row) {
    var drama = biliLiveDrama(row, category);
    if (!drama || seen[drama.sourceId]) return;
    seen[drama.sourceId] = true;
    items.push(drama);
  });
  return {items: items, count: items.length, page: page, hasMore: !!hasMore, fresh: true};
}
function biliLiveIsMore(value) {
  return value === true || Number(value) === 1;
}
function* biliLiveAccessId() {
  var html = yield* http("https://live.bilibili.com/lol", {
    credential: false,
    headers: {"User-Agent": BILI_LIVE_UA, "Accept": "text/html"}
  });
  var match = /(?:\\?["'])?access_id(?:\\?["'])?\s*[:=]\s*(?:\\?["'])([A-Za-z0-9_-]{8,})/.exec(html);
  if (!match) throw new Error("直播分区签名参数暂不可用");
  return match[1];
}
function* biliLiveWbi(state) {
  if (state.liveWbi && Date.now() - (state.liveWbiAt || 0) < 21600000)
    return state.liveWbi;
  var response = JSON.parse(yield* http("https://api.bilibili.com/x/web-interface/nav", {
    credential: false,
    headers: {
      "User-Agent": BILI_LIVE_UA,
      "Referer": "https://live.bilibili.com/",
      "Accept": "application/json, text/plain, */*"
    }
  }));
  if (!(Number(response.code) === 0 || (Number(response.code) === -101 && response.data)))
    throw new Error("无法取得 B 站公开 WBI 参数");
  var images = (response.data || {}).wbi_img || {};
  var combined = [images.img_url, images.sub_url].map(function(address) {
    return String(address || "").split("/").pop().split(".")[0];
  }).join("");
  if (combined.length < 64) throw new Error("B 站 WBI 参数不完整");
  state.liveWbi = BILI_LIVE_WBI.map(function(index) { return combined[index]; }).join("").slice(0, 32);
  state.liveWbiAt = Date.now();
  return state.liveWbi;
}
function* biliLiveRequest(host, route, params, state, options) {
  options = options || {};
  var queryParams = Object.assign({}, params || {});
  if (options.signed) {
    var mixin = yield* biliLiveWbi(state);
    queryParams.w_webid = yield* biliLiveAccessId();
    Object.keys(queryParams).forEach(function(key) {
      queryParams[key] = String(queryParams[key]).replace(/[!'()*]/g, "");
    });
    queryParams.wts = String(Math.floor(Date.now() / 1000));
    queryParams.w_rid = md5(query(queryParams) + mixin);
  }
  var pageReferer = "https://live.bilibili.com/";
  var response = JSON.parse(yield* http("https://" + host + route + "?" + query(queryParams), {
    credential: options.credential === true,
    headers: {
      "User-Agent": BILI_LIVE_UA,
      "Referer": pageReferer,
      "Origin": "https://live.bilibili.com",
      "Accept": "application/json, text/plain, */*"
    }
  }));
  var code = Number(response.code);
  if (code !== 0 && !(options.allowNotLoggedIn && code === -101 && response.data)) {
    if (options.loginRequired && (code === -101 || code === -400))
      throw new Error("关注直播列表需要配置有效的 B 站登录 Cookie");
    throw new Error("哔哩哔哩直播接口暂不可用（业务码 " + code + "）");
  }
  if (!response.data) throw new Error("哔哩哔哩直播接口没有返回数据");
  return response.data;
}
function biliLiveAreaRows(data) {
  var root = (data || {}).data || data || {};
  var candidates = Array.isArray(root) ? root :
    (root.parent_list || root.parentList || root.data || root.area_list || []);
  return array(candidates).map(function(row) {
    var id = String((row || {}).id || (row || {}).parent_area_id || "");
    var name = biliLiveClean((row || {}).name || (row || {}).parent_area_name || "");
    return /^\d{1,8}$/.test(id) && name ? {id: id, name: name} : null;
  }).filter(Boolean);
}
function* biliLiveAreas(state) {
  if (Array.isArray(state.liveAreas) && state.liveAreas.length &&
      Date.now() - (state.liveAreasAt || 0) < 21600000)
    return state.liveAreas;
  var data = yield* biliLiveRequest("api.live.bilibili.com",
    "/room/v1/Area/getList", {need_entrance: 1, parent_id: 0}, state);
  var rows = biliLiveAreaRows(data);
  if (!rows.length) throw new Error("哔哩哔哩直播分类结构暂不可用");
  state.liveAreas = rows;
  state.liveAreasAt = Date.now();
  return rows;
}
function biliLiveAreaName(state, id) {
  var category = array(state.liveCategories).filter(function(row) { return row.id === id; })[0];
  return category ? category.name : "直播";
}
function biliLiveMediaAddress(host, base, extra) {
  host = String(host || "").replace(/\/+$/, "");
  base = String(base || "");
  extra = String(extra || "");
  var address = /^https?:\/\//i.test(base) ? base + extra :
    host + (base.charAt(0) === "/" ? base : "/" + base) + extra;
  address = biliLiveSecure(address);
  var parsed = /^https:\/\/([A-Za-z0-9.-]+)(?::\d+)?\//i.exec(address);
  if (!parsed || !BILI_LIVE_MEDIA_HOST.test(parsed[1]) || /@/.test(parsed[1])) return "";
  return address;
}
function biliLiveCandidates(playurl, roomId) {
  var rows = [], streams = array((playurl || {}).stream);
  streams.forEach(function(stream) {
    var protocol = String((stream || {}).protocol_name || "").toLowerCase();
    array((stream || {}).format).forEach(function(format) {
      var formatName = String((format || {}).format_name || "").toLowerCase();
      array((format || {}).codec).forEach(function(codec) {
        var codecName = String((codec || {}).codec_name || "").toLowerCase();
        var base = String((codec || {}).base_url || "");
        array((codec || {}).url_info).forEach(function(info) {
          var address = biliLiveMediaAddress((info || {}).host, base, (info || {}).extra);
          if (!address) return;
          var isHls = protocol.indexOf("hls") >= 0 || formatName.indexOf("hls") >= 0 ||
            /\.m3u8(?:\?|$)/i.test(address);
          var score = (isHls ? 100 : 0) + (/avc|h264/.test(codecName) ? 10 : 0) +
            (/fmp4|ts/.test(formatName) ? 2 : 0);
          var height = Number((codec || {}).current_qn) || 0;
          rows.push({
            url: address,
            score: score,
            height: height,
            headers: {
              "User-Agent": BILI_LIVE_UA,
              "Referer": "https://live.bilibili.com/" + roomId
            }
          });
        });
      });
    });
  });
  rows.sort(function(a, b) { return b.score - a.score; });
  var seen = {};
  return rows.filter(function(row) {
    if (seen[row.url]) return false;
    seen[row.url] = true;
    return true;
  }).slice(0, 3);
}
function* biliLiveExecute(action, input, state) {
  input = input || {};
  state = state || {};
  var drama = input.drama || {};
  var roomId = String(drama.sourceId || String(drama.id || "").split(":").pop() || "");
  var page = Math.max(1, Math.floor(Number(input.page) || 1));
  var category = String(input.category || "recommend");

  if (action === "categories") {
    var areas = yield* biliLiveAreas(state);
    var categories = [{id: "following", name: "关注"}].concat(areas.map(function(row) {
      return {id: "area:" + row.id + ":0", name: row.name};
    }));
    state.liveCategories = categories;
    return {items: categories};
  }

  if (action === "catalog" || action === "check") {
    if (category === "following") {
      var pageSize = 10;
      var followed = yield* biliLiveRequest("api.live.bilibili.com",
        "/xlive/web-ucenter/v1/xfetter/GetWebList",
        {page: page, page_size: pageSize}, state,
        {credential: true, loginRequired: true});
      var rooms = array(followed.rooms);
      if (!rooms.length) rooms = array(followed.list);
      var count = Number(followed.count) || 0;
      return biliLivePage(rooms, page, rooms.length > 0 && page * pageSize < count, "关注");
    }

    if (category === "recommend" || category === "all" || category === "") {
      var home = yield* biliLiveRequest("api.live.bilibili.com",
        "/xlive/web-interface/v1/index/getListV2",
        {platform: "web", page: page}, state);
      var homeData = home || {};
      var homeRows = array(homeData.list);
      var recommended = array(homeData.recommend_room_list);
      return biliLivePage(homeRows.concat(recommended), page,
        biliLiveIsMore(homeData.has_more) && homeRows.length > 0, "推荐");
    }

    var areaMatch = /^area:(\d{1,8}):(\d{1,8})$/.exec(category);
    if (!areaMatch) throw new Error("未知的哔哩哔哩直播分类");
    var areaId = areaMatch[2];
    var parentAreaId = areaMatch[1];
    var areaData = yield* biliLiveRequest("api.live.bilibili.com",
      "/xlive/web-interface/v1/second/getList",
      {
        platform: "web",
        parent_area_id: parentAreaId,
        area_id: areaId,
        sort_type: "",
        page: page
      }, state, {signed: true});
    var areaName = biliLiveAreaName(state, category);
    var areaItems = array(areaData.list);
    return biliLivePage(areaItems, page,
      biliLiveIsMore(areaData.has_more) && areaItems.length > 0, areaName);
  }

  if (action === "detail" || action === "metadata") {
    if (!/^\d{1,16}$/.test(roomId) || Number(roomId) <= 0)
      throw new Error("直播间编号无效");
    var normalized = Object.assign({}, drama, {
      id: "bilibili-live:" + roomId,
      source: "bilibili-live",
      sourceId: roomId,
      title: String(drama.title || "哔哩哔哩直播"),
      episodes: 1,
      category: String(drama.category || "直播"),
      tags: array(drama.tags).length ? drama.tags : ["直播"]
    });
    return single(normalized, {
      id: "bilibili-live:" + roomId,
      title: "直播",
      currentEpisode: 1
    });
  }

  if (action === "resolve") {
    if (!/^\d{1,16}$/.test(roomId) || Number(roomId) <= 0)
      throw new Error("直播间编号无效");
    var data = yield* biliLiveRequest("api.live.bilibili.com",
      "/xlive/web-room/v2/index/getRoomPlayInfo",
      {
        room_id: roomId,
        protocol: "0,1",
        format: "0,1,2",
        codec: "0,1,2",
        qn: "0",
        platform: "web"
      }, state, {credential: true});
    if (Number(data.live_status) !== 1)
      throw new Error("该直播间当前未开播");
    var playurl = (((data.playurl_info || {}).playurl) || {});
    var candidates = biliLiveCandidates(playurl, roomId);
    if (!candidates.length)
      throw new Error("直播间未返回受支持的 HTTPS 播放线路");
    return {
      url: candidates[0].url,
      quality: 0,
      qualities: [],
      headers: candidates[0].headers,
      variants: candidates.map(function(row) {
        return {url: row.url, quality: 0, headers: row.headers};
      })
    };
  }

  return {error: "哔哩哔哩直播源不支持此操作"};
}
function* sourceExecute(action, input, state) {
  return yield* biliLiveExecute(action, input, state);
}
