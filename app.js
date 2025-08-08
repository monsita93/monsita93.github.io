// CONFIGURAZIONE FIREBASE

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

// LOGIN
document.getElementById("login-btn").addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
});

document.getElementById("logout-btn").addEventListener("click", () => {
  auth.signOut();
});

// RILEVA CAMBI LOGIN
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    document.getElementById("user-name").innerText = `Ciao, ${user.displayName}`;
    document.getElementById("login-btn").style.display = "none";
    document.getElementById("logout-btn").style.display = "inline";
    document.getElementById("new-post").style.display = "block";
  } else {
    currentUser = null;
    document.getElementById("user-name").innerText = "";
    document.getElementById("login-btn").style.display = "inline";
    document.getElementById("logout-btn").style.display = "none";
    document.getElementById("new-post").style.display = "none";
  }
});

// GEOLOCALIZZAZIONE
navigator.geolocation.getCurrentPosition(pos => {
  currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  loadPosts();
});

// PUBBLICA ANNUNCIO
document.getElementById("post-btn").addEventListener("click", () => {
  if (!currentPosition) return alert("Posizione non rilevata");
  
  db.collection("posts").add({
    title: document.getElementById("title").value,
    desc: document.getElementById("desc").value,
    expiry: document.getElementById("expiry").value,
    lat: currentPosition.lat,
    lng: currentPosition.lng,
    userId: currentUser.uid,
    userName: currentUser.displayName,
    reservedBy: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
});

// CARICA ANNUNCI VICINI
function loadPosts() {
  db.collection("posts").onSnapshot(snapshot => {
    const list = document.getElementById("posts-list");
    list.innerHTML = "";
    const maxDist = parseFloat(document.getElementById("max-distance").value);

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!currentPosition) return;
      const dist = distance(currentPosition.lat, currentPosition.lng, data.lat, data.lng);
      if (dist <= maxDist) {
        const li = document.createElement("li");
        li.innerHTML = `<b>${data.title}</b> - ${data.desc} (Scade: ${data.expiry}) 
                        <br>Offerto da: ${data.userName} - Distanza: ${dist.toFixed(1)} km
                        <br>${data.reservedBy ? "Già prenotato" : `<button onclick="reserve('${doc.id}')">Prenota</button>`}`;
        list.appendChild(li);
      }
    });
  });
}

// PRENOTA
function reserve(id) {
  if (!currentUser) return alert("Devi accedere per prenotare");
  db.collection("posts").doc(id).update({
    reservedBy: currentUser.uid
  });
}

// CALCOLO DISTANZA (Haversine)
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}
