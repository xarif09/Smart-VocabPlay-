"""Load the vocabulary: src/App.jsx W(...) rows + src/vocabExtra.js EXTRA_WORDS + current photo mapping."""
import json, re, os, urllib.parse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def slug(s):
    s = s.lower().replace("'", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "x"


def key(cat, word):
    return f"{cat}|{word}"


def out_name(cat, word):
    return f"{cat}__{slug(word)}.jpg"


def load_words():
    """Return list of dicts {cat, word, meaning, emoji, key} in app order, deduplicated by key."""
    out, seen = [], set()
    src = open(os.path.join(ROOT, "src/App.jsx"), encoding="utf-8").read()
    for m in re.finditer(r'\bW\(\s*"([a-z]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"', src):
        cat, word, meaning, emoji = m.groups()
        k = key(cat, word)
        if k not in seen:
            seen.add(k); out.append(dict(cat=cat, word=word, meaning=meaning, emoji=emoji, key=k))
    ex = os.path.join(ROOT, "src/vocabExtra.js")
    if os.path.exists(ex):
        s = open(ex, encoding="utf-8").read()
        for m in re.finditer(r'\[\s*"([a-z]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"', s):
            cat, word, meaning, emoji = m.groups()
            k = key(cat, word)
            if k not in seen:
                seen.add(k); out.append(dict(cat=cat, word=word, meaning=meaning, emoji=emoji, key=k, extra=True))
    return out


def load_current_mapping():
    """key -> {title, file, commons_file (File:...) or None}"""
    s = open(os.path.join(ROOT, "src/images.js"), encoding="utf-8").read()
    T = {}
    for m in re.finditer(r'add\("(\w+)",\s*\[([\s\S]*?)\]\);', s):
        cat, body = m.groups()
        for pm in re.finditer(r'\["([^"\]]+)","([^"]+)"\]', body):
            T[key(cat, pm.group(1))] = pm.group(2)
    man = json.load(open(os.path.join(ROOT, "src/imgManifest.json"), encoding="utf-8"))
    try:
        cred = json.load(open(os.path.join(ROOT, "public/img/credits.json"), encoding="utf-8"))
    except Exception:
        cred = {}
    res = {}
    for k, title in T.items():
        f = man.get(title)
        c = cred.get(title, {})
        cf = None
        srcu = c.get("source", "")
        mm = re.search(r"/wiki/(File:[^?#]+)", urllib.parse.unquote(srcu))
        if mm:
            cf = urllib.parse.unquote(mm.group(1).split("?")[0]).replace("_", " ")
        res[k] = dict(title=title, file=f, commons_file=cf)
    return res


if __name__ == "__main__":
    w = load_words(); cm = load_current_mapping()
    print(len(w), "words;", sum(1 for x in w if x["key"] in cm), "with current photo")
