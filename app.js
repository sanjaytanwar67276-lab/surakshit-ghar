// --- FIREBASE SETUP ---
const firebaseConfig = {
    apiKey: "AIzaSyAy14hJ2MPReimA6L0O3oBZsF4y1OZtoUE",
    authDomain: "surakshit-ghar-a9cf2.firebaseapp.com",
    databaseURL: "https://surakshit-ghar-a9cf2-default-rtdb.firebaseio.com",
    projectId: "surakshit-ghar-a9cf2",
    storageBucket: "surakshit-ghar-a9cf2.firebasestorage.app",
    messagingSenderId: "1002819775934",
    appId: "1:1002819775934:web:f5b2267560c29b195addef"
};
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

let myName = "";
let myFamilyCode = "";
let timerId = null;
const tickSound = new Audio('https://www.soundjay.com/buttons/sounds/button-09.mp3'); 

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

window.onload = function() {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    let savedName = localStorage.getItem("sg_name");
    let savedCode = localStorage.getItem("sg_code");
    if(savedName && savedCode) {
        document.getElementById('user-name').value = savedName;
        document.getElementById('family-code').value = savedCode;
        login(); 
    }
}

function showNotification(title, message) {
    if (Notification.permission === "granted") {
        new Notification(title, { body: message, icon: "https://cdn-icons-png.flaticon.com/512/1161/1161388.png" });
    }
}

function generateCode() {
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newCode = '';
    for (let i = 0; i < 6; i++) { newCode += chars.charAt(Math.floor(Math.random() * chars.length)); }
    document.getElementById('family-code').value = newCode;
}

function showScreen(screenId) {
    ['login-screen', 'dashboard-screen', 'sender-screen', 'receiver-screen', 'helpline-screen'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    document.getElementById(screenId).style.display = 'block';
    if(screenId === 'receiver-screen') { loadFamilyData(); }
}

function login() {
    let n = document.getElementById('user-name').value.trim();
    let c = document.getElementById('family-code').value.trim();
    if(n === "" || c === "") return alert("Please enter both Name and Family Group Code.");
    
    myName = n; myFamilyCode = c.toUpperCase();
    localStorage.setItem("sg_name", myName); localStorage.setItem("sg_code", myFamilyCode);

    document.getElementById('welcome-text').innerText = "Hello, " + myName + "!";
    document.getElementById('group-code-display').innerText = myFamilyCode;
    
    showScreen('dashboard-screen');
    listenForAlerts(); loadGroupMembers(); listenForVoice();
}

function logoutApp() {
    if(confirm("🚪 Kya aap sach mein group se bahar aana chahte hain?")) {
        localStorage.removeItem("sg_name"); localStorage.removeItem("sg_code");
        window.location.reload();
    }
}

// --- SMART LOCATION CODE ---
async function updateData() {
    tickSound.play().catch(e => console.log("Sound error")); 

    let currentBat = 100;
    try {
        if (navigator.getBattery) {
            let battery = await navigator.getBattery();
            currentBat = Math.floor(battery.level * 100);
            document.getElementById('bat-stat').innerText = "Battery: " + currentBat + "%";
        }
    } catch(e) {}

    // Check if location is supported and HTTPS is used
    if (!navigator.geolocation) {
        alert("❌ Aapka phone/browser live location support nahi karta, ya aap 'http' link par hain.");
        return;
    }

    document.getElementById('loc-stat').innerText = "Fetching location...";
    document.getElementById('loc-stat').style.color = "#ffaa00";

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            document.getElementById('loc-stat').innerText = "Location: Sent Successfully ✅";
            document.getElementById('loc-stat').style.color = "#00ff88";
            db.ref('users/' + myFamilyCode + '/' + myName).set({
                lat: pos.coords.latitude, lon: pos.coords.longitude, battery: currentBat,
                time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })
            });
            showNotification("📍 Location Sent", "System Active");
        },
        function(err) {
            document.getElementById('loc-stat').innerText = "Location: Failed ❌";
            document.getElementById('loc-stat').style.color = "#ff4444";
            if(err.code === 1) alert("❌ Location Permission Denied! Phone ki settings mein Chrome ko location allow karein.");
            else if(err.code === 2) alert("❌ GPS Signal nahi mil raha. Kripya bahar open area mein aayein.");
            else alert("❌ Error: " + err.message);
        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

function startSending() {
    let interval = document.getElementById("time-slider").value;
    document.getElementById('start-btn').innerText = "🛡️ SERVICE IS RUNNING";
    document.getElementById('start-btn').style.background = "#444";
    updateData();
    if(timerId) clearInterval(timerId);
    timerId = setInterval(updateData, interval * 60 * 1000); 
}

// --- SMART MIC CODE ---
async function toggleRecording() {
    // Check for HTTPS and API support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("❌ Aapka browser Mic support nahi karta. Dhyan rahe link 'https://' se shuru hona chahiye.");
        return;
    }

    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => { if(e.data.size > 0) audioChunks.push(e.data); };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                audioChunks = []; stream.getTracks().forEach(track => track.stop()); 

                const audioUrl = URL.createObjectURL(audioBlob);
                const a = document.createElement('a'); a.href = audioUrl;
                a.download = 'Audio_' + new Date().getTime() + '.webm'; a.click(); 

                let reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = function() {
                    db.ref('voice_notes/' + myFamilyCode).push({ sender: myName, audio: reader.result, time: new Date().getTime() });
                    showNotification("🎤 Saboot Safe Hai", "Voice sent!");
                }
            };
            mediaRecorder.start(); isRecording = true;
            let btn = document.getElementById('mic-btn');
            btn.innerText = "🛑 Stop & Send Voice"; btn.style.background = "#ff4444"; 
        } catch (err) {
            alert("❌ Mic permission Denied! Chrome settings mein site ko Mic allow karein.");
        }
    } else {
        mediaRecorder.stop(); isRecording = false;
        let btn = document.getElementById('mic-btn');
        btn.innerText = "🎤 Start Voice Record"; btn.style.background = "#00d2ff";
    }
}

