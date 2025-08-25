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
		
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global Variables
let currentUser = null;
let userLocation = null;
let currentChatId = null;
let unsubscribeFunctions = [];

// DOM Elements
const loadingScreen = document.getElementById('loadingScreen');
const authScreen = document.getElementById('authScreen');
const mainApp = document.getElementById('mainApp');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userAvatar = document.getElementById('userAvatar');

// Navigation
const navBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Search
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const radiusSlider = document.getElementById('radiusSlider');
const radiusValue = document.getElementById('radiusValue');

// Form
const addAdForm = document.getElementById('addAdForm');

// Modals
const adModal = document.getElementById('adModal');
const chatModal = document.getElementById('chatModal');
const closeModal = document.getElementById('closeModal');
const closeChatModal = document.getElementById('closeChatModal');

// Auth State Listener
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        userAvatar.src = user.photoURL;
        showMainApp();
        getCurrentLocation();
        loadRecentAds();
        loadMyAds();
        loadConversations();
    } else {
        currentUser = null;
        showAuthScreen();
    }
});

// Show/Hide Screens
function showLoadingScreen() {
    loadingScreen.classList.remove('hidden');
    authScreen.classList.add('hidden');
    mainApp.classList.add('hidden');
}

function showAuthScreen() {
    loadingScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
    mainApp.classList.add('hidden');
}

function showMainApp() {
    loadingScreen.classList.add('hidden');
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
}

// Authentication
loginBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('Login error:', error);
        alert('Errore durante il login');
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        // Cleanup listeners
        unsubscribeFunctions.forEach(unsub => unsub());
        unsubscribeFunctions = [];
        await auth.signOut();
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Navigation
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
    });
});

function switchTab(tabName) {
    navBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName === 'my-ads' ? 'myAds' : tabName}Tab`).classList.add('active');
    
    // Load data for specific tabs
    switch(tabName) {
        case 'search':
            performSearch();
            break;
        case 'my-ads':
            loadMyAds();
            break;
        case 'messages':
            loadConversations();
            break;
    }
}

// Geolocation
function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
            },
            (error) => {
                console.warn('Geolocation error:', error);
                // Default to center of Italy if location fails
                userLocation = { lat: 41.9028, lng: 12.4964 };
            }
        );
    }
}

// Distance calculation
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Search functionality
radiusSlider.addEventListener('input', (e) => {
    radiusValue.textContent = e.target.value;
    performSearch();
});

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    if (!userLocation) return;
    
    const query = searchInput.value.toLowerCase();
    const radius = parseInt(radiusSlider.value);
    
    try {
        const snapshot = await db.collection('ads')
            .where('status', '==', 'active')
            .where('expiryDate', '>', new Date())
            .orderBy('expiryDate')
            .orderBy('createdAt', 'desc')
            .get();
        
        const results = [];
        snapshot.forEach(doc => {
            const ad = { id: doc.id, ...doc.data() };
            
            // Skip own ads
            if (ad.userId === currentUser.uid) return;
            
            // Calculate distance
            const distance = calculateDistance(
                userLocation.lat, userLocation.lng,
                ad.location.lat, ad.location.lng
            );
            
            // Filter by radius
            if (distance <= radius) {
                // Filter by search query
                if (!query || 
                    ad.title.toLowerCase().includes(query) || 
                    ad.description.toLowerCase().includes(query)) {
                    ad.distance = distance;
                    results.push(ad);
                }
            }
        });
        
        // Sort by distance
        results.sort((a, b) => a.distance - b.distance);
        
        displayAds(results, 'searchResults');
        
    } catch (error) {
        console.error('Search error:', error);
    }
}

// Load recent ads
async function loadRecentAds() {
    if (!userLocation) return;
    
    try {
        const snapshot = await db.collection('ads')
            .where('status', '==', 'active')
            .where('expiryDate', '>', new Date())
            .orderBy('expiryDate')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        
        const ads = [];
        snapshot.forEach(doc => {
            const ad = { id: doc.id, ...doc.data() };
            
            // Skip own ads
            if (ad.userId === currentUser.uid) return;
            
            // Calculate distance
            const distance = calculateDistance(
                userLocation.lat, userLocation.lng,
                ad.location.lat, ad.location.lng
            );
            
            // Only show ads within 20km
            if (distance <= 20) {
                ad.distance = distance;
                ads.push(ad);
            }
        });
        
        // Sort by distance
        ads.sort((a, b) => a.distance - b.distance);
        
        displayAds(ads, 'recentAds');
        
    } catch (error) {
        console.error('Load recent ads error:', error);
    }
}

// Display ads
function displayAds(ads, containerId) {
    const container = document.getElementById(containerId);
    
    if (ads.length === 0) {
        container.innerHTML = '<div class="ad-card"><p>Nessun annuncio trovato</p></div>';
        return;
    }
    
    container.innerHTML = ads.map(ad => {
        const expiryDate = ad.expiryDate.toDate();
        const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        const isExpiringSoon = daysLeft <= 1;
        
        return `
            <div class="ad-card" onclick="showAdDetails('${ad.id}')">
                <h3>${ad.title}</h3>
                <p>${ad.description}</p>
                <div class="ad-meta">
                    <span class="ad-distance">📍 ${ad.distance.toFixed(1)} km</span>
                    <span class="ad-expiry ${isExpiringSoon ? 'soon' : ''}">
                        ⏰ ${daysLeft === 0 ? 'Oggi' : daysLeft === 1 ? 'Domani' : `${daysLeft} giorni`}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// Add new ad
addAdForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!userLocation) {
        alert('Impossibile rilevare la posizione. Riprova.');
        return;
    }
    
    const title = document.getElementById('adTitle').value;
    const description = document.getElementById('adDescription').value;
    const expiryDate = new Date(document.getElementById('adExpiry').value);
    const locationDetails = document.getElementById('adLocation').value;
    
    // Validate expiry date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expiryDate < today) {
        alert('La data di scadenza non può essere nel passato');
        return;
    }
    
    try {
        await db.collection('ads').add({
            title,
            description,
            expiryDate,
            locationDetails,
            location: {
                lat: userLocation.lat,
                lng: userLocation.lng
            },
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: currentUser.displayName,
            userPhoto: currentUser.photoURL,
            status: 'active',
            assignedTo: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('Annuncio pubblicato con successo!');
        addAdForm.reset();
        switchTab('my-ads');
        
    } catch (error) {
        console.error('Add ad error:', error);
        alert('Errore nella pubblicazione dell\'annuncio');
    }
});

// Load my ads
async function loadMyAds() {
    try {
        const snapshot = await db.collection('ads')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        const ads = [];
        snapshot.forEach(doc => {
            ads.push({ id: doc.id, ...doc.data() });
        });
        
        displayMyAds(ads);
        
    } catch (error) {
        console.error('Load my ads error:', error);
    }
}

