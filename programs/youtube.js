"use strict";

function ytFailure(code){var error=new Error("YouTube request unavailable");error.sourceError=code;return error;}

function ytAssignment(body,pattern){return typeof jsonAssignment==="function"?JSON.parse(jsonAssignment(body,pattern.source)):assignment(body,pattern);}

var YT_CATEGORIES = [
  { id: "gaming", name: "游戏", labels: ["gaming", "游戏"] },
  { id: "live", name: "直播", labels: ["live", "直播"] },
  { id: "music", name: "音乐", labels: ["music", "音乐"] },
  { id: "podcasts", name: "播客", labels: ["podcasts", "播客"] }
];

function ytText(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  if (typeof value.simpleText === "string") return value.simpleText.trim();
  return array(value.runs).map(function (row) {
    return String(row && row.text || "");
  }).join("").trim();
}

function ytCategory(label) {
  var value = String(label || "").trim().toLowerCase();
  return YT_CATEGORIES.find(function (row) {
    return row.labels.some(function (name) {
      return name.toLowerCase() === value;
    });
  }) || null;
}

function ytCategoryName(id) {
  if (!id) return "推荐";
  var row = YT_CATEGORIES.find(function (item) {
    return item.id === id;
  });
  return row ? row.name : "";
}

function ytIndexHome(root, state) {
  var pending = [root];
  var inspected = 0;
  var grid = null;
  while (pending.length && inspected < 250000) {
    var value = pending.pop();
    if (!value || typeof value !== "object") continue;
    inspected++;
    if (grid && value === grid) {
      var gridKeys = Object.keys(value);
      for (var gridIndex = gridKeys.length - 1; gridIndex >= 0; gridIndex--) {
        if (gridKeys[gridIndex] === "contents") continue;
        var gridChild = value[gridKeys[gridIndex]];
        if (gridChild && typeof gridChild === "object") pending.push(gridChild);
      }
      continue;
    }
    if (!grid && value.richGridRenderer &&
        Array.isArray(value.richGridRenderer.contents)) {
      grid = value.richGridRenderer;
    }
    if (value.chipCloudChipRenderer) {
      var chip = value.chipCloudChipRenderer;
      var category = ytCategory(ytText(chip.text));
      var command = chip.navigationEndpoint &&
        chip.navigationEndpoint.continuationCommand;
      if (category && command && typeof command.token === "string") {
        state.categoryTokens[category.id] = command.token;
      }
    }
    var keys = Object.keys(value);
    for (var i = keys.length - 1; i >= 0; i--) {
      var child = value[keys[i]];
      if (child && typeof child === "object") pending.push(child);
    }
  }
  if (pending.length) throw new Error("YouTube 首页结构超出解析范围");
  return grid;
}

function ytFeedItems(response) {
  var result = [];
  array(response && response.onResponseReceivedActions).concat(array(response && response.onResponseReceivedEndpoints)).forEach(function (action) {
    var command = action.appendContinuationItemsAction ||
      action.reloadContinuationItemsCommand;
    array(command && command.continuationItems).forEach(function (row) {
      if (row && (row.richItemRenderer || row.videoRenderer || row.lockupViewModel || row.itemSectionRenderer || row.richSectionRenderer)) result.push(row);
    });
  });
  return result;
}

function ytNextFromItems(items) {
  for (var i = array(items).length - 1; i >= 0; i--) {
    var renderer = items[i] && items[i].continuationItemRenderer;
    var command = renderer && renderer.continuationEndpoint &&
      renderer.continuationEndpoint.continuationCommand;
    if (command && typeof command.token === "string" && command.token) {
      return command.token;
    }
  }
  return "";
}

function ytNextFromResponse(response) {
  var token = "";
  array(response && response.onResponseReceivedActions).concat(array(response && response.onResponseReceivedEndpoints)).some(function (action) {
    var command = action.appendContinuationItemsAction ||
      action.reloadContinuationItemsCommand;
    token = ytNextFromItems(command && command.continuationItems);
    return !!token;
  });
  return token;
}

