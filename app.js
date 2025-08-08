// Inserisci la configurazione Firebase qui
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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentPosition = null;

// UI elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameEl = document.getElementById('user-name');
const newPostSection = document.getElementById('new-post');
const postBtn = document.getElementById('post-btn');
const postsList = document.getElementById('posts-list');
const maxDistanceInput = document.getElementById('max-distance');
const refreshBtn = document.getElementById('refresh-btn');
const fabBtn = document.getElementById('fab-btn');
const closeNewPostBtn = document.getElementById('close-new-post');

// LOGIN
loginBtn.addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => alert(err.message));
});
logoutBtn.addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    userNameEl.textContent = `Ciao, ${user.displayName}`;
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    fabBtn.style.display = 'block';
  } else {
    currentUser = null;
    userNameEl.textContent = '';
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    fabBtn.style.display = 'none';
    newPostSection.classList.add('hidden');
  }
});

// Toggle sezione nuovo annuncio
fabBtn.addEventListener('click', () => {
  newPostSection.classList.remove('hidden');
  fabBtn.style.display = 'none';
});
closeNewPostBtn.addEventListener('click', () => {
  newPostSection.classList.add('hidden');
  fabBtn.style.display = 'block';
});

// GEO
function requestPosition() {
  if (!navigator.geolocation) {
    alert('Geolocalizzazione non supportata.');
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    subscribeToPosts();
  }, err => {
    alert('Posizione non disponibile: ' + err.message);
  }, {enableHighAccuracy:true, maximumAge:60000});
}
requestPosition();

// Pubblica
postBtn.addEventListener('click', async () => {
  if (!currentUser) return alert('Effettua il login.');
  if (!currentPosition) return alert('Posizione non disponibile.');
  const title = document.getElementById('title').value.trim();
  const desc = document.getElementById('desc').value.trim();
  const expiry = document.getElementById('expiry').value;
  if (!title || !desc || !expiry) return alert('Compila tutti i campi.');

  await db.collection('posts').add({
    title, desc, expiry,
    lat: currentPosition.lat,
    lng: currentPosition.lng,
    userId: currentUser.uid,
    userName: currentUser.displayName,
    reservedBy: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('title').value = '';
  document.getElementById('desc').value = '';
  document.getElementById('expiry').value = '';
  newPostSection.classList.add('hidden');
  fabBtn.style.display = 'block';
});

refreshBtn.addEventListener('click', () => subscribeToPosts(true));

let unsubscribe = null;
function subscribeToPosts(forceReload=false) {
  if (!currentPosition) return;
  if (unsubscribe && !forceReload) return;
  if (unsubscribe) unsubscribe();
  unsubscribe = db.collection('posts')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      postsList.innerHTML = '';
      const maxDist = parseFloat(maxDistanceInput.value) || 5;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.lat || !data.lng) return;
        const dist = distance(currentPosition.lat, currentPosition.lng, data.lat, data.lng);
        if (dist <= maxDist) {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${escapeHtml(data.title)}</strong> — ${escapeHtml(data.desc)}
            <div class="muted">Scadenza: ${escapeHtml(data.expiry)} • Offerto da: ${escapeHtml(data.userName)} • ${dist.toFixed(1)} km</div>
            <div>${data.reservedBy ? '<em>Già prenotato</em>' : '<button class="primary-btn reserve-btn" data-id="'+doc.id+'">Prenota</button>'}</div>`;
          postsList.appendChild(li);
        }
      });
      document.querySelectorAll('.reserve-btn').forEach(btn=>{
        btn.addEventListener('click', async ev => {
          const id = ev.currentTarget.dataset.id;
          if (!currentUser) return alert('Accedi per prenotare.');
          try {
            const ref = db.collection('posts').doc(id);
            await db.runTransaction(async (t) => {
              const snap = await t.get(ref);
              if (!snap.exists) throw 'Annuncio non trovato';
              if (snap.data().reservedBy) throw 'Già prenotato';
              t.update(ref, { reservedBy: currentUser.uid });
            });
            alert('Prenotazione registrata.');
          } catch(err) {
            alert('Errore: ' + err);
          }
        });
      });
    });
}

function distance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = v => v * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
