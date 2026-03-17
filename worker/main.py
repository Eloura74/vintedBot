import asyncio
import os
import json
import websockets
from playwright.async_api import async_playwright
from datetime import datetime
from dotenv import load_dotenv
from bs4 import BeautifulSoup

load_dotenv()

import httpx

class VintedScraper:
    def __init__(self, api_url):
        self.api_url = api_url
        self.ws_url = api_url.replace("http", "ws")
        self.active_tasks = {}
        self.browser = None
        self.context = None
        self.http_client = httpx.AsyncClient()
        self.ws = None

    async def log(self, message, type="info"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = json.dumps({
            "type": "log",
            "payload": {"time": timestamp, "msg": message, "type": type}
        })
        print(f"[{timestamp}] {message}")
        try:
            if self.ws and self.ws.open:
                await self.ws.send(log_entry)
        except Exception as e:
            print(f"WS Log Error: {e}")

    async def send_webhook(self, task, item):
        webhook_url = task.get('webhookUrl')
        if not webhook_url:
            return

        payload = {
            "embeds": [{
                "title": f"✨ Nouveau sur Vinted : {task['keywords']}",
                "description": f"**Prix :** {item.get('price', 'N/A')}€\n[Voir l'annonce]({item['url']})",
                "color": 0x00FFBB,
                "image": {"url": item.get('image_url')},
                "footer": {"text": "Vinted Monitor - Advanced Scouting"}
            }]
        }
        try:
            await self.http_client.post(webhook_url, json=payload)
            print(f"📧 Webhook sent for {item['id']}")
        except Exception as e:
            print(f"❌ Webhook error: {e}")

    async def init_browser(self):
        pw = await async_playwright().start()
        self.browser = await pw.chromium.launch(headless=True)
        
        # Chargement de la session si elle existe
        current_dir = os.path.dirname(os.path.abspath(__file__))
        session_path = os.path.join(current_dir, "session.json")
        if os.path.exists(session_path):
            print(f"📂 Loading existing session from {session_path}...")
            self.context = await self.browser.new_context(
                storage_state=session_path,
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
            )
        else:
            print("⚠️ No session found. Running in guest mode.")
            self.context = await self.browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
            )

        # Premier passage pour vérifier la session
        page = await self.context.new_page()
        try:
            await page.goto("https://www.vinted.fr", wait_until="networkidle")
            # Logique de vérification de login (ex: présence du bouton profil)
            print("✅ Browser ready and session injected.")
        except Exception as e:
            print(f"❌ Initial browser check failed: {e}")
        finally:
            await page.close()

    async def sniper_buy(self, item_url):
        """
        [DÉSACTIVÉ] Logique d'achat automatique.
        Cette méthode n'est pas appelée pour l'instant.
        """
        print(f"🎯 Sniper target: {item_url}")
        page = await self.context.new_page()
        try:
            # 1. Aller sur l'article
            await page.goto(item_url, wait_until="networkidle")
            
            # 2. Chercher le bouton "Acheter" (Buy now)
            # Sélecteur typique Vinted pour le bouton d'achat
            buy_button = page.locator('button[data-testid="item-buy-button"]')
            
            if await buy_button.is_visible():
                await self.log("🔘 Bouton 'Acheter' détecté ! (Auto-buy en pause pour sécurité)", "success")
                # await buy_button.click()
                # await self.log("🖱️ Clic sur Acheter effectué !", "success")
            else:
                await self.log("⚠️ Bouton 'Acheter' introuvable (Article possiblement vendu)", "warning")

        except Exception as e:
            print(f"❌ Sniper error for {item_url}: {e}")
        finally:
            await page.close()

    async def scrape_task(self, task):
        if not task.get('status', True):
            return

        if not self.context:
            await self.init_browser()

        keywords = task.get('keywords', '')
        max_price = task.get('maxPrice')
        task_id = task.get('id')
        
        await self.log(f"🔍 Scrutage de Vinted : {keywords}")
        
        url = f"https://www.vinted.fr/catalog?search_text={keywords.replace(' ', '+')}&order=newest_first"
        if max_price:
            url += f"&price_to={max_price}"

        page = await self.context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded")
            await asyncio.sleep(2)
            
            content = await page.content()
            soup = BeautifulSoup(content, 'html.parser')
            items = soup.find_all('div', {'data-testid': 'grid-item'})
            
            r = self.redis_client
            redis_key = f"seen_items:{task_id}"

            found_new = 0
            for item in items:
                try:
                    link_tag = item.find('a', href=True)
                    if not link_tag: continue
                    
                    href = link_tag['href']
                    item_url = href if href.startswith('http') else "https://www.vinted.fr" + href
                    item_id = item_url.split('/')[-1].split('-')[0]
                    
                    if await r.sismember(redis_key, item_id):
                        continue
                        
                    await r.sadd(redis_key, item_id)
                    found_new += 1
                    
                    price_text = item.get_text()
                    price = "N/A"
                    import re
                    price_match = re.search(r'(\d+[,\.]\d{2})\s?€', price_text)
                    if price_match:
                        price = price_match.group(1)

                    item_data = {
                        "id": item_id,
                        "url": item_url,
                        "price": price,
                        "image_url": item.find('img')['src'] if item.find('img') else None
                    }

                    await self.log(f"✨ TROUVÉ : {keywords} - {price}€", "success")
                    await self.send_webhook(task, item_data)
                    
                    if task.get('autoBuy'):
                        await self.sniper_buy(item_url)
                    
                except Exception as e:
                    continue
            
            if found_new > 0:
                await self.log(f"📈 {found_new} nouveaux articles pour '{keywords}'")
                
        except Exception as e:
            print(f"❌ Error scraping {keywords}: {e}")
        finally:
            await page.close()

    async def load_initial_tasks(self):
        api_url = os.getenv("API_URL", "http://api:3000")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{api_url}/api/tasks")
                if resp.status_code == 200:
                    tasks = resp.json()
                    for task in tasks:
                        self.active_tasks[task['id']] = task
                    print(f"📦 Loaded {len(tasks)} initial tasks.")
        except Exception as e:
            print(f"⚠️ Could not load initial tasks: {e}")

    async def listen_to_api(self):
        while True:
            try:
                async with websockets.connect(self.ws_url) as websocket:
                    self.ws = websocket
                    print(f"🔌 Connected to API at {self.ws_url}")
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            print(f"🔔 Update received: {data['type']}")
                            
                            if data['type'] in ['task_created', 'task_updated']:
                                task = data['task']
                                self.active_tasks[task['id']] = task
                            elif data['type'] == 'task_deleted':
                                task_id = data['taskId']
                                if task_id in self.active_tasks:
                                    del self.active_tasks[task_id]
                        except Exception as e:
                            print(f"Error parsing WS message: {e}")
            except Exception as e:
                print(f"🔌 WS Connection lost: {e}. Retrying in 5s...")
                await asyncio.sleep(5)

    async def run(self):
        print("🚀 Vinted Worker starting...")
        
        await self.init_browser()
        await self.load_initial_tasks()
        
        # Lancer l'écouteur WebSocket en arrière-plan
        asyncio.create_task(self.listen_to_api())
        
        # Boucle principale de scraping
        while True:
            for task_id in list(self.active_tasks.keys()):
                task = self.active_tasks[task_id]
                await self.scrape_task(task)
                await asyncio.sleep(2)

            await asyncio.sleep(5)

async def main():
    api_url = os.getenv("API_URL", "http://localhost:3001")
    scraper = VintedScraper(api_url)
    await scraper.run()

if __name__ == "__main__":
    asyncio.run(main())
