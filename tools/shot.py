"""Скриншоты сайта для проверки шага: десктоп 1440x900 и телефон 390x844, первый экран и вся страница.
Запуск: python tools/shot.py <имя-шага> [url]. Файлы: process/screenshots/<имя-шага>-<desktop|mobile>[-full].png"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
name = sys.argv[1] if len(sys.argv) > 1 else "check"
url = sys.argv[2] if len(sys.argv) > 2 else (root / "docs" / "index.html").as_uri()
out = root / "process" / "screenshots"
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    for label, viewport, mobile in [("desktop", {"width": 1440, "height": 900}, False),
                                    ("mobile", {"width": 390, "height": 844}, True)]:
        context = browser.new_context(viewport=viewport, is_mobile=mobile, has_touch=mobile)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1200)
        if not mobile:
            # Фонарь к Смотрителю: проверяем свет и «глаз».
            page.mouse.move(viewport["width"] * 0.5, viewport["height"] * 0.4, steps=8)
            page.wait_for_timeout(1600)
        page.screenshot(path=str(out / f"{name}-{label}.png"))
        page.screenshot(path=str(out / f"{name}-{label}-full.png"), full_page=True)
        width = page.evaluate("document.documentElement.scrollWidth")
        print(f"{label}: scrollWidth={width} (viewport {viewport['width']}), errors={errors[:5]}")
        context.close()
    browser.close()
