"""Shared helpers: paths, polite HTTP client with disk cache + throttle, licence parsing."""
import hashlib, html, json, os, re, sys, threading, time
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CACHE = os.environ.get("IMG_CACHE", os.path.join(HERE, ".cache"))
UA = "SmartVocabPlayBot/1.0 (https://github.com/xarif09/Smart-VocabPlay-; educational)"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
COMMONS_REST_SEARCH = "https://commons.wikimedia.org/w/rest.php/v1/search/page"
WIKI_API = "https://en.wikipedia.org/w/api.php"
SMALL_W = 330    # thumbnail width used for CLIP ranking / detection (standard Wikimedia bucket)
LARGE_W = 1280   # width used for the final crop source (standard bucket)

for d in ("api", "thumbs", "large", "cands"):
    os.makedirs(os.path.join(CACHE, d), exist_ok=True)

_sess = requests.Session()
_sess.headers.update({"User-Agent": UA, "Accept-Encoding": "gzip"})
_api_lock = threading.Lock()
_api_last = [0.0]
_img_lock = threading.Lock()
_img_last = [0.0]
API_INTERVAL = float(os.environ.get("API_INTERVAL", "1.0"))
IMG_INTERVAL = float(os.environ.get("IMG_INTERVAL", "0.5"))


def h(s):
    return hashlib.sha1(s.encode("utf-8")).hexdigest()


def _throttle(lock, last, interval):
    with lock:
        wait = last[0] + interval - time.time()
        if wait > 0: time.sleep(wait)
        last[0] = time.time()


def _get(url, params=None, lock=_api_lock, last=_api_last, interval=API_INTERVAL, stream=False, tries=8, redirects=True):
    delay = 5
    for i in range(tries):
        _throttle(lock, last, interval)
        try:
            r = _sess.get(url, params=params, timeout=60, stream=stream, allow_redirects=redirects)
        except requests.RequestException as e:
            time.sleep(delay); delay = min(delay * 2, 120); continue
        if r.status_code == 429 or r.status_code >= 500:
            ra = r.headers.get("Retry-After")
            print(f"    [{r.status_code}] retry-after={ra} backoff={delay} {url[:60]}", file=sys.stderr, flush=True)
            time.sleep(float(ra) if ra and ra.isdigit() else delay); delay = min(delay * 2, 120); continue
        return r
    return None


def api(url, params, cache_only=False):
    """Cached GET of a MediaWiki API query (json)."""
    p = dict(params)
    if "rest.php" not in url:
        p.setdefault("format", "json"); p.setdefault("formatversion", "2")
    k = h(url + "?" + json.dumps(p, sort_keys=True))
    f = os.path.join(CACHE, "api", k + ".json")
    if os.path.exists(f):
        return json.load(open(f, encoding="utf-8"))
    if cache_only:
        return None
    r = _get(url, p)
    if r is None or r.status_code != 200:
        return {}
    try:
        j = r.json()
    except Exception:
        return {}
    json.dump(j, open(f, "w", encoding="utf-8"))
    return j


def download(url, path):
    """Cached image download (throttled separately from API calls)."""
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return True
    if os.path.exists(path + ".fail"):
        return False
    r = _get(url, lock=_img_lock, last=_img_last, interval=IMG_INTERVAL, tries=6)
    if r is None or r.status_code != 200 or not r.headers.get("content-type", "").startswith("image"):
        open(path + ".fail", "w").write(str(r.status_code if r is not None else "none"))
        return False
    tmp = path + ".part"
    open(tmp, "wb").write(r.content)
    os.replace(tmp, path)
    return True


def fetch_thumb(title, width, path):
    """Download a scaled copy of a Commons file via MediaWiki's thumb.php entry point (identified UA, throttled,
    honours 429/Retry-After). Cached on disk; failures are remembered in <path>.fail."""
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return True
    if os.path.exists(path + ".fail"):
        return False
    name = title[5:] if title.startswith("File:") else title
    r = _get("https://commons.wikimedia.org/w/thumb.php", params={"f": name, "w": str(width)},
             lock=_img_lock, last=_img_last, interval=IMG_INTERVAL, tries=8, redirects=False)
    if r is not None and r.status_code in (301, 302, 303, 307) and r.headers.get("location"):
        r = _get(_upload(r.headers["location"]), lock=_img_lock, last=_img_last, interval=IMG_INTERVAL, tries=2)
    if r is None or r.status_code != 200 or not r.headers.get("content-type", "").startswith("image"):
        open(path + ".fail", "w").write(str(r.status_code if r is not None else "none"))
        return False
    tmp = path + ".part"
    open(tmp, "wb").write(r.content)
    os.replace(tmp, path)
    return True


def strip_html(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


FREE_RE = re.compile(r"^(cc0|cc[- ]zero|public domain|pd|pdm|no restrictions|cc[- ]by(-sa)?([- ]\d(\.\d)?)?)", re.I)


def licence_ok(short):
    s = (short or "").strip()
    if not s: return False
    if re.search(r"\b(nc|nd|non-commercial|noncommercial|fair use|non-free)\b", s, re.I): return False
    return bool(FREE_RE.match(s))


def _upload(u):
    u = (u or "").split("?")[0]
    return re.sub(r"^https://thumb\.wikimedia\.org/", "https://upload.wikimedia.org/", u)


def thumb_url(info, width):
    """Wikimedia thumbnail URL (served from upload.wikimedia.org) at a standard width, or the original if smaller."""
    tu = _upload(info.get("thumburl"))
    ow = info.get("width") or 0
    if ow and ow <= width:
        return _upload(info.get("url"))
    m = re.search(r"/(\d+)px-", tu)
    if not m:
        return _upload(info.get("url"))
    return tu.replace(f"/{m.group(1)}px-", f"/{width}px-", 1)


def safe_name(title):
    return h(title)
