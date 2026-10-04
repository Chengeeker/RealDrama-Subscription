"use strict";

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

function ytFindRichGrid(root) {
  if (!root || typeof root !== "object") return null;
  if (root.richGridRenderer && Array.isArray(root.richGridRenderer.contents)) {
    return root.richGridRenderer;
  }
  var values = Array.isArray(root) ? root : Object.keys(root).map(function (key) {
    return root[key];
  });
  for (var i = 0; i < values.length; i++) {
    var found = ytFindRichGrid(values[i]);
    if (found) return found;
  }
  return null;
}

function ytFeedItems(response) {
  var result = [];
  array(response && response.onResponseReceivedActions).forEach(function (action) {
    var command = action.appendContinuationItemsAction ||
      action.reloadContinuationItemsCommand;
    array(command && command.continuationItems).forEach(function (row) {
      if (row && row.richItemRenderer) result.push(row.richItemRenderer);
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
  array(response && response.onResponseReceivedActions).some(function (action) {
    var command = action.appendContinuationItemsAction ||
      action.reloadContinuationItemsCommand;
    token = ytNextFromItems(command && command.continuationItems);
    return !!token;
  });
  return token;
}

function ytCard(item, category, state) {
  var renderer = item && item.richItemRenderer || item;
  var lock = renderer && renderer.content && renderer.content.lockupViewModel;
  if (!lock) return null;
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

function ytRows(items, category, state) {
  var seen = {};
  return array(items).map(function (item) {
    return ytCard(item, category, state);
  }).filter(function (row) {
    if (!row || seen[row.sourceId]) return false;
    seen[row.sourceId] = true;
    return true;
  });
}

function ytCollectCategoryTokens(root, state) {
  if (!root || typeof root !== "object") return;
  if (root.chipCloudChipRenderer) {
    var chip = root.chipCloudChipRenderer;
    var category = ytCategory(ytText(chip.text));
    var command = chip.navigationEndpoint &&
      chip.navigationEndpoint.continuationCommand;
    if (category && command && typeof command.token === "string") {
      state.categoryTokens[category.id] = command.token;
    }
  }
  var values = Array.isArray(root) ? root : Object.keys(root).map(function (key) {
    return root[key];
  });
  values.forEach(function (value) {
    ytCollectCategoryTokens(value, state);
  });
}

function* ytBootstrap(state, force) {
  var now = Date.now();
  if (!force && state.bootstrapAt &&
      now - Number(state.bootstrapAt) < 300000 &&
      state.context && state.rootItems) {
    return state;
  }

  var html = yield* http("https://www.youtube.com/", {
    headers: {
      "Accept": "text/html,application/xhtml+xml"
    },
    credential: true
  });
  var context = assignment(html, /INNERTUBE_CONTEXT"?\s*[:=]\s*/);
  var initial = assignment(html, /ytInitialData\s*=\s*/);
  if (!context || !context.client || !context.client.clientName ||
      !context.client.clientVersion || !initial) {
    throw new Error("YouTube 首页未提供可用的信息流上下文");
  }

  var grid = ytFindRichGrid(initial);
  if (!grid) throw new Error("YouTube 首页信息流格式已变化");
  state.context = context;
  state.categoryTokens = {};
  ytCollectCategoryTokens(initial, state);
  state.rootItems = ytRows(grid.contents, "", state);
  state.rootCursor = ytNextFromItems(grid.contents);
  state.bootstrapAt = now;
  state.cursors = {};
  state.cursorPages = {};
  if (!state.rootItems.length) {
    throw new Error("YouTube 首页没有返回登录态信息流，请检查账号 Cookie");
  }
  return state;
}

function* ytBrowse(state, continuation) {
  return yield* json("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
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
      continuation: continuation
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
    throw new Error("YouTube 当前账号没有该分类入口，请刷新分类列表");
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
    throw new Error("YouTube 返回未登录信息流，请检查账号 Cookie");
  }
  return ytResult(response, category, state, page);
}

function* ytResolve(input) {
  var drama = input.drama || {};
  var videoId = String(drama.sourceId || "");
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new Error("YouTube 视频标识无效");
  }
  var html = yield* http(
    "https://www.youtube.com/watch?v=" + encodeURIComponent(videoId),
    {
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "Referer": "https://www.youtube.com/"
      },
      credential: true
    }
  );
  var player = assignment(html, /ytInitialPlayerResponse\s*=\s*/);
  if (!player) throw new Error("YouTube 播放信息暂不可用");
  var details = player.videoDetails || {};
  var streams = player.streamingData || {};
  var hls = String(streams.hlsManifestUrl || "");
  if (hls.indexOf("https://") === 0) {
    return {
      url: hls,
      source: "youtube",
      quality: 0,
      qualities: [],
      headers: { "Referer": "https://www.youtube.com/" }
    };
  }

  var formats = array(streams.formats).map(function (row) {
    var mime = String(row && row.mimeType || "");
    return {
      url: String(row && row.url || ""),
      height: Number(row && row.height) ||
        Number(String(row && row.qualityLabel || "").replace(/[^\d]/g, "")) || 0,
      mime: mime
    };
  }).filter(function (row) {
    return /^https:\/\//.test(row.url) && row.mime.indexOf("video/") === 0;
  });
  if (formats.length) {
    var selected = select(formats, Number(input.quality) || 0);
    selected.source = "youtube";
    selected.headers = { "Referer": "https://www.youtube.com/" };
    return selected;
  }

  if (details.isLive === true || details.isLiveContent === true) {
    throw new Error("YouTube 直播没有提供 HLS 播放地址");
  }
  if (streams.serverAbrStreamingUrl) {
    throw new Error("该 YouTube 视频只提供浏览器 UMP 流，当前播放器无法直接解析");
  }
  throw new Error("YouTube 没有提供可直接播放的视频地址");
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