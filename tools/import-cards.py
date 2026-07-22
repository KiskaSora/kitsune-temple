# -*- coding: utf-8 -*-
"""
Импорт карточек персонажей SillyTavern в данные сайта.

Кладёшь .png карточки в files/bots/ и запускаешь:

    python tools/import-cards.py

Скрипт сам:
  * достаёт из PNG встроенное описание персонажа (chunk `chara` / `ccv3`);
  * делает лёгкую превьюшку 600x800 в assets/img/bots/;
  * дописывает бота в data/bots.json.

Уже заполненные вручную поля НЕ трогает — дописывает только пустые.
Так что можно спокойно править описания на сайте и запускать импорт снова.

Ключи:
    --line pasta     в какую линейку класть новых ботов
    --nsfw           пометить новых ботов как 18+
    --force-cover    перерисовать превьюшки, даже если они уже есть
"""

import argparse
import base64
import json
import re
import struct
import sys
from datetime import date
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Нужен Pillow:  pip install pillow")

# чтобы русские имена не превращались в кракозябры в консоли Windows
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "files" / "bots"
COVERS = ROOT / "assets" / "img" / "bots"
DATA = ROOT / "data" / "bots.json"

COVER_SIZE = (600, 800)
COVER_QUALITY = 82

TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e',
    'ю': 'yu', 'я': 'ya',
}


def slug(text):
    """Имя персонажа → латинский id для ссылки вида #/bots/dzhef."""
    out = "".join(TRANSLIT.get(ch, ch) for ch in text.lower())
    out = re.sub(r"[^a-z0-9]+", "-", out).strip("-")
    return out or "bot"


def read_png_text(path):
    """Достаёт текстовые chunk'и PNG (tEXt и zTXt) как словарь."""
    raw = path.read_bytes()
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
        return {}
    out, pos = {}, 8
    while pos + 8 <= len(raw):
        (length,) = struct.unpack(">I", raw[pos:pos + 4])
        ctype = raw[pos + 4:pos + 8]
        body = raw[pos + 8:pos + 8 + length]
        pos += 12 + length          # длина + тип + данные + crc
        if ctype == b"IEND":
            break
        if ctype == b"tEXt" and b"\x00" in body:
            key, val = body.split(b"\x00", 1)
            out[key.decode("latin-1")] = val
        elif ctype == b"zTXt" and b"\x00" in body:
            import zlib
            key, rest = body.split(b"\x00", 1)
            try:
                out[key.decode("latin-1")] = zlib.decompress(rest[1:])
            except zlib.error:
                pass
    return out


def parse_card(path):
    """PNG карточки → словарь спецификации Character Card (V2/V3) или None."""
    chunks = read_png_text(path)
    for key in ("ccv3", "chara"):
        if key not in chunks:
            continue
        try:
            payload = base64.b64decode(chunks[key])
            card = json.loads(payload.decode("utf-8"))
        except Exception:
            continue
        # V2/V3 прячут всё в data, V1 лежит плоско
        return card.get("data", card)
    return None


def clean(text, limit=None, name=None):
    """Разворачивает макросы, снимает разметку промпта, режет по границе предложения."""
    text = str(text or "")
    text = re.sub(r"\{\{char\}\}", name or "он", text, flags=re.I)
    text = re.sub(r"\{\{user\}\}", "ты", text, flags=re.I)
    text = re.sub(r"\{\{[^}]*\}\}", "", text)          # прочие макросы — в мусор
    text = re.sub(r"<[^>]+>", " ", text)               # html/xml-теги
    text = re.sub(r"^\s*[>#\-*+]+\s*", " ", text, flags=re.M)   # цитаты, списки, заголовки
    text = re.sub(r"[*_`~]{1,3}", "", text)            # жирный/курсив/код
    text = re.sub(r"\s+", " ", text).strip()
    if limit and len(text) > limit:
        cut = text[:limit]
        stop = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
        text = (cut[:stop + 1] if stop > limit * 0.5 else cut.rstrip() + "…")
    return text


def estimate_tokens(card):
    """Грубая оценка объёма карточки: кириллица ≈ 3.2 символа на токен."""
    body = " ".join(str(card.get(k) or "") for k in
                    ("description", "personality", "scenario", "mes_example", "first_mes"))
    return int(len(body) / 3.2 / 10) * 10


def make_cover(png, dest, force=False):
    if dest.exists() and not force:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(png) as im:
        im = im.convert("RGB")
        # обрезаем по центру верха — у портретов лицо обычно вверху
        tw, th = COVER_SIZE
        scale = max(tw / im.width, th / im.height)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        left = (im.width - tw) // 2
        top = min((im.height - th) // 2, round(im.height * 0.12))
        im.crop((left, max(top, 0), left + tw, max(top, 0) + th)).save(
            dest, "WEBP", quality=COVER_QUALITY, method=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--line", default="", help="id линейки для новых ботов")
    ap.add_argument("--nsfw", action="store_true", help="пометить новых как 18+")
    ap.add_argument("--force-cover", action="store_true", help="перерисовать превьюшки")
    args = ap.parse_args()

    cards = sorted(CARDS.glob("*.png"))
    if not cards:
        print(f"В {CARDS.relative_to(ROOT)} нет ни одного .png — положи туда карточки и запусти снова.")
        return

    db = json.loads(DATA.read_text("utf-8"))
    by_id = {b["id"]: b for b in db["items"]}
    known_lines = {l["id"] for l in db["lines"]}
    if args.line and args.line not in known_lines:
        print(f"! Линейки «{args.line}» нет в bots.json — сначала заведи её в lines.")
        return

    added = updated = skipped = 0
    for png in cards:
        card = parse_card(png)
        if not card:
            print(f"× {png.name} — это не карточка персонажа (нет описания внутри)")
            skipped += 1
            continue

        name = clean(card.get("name")) or png.stem
        bot_id = slug(name)
        cover_rel = f"assets/img/bots/{bot_id}.webp"
        make_cover(png, COVERS / f"{bot_id}.webp", args.force_cover)

        # то, что вытащили из карточки — только для пустых полей
        found = {
            "cover": cover_rel,
            "tagline": clean(card.get("creator_notes"), 90, name),
            "description": clean(card.get("description"), 420, name),
            "greeting": clean(card.get("first_mes"), 200, name),
            "tags": [t for t in (card.get("tags") or []) if isinstance(t, str)][:4],
            "tokens": estimate_tokens(card),
            "updated": date.today().isoformat(),
            "files": {"card": f"files/bots/{png.name}", "lorebook": ""},
        }

        bot = by_id.get(bot_id)
        if bot is None:
            bot = {
                "id": bot_id, "name": name, "line": args.line, "tagline": "", "cover": "",
                "tags": [], "nsfw": args.nsfw, "tokens": 0, "updated": "", "featured": False,
                "greeting": "", "description": "", "files": {"card": "", "lorebook": ""},
            }
            db["items"].append(bot)
            by_id[bot_id] = bot
            added += 1
            mark = "+"
        else:
            updated += 1
            mark = "~"

        for key, value in found.items():
            if key == "files":
                for fk, fv in value.items():
                    if fv and not bot["files"].get(fk):
                        bot["files"][fk] = fv
            elif value and not bot.get(key):
                bot[key] = value

        print(f"{mark} {name}  →  #{bot_id}" + ("" if bot["line"] else "   (линейка не задана!)"))

    DATA.write_text(json.dumps(db, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"\nГотово: новых {added}, обновлено {updated}, пропущено {skipped}.")
    print("Проверь data/bots.json и закоммить вместе с assets/img/bots/.")


if __name__ == "__main__":
    main()
