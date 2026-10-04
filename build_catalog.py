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
SOURCES = [
    source("hongguo", "红果", ["hongguo", "hongguo-web"],
           ["api5-normal-sinfonlineb.fqnovel.com", "hongguoduanju.com", "djapi.999888456.xyz"],
           BASIC + ["search", "suggestions", "rankings", "download", "catalogTools"],
           description="真人剧、漫剧、AI 剧；App、网页及备用公开播放接口"),
    source("douyin", "抖音短视频", ["douyin"], DOUYIN_DOMAINS,
           BASIC + ["creator", "comments"], family="douyin", kind="video",
           credentialGroup="douyin", credentialRequired=True, credentialDomains=DOUYIN_DOMAINS),
    source("douyin-live", "抖音直播", ["douyin"], DOUYIN_DOMAINS,
           BASIC + ["creator", "live"], family="douyin", kind="live",
           credentialGroup="douyin", credentialRequired=True, credentialDomains=DOUYIN_DOMAINS),
    source("douyin-series", "抖音短剧", ["douyin"], DOUYIN_DOMAINS,
           BASIC + ["creator", "comments"], family="douyin", kind="drama",
           credentialGroup="douyin", credentialRequired=True, credentialDomains=DOUYIN_DOMAINS),
    source("douyin-theater", "抖音放映厅", ["douyin"], DOUYIN_DOMAINS,
           BASIC + ["creator", "comments"], family="douyin", kind="video",
           credentialGroup="douyin", credentialRequired=True, credentialDomains=DOUYIN_DOMAINS),
    source("bilibili", "哔哩哔哩", ["bilibili"], ["api.bilibili.com"],
           BASIC + ["creator", "comments", "account", "search"], kind="video",
           credentialGroup="bilibili", credentialDomains=["api.bilibili.com"]),
    source("hanxiaoquan", "韩小圈", ["web-cms"], ["www.jennyhow.com"], BASIC + ["search", "download"],
           config=dict(id="hanxiaoquan", base="https://www.jennyhow.com", categories=[
               dict(id=str(n), name=name) for n, name in [(1,"韩剧"),(2,"电影"),(3,"综艺"),(4,"动漫")]])),
    source("guipian", "鬼片", ["web-cms"], ["guipianwu.com"], BASIC + ["search", "download"],
           config=dict(id="guipian", base="https://guipianwu.com", categories=[
               dict(id=str(n), name=name) for n, name in [(3,"恐怖片"),(6,"大陆鬼片"),(7,"日韩鬼片"),(8,"林正英鬼片"),(9,"港台鬼片"),(10,"泰国鬼片"),(11,"欧美鬼片"),(31,"剧情片"),(12,"国产剧"),(13,"美剧"),(14,"韩剧"),(15,"日剧"),(16,"泰剧"),(17,"港台剧"),(18,"其他剧"),(23,"日韩动漫"),(24,"国产动漫"),(25,"欧美动漫"),(26,"港台动漫")]])),
    source("sorani", "青空", ["sorani"], ["api.sorani.cc"], BASIC + ["search", "download"]),
    source("huangju", "剧果", ["huangju"], ["api.huangju.net"], BASIC + ["search", "download"]),
    source("dsd", "帝果", ["dsd"], ["www.dsd.com.se"], BASIC + ["search", "download"]),
    source("crj91", "91成人短剧", ["crj91"], ["91crdj.com"], BASIC + ["search", "download"]),
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
        metadata = {k:v for k,v in package.items() if k != "program"}
        entries.append(dict(metadata, url="sources/"+record["id"]+".json", sha256=hashlib.sha256(content).hexdigest()))
    catalog = dict(schema=1, name="RealDrama 站源迁移开发快照", api=1, status="draft", sources=entries)
    (ROOT / "subscription.json").write_bytes((json.dumps(catalog, ensure_ascii=False, indent=2)+"\n").encode("utf-8"))
    print("Generated", len(entries), "source packages")

if __name__ == "__main__":
    main()
