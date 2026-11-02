#!/usr/bin/env python3
"""Runs test/harness.html in headless Chrome: once with fiveplay-controller.user.js, once with the code inside index.html's bookmark.
Set CHROME to the browser binary if it is not installed in a standard place."""
import html
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
SCRIPT_TAG = '<script src="../fiveplay-controller.user.js"></script>'


def find_chrome() -> str:
	candidates = [
		os.environ.get("CHROME"),
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		shutil.which("google-chrome"),
		shutil.which("google-chrome-stable"),
		shutil.which("chromium"),
		shutil.which("chromium-browser"),
		r"C:\Program Files\Google\Chrome\Application\chrome.exe",
	]
	for candidate in candidates:
		if candidate and pathlib.Path(candidate).exists():
			return candidate
	sys.exit("Google Chrome not found: set the CHROME environment variable to its path")


def run_in_chrome(page: str) -> str:
	with tempfile.TemporaryDirectory() as tmp:
		path = pathlib.Path(tmp) / "harness.html"
		path.write_text(page)
		proc = subprocess.run(
			[find_chrome(), "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
			 f"--user-data-dir={tmp}/profile", "--dump-dom", path.as_uri()],
			capture_output=True, text=True, timeout=90,
		)
	found = re.search(r'<pre id="out">(.*?)</pre>', proc.stdout, re.S)
	return html.unescape(found.group(1)) if found else "FAIL no output from Chrome\n" + proc.stderr[-2000:]


def main() -> int:
	harness = (HERE / "harness.html").read_text()
	assert SCRIPT_TAG in harness
	href = re.search(r'class="bookmarklet" href="([^"]+)"', (ROOT / "index.html").read_text()).group(1)
	bookmark_code = urllib.parse.unquote(html.unescape(href)[len("javascript:"):])
	variants = {
		"userscript file": f'<script src="{(ROOT / "fiveplay-controller.user.js").as_uri()}"></script>',
		"index.html bookmark": "<script>" + bookmark_code + "</script>",
	}
	failed = False
	for name, tag in variants.items():
		out = run_in_chrome(harness.replace(SCRIPT_TAG, tag))
		failed |= "FAIL" in out or "passed" not in out
		print(f"== {name} ==\n{out}\n")
	return 1 if failed else 0


if __name__ == "__main__":
	sys.exit(main())
