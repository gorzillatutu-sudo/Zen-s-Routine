# My Routine

Habit + alarm app — UI is a 1:1 build of the design file (941 px design width, scaled to every screen).

## Preview in browser
    cd www && python3 -m http.server 8080      # then open http://localhost:8080
(on desktop it shows inside a phone frame; on a phone it is full screen)

## Build the real app (Capacitor)
    npm install
    npx cap add android      # and/or: npx cap add ios
    npx cap sync
    npx cap open android     # opens Android Studio -> Run / Build APK

* Alarms ring inside the app, and with `@capacitor/local-notifications` (already in package.json) they also fire as
  system notifications when the app is closed.
* App icon: `icon-source.png` (use `npx @capacitor/assets generate` if you want all sizes).

## Where things are
* `www/index.html`  — structure
* `www/css/style.css` — every size is in design pixels (the numbers match the design file)
* `www/js/app.js`   — data (localStorage), animations, popups, alarms
* `www/assets/`     — your PNGs (cropped + converted to WebP)

First launch loads demo data that matches the design (3/6, Mon–Wed ticked, 7:00 AM Daily).
Settings → Reset all data gives a clean start.

## Build the APK on GitHub (no Android Studio needed)
1. Create a new GitHub repository and upload everything in this folder (keep the `.github` folder).
2. Open the repo -> **Actions** tab -> **Build Android APK** -> **Run workflow** (it also runs on every push to `main`).
3. Wait ~5-8 minutes. Open the finished run -> **Artifacts** -> download **MyRoutine-apk** (zip) -> extract `app-debug.apk`.
4. Copy the APK to your phone and install it (allow "Install unknown apps" when asked).
5. On first launch allow **Notifications** so habit alarms can ring when the app is closed.
