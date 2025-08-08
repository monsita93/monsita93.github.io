# FoodShare — Single-page demo (no build)
Webapp demo per condividere annunci geolocalizzati di alimenti in scadenza.
Questa versione è pensata per essere pubblicata su **GitHub Pages** (nessuna build richiesta).

## Cosa contiene
- `index.html` — pagina principale (HTML + CDN Firebase)
- `style.css` — stile minimo, responsive
- `app.js` — logica: login con Google, Firestore, geolocalizzazione, prenotazione
- `README.md` — questo file

## Istruzioni rapide
1. Crea un progetto Firebase: https://console.firebase.google.com/
2. Abilita **Authentication → Sign-in method → Google**.
3. Crea un database **Cloud Firestore** (in modalità *test* inizialmente).
4. Copia la configurazione Firebase nel file `app.js` (oggetto `firebaseConfig`).
5. (Consigliato) Imposta regole Firestore adeguate prima di andare in produzione.
   - Esempio minimale di regole per test (NON sicuro per produzione):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null && resource.data.reservedBy == null;
    }
  }
}
```
6. Carica i file nel repository GitHub e abilita GitHub Pages (branch `main` o `gh-pages`).

## Note e miglioramenti possibili
- Validazione lato server (Cloud Functions) per evitare abusi.
- Aggiungere storage per foto degli annunci.
- Mostrare gli annunci su mappa (Leaflet / Google Maps).
- Migliorare regole Firestore per controllare chi può modificare cosa.

-- Fine --
