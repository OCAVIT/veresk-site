"""Проверка целевого действия: ошибки формы и скачивание билета PNG 1200x630; заодно рисует docs/og.png.
Запуск: python tools/check_ticket.py"""
import base64
import pathlib
import struct

from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
shots = root / "process" / "screenshots"
shots.mkdir(parents=True, exist_ok=True)
url = (root / "docs" / "index.html").as_uri()


def png_size(data):
    return struct.unpack(">II", data[16:24])


with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    page.goto(url, wait_until="networkidle")
    form = page.locator("#ticket-kassa")
    form.scroll_into_view_if_needed()

    form.locator("button[type=submit]").click()
    print("empty:", form.locator("[data-ticket-note]").inner_text())
    form.locator("input").fill("Агент 007")
    form.locator("button[type=submit]").click()
    print("digits:", form.locator("[data-ticket-note]").inner_text())
    form.screenshot(path=str(shots / "03-form-error.png"))

    form.locator("input").fill("Анна Лукина")
    with page.expect_download() as info:
        form.locator("button[type=submit]").click()
    download = info.value
    target = root / "process" / download.suggested_filename
    download.save_as(str(target))
    data = target.read_bytes()
    print("download:", download.suggested_filename, png_size(data), len(data), "bytes")
    print("note:", form.locator("[data-ticket-note]").inner_text())
    print("hero synced:", page.locator("#ticket-hero-name").input_value())
    form.screenshot(path=str(shots / "03-form-done.png"))
    (shots / "03-ticket-anna.png").write_bytes(data)
    target.unlink()

    og = page.evaluate("window.vereskTicket.exportPng('Пассажир')")
    (root / "docs" / "og.png").write_bytes(base64.b64decode(og.split(",", 1)[1]))
    print("og.png", png_size((root / "docs" / "og.png").read_bytes()))
    browser.close()
