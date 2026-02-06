"""
从 iconfont.cn 下载技术图标的自动化脚本 - 改进版
"""
import os
import time
import requests
from playwright.sync_api import sync_playwright

# 目标保存目录
SAVE_DIR = r"C:\Users\Administrator\Desktop\serverhub\client\src\renderer\assets\icons"

# 需要搜索的图标关键词列表
ICONS_TO_DOWNLOAD = [
    {"keywords": ["PM2", "nodejs进程", "node.js"], "filename": "pm2.svg"},
    {"keywords": ["letsencrypt", "ssl", "https证书", "安全证书"], "filename": "certbot.svg"},
    {"keywords": ["cloudflare", "CDN"], "filename": "cloudflare.svg"},
    {"keywords": ["备份", "backup", "云备份", "数据备份"], "filename": "backup.svg"},
    {"keywords": ["监控", "dashboard", "数据监控", "仪表盘"], "filename": "monitoring.svg"},
    {"keywords": ["minecraft", "我的世界"], "filename": "minecraft.svg"},
    {"keywords": ["防火墙", "firewall", "安全防护", "shield"], "filename": "firewall.svg"},
]

def search_and_screenshot(page, keyword, index):
    """搜索关键词并截图"""
    print(f"\n{'='*50}")
    print(f"搜索关键词: {keyword}")
    
    # 直接访问搜索结果页面
    search_url = f"https://www.iconfont.cn/search/index?searchType=icon&q={keyword}"
    page.goto(search_url)
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    # 截图搜索结果
    screenshot_path = os.path.join(SAVE_DIR, f"search_{index}_{keyword}.png")
    page.screenshot(path=screenshot_path, full_page=False)
    print(f"搜索结果截图: {screenshot_path}")
    
    return screenshot_path

def get_svg_from_icon(page, icon_index=0):
    """点击图标并获取 SVG 内容"""
    # 查找图标容器
    icon_items = page.locator('.block-icon-list li').all()
    
    if len(icon_items) == 0:
        # 尝试其他选择器
        icon_items = page.locator('.icon-gouwuche1').all()
    
    if len(icon_items) == 0:
        icon_items = page.locator('.icon-item').all()
    
    print(f"找到 {len(icon_items)} 个图标项")
    
    if len(icon_items) <= icon_index:
        return None
    
    # 点击指定的图标
    icon_items[icon_index].click()
    time.sleep(2)
    
    # 截图弹窗
    page.screenshot(path=os.path.join(SAVE_DIR, "icon_detail.png"))
    
    # 查找 SVG 下载按钮或链接
    svg_btn = page.locator('text=SVG下载').first
    if svg_btn.is_visible():
        svg_btn.click()
        time.sleep(1)
        return True
    
    # 尝试其他方式获取 SVG
    svg_element = page.locator('svg').first
    if svg_element.is_visible():
        svg_content = svg_element.evaluate('el => el.outerHTML')
        return svg_content
    
    return None

def main():
    print("开始探索 iconfont.cn 网站结构...")
    print(f"保存目录: {SAVE_DIR}")
    
    os.makedirs(SAVE_DIR, exist_ok=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='zh-CN'
        )
        page = context.new_page()
        
        # 搜索每个关键词并截图
        for i, icon_info in enumerate(ICONS_TO_DOWNLOAD):
            keyword = icon_info["keywords"][0]
            search_and_screenshot(page, keyword, i)
        
        # 尝试获取页面上的图标元素结构
        print("\n分析页面结构...")
        page.goto("https://www.iconfont.cn/search/index?searchType=icon&q=cloudflare")
        page.wait_for_load_state('networkidle')
        time.sleep(3)
        
        # 获取页面 HTML 片段
        html_content = page.content()
        
        # 查找所有可能的图标容器
        selectors_to_try = [
            '.block-icon-list li',
            '.icon-item',
            '.icon-twrap',
            '.icon-gouwuche1',
            '[class*="icon"]',
            '.J_icon_item',
        ]
        
        for selector in selectors_to_try:
            items = page.locator(selector).all()
            if len(items) > 0:
                print(f"选择器 '{selector}' 找到 {len(items)} 个元素")
        
        # 尝试点击第一个图标
        print("\n尝试点击图标...")
        first_icon = page.locator('.block-icon-list li').first
        if first_icon.is_visible():
            first_icon.hover()
            time.sleep(1)
            page.screenshot(path=os.path.join(SAVE_DIR, "icon_hover.png"))
            
            # 查找下载按钮
            download_btns = page.locator('.icon-gouwuche1, .icon-xiazai, [class*="download"]').all()
            print(f"找到 {len(download_btns)} 个下载相关按钮")
            
            first_icon.click()
            time.sleep(2)
            page.screenshot(path=os.path.join(SAVE_DIR, "after_click.png"))
        
        print("\n保持浏览器打开 15 秒以便观察...")
        time.sleep(15)
        
        browser.close()
    
    print("\n探索完成")

if __name__ == "__main__":
    main()
