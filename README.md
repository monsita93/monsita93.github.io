# FoodShare WebApp

## Configurazione Firebase
1. Crea un progetto Firebase
2. Abilita **Authentication** (Google)
3. Abilita **Firestore Database**
4. Sostituisci le credenziali in `app.js`

## Regole Firestore consigliate
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /annunci/{annuncioId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
        && resource.data.userId == request.auth.uid;
      allow update: if request.auth != null
        && request.resource.data.prenotazioni.size() >= resource.data.prenotazioni.size()
        && request.auth.uid in request.resource.data.prenotazioni;
    }

    match /messages/{chatId} {
      allow read, update: if request.auth != null
        && request.auth.uid in resource.data.participants;
      allow create: if request.auth != null;
    }
  }
}
```

## Pubblicazione su GitHub Pages
- Carica tutti i file su un repository pubblico
- Abilita GitHub Pages dalle impostazioni
