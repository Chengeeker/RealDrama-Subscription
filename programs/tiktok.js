var TT_BASE = "https://www.tikwm.com";
var TT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
function ttText(value, limit) { return typeof value === "string" ? value.slice(0, limit || 4000) : ""; }
function ttId(row) { var id = String(first(row, ["video_id", "id"])); return /^\d{10,25}$/.test(id) ? id : ""; }
function ttUrl(value) {
    if (typeof value !== "string") return "";
    if (/^\/video\/media\//.test(value)) value = TT_BASE + value;
    return /^https:\/\/(?:www\.tikwm\.com|[a-z0-9-]+\.(?:tiktokcdn(?:-us|-eu)?\.com|tiktokv\.com|byteoversea\.com))\//i.test(value) ? value : "";
}
function ttVideo(row) { return row && ttId(row) && !array(row.images).length && Number(row.duration) > 0 && ttUrl(row.play); }
function ttDrama(row) {
    var id = ttId(row), author = row.author || {};
    return {id: "tiktok:" + id, source: "tiktok", sourceId: id,
        title: ttText(row.title) || ttText(author.nickname, 100) || "TikTok 视频",
        description: ttText(row.title), cover: url(row.cover), episodes: 1, category: "公开视频", tags: [],
        creatorId: ttText(author.unique_id, 100), creatorName: ttText(author.nickname, 100),
        creatorAvatar: url(author.avatar), heat: String(Number(row.digg_count) || 0), views: String(Number(row.play_count) || 0)};
}
function* ttRequest(route, params) {
    var data;
    for (var attempt = 0; attempt < 2; attempt++) {
        try {
            data = yield* json(TT_BASE + "/api/" + route, {
                method: "POST", body: query(params),
                headers: {"User-Agent": TT_UA, "Referer": TT_BASE + "/", "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"}
            });
            break;
        } catch (error) {
            if (attempt || !(error.httpStatus >= 500 && error.httpStatus <= 599)) throw error;
        }
    }
    if (data.code !== 0 || data.data == null) throw new Error("TikTok 公开内容服务暂不可用");
    return data.data;
}
function ttRemember(state, row) {
    state.rows = state.rows || {};
    var id = ttId(row);
    state.rows[id] = {at: Date.now(), drama: ttDrama(row), play: ttUrl(row.play), wmplay: ttUrl(row.wmplay)};
    var ids = Object.keys(state.rows);
    while (ids.length > 48) delete state.rows[ids.shift()];
    return state.rows[id];
}
function* ttDetail(id, state, force) {
    if (!/^\d{10,25}$/.test(id)) throw new Error("TikTok 视频标识无效");
    var cached = state.rows && state.rows[id];
    if (!force && cached && Date.now() - cached.at < 30000) return cached;
    var row = yield* ttRequest("", {url: id});
    if (ttId(row) !== id || !ttVideo(row)) throw new Error("TikTok 视频不可用或不是视频内容");
    return ttRemember(state, row);
}
function ttQueryId(value) {
    if (/^\d{10,25}$/.test(value)) return value;
    var match = /^https:\/\/(?:www\.|m\.)?tiktok\.com\/@[A-Za-z0-9_.-]+\/video\/(\d{10,25})(?:[?#].*)?$/.exec(value);
    return match ? match[1] : "";
}
function* ttCatalog(input, state, search) {
    var page = Math.max(1, Number(input.page) || 1), keyword = ttText(input.query, 200).trim();
    if (search && !keyword) return empty();
    var direct = search ? ttQueryId(keyword) : "";
    if (direct) {
        if (page > 1) return empty();
        var video = yield* ttDetail(direct, state, input.force === true);
        return {items: [video.drama], page: 1, hasMore: false};
    }
    var key = search ? "search:" + keyword : "popular";
    state.feeds = state.feeds || {};
    var feed = state.feeds[key];
    if (search && page > 1 && !feed) throw new Error("TikTok 搜索分页已过期，请重新搜索");
    if (page === 1 || input.force === true || !feed) feed = {cursor: "0", seen: []};
    var items = [], more = true;
    for (var attempt = 0; attempt < 2 && !items.length && more; attempt++) {
        var previous = feed.cursor;
        var data = yield* ttRequest(search ? "feed/search/" : "feed/list/", search ?
            {keywords: keyword, count: 10, cursor: previous} : {region: "US", count: 20});
        var rows = search ? data.videos : data;
        if (!Array.isArray(rows) || rows.length > 100) throw new Error("TikTok 列表格式无效");
        rows.forEach(function(row) {
            if (!ttVideo(row) || row.is_ad || feed.seen.indexOf(ttId(row)) !== -1) return;
            var saved = ttRemember(state, row);
            feed.seen.push(saved.drama.sourceId); items.push(saved.drama);
        });
        if (search) {
            feed.cursor = String(data.cursor == null ? previous : data.cursor);
            more = (data.hasMore === true || data.hasMore === 1) && /^\d{1,30}$/.test(feed.cursor) && feed.cursor !== previous;
        } else more = rows.length > 0;
    }
    feed.seen = feed.seen.slice(-600); state.feeds[key] = feed;
    var keys = Object.keys(state.feeds);
    while (keys.length > 4) delete state.feeds[keys.shift()];
    return {items: items, page: page, hasMore: more && items.length > 0, fresh: true};
}
function* sourceExecute(action, input, state) {
    if (action === "categories") return {items: [{id: "popular", name: "公开热门"}]};
    if (action === "catalog" || action === "check" || action === "search") return yield* ttCatalog(input, state, action === "search");
    var drama = input.drama || {}, id = String(drama.sourceId || "");
    if (action === "detail" || action === "metadata") {
        if (!/^\d{10,25}$/.test(id)) throw new Error("TikTok 视频标识无效");
        if (input.force === true) return single((yield* ttDetail(id, state, true)).drama);
        return single(state.rows && state.rows[id] ? state.rows[id].drama : drama);
    }
    if (action === "resolve") {
        var cached = state.rows && state.rows[id], age = cached ? Date.now() - cached.at : -1;
        var row = input.force !== true && cached && cached.play && age >= 0 && age < 120000 ? cached : yield* ttDetail(id, state, true);
        var choices = [row.play, row.wmplay].filter(function(value, index, all) { return value && all.indexOf(value) === index; });
        row.play = ""; row.wmplay = "";
        return select(choices.map(function(address) { return {url: address, height: 0, headers: {"User-Agent": TT_UA, "Referer": TT_BASE + "/"}}; }), 0);
    }
    throw new Error("TikTok 订阅不支持此操作");
}
