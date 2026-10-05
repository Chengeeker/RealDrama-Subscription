from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parent
PROGRAMS = ROOT / "programs"
PACKAGES = ROOT / "sources"

def source(identifier, name, programs, domains, capabilities=None, **extra):
    return dict(id=identifier, name=name, programs=programs, domains=domains,
                capabilities=capabilities or ["catalog", "categories", "detail", "resolve"], **extra)

BASIC = ["catalog", "categories", "detail", "resolve"]
DOUYIN_DOMAINS = ["www.douyin.com", "live.douyin.com"]
DOUYIN_DANMAKU_DOMAINS = DOUYIN_DOMAINS + ["www-hj.douyin.com"]
SOURCES = [
    source("hongguo", "红果", ["hongguo", "hongguo-web"],
           ["api5-normal-sinfonlineb.fqnovel.com", "hongguoduanju.com", "djapi.999888456.xyz"],
           BASIC + ["search", "suggestions", "rankings", "download", "catalogTools"],
           description="真人剧、漫剧、AI 剧；App、网页及备用公开播放接口"),
    source("douyin", "抖音短视频", ["douyin"], DOUYIN_DANMAKU_DOMAINS,
           BASIC + ["creator", "comments", "danmaku"], family="douyin", kind="video", version="0.1.1",
           credentialGroup="douyin", credentialRequired=True, credentialDomains=DOUYIN_DANMAKU_DOMAINS),
    source("douyin-live", "抖音直播", ["douyin"], DOUYIN_DOMAINS,
           BASIC + ["creator", "live"], family="douyin", kind="live", version="0.1.1",
           credentialGroup="douyin", credentialRequired=True, credentialDomains=DOUYIN_DOMAINS),
    source("douyin-series", "抖音短剧", ["douyin"], DOUYIN_DOMAINS,
           BASIC + ["creator", "comments"], family="douyin", kind="drama", version="0.1.1",
           credentialGroup="douyin", credentialRequired=True, credentialDomains=DOUYIN_DOMAINS),
    source("douyin-theater", "抖音放映厅", ["douyin"], DOUYIN_DOMAINS,
           BASIC + ["creator", "comments"], family="douyin", kind="video", version="0.1.1",
           credentialGroup="douyin", credentialRequired=True, credentialDomains=DOUYIN_DOMAINS),
    source("bilibili", "Bilibili 视频", ["bilibili"], ["api.bilibili.com"],
           BASIC + ["creator", "comments", "account", "search", "danmaku"], kind="video", version="0.2.1",
           credentialGroup="bilibili", credentialDomains=["api.bilibili.com"]),
    source("bilibili-live", "Bilibili 直播", ["bilibili-live"],
           ["api.bilibili.com", "api.live.bilibili.com", "live.bilibili.com"],
           BASIC + ["live"], kind="live", version="0.1.2", license="MIT",
           credentialGroup="bilibili", credentialRequired=False,
           credentialDomains=["api.live.bilibili.com"],
           description="公开直播推荐、关注和分区；关注列表可选 Cookie 登录"),
    source("tiktok", "TikTok", ["tiktok"], ["www.tiktok.com"],
           BASIC, kind="video", version="0.1.4", credentialGroup="tiktok",
           credentialRequired=True, credentialDomains=["www.tiktok.com"],
           description="Cookie 登录；推荐和关注短视频信息流"),
    source("youtube", "YouTube", ["youtube"], ["www.youtube.com"],
           BASIC + ["live"], kind="video", version="0.1.4", credentialGroup="youtube",
           credentialRequired=True, credentialDomains=["www.youtube.com"],
           description="登录态首页、游戏、直播、音乐和播客信息流；视频与直播播放解析"),
    source("hanxiaoquan", "韩小圈", ["web-cms"], ["www.jennyhow.com"], BASIC + ["search", "download"],
           config=dict(id="hanxiaoquan", base="https://www.jennyhow.com", categories=[
               dict(id=str(n), name=name) for n, name in [(1,"韩剧"),(2,"电影"),(3,"综艺"),(4,"动漫")]])),
    source("guipian", "鬼片", ["web-cms"], ["guipianwu.com"], BASIC + ["search", "download"],
           config=dict(id="guipian", base="https://guipianwu.com", categories=[
               dict(id=str(n), name=name) for n, name in [(3,"恐怖片"),(6,"大陆鬼片"),(7,"日韩鬼片"),(8,"林正英鬼片"),(9,"港台鬼片"),(10,"泰国鬼片"),(11,"欧美鬼片"),(31,"剧情片"),(12,"国产剧"),(13,"美剧"),(14,"韩剧"),(15,"日剧"),(16,"泰剧"),(17,"港台剧"),(18,"其他剧"),(23,"日韩动漫"),(24,"国产动漫"),(25,"欧美动漫"),(26,"港台动漫")]])),
    source("sorani", "青空", ["sorani"], ["api.sorani.cc"], BASIC + ["search", "download"]),
    source("huangju", "剧果", ["huangju"], ["api.huangju.net"], BASIC + ["search", "download"]),
    source("dsd", "帝果", ["dsd"], ["www.dsd.com.se"], BASIC + ["search", "download"]),
    source("crj91", "91成人短剧", ["crj91"], ["91crdj.com"], BASIC + ["search", "download"], version="0.1.1"),
    source("stripchat", "Stripchat 成人直播", ["stripchat"], ["zh.stripchat.global", "zh.stripol.com", "zh.stripchat.com",
           "edge-hls.doppiocdn.org", "edge-hls.doppiocdn.media", "edge-hls.growcdnssedge.com", "edge-hls.sacfedge.com"],
           BASIC + ["search", "playlistRewrite"], kind="live", version="0.1.1"),
    source("huangguoai", "黄果 AI", ["huangguo"], ["huangguoai.com"], BASIC + ["download"], family="huangguo"),
    source("huangguo-video", "黄果视频", ["huangguo"], ["huangguo.video"], BASIC + ["download"], family="huangguo", browser=True),
    source("cloudfront", "黄果旧版", ["cloudfront"], ["d2pypzndaqisk.cloudfront.net", "dr6skssi3nxbk.cloudfront.net",
           "d18ka9rqpfd3lo.cloudfront.net", "d37n0wjehmw08f.cloudfront.net", "sjljsla.lkkwip.cn"],
           BASIC + ["download"], family="huangguo"),
]

