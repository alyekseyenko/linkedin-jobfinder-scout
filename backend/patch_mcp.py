import os

path = '/root/.local/share/uv/tools/linkedin-scraper-mcp/lib/python3.12/site-packages/linkedin_mcp_server/core/browser.py'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    target = '"locale": "en-US",'
    replacement = '"locale": "en-US",\n                "user_agent": os.getenv("OVERRIDE_USER_AGENT", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),'
    
    if target in content and 'OVERRIDE_USER_AGENT' not in content:
        content = content.replace(target, replacement, 1)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Successfully patched core/browser.py with user_agent!')
    else:
        print('Already patched or target not found.')

driver_path = '/root/.local/share/uv/tools/linkedin-scraper-mcp/lib/python3.12/site-packages/linkedin_mcp_server/drivers/browser.py'
if os.path.exists(driver_path):
    with open(driver_path, 'r', encoding='utf-8') as f:
        d_content = f.read()
    
    target_nav = '''        await goto_reporting_proxy_errors(
            browser.page,
            "https://www.linkedin.com/feed/",
            wait_until="domcontentloaded",
        )
        await stabilize_navigation("pre-import feed navigation", logger)
        await record_page_trace(browser.page, "bridge-after-pre-import-feed")
        if not await browser.import_cookies(cookie_path):'''
    
    replacement_nav = '''        if not await browser.import_cookies(cookie_path):'''
    
    if target_nav in d_content:
        d_content = d_content.replace(target_nav, replacement_nav, 1)
        with open(driver_path, 'w', encoding='utf-8') as f:
            f.write(d_content)
        print('Successfully patched drivers/browser.py to import cookies before navigating!')
    else:
        print('drivers/browser.py target already patched or not found.')