function ytCard(item, category, state) {
  var renderer = item && item.richItemRenderer || item;
  var lock = renderer && (renderer.lockupViewModel || renderer.content && renderer.content.lockupViewModel);
  if (!lock) {
    var legacy = renderer && (renderer.videoRenderer || renderer.gridVideoRenderer || renderer.compactVideoRenderer || renderer.content && renderer.content.videoRenderer);
    if (!legacy || !/^[A-Za-z0-9_-]{11}$/.test(String(legacy.videoId || ""))) return null;
    var authors = legacy.ownerText || legacy.shortBylineText || legacy.longBylineText || {};
    var authorRun = array(authors.runs)[0] || {};
    var endpoint = authorRun.navigationEndpoint && authorRun.navigationEndpoint.browseEndpoint || {};
    var row = {id:"youtube:"+legacy.videoId,source:"youtube",sourceId:legacy.videoId,title:ytText(legacy.title),description:"",cover:String((array(legacy.thumbnail && legacy.thumbnail.thumbnails)[0] || {}).url || ""),episodes:1,category:ytCategoryName(category)||"推荐",tags:["YouTube"],creatorName:ytText(authors),creatorId:String(endpoint.browseId || ""),creatorAvatar:""};
    if (!row.title) return null;
    state.rows=state.rows||{};state.rows[row.sourceId]=row;
    var ids=Object.keys(state.rows);while(ids.length>80)delete state.rows[ids.shift()];
    return row;
  }
  var videoId = String(lock.contentId || "");
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;

  var lockMetadata = lock.metadata && lock.metadata.lockupMetadataViewModel || {};
  var title = ytText(lockMetadata.title && lockMetadata.title.content);
  if (!title) return null;

  var cardMetadata = lockMetadata.metadata &&
    lockMetadata.metadata.contentMetadataViewModel || {};
  var rows = array(cardMetadata.metadataRows);
  var creatorName = "";
  var creatorId = "";
  rows.some(function (row) {
    return array(row.metadataParts).some(function (part) {
      var text = part && part.text || {};
      var runs = array(text.commandRuns);
      var endpoint = null;
      runs.some(function (run) {
        var command = run && run.onTap && run.onTap.innertubeCommand || {};
        endpoint = command.browseEndpoint || null;
        return !!endpoint;
      });
      if (!endpoint) return false;
      creatorName = ytText(text.content);
      creatorId = String(endpoint.browseId || endpoint.canonicalBaseUrl || "");
      return true;
    });
  });

  var decorated = lockMetadata.image &&
    lockMetadata.image.decoratedAvatarViewModel || {};
  var avatarSources = array(decorated.avatar &&
    decorated.avatar.avatarViewModel &&
    decorated.avatar.avatarViewModel.image &&
    decorated.avatar.avatarViewModel.image.sources);
  var thumbnailSources = array(lock.contentImage &&
    lock.contentImage.thumbnailViewModel &&
    lock.contentImage.thumbnailViewModel.image &&
    lock.contentImage.thumbnailViewModel.image.sources);
  var avatar = avatarSources.map(function (row) {
    return String(row && row.url || "");
  }).find(function (url) {
    return /^https:\/\//.test(url);
  }) || "";
  var cover = thumbnailSources.map(function (row) {
    return String(row && row.url || "");
  }).find(function (url) {
    return /^https:\/\//.test(url);
  }) || "";

  var categoryName = ytCategoryName(category);
  var isLive = category === "live" ||
    !!(lockMetadata.liveData && lockMetadata.liveData.liveBadgeText);
  var tags = ["YouTube"];
  if (categoryName) tags.push(categoryName);
  if (isLive && tags.indexOf("直播") < 0) tags.push("直播");

  var drama = {
    id: "youtube:" + videoId,
    source: "youtube",
    sourceId: videoId,
    title: title,
    description: "",
    cover: cover,
    episodes: 1,
    category: categoryName || "推荐",
    tags: tags,
    vip: false,
    creatorName: creatorName,
    creatorId: creatorId,
    creatorAvatar: avatar
  };

  state.rows = state.rows || {};
  state.rows[videoId] = drama;
  var ids = Object.keys(state.rows);
  while (ids.length > 80) delete state.rows[ids.shift()];
  return drama;
}

function ytFlattenItems(root) {
  var pending=[root], items=[], scanned=0;
  while(pending.length && scanned++<30000 && items.length<120) {
    var value=pending.pop();if(!value||typeof value!=="object")continue;
    if(value.richItemRenderer||value.videoRenderer||value.gridVideoRenderer||value.compactVideoRenderer||value.lockupViewModel) {items.push(value);continue;}
    var keys=Object.keys(value);for(var i=keys.length-1;i>=0;i--) {
      var key=keys[i];if(key==="navigationEndpoint"||key==="thumbnail"||key==="trackingParams"||key==="metadata")continue;
      if(value[key]&&typeof value[key]==="object")pending.push(value[key]);
    }
  }
  return items;
}

