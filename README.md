# Forma

A personal fitness tracker for splits, lifting, goal phases, meal tracking with photos, and weekly insights.

## Run it on Windows
1. Unzip `Forma-0.1.0-Windows.zip` anywhere, for example `C:\Forma`.
2. Open `Forma.exe`. Windows SmartScreen may warn because the app is unsigned. Click "More info", then "Run anyway".
3. Create your profile. You can add an optional PIN.

To install it on a second laptop, copy the same zip over and repeat the steps. Each person gets their own profile with separate data. Data lives in `%APPDATA%\Forma\data`.

## iPhone and iPad
Open the GitHub Pages link in Safari, tap Share, then "Add to Home Screen". It runs full screen and keeps its data on the device.

## Logging meals by typing (free, offline)
On Meals, type what you ate, e.g. `2 medium eggs scrambled, 1 tbsp butter, 1 mug coffee`. Calories and macros fill in as you type, from a built-in list of about 150 common and Filipino foods. If a food isn't in the list, tap it to enter its calories once and it's remembered next time.

## Coach
The Coach card on the Dashboard and Meals reads what you've eaten and gives lifting-focused tips: protein per day and per meal, carbs after training, fruit and veg, sweet drinks, alcohol and salty food. Each tip explains why it matters. It runs offline and isn't a chatbot.

## Barcode scanning (free)
On Meals, tap "Scan barcode" and point the camera at a packaged food. Nutrition comes from Open Food Facts, a free database, so no account or key is needed. You can also type the number.

## Photo meal tracking (optional)
This is optional and separate from a Claude subscription: it uses a pay-as-you-go API key. Go to Settings, then Claude API key, and paste a key from console.anthropic.com. On Windows the key is encrypted with Windows DPAPI. It is never written to the code or to backups.

## Develop
```
npm install
npm run dev        # Electron + Vite
npm run dev:web    # browser/PWA only
npm test
npm run dist:zip   # Windows zip (electron-builder)
```
GitHub Actions builds the Windows installer (`windows.yml`) and deploys the iPhone web version to Pages (`pages.yml`).

## Stack
Electron, React, TypeScript, Vite, Motion, and sql.js (SQLite, one file per profile). Electron gives the same Chromium on every Windows machine, so the animations behave the same everywhere. sql.js avoids native builds.
