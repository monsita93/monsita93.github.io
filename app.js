// Configura Firebase
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
let currentChatId = null;

// Login/Logout
document.getElementById('loginBtn').onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
};
document.getElementById('logoutBtn').onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
  if(user) {
    currentUser = user;
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'inline-block';
    caricaAnnunci();
  } else {
    currentUser = null;
    document.getElementById('loginBtn').style.display = 'inline-block';
    document.getElementById('logoutBtn').style.display = 'none';
  }
});

// Mostra/Nascondi pannello nuovo annuncio
document.getElementById('fab').onclick = () => document.getElementById('nuovoAnnuncioPanel').classList.remove('hidden');
document.getElementById('chiudiPanel').onclick = () => document.getElementById('nuovoAnnuncioPanel').classList.add('hidden');

// Pubblica annuncio
document.getElementById('pubblica').onclick = async () => {
  const titolo = document.getElementById('titolo').value;
  const descrizione = document.getElementById('descrizione').value;
  const luogo = document.getElementById('luogo').value;

  try {
    await db.collection('annunci').add({
      titolo, descrizione, luogo,
      userId: currentUser.uid,
      userName: currentUser.displayName,
      prenotazioni: []
    });
    alert('Annuncio pubblicato');
    document.getElementById('nuovoAnnuncioPanel').classList.add('hidden');
  } catch (e) {
    alert('Errore pubblicazione: ' + e.message);
  }
};

// Carica annunci
function caricaAnnunci() {
  db.collection('annunci').onSnapshot(snapshot => {
    const container = document.getElementById('annunci');
    container.innerHTML = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      const div = document.createElement('div');
      div.className = 'annuncio';
      div.innerHTML = `<h3>\${data.titolo}</h3><p>\${data.descrizione}</p>
        <p><strong>Luogo:</strong> \${data.luogo}</p>
        <p>Prenotati: \${data.prenotazioni.length}</p>
        <button onclick="prenotaAnnuncio('\${doc.id}')">Prenota</button>
        <button onclick="apriChat('\${data.userId}')">Contatta</button>`;
      container.appendChild(div);
    });
  });
}

// Prenota annuncio
window.prenotaAnnuncio = async (id) => {
  try {
    await db.collection('annunci').doc(id).update({
      prenotazioni: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });
  } catch (e) {
    alert('Errore prenotazione: ' + e.message);
  }
};

// Chat
window.apriChat = (otherUserId) => {
  const chatId = [currentUser.uid, otherUserId].sort().join('_');
  currentChatId = chatId;
  document.getElementById('chatWindow').classList.remove('hidden');

  db.collection('messages').doc(chatId).collection('msgs').orderBy('timestamp')
    .onSnapshot(snapshot => {
      const chatDiv = document.getElementById('chatMessages');
      chatDiv.innerHTML = '';
      snapshot.forEach(doc => {
        const msg = doc.data();
        const p = document.createElement('p');
        p.textContent = msg.senderName + ': ' + msg.text;
        chatDiv.appendChild(p);
      });
    });
};

document.getElementById('closeChat').onclick = () => document.getElementById('chatWindow').classList.add('hidden');
document.getElementById('sendMsg').onclick = async () => {
  const text = document.getElementById('chatInput').value;
  if(!text) return;
  await db.collection('messages').doc(currentChatId).collection('msgs').add({
    text,
    senderId: currentUser.uid,
    senderName: currentUser.displayName,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('chatInput').value = '';
};
