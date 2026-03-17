@echo off
pushd %~dp0
echo 🚀 Preparation du Vinted Sniper Standalone (Windows)...

:: Contournement pour l'erreur de fonction incorrecte sur R:\Temp
set "TMP=%CD%\tmp"
set "TEMP=%CD%\tmp"
if not exist "tmp" mkdir "tmp"

echo 📦 Installation des dependances du Backend...
cd backend
call npm install
cd ..

echo 📦 Installation des dependances du Frontend...
cd frontend
call npm install
call npm run build
cd ..

echo 📦 Nettoyage et creation de l'environnement virtuel Python (Venv)...
cd worker
:: Tente de desactiver si deja actif dans ce terminal
if defined VIRTUAL_ENV call deactivate

:: Suppression forcee du venv corrompu
if exist "venv" (
    echo 🗑️ Suppression de l'ancien venv...
    rd /s /q "venv" || (
        echo ⚠️ IMPOSSIBLE DE SUPPRIMER LE DOSSIER VENV.
        echo ⚠️ Fermez tout terminal affichant "(venv)" et relancez le script.
        pause
        exit /b 1
    )
)

echo 🔨 Creation du nouveau venv...
python -m venv venv
call venv\Scripts\activate

echo 📥 Installation des packages (Python 3.13 optimized)...
:: Utilise python -m pip pour eviter les erreurs de chemin
python -m pip install --upgrade pip
python -m pip install --no-cache-dir --prefer-binary -r requirements.txt
python -m playwright install chromium
cd ..

echo 📦 Installation des dependances Desktop...
cd desktop
call npm install
echo ✅ Preparation terminee !
echo 💻 Pour tester, lancez : cd desktop && npm start
echo 🔨 Pour generer l'EXE, lancez : cd desktop && npm run build
rmdir /s /q "%CD%\tmp"
popd
pause
