// Inserisci qui la tua configurazione Firebase (sostituisci i valori placeholder)
        const firebaseConfig = {
            apiKey: "AIzaSyCHN6FisiuH2JwboVcyrlg1UHnsLNAIWDE",
            authDomain: "foodshare-app-ff567.firebaseapp.com",
            databaseURL: "https://foodshare-app-ff567-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "foodshare-app-ff567",
            storageBucket: "foodshare-app-ff567.firebasestorage.app",
            messagingSenderId: "120193233604",
            appId: "1:120193233604:web:fa7afd4bde94b558378f91",
            measurementId: "G-2B7P1JMHES"
        };

// Inizializza Firebase (compat mode)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentPosition = null;

// ELEMENTI UI
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameEl = document.getElementById('user-name');
const newPostEl = document.getElementById('new-post');
const postBtn = document.getElementById('post-btn');
const postsList = document.getElementById('posts-list');
const maxDistanceInput = document.getElementById('max-distance');
const refreshBtn = document.getElementById('refresh-btn');

// LOGIN/LOGOUT
loginBtn.addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => alert(err.message));
});
logoutBtn.addEventListener('click', () => auth.signOut());

// Stato auth
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    userNameEl.textContent = `Ciao, ${user.displayName}`;
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    newPostEl.style.display = 'block';
  } else {
    currentUser = null;
    userNameEl.textContent = '';
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    newPostEl.style.display = 'none';
  }
});

// Ottieni posizione (chiediamo all'utente)
function requestPosition() {
  if (!navigator.geolocation) {
    alert('Geolocalizzazione non supportata dal browser.');
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    console.log('Posizione ottenuta', currentPosition);
    // quando otteniamo la posizione, carichiamo i post
    subscribeToPosts();
  }, err => {
    alert('Impossibile ottenere la posizione: ' + err.message);
  }, {enableHighAccuracy:true, maximumAge:60000});
}
requestPosition();

// Pubblica annuncio
postBtn.addEventListener('click', async () => {
  if (!currentUser) return alert('Effettua il login per pubblicare.');
  if (!currentPosition) return alert('Posizione non disponibile.');

  const title = document.getElementById('title').value.trim();
  const desc = document.getElementById('desc').value.trim();
  const expiry = document.getElementById('expiry').value;
  if (!title || !desc || !expiry) return alert('Compila tutti i campi.');

  try {
    await db.collection('posts').add({
      title, desc, expiry,
      lat: currentPosition.lat,
      lng: currentPosition.lng,
      userId: currentUser.uid,
      userName: currentUser.displayName || null,
      reservedBy: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // pulisci i campi
    document.getElementById('title').value = '';
    document.getElementById('desc').value = '';
    document.getElementById('expiry').value = '';
  } catch (err) {
    alert('Errore pubblicazione: ' + err.message);
  }
});

// Aggiorna manuale
refreshBtn.addEventListener('click', () => {
  // reload posts from cache by re-subscribing
  subscribeToPosts(true);
});

let unsubscribe = null;

// Sottoscrizione in tempo reale con filtro lato client per distanza
function subscribeToPosts(forceReload=false) {
  if (!currentPosition) return;
  if (unsubscribe && !forceReload) return;

  if (unsubscribe) unsubscribe(); // rimuovi precedente

  unsubscribe = db.collection('posts')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      postsList.innerHTML = '';
      const maxDist = parseFloat(maxDistanceInput.value) || 5;
      snapshot.forEach(doc => {
        const data = doc.data();
        // controllo campi
        if (!data.lat || !data.lng) return;
        const dist = distance(currentPosition.lat, currentPosition.lng, data.lat, data.lng);
        if (dist <= maxDist) {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${escapeHtml(data.title)}</strong> — ${escapeHtml(data.desc)}
            <div class="muted">Scadenza: ${escapeHtml(data.expiry || '')} • Offerto da: ${escapeHtml(data.userName || 'Anonimo')} • ${dist.toFixed(1)} km</div>
            <div>${data.reservedBy ? '<em>Già prenotato</em>' : '<button class="reserve-btn" data-id="'+doc.id+'">Prenota</button>'}</div>`;
          postsList.appendChild(li);
        }
      });

      // attach reserve handlers
      document.querySelectorAll('.reserve-btn').forEach(btn=>{
        btn.addEventListener('click', async (ev)=>{
          const id = ev.currentTarget.dataset.id;
          if (!currentUser) return alert('Devi accedere per prenotare.');
          try{
            // transazione semplice per segnare la prenotazione solo se non prenotato
            const ref = db.collection('posts').doc(id);
            await db.runTransaction(async (t) => {
              const snap = await t.get(ref);
              if (!snap.exists) throw 'Annuncio non trovato';
              const reservedBy = snap.data().reservedBy;
              if (reservedBy) throw 'Già prenotato';
              t.update(ref, { reservedBy: currentUser.uid });
            });
            alert('Prenotazione registrata.');
          }catch(err){
            alert('Errore prenotazione: ' + err);
          }
        });
      });
    }, err => {
      console.error('Snapshot error', err);
    });
}

// Funzione di utilità: Haversine
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = v => v * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Basic escaping
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

// small helper to show errors in console for older browsers
window.addEventListener('error', e => console.error(e.message));