#!/usr/bin/env python3
"""Writes index.html, the installer page: fiveplay-controller.user.js packed into a bookmark link. Run it again after editing the script."""
import pathlib
import re
import urllib.parse

HERE = pathlib.Path(__file__).resolve().parent
REPO = "https://github.com/adi3120/fiveplay-controller"
USERSCRIPT = "https://raw.githubusercontent.com/adi3120/fiveplay-controller/main/fiveplay-controller.user.js"

PAGE = """<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FivePlay Controller</title>
<style>
	body {{ font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #222; }}
	a.bookmarklet {{ display: inline-block; margin: 4px 0; padding: 9px 18px; border-radius: 8px; background: #1a7f37; color: #fff; font-weight: 600; text-decoration: none; cursor: grab; }}
	kbd {{ padding: 1px 6px; border: 1px solid #ccc; border-radius: 4px; background: #f6f6f6; font: 13px ui-monospace, monospace; }}
	li {{ margin: 6px 0; }}
	.small {{ color: #666; font-size: 13px; }}
</style>
<h1>FivePlay Controller</h1>
<p>Play <a href="https://fiveplay.lol/">fiveplay.lol</a> with a game controller, in GTA V's original controller layout.
It is a bookmark, so there is nothing to install. Use Google Chrome.</p>
<ol>
	<li>Show the bookmarks bar (<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd> on a Mac, <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd> on Windows and Linux), then drag this button onto it:<br>
		<a class="bookmarklet" href="{href}" title="Drag me to the bookmarks bar">FivePlay Controller</a></li>
	<li>Connect the controller (Bluetooth or USB). On a Logitech F310, set the switch on the back to <b>D</b> and keep the Mode light off.</li>
	<li>Open fiveplay.lol, click the <b>FivePlay Controller</b> bookmark, then press any button on the controller.</li>
	<li>Click inside the game once. Chrome only lets the controller look around, aim and shoot after a real click.</li>
</ol>
<p>Press <b>Back + A</b> on the controller (or click the bookmark again) to see the button layout.
Reloading the page turns the controller off, so click the bookmark again after each reload.</p>
<p>Prefer it to start by itself? With <a href="https://www.tampermonkey.net/">Tampermonkey</a> or
<a href="https://violentmonkey.github.io/">Violentmonkey</a> installed, <a href="{userscript}">install the userscript</a> instead.</p>
<p class="small">If dragging does not work: right-click the green button, choose Copy Link Address, then add a bookmark in Chrome's
bookmark manager and paste it as the URL. Source, full controls and help: <a href="{repo}">{repo}</a>. Bookmark size: {size} characters.</p>
</html>
"""


def bookmarklet(source: str) -> str:
	code = re.sub(r"(?s)^// ==UserScript==.*?// ==/UserScript==\n", "", source)
	# Only whole-line comments are dropped: newlines stay (as %0A), so trailing // comments still end where they should.
	lines = (line.strip() for line in code.splitlines())
	code = "\n".join(line for line in lines if line and not line.startswith("//"))
	return "javascript:" + urllib.parse.quote(code, safe="")


def main() -> None:
	href = bookmarklet((HERE / "fiveplay-controller.user.js").read_text())
	(HERE / "index.html").write_text(PAGE.format(href=href, size=f"{len(href):,}", repo=REPO, userscript=USERSCRIPT))
	print(f"index.html written ({len(href):,}-character bookmark)")


if __name__ == "__main__":
	main()
