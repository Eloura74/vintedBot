# Vinted Sniper Standalone 🎯

Ce projet est un moniteur Vinted avancé permettant de surveiller les nouveaux articles en temps réel et d'envoyer des notifications via Webhook Discord. Il est conçu pour être distribué comme une application de bureau (Windows & macOS).

## 🏗️ Architecture
- **Desktop** : Application Electron orchestrant le backend, le worker et l'interface.
- **Backend** : API Node.js (Express/Sequelize) utilisant SQLite.
- **Worker** : Moteur de monitoring Python (Playwright/Websockets).
- **Frontend** : Interface utilisateur moderne en React (Vite/Tailwind).

## 🚀 Installation & Utilisation

### Windows
1. Double-cliquez sur `setup_windows.bat` pour initialiser l'environnement.
2. Lancez l'application via le dossier `desktop` : `npm start`.

### macOS
1. Ouvrez un terminal dans le dossier racine.
2. Lancez `chmod +x setup_mac.sh && ./setup_mac.sh`.
3. Lancez l'application : `cd desktop && npm start`.

## 📦 Packaging
Pour générer un installateur autonome (.exe ou .dmg) :
1. Allez dans le dossier `desktop`.
2. Lancez `npm run build`.

## 🔒 Sécurité
- Ce projet utilise une capture de session via Electron pour éviter de stocker des identifiants en clair.
- Les fichiers `session.json` et `vinted.sqlite` sont ignorés par Git pour protéger votre vie privée.
