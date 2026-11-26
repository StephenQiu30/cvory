"""Playwright Chromium browser pool for pixel-identical A4 PDF export."""

import asyncio
import json
from typing import Any, Protocol

from playwright.async_api import Browser, Playwright, async_playwright

from app.core.config import Settings


class PdfRenderer(Protocol):
    """Protocol for rendering a structured resume snapshot into A4 PDF bytes."""

    async def render_resume_pdf(self, *, payload: dict[str, Any]) -> bytes: ...
    async def close(self) -> None: ...


class PlaywrightPdfRenderer:
    """Reuses a single Chromium instance with bounded concurrency to render A4 PDFs."""

    def __init__(self, settings: Settings) -> None:
        self._frontend_internal_url = settings.frontend_internal_url.rstrip("/")
        self._semaphore = asyncio.Semaphore(settings.pdf_max_concurrency)
        self._lock = asyncio.Lock()
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None

    async def _ensure_browser(self) -> Browser:
        if self._browser is not None and self._browser.is_connected():
            return self._browser
        async with self._lock:
            if self._browser is not None and self._browser.is_connected():
                return self._browser
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            return self._browser

    async def render_resume_pdf(self, *, payload: dict[str, Any]) -> bytes:
        """Opens the frontend print route with injected resume JSON and prints an A4 PDF."""
        async with self._semaphore:
            browser = await self._ensure_browser()
            context = await browser.new_context(
                viewport={"width": 794, "height": 1123},
                device_scale_factor=2,
            )
            try:
                page = await context.new_page()
                serialized = json.dumps(payload, ensure_ascii=False)
                await page.add_init_script(f"window.__CVORY_PRINT_PAYLOAD__ = {serialized};")
                await page.goto(
                    f"{self._frontend_internal_url}/print/render",
                    wait_until="networkidle",
                    timeout=30_000,
                )
                await page.emulate_media(media="print")
                await page.evaluate("() => document.fonts.ready")
                return await page.pdf(
                    format="A4",
                    print_background=True,
                    prefer_css_page_size=True,
                )
            finally:
                await context.close()

    async def close(self) -> None:
        """Closes the shared Chromium browser and Playwright driver."""
        if self._browser is not None:
            await self._browser.close()
            self._browser = None
        if self._playwright is not None:
            await self._playwright.stop()
            self._playwright = None
