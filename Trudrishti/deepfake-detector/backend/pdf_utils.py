import os
import asyncio
from playwright.async_api import async_playwright

async def convert_html_to_pdf_async(html_path: str, pdf_path: str):
    """
    Converts a local HTML file to a high-fidelity PDF report using Playwright.
    """
    abs_html_path = os.path.abspath(html_path)
    abs_pdf_path = os.path.abspath(pdf_path)
    
    # Format path for file URI
    file_url = f"file:///{abs_html_path.replace(os.sep, '/')}"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            page = await browser.new_page()
            # Set standard viewport
            await page.set_viewport_size({"width": 1280, "height": 1024})
            
            # Navigate to Evidently HTML file and wait for load
            await page.goto(file_url, wait_until="networkidle")
            
            # Wait for interactive charts to animate / render
            await page.wait_for_timeout(2000)
            
            # Print to PDF with backgrounds enabled for professional styling
            await page.pdf(
                path=abs_pdf_path,
                format="A4",
                print_background=True,
                margin={"top": "0.5in", "bottom": "0.5in", "left": "0.5in", "right": "0.5in"}
            )
        finally:
            await browser.close()

def convert_html_to_pdf(html_path: str, pdf_path: str):
    """
    Synchronous wrapper that safely executes the async Playwright function
    regardless of whether an event loop is already running in the current thread.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import threading
        
        def run_in_thread():
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                new_loop.run_until_complete(convert_html_to_pdf_async(html_path, pdf_path))
            finally:
                new_loop.close()
                
        thread = threading.Thread(target=run_in_thread)
        thread.start()
        thread.join()
    else:
        asyncio.run(convert_html_to_pdf_async(html_path, pdf_path))
