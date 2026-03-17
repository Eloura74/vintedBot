import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        # On lance le navigateur en mode visible (headless=False)
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        
        page = await context.new_page()
        await page.goto("https://www.vinted.fr/member/signup/select_type")
        
        print("\n" + "="*50)
        print("🔑 ACTION REQUISE : Connecte-toi à ton compte Vinted dans la fenêtre qui vient de s'ouvrir.")
        print("Une fois que tu es sur ton profil et que la connexion est réussie,")
        print("reviens ici et appuie sur ENTREE pour sauvegarder la session.")
        print("="*50 + "\n")
        
        input("Appuie sur ENTREE quand tu es connecté...")
        
        # Sauvegarde de l'état (cookies, local storage, etc.)
        await context.storage_state(path="session.json")
        print("\n✅ Session sauvegardée avec succès dans 'session.json' !")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