function displayMyAds(ads) {
    const container = document.getElementById('myAdsList');
    
    if (ads.length === 0) {
        container.innerHTML = '<div class="ad-card"><p>Non hai ancora pubblicato annunci</p></div>';
        return;
    }
    
    container.innerHTML = ads.map(ad => {
        const expiryDate = ad.expiryDate.toDate();
        const isExpired = expiryDate < new Date();
        const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        
        let statusClass = 'status-active';
        let statusText = 'Attivo';
        
        if (isExpired) {
            statusClass = 'status-expired';
            statusText = 'Scaduto';
        } else if (ad.status === 'assigned') {
            statusClass = 'status-assigned';
            statusText = 'Assegnato';
        }
        
        return `
            <div class="ad-card" onclick="showMyAdDetails('${ad.id}')">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h3>${ad.title}</h3>
                        <p>${ad.description}</p>
                    </div>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="ad-meta">
                    <span>⏰ ${isExpired ? 'Scaduto' : daysLeft === 0 ? 'Oggi' : daysLeft === 1 ? 'Domani' : `${daysLeft} giorni`}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Show ad details
async function showAdDetails(adId) {
    try {
        const doc = await db.collection('ads').doc(adId).get();
        if (!doc.exists) return;
        
        const ad = { id: doc.id, ...doc.data() };
        const expiryDate = ad.expiryDate.toDate();
        const isExpired = expiryDate < new Date();
        
        // Check if user already applied
        const applicationSnapshot = await db.collection('applications')
            .where('adId', '==', adId)
            .where('userId', '==', currentUser.uid)
            .get();
        
        const hasApplied = !applicationSnapshot.empty;
        const application = hasApplied ? applicationSnapshot.docs[0] : null;
        
        document.getElementById('modalTitle').textContent = ad.title;
        
        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <div>
                <p><strong>Descrizione:</strong> ${ad.description}</p>
                <p><strong>Scadenza:</strong> ${expiryDate.toLocaleDateString()}</p>
                <p><strong>Distanza:</strong> ${ad.distance ? ad.distance.toFixed(1) + ' km' : 'N/D'}</p>
                ${ad.locationDetails ? `<p><strong>Dettagli ritiro:</strong> ${ad.locationDetails}</p>` : ''}
                <p><strong>Pubblicato da:</strong> ${ad.userName}</p>
                
                ${!isExpired && ad.status === 'active' ? `
                    <div style="margin-top: 1rem;">
                        ${!hasApplied ? `
                            <button class="btn btn-primary" onclick="applyForAd('${adId}')">
                                <span>🙋‍♂️</span> Candidati
                            </button>
                        ` : `
                            <p style="color: green; font-weight: 600;">✅ Ti sei già candidato</p>
                            <button class="btn btn-secondary" onclick="cancelApplication('${application.id}')">
                                <span>❌</span> Annulla candidatura
                            </button>
                        `}
                        <button class="btn btn-secondary" onclick="startChat('${ad.userId}', '${ad.userName}')">
                            <span>💬</span> Contatta
                        </button>
                    </div>
                ` : `
                    <p style="color: red; font-weight: 600;">
                        ${isExpired ? '⏰ Annuncio scaduto' : '✅ Prodotto già assegnato'}
                    </p>
                `}
            </div>
        `;
        
        adModal.classList.remove('hidden');
        
    } catch (error) {
        console.error('Show ad details error:', error);
    }
}

// Show my ad details (with applicants)
async function showMyAdDetails(adId) {
    try {
        const doc = await db.collection('ads').doc(adId).get();
        if (!doc.exists) return;
        
        const ad = { id: doc.id, ...doc.data() };
        const expiryDate = ad.expiryDate.toDate();
        const isExpired = expiryDate < new Date();
        
        // Get applications for this ad
        const applicationsSnapshot = await db.collection('applications')
            .where('adId', '==', adId)
            .orderBy('createdAt')
            .get();
        
        const applications = [];
        applicationsSnapshot.forEach(doc => {
            applications.push({ id: doc.id, ...doc.data() });
        });
        
        document.getElementById('modalTitle').textContent = ad.title;
        
        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <div>
                <p><strong>Descrizione:</strong> ${ad.description}</p>
                <p><strong>Scadenza:</strong> ${expiryDate.toLocaleDateString()}</p>
                ${ad.locationDetails ? `<p><strong>Dettagli ritiro:</strong> ${ad.locationDetails}</p>` : ''}
                
                <h4 style="margin-top: 1.5rem; margin-bottom: 1rem;">
                    Candidature (${applications.length})
                </h4>
                
                ${applications.length === 0 ? `
                    <p style="color: #666;">Nessuna candidatura ancora</p>
                ` : `
                    <div class="applicants-list">
                        ${applications.map(app => `
                            <div class="applicant-item">
                                <div class="applicant-info">
                                    <img src="${app.userPhoto}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%;">
                                    <span>${app.userName}</span>
                                </div>
                                <div class="applicant-actions">
                                    ${!isExpired && ad.status === 'active' ? `
                                        <button class="btn btn-success" onclick="assignToUser('${adId}', '${app.userId}', '${app.userName}')">
                                            <span>✅</span> Assegna
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-secondary" onclick="startChat('${app.userId}', '${app.userName}')">
                                        <span>💬</span> Chat
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
                
                ${!isExpired && ad.status === 'active' ? `
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-danger" onclick="deleteAd('${adId}')">
                            <span>🗑️</span> Elimina Annuncio
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
        
        adModal.classList.remove('hidden');
        
    } catch (error) {
        console.error('Show my ad details error:', error);
    }
}

// Apply for ad
async function applyForAd(adId) {
    try {
        await db.collection('applications').add({
            adId,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: currentUser.displayName,
            userPhoto: currentUser.photoURL,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('Candidatura inviata con successo!');
        adModal.classList.add('hidden');
        
    } catch (error) {
        console.error('Apply for ad error:', error);
        alert('Errore nell\'invio della candidatura');
    }
}

// Cancel application
async function cancelApplication(applicationId) {
    try {
        await db.collection('applications').doc(applicationId).delete();
        alert('Candidatura annullata');
        adModal.classList.add('hidden');
        
    } catch (error) {
        console.error('Cancel application error:', error);
        alert('Errore nell\'annullare la candidatura');
    }
}

// Assign to user
async function assignToUser(adId, userId, userName) {
    try {
        // Update ad status
        await db.collection('ads').doc(adId).update({
            status: 'assigned',
            assignedTo: userId,
            assignedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert(`Prodotto assegnato a ${userName}!`);
        adModal.classList.add('hidden');
        loadMyAds();
        
    } catch (error) {
        console.error('Assign to user error:', error);
        alert('Errore nell\'assegnazione del prodotto');
    }
}

// Delete ad
async function deleteAd(adId) {
    if (!confirm('Sei sicuro di voler eliminare questo annuncio?')) return;
    
    try {
        // Delete applications for this ad
        const applicationsSnapshot = await db.collection('applications')
            .where('adId', '==', adId)
            .get();
        
        const batch = db.batch();
        applicationsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete the ad
        batch.delete(db.collection('ads').doc(adId));
        
        await batch.commit();
        
        alert('Annuncio eliminato');
        adModal.classList.add('hidden');
        loadMyAds();
        
    } catch (error) {
        console.error('Delete ad error:', error);
        alert('Errore nell\'eliminazione dell\'annuncio');
    }
}

// Chat functionality
function getChatId(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
}

async function startChat(otherUserId, otherUserName) {
    currentChatId = getChatId(currentUser.uid, otherUserId);
    
    document.getElementById('chatTitle').textContent = `Chat con ${otherUserName}`;
    
    // Create chat if it doesn't exist
    await db.collection('chats').doc(currentChatId).set({
        participants: [currentUser.uid, otherUserId],
        participantNames: {
            [currentUser.uid]: currentUser.displayName,
            [otherUserId]: otherUserName
        },
        lastMessage: '',
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    loadChatMessages(currentChatId);
    chatModal.classList.remove('hidden');
    adModal.classList.add('hidden');
}

function loadChatMessages(chatId) {
    // Unsubscribe from previous chat
    const existingUnsub = unsubscribeFunctions.find(unsub => unsub.chatId === chatId);
    if (existingUnsub) return;
    
    const unsubscribe = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('createdAt')
        .onSnapshot(snapshot => {
            const messages = [];
            snapshot.forEach(doc => {
                messages.push({ id: doc.id, ...doc.data() });
            });
            
            displayChatMessages(messages);
        });
    
    unsubscribe.chatId = chatId;
    unsubscribeFunctions.push(unsubscribe);
}

function displayChatMessages(messages) {
    const container = document.getElementById('chatMessages');
    
    container.innerHTML = messages.map(msg => {
        const isSent = msg.senderId === currentUser.uid;
        const time = msg.createdAt ? msg.createdAt.toDate().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
        
        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                ${msg.text}
                <div class="message-time">${time}</div>
            </div>
        `;
    }).join('');
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// Send message
document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text || !currentChatId) return;
    
    try {
        await db.collection('chats').doc(currentChatId).collection('messages').add({
            text,
            senderId: currentUser.uid,
            senderName: currentUser.displayName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update last message in chat
        await db.collection('chats').doc(currentChatId).update({
            lastMessage: text,
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        input.value = '';
        
    } catch (error) {
        console.error('Send message error:', error);
    }
}

// Load conversations
async function loadConversations() {
    try {
        const snapshot = await db.collection('chats')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('lastMessageTime', 'desc')
            .get();
        
        const conversations = [];
        snapshot.forEach(doc => {
            const chat = { id: doc.id, ...doc.data() };
            conversations.push(chat);
        });
        
        displayConversations(conversations);
        
    } catch (error) {
        console.error('Load conversations error:', error);
    }
}

function displayConversations(conversations) {
    const container = document.getElementById('conversationsList');
    
    if (conversations.length === 0) {
        container.innerHTML = '<div class="conversation-item"><p>Nessuna conversazione</p></div>';
        return;
    }
    
    container.innerHTML = conversations.map(chat => {
        const otherUserId = chat.participants.find(id => id !== currentUser.uid);
        const otherUserName = chat.participantNames[otherUserId] || 'Utente';
        const lastMessageTime = chat.lastMessageTime ? 
            chat.lastMessageTime.toDate().toLocaleString('it-IT', { 
                day: '2-digit', 
                month: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            }) : '';
        
        return `
            <div class="conversation-item" onclick="startChatById('${chat.id}', '${otherUserId}', '${otherUserName}')">
                <div class="conversation-header">
                    <span class="conversation-user">${otherUserName}</span>
                    <span class="conversation-time">${lastMessageTime}</span>
                </div>
                <div class="conversation-preview">${chat.lastMessage || 'Nessun messaggio'}</div>
            </div>
        `;
    }).join('');
}

function startChatById(chatId, otherUserId, otherUserName) {
    currentChatId = chatId;
    document.getElementById('chatTitle').textContent = `Chat con ${otherUserName}`;
    loadChatMessages(chatId);
    chatModal.classList.remove('hidden');
}

// Modal close handlers
closeModal.addEventListener('click', () => {
    adModal.classList.add('hidden');
});

closeChatModal.addEventListener('click', () => {
    chatModal.classList.add('hidden');
    currentChatId = null;
});

// Click outside to close modals
adModal.addEventListener('click', (e) => {
    if (e.target === adModal) {
        adModal.classList.add('hidden');
    }
});

chatModal.addEventListener('click', (e) => {
    if (e.target === chatModal) {
        chatModal.classList.add('hidden');
        currentChatId = null;
    }
});

// Initialize app
showLoadingScreen();