function ytRows(items, category, state) {
  var seen = {};
  return ytFlattenItems(items).map(function (item) {
    return ytCard(item, category, state);
  }).filter(function (row) {
    if (!row || seen[row.sourceId]) return false;
    seen[row.sourceId] = true;
    return true;
  });
}

var YT_FALLBACK_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function* ytHttp(address, options) {
  options = options || {};
  var response = yield {
    type: "http",
    url: address,
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body,
    credential: !!options.credential,
    sign: !!options.sign
  };
  var status = Number(response && response.status) || 0;
  if (status !== 200) {
    var error = new Error("YouTube 请求失败");
    error.sourceError = "http";
    error.httpStatus = status;
    throw error;
  }
  return String(response.text || "");
}

function* ytJson(address, options) {
  var body = yield* ytHttp(address, options);
  var response;
  try {
    response = JSON.parse(body);
  } catch (_) {
    throw new Error("YouTube 信息流响应不是有效 JSON");
  }
  if (response && response.error) {
    var status = Number(response.error.code) || 0;
    throw new Error("YouTube 信息流接口拒绝请求" +
      (status ? "（HTTP " + status + "）" : ""));
  }
  return response;
}

function* ytBootstrap(state, force) {
  var now = Date.now();
  if (!force && state.bootstrapAt &&
      now - Number(state.bootstrapAt) < 300000 &&
      state.context && state.rootItems) {
    return state;
  }

  var html = yield* ytHttp("https://www.youtube.com/", {
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "User-Agent": YT_FALLBACK_USER_AGENT
    },
    credential: true
  });
  if (/consent\.youtube\.com|Before you continue to YouTube/i.test(html)) {
    throw ytFailure("youtube_consent");
  }
  var context = ytAssignment(html, /INNERTUBE_CONTEXT"?\s*[:=]\s*/);
  var initial = ytAssignment(html, /ytInitialData(?:["\']\])?\s*=\s*/);
  if (!context || !context.client || !context.client.clientName ||
      !context.client.clientVersion || !initial) {
    throw ytFailure("youtube_context");
  }

  state.categoryTokens = {};
  var grid = ytIndexHome(initial, state);
  state.context = context;
  state.rootItems = ytRows(grid ? grid.contents : initial, "", state);
  state.rootCursor = ytNextFromItems(grid && grid.contents);
  if(!state.rootItems.length) {
    var response=yield* ytBrowse(state, "", "FEwhat_to_watch");
    var fallbackGrid=ytIndexHome(response,state);
    state.rootItems=ytRows(fallbackGrid ? fallbackGrid.contents : response,"",state);
    state.rootCursor=ytNextFromItems(fallbackGrid&&fallbackGrid.contents)||ytNextFromResponse(response);
  }
  state.bootstrapAt = now;
  state.cursors = {};
  state.cursorPages = {};
  if (!state.rootItems.length) {
    throw ytFailure("youtube_feed_empty");
  }
  return state;
}

function* ytBrowse(state, continuation, browseId) {
  return yield* ytJson("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Referer": "https://www.youtube.com/",
      "User-Agent": String(state.context.client.userAgent),
      "X-Origin": "https://www.youtube.com",
      "X-Goog-Visitor-Id": String(state.context.client.visitorData),
      "X-YouTube-Client-Name": String(state.context.client.clientName),
      "X-YouTube-Client-Version": String(state.context.client.clientVersion)
    },
    body: {
      context: state.context,
      continuation: continuation || undefined,
      browseId: browseId || undefined
    },
    credential: true,
    sign: true
  });
}

function ytResult(response, category, state, page) {

  var items = ytRows(ytFeedItems(response), category, state);
  var cursor = ytNextFromResponse(response);
  var key = category || "all";
  state.cursors = state.cursors || {};
  state.cursorPages = state.cursorPages || {};
  state.cursors[key] = cursor;
  state.cursorPages[key] = page + 1;
  return {
    items: items,
    page: page,
    hasMore: !!cursor,
    count: items.length
  };
}

function* ytCatalog(input, state) {
  var category = String(input.category || "");
  var page = Math.max(1, Number(input.page) || 1);
  if (page > 15) throw new Error("YouTube 信息流最多支持连续加载 15 页，请刷新后继续");
  var force = input.force === true;
  yield* ytBootstrap(state, force);

  if (category && !ytCategoryName(category)) {
    throw new Error("YouTube 分类无效");
  }
  if (category && !state.categoryTokens[category]) {
    throw ytFailure("youtube_category");
  }
  var key = category || "all";
  if (page === 1 && !category) {
    var rootCursor = state.rootCursor || "";
    state.cursors = state.cursors || {};
    state.cursorPages = state.cursorPages || {};
    state.cursors[key] = rootCursor;
    state.cursorPages[key] = 2;
    return {
      items: state.rootItems.slice(),
      page: 1,
      hasMore: !!rootCursor,
      count: state.rootItems.length
    };
  }

  var cursor = "";
  if (state.cursorPages && state.cursorPages[key] === page) {
    cursor = state.cursors && state.cursors[key] || "";
  } else if (category) {
    cursor = state.categoryTokens[category];
    for (var categoryPage = 1; categoryPage < page; categoryPage++) {
      if (!cursor) return { items: [], page: page, hasMore: false, count: 0 };
      var categoryResponse = yield* ytBrowse(state, cursor);
      cursor = ytNextFromResponse(categoryResponse);
    }
  } else {
    cursor = state.rootCursor || "";
    for (var rootPage = 2; rootPage < page; rootPage++) {
      if (!cursor) return { items: [], page: page, hasMore: false, count: 0 };
      var rootResponse = yield* ytBrowse(state, cursor);
      cursor = ytNextFromResponse(rootResponse);
    }
  }

  if (!cursor) return { items: [], page: page, hasMore: false, count: 0 };
  var response = yield* ytBrowse(state, cursor);
  if (response.responseContext &&
      response.responseContext.mainAppWebResponseContext &&
      response.responseContext.mainAppWebResponseContext.loggedOut === true) {
    throw ytFailure("youtube_context");
  }
  return ytResult(response, category, state, page);
}

var YT_ANDROID_USER_AGENT = "com.google.android.youtube/20.02.35 (Linux; U; Android 14) gzip";

function ytMediaPlan(player, input, userAgent) {
  var streams = player.streamingData || {};
  var hls = String(streams.hlsManifestUrl || "");
  if (hls.indexOf("https://") === 0) {
    return {
      url: hls,
      source: "youtube",
      quality: 0,
      qualities: [],
      headers: { "Referer": "https://www.youtube.com/", "User-Agent": userAgent }
    };
  }

  var formats = array(streams.formats).map(function (row) {
    var mime = String(row && row.mimeType || "");
    return {
      url: String(row && row.url || ""),
      height: Number(row && row.height) ||
        Number(String(row && row.qualityLabel || "").replace(/[^\d]/g, "")) || 0,
      mime: mime,
      headers: { "Referer": "https://www.youtube.com/", "User-Agent": userAgent }
    };
  }).filter(function (row) {
    return /^https:\/\//.test(row.url) && row.mime.indexOf("video/") === 0;
  });
  if (formats.length) {
    var selected = select(formats, Number(input.quality) || 0);
    selected.source = "youtube";
    selected.headers = { "Referer": "https://www.youtube.com/", "User-Agent": userAgent };
    return selected;
  }

  return null;
}

var YT_SAFARI_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Safari/605.1.15,gzip(gfe)";

function ytPlayerFailure(player) {
  var status = player && player.playabilityStatus || {};
  var reason = String(status.reason || "").toLowerCase();
  if (/bot|机器人/.test(reason)) return "youtube_bot";
  if (status.status === "LOGIN_REQUIRED") return "youtube_login";
  return "youtube_player";
}

function ytExpiringPlan(player, input, userAgent) {
  if (!player || player.playabilityStatus && player.playabilityStatus.status !== "OK") return null;
  var plan = ytMediaPlan(player, input, userAgent);
  if (!plan) return null;
  var ttl = Number(player.streamingData && player.streamingData.expiresInSeconds);
  if (isFinite(ttl) && ttl > 0) {
    plan.expiresAt = Date.now() + Math.min(ttl, 21600) * 1000;
    array(plan.variants).forEach(function (variant) { variant.expiresAt = plan.expiresAt; });
  }
  return plan;
}

function* ytAndroidPlayer(videoId) {
  return yield* ytJson("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": YT_ANDROID_USER_AGENT },
    body: JSON.stringify({
      context: { client: {
        clientName: "ANDROID", clientVersion: "20.02.35",
        osName: "Android", osVersion: "14", hl: "zh-CN", gl: "US"
      } },
      videoId: videoId, contentCheckOk: true, racyCheckOk: true
    })
  });
}