def main():
    PACKAGES.mkdir(exist_ok=True)
    sdk = (PROGRAMS / "sdk.js").read_text(encoding="utf-8")
    entries = []
    packages = {}
    for definition in SOURCES:
        record = dict(definition)
        names = record.pop("programs")
        config = record.pop("config", None)
        version = record.pop("version", "0.1.0")
        program = sdk + "\n"
        if config:
            program += "var sourceConfig=" + json.dumps(config, ensure_ascii=False) + ";\n"
        program += "\n".join((PROGRAMS / (name + ".js")).read_text(encoding="utf-8") for name in names)
        package = dict(schema=1, api=1, status="draft", engine="javascript-generator-v1", version=version,
                       credentialDomains=[], description=record.get("description", "可独立更新的本地站源程序"), **{k:v for k,v in record.items() if k not in ("description","credentialDomains")})
        package["credentialDomains"] = record.get("credentialDomains", [])
        package["program"] = program
        content = (json.dumps(package, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        (PACKAGES / (record["id"] + ".json")).write_bytes(content)
        packages[record["id"]] = package
        metadata = {k:v for k,v in package.items() if k != "program"}
        entries.append(dict(metadata, url="sources/"+record["id"]+".json", sha256=hashlib.sha256(content).hexdigest()))
    groups = [
        ("douyin", "抖音", ["douyin", "douyin-live", "douyin-series", "douyin-theater"]),
        ("bilibili", "Bilibili", ["bilibili", "bilibili-live"]),
        ("huangguo", "黄果", ["huangguoai", "huangguo-video", "cloudfront"]),
    ]
    for identifier, name, members in groups:
        base = dict(packages[members[0]])
        bundle_version = {"douyin": "0.2.1", "bilibili": "0.3.2"}.get(identifier, "0.2.0")
        base.update(id=identifier, name=name, api=2, version=bundle_version,
                    description="组合订阅，子项独立开关；需要支持组合订阅的客户端",
                    domains=sorted({host for key in members for host in packages[key]["domains"]}),
                    capabilities=sorted({cap for key in members for cap in packages[key]["capabilities"]}))
        children = []
        for key in members:
            child = dict(packages[key])
            for field in ["schema", "api", "engine", "status", "version"]:
                child.pop(field, None)
            if child["program"] == base["program"]:
                child.pop("program")
            children.append(child)
        base["children"] = children
        content = (json.dumps(base, ensure_ascii=False, indent=2)+"\n").encode("utf-8")
        (PACKAGES / (identifier+".json")).write_bytes(content)
        metadata = {k:v for k,v in base.items() if k != "program"}
        metadata["children"] = [{k:v for k,v in child.items() if k != "program"} for child in children]
        grouped = dict(metadata, url="sources/"+identifier+".json", sha256=hashlib.sha256(content).hexdigest())
        position = next(i for i, entry in enumerate(entries) if entry["id"] in members)
        entries = [entry for entry in entries if entry["id"] not in members]
        entries.insert(position, grouped)
    catalog = dict(schema=1, name="RealDrama 站源迁移开发快照", api=1, status="draft", sources=entries)
    (ROOT / "subscription.json").write_bytes((json.dumps(catalog, ensure_ascii=False, indent=2)+"\n").encode("utf-8"))
    print("Generated", len(entries), "subscriptions")

if __name__ == "__main__":
    main()
