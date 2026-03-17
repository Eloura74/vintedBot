#!/bin/bash

# Script de préparation pour macOS
echo "🚀 Préparation du Vinted Sniper Standalone (macOS)..."

# Empêcher les erreurs si les dossiers n'existent pas
mkdir -p tmp

echo "📦 Installation des dépendances du Backend..."
cd backend
npm install
cd ..

echo "📦 Installation des dépendances du Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "📦 Création de l'environnement virtuel Python (Venv)..."
cd worker
# Suppression si corrompu
if [ -d "venv" ]; then
    echo "🗑️ Suppression de l'ancien venv..."
    rm -rf venv
fi

echo "🔨 Création du nouveau venv..."
python3 -m venv venv
source venv/bin/activate

echo "📥 Installation des packages Python..."
python3 -m pip install --upgrade pip
python3 -m pip install --no-cache-dir -r requirements.txt
python3 -m playwright install chromium
cd ..

echo "📦 Installation des dépendances Desktop..."
cd desktop
npm install

echo "✅ Préparation terminée !"
echo "💻 Pour tester : cd desktop && npm start"
echo "🔨 Pour générer le .dmg : cd desktop && npm run build"

# Nettoyage
rm -rf tmp