function* ytSafariPlayer(videoId, input) {
  var html = yield* ytHttp("https://www.youtube.com/watch?v=" + encodeURIComponent(videoId), {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Referer": "https://www.youtube.com/", "User-Agent": YT_SAFARI_USER_AGENT
    },
    credential: true
  });
  var player = ytAssignment(html, /ytInitialPlayerResponse(?:["\']\])?\s*=\s*/);
  var plan = ytExpiringPlan(player, input, YT_SAFARI_USER_AGENT);
  if (plan) return { plan: plan };
  var context = ytAssignment(html, /INNERTUBE_CONTEXT"?\s*[:=]\s*/);
  var stamp = /"STS"\s*:\s*(\d+)/.exec(html);
  if (!context || !context.client || !context.client.clientVersion || !stamp) {
    return { code: ytPlayerFailure(player) };
  }
  context.client.clientName = "WEB";
  context.client.userAgent = YT_SAFARI_USER_AGENT;
  var headers = {
    "Content-Type": "application/json", "User-Agent": YT_SAFARI_USER_AGENT,
    "Referer": "https://www.youtube.com/", "X-Origin": "https://www.youtube.com",
    "X-YouTube-Client-Name": "1", "X-YouTube-Client-Version": String(context.client.clientVersion)
  };
  if (context.client.visitorData) headers["X-Goog-Visitor-Id"] = String(context.client.visitorData);
  player = yield* ytJson("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST", headers: headers, credential: true, sign: true,
    body: JSON.stringify({
      context: context, videoId: videoId, contentCheckOk: true, racyCheckOk: true,
      playbackContext: { contentPlaybackContext: {
        html5Preference: "HTML5_PREF_WANTS", signatureTimestamp: Number(stamp[1])
      } }
    })
  });
  return { plan: ytExpiringPlan(player, input, YT_SAFARI_USER_AGENT), code: ytPlayerFailure(player) };
}

function* ytResolve(input) {
  var videoId = String((input.drama || {}).sourceId || "");
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error("YouTube 视频标识无效");
  var code = "youtube_player";
  var candidates = input.force === true ? ["safari", "android"] : ["android", "safari"];
  for (var index = 0; index < candidates.length; index++) {
    try {
      if (candidates[index] === "android") {
        var player = yield* ytAndroidPlayer(videoId);
        var plan = ytExpiringPlan(player, input, YT_ANDROID_USER_AGENT);
        if (plan) return plan;
        var failure = ytPlayerFailure(player);
        if (failure !== "youtube_player") code = failure;
      } else {
        var result = yield* ytSafariPlayer(videoId, input);
        if (result.plan) return result.plan;
        if (result.code && result.code !== "youtube_player") code = result.code;
      }
    } catch (error) {
      if (error.httpStatus === 429) throw error;
    }
  }
  throw ytFailure(code);
}

function* sourceExecute(action, input, state) {
  state = state || {};
  input = input || {};
  if (action === "categories") {
    yield* ytBootstrap(state, input.force === true);
    return {
      items: YT_CATEGORIES.filter(function (category) {
        return !!state.categoryTokens[category.id];
      }).map(function (category) {
        return { id: category.id, name: category.name };
      })
    };
  }
  if (action === "catalog" || action === "check") {
    return yield* ytCatalog(input, state);
  }
  if (action === "detail" || action === "metadata") {
    var drama = input.drama || {};
    var videoId = String(drama.sourceId || "");
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      throw new Error("YouTube 视频标识无效");
    }
    return single(drama, {
      id: "youtube:" + videoId,
      title: "播放",
      currentEpisode: 1
    });
  }
  if (action === "resolve") return yield* ytResolve(input);
  throw new Error("YouTube 订阅不支持此操作");
}