// --- HELPERS (SOS, Group Data, etc) ---
function sendSOS() {
    if(confirm("🚨 DANGER ALERT! Send SOS?")) {
        db.ref('alerts/' + myFamilyCode).push({ msg: "URGENT: " + myName + " needs IMMEDIATE HELP!", timestamp: new Date().getTime() });
    }
}

function listenForAlerts() {
    db.ref('alerts/' + myFamilyCode).on('child_added', (snapshot) => {
        let data = snapshot.val();
        if(data && (new Date().getTime() - data.timestamp < 60000)) {
            let alertBox = document.getElementById('danger-alert');
            alertBox.style.display = "block"; alertBox.style.background = "#ff4444"; alertBox.innerText = "⚠️ " + data.msg;
            showNotification("🚨 EMERGENCY ALERT", data.msg);
        }
    });
}

function listenForVoice() {
    db.ref('voice_notes/' + myFamilyCode).on('child_added', (snapshot) => {
        let data = snapshot.val();
        if (data && (new Date().getTime() - data.time < 120000) && data.sender !== myName) {
            let audio = new Audio(data.audio);
            audio.play().catch(e => alert("🎤 Naya voice message aaya hai '" + data.sender + "' se! (Browser blocked auto-play)"));
            let dangerBox = document.getElementById('danger-alert');
            dangerBox.style.display = "block"; dangerBox.style.background = "#00d2ff";
            dangerBox.innerText = "🎤 " + data.sender + " ka Voice Message baj raha hai!";
            showNotification("🎤 Naya Voice Message", data.sender + " ne aawaz bheji hai!");
            setTimeout(() => { dangerBox.style.display = "none"; }, 5000);
        }
    });
}

function loadGroupMembers() {
    db.ref('users/' + myFamilyCode).on('value', (snapshot) => {
        let members = [];
        snapshot.forEach((child) => { members.push("👤 " + child.key); });
        document.getElementById('group-members-list').innerHTML = members.length > 0 ? members.join("<br>") : "No members active.";
    });
}

function loadFamilyData() {
    db.ref('users/' + myFamilyCode).on('value', (snapshot) => {
        let html = ""; let hasData = false;
        snapshot.forEach((child) => {
            hasData = true; let d = child.val();
            let mapUrl = "https://www.google.com/maps/search/?api=1&query=" + d.lat + "," + d.lon;
            html += `<div class="member-card"><div class="member-name">👤 ${child.key}</div><div class="member-data">🔋 Battery: ${d.battery}%</div><div class="member-data">🕒 Last Updated: ${d.time}</div><a href="${mapUrl}" target="_blank" class="map-link">📍 View on Google Maps ➡️</a></div>`;
        });
        document.getElementById('family-list').innerHTML = hasData ? html : "No updates found.";
    });
}

function findNearby(query) { window.open("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query), "_blank"); }
function goBackFromHelpline() { showScreen(myName === "" ? 'login-screen' : 'dashboard-screen'); }
function inviteWhatsApp() { window.open("https://wa.me/?text=Surakshit Ghar code: *" + myFamilyCode + "*", "_blank"); }

const slider = document.getElementById("time-slider");
if(slider) slider.oninput = function() { document.getElementById("time-val").innerText = this.value; }

// --- 40 EMERGENCY HELPLINE NUMBERS ---
const helplines = [
    { name: "National Emergency", num: "112" }, { name: "Police", num: "100" }, { name: "Fire", num: "101" }, { name: "Ambulance", num: "102" }
];
function loadHelplines() {
    let html = "";
    helplines.forEach(h => { html += `<div class="help-item"><div class="help-info"><div class="help-name">${h.name}</div><div class="help-num">${h.num}</div></div><a href="tel:${h.num}" class="call-btn">📞 Call</a></div>`; });
    document.getElementById('helpline-list').innerHTML = html;
}
loadHelplines();
