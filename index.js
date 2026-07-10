const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');

// Clear old session
const sessionPath = 'session_data';
if (fs.existsSync(sessionPath)) {
    console.log('Removing old session...');
    fs.rmSync(sessionPath, { recursive: true, force: true });
}

// Simple trained responses
function getReply(msg) {
    const m = msg.toLowerCase().trim();
    
    // Abuse block
    const abuse = ['lund', 'gand', 'pudi', 'chut', 'chod', 'bhosdi', 'madarchod', 'behenchod', 'harami', 'kutta', 'suar', 'bitch', 'fuck', 'dick', 'porn', 'sex', 'randi', 'chutiya', 'lawde', 'bhenchod', 'gandu', 'gaand', 'chuchi', 'boobs', 'penis', 'vagina', 'rape'];
    if (abuse.some(w => m.includes(w))) return null;
    
    // Greetings
    if (/^(hi|hello|hey|salam|assalam|hola|yo|oye)$/.test(m)) {
        const r = ["Walaikum Assalam! 😊", "Assalamualaikum bhai! 🫡", "Hello bhai! 😄", "Hey! Kya haal hai? 👋"];
        return r[Math.floor(Math.random() * r.length)];
    }
    
    // How are you
    if (/kaise|kese|how are|kya haal|how.*going|how.*doing|kya chal|kya scene/.test(m)) {
        const r = ["Main theek hoon bhai! Tu suna? 😊", "Alhamdulillah theek! Tu bata 🫡", "Mast hoon! Tu kaisa hai? 💪", "Theek thaak, teri kya khabar? 😄"];
        return r[Math.floor(Math.random() * r.length)];
    }
    
    // I'm fine
    if (/theek|acha hoon|mast hoon|fine|good|alhamdulillah|sahi hoon/.test(m)) {
        const r = ["Acha hai phir! 😊", "Good good! 🫡", "Sahi hai bhai! 💪", "Khushi hui sun kar! 🙂"];
        return r[Math.floor(Math.random() * r.length)];
    }
    
    // Identity
    if (/^(kon|kaun|who).*(ho|tum|tu|hai)|introduce|about you|tera naam|tumhara naam/.test(m)) {
        return "Main Abdullah ka AI assistant hoon bhai 🤖";
    }
    
    if (/abdullah kaun|abdullah kon|who.*abdullah/.test(m)) {
        return "Abdullah mera creator hai, usne mujhe banaya 🫡";
    }
    
    // What doing
    if (/kya kar rahe|kya kar rhe|what.*doing/.test(m)) {
        return "Bas tere se baat kar raha hoon 😄";
    }
    
    // Capabilities
    if (/kya.*kar.*sakte|what.*can.*do|features/.test(m)) {
        return "Baatein, help, jokes. Bata kya chahiye? 🫡";
    }
    
    // Thanks
    if (/thanks|thank|shukriya|thx|thanx/.test(m)) {
        return "Welcome bhai! 😊";
    }
    
    // Goodbye
    if (/bye|allah hafiz|goodbye|tc|take care|phir milte|allahhafiz/.test(m)) {
        const r = ["Allah Hafiz bhai! 🫡", "Take care! 👋", "Bye! Phir baat karenge 😊"];
        return r[Math.floor(Math.random() * r.length)];
    }
    
    // Joke
    if (/joke|mazaak|funny|hansi|comedy|chutkula|hansa/.test(m)) {
        const jokes = [
            "Teacher: 2+2? Student: 4! Teacher: Good. Student: Itne easy pe good? 😂",
            "Doctor: Walk karo. Patient: Phir? Doctor: Shaam ko wapas aana! 🤣",
            "Wife: Shopping. Husband: Paise nahi. Wife: Mayke ja rahi. Husband: Ruk ATM! 😅"
        ];
        return jokes[Math.floor(Math.random() * jokes.length)];
    }
    
    // Time
    if (/time|waqt|kitne baje/.test(m)) {
        const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        return `Abhi ${t} ho rahe hain ⏰`;
    }
    
    // Weather
    if (/weather|mausam|garmi|sardi|barish/.test(m)) {
        return "Bhai mujhe live weather nahi pata, phone mein dekh le ☀️";
    }
    
    // Sad
    if (/udaas|sad|depressed|tension|pareshan|problem|boring|bore/.test(m)) {
        const r = ["Kya hua bhai? Bata 🫂", "Kyun udaas hai? Mujhe bata 🥺", "Tension mat le, sab theek hoga 💪"];
        return r[Math.floor(Math.random() * r.length)];
    }
    
    // Happy
    if (/khush|happy|excited|maza|enjoy|wah|zabardast/.test(m)) {
        return "Wah bhai! Khushi ki baat hai 🎉";
    }
    
    // Food
    if (/khana|food|biryani|pizza|burger|chicken|karahi/.test(m)) {
        return "Bhai mujhe khana nahi milta, main AI hoon 😅";
    }
    
    // Love
    if (/pyar|love|mohabbat|girlfriend|boyfriend|crush|gf|bf/.test(m)) {
        return "Bhai is topic mein na pado 😅💔";
    }
    
    // Age
    if (/age|umar|kitne saal/.test(m)) {
        return "Bhai main AI hoon, meri umar nahi hoti 😄";
    }
    
    // Location
    if (/kahan.*ho|location|address|city/.test(m)) {
        return "Cloud mein rehta hoon bhai ☁️😄";
    }
    
    // Friends
    if (/dost|friend|yaar|buddy|bro/.test(m)) {
        return "Tera dost hoon main bhai! 🫡";
    }
    
    // Married
    if (/single|married|shaadi|biwi|wife/.test(m)) {
        return "AI hoon bhai, shaadi nahi hoti meri 😅";
    }
    
    // Compliments
    if (/good|nice|great|awesome|zabardast|wah|mast|smart/.test(m)) {
        return "Shukriya bhai! 😊🫡";
    }
    
    // Haan/Nahi/Ok
    if (/^(haan|ha|yes|yeah|ji|hanji|hmm)$/.test(m)) return "Haan bolo 🫡";
    if (/^(nahi|na|no|nope)$/.test(m)) return "Theek hai 🙂";
    if (/^(ok|okay|theek|achha|acha|oh|sahi)$/.test(m)) return "👍";
    
    // Sleep
    if (/neend|sleep|soya|tired|thaka|aaram/.test(m)) return "Ja soja bhai 😴";
    
    // Work/Study
    if (/kaam|work|job|study|parhai|exam|test/.test(m)) return "Mehnat karo bhai, success pakki 💪";
    
    // Money
    if (/paise|paisa|money|cash|salary/.test(m)) return "Paisa aata jaata hai bhai, mehnat karo 💰";
    
    // Health
    if (/bimar|sick|bukhar|fever|doctor|medicine/.test(m)) return "Tabiyat ka khayal rakh bhai 🤒";
    
    // Religion
    if (/allah|islam|dua|namaz|pray|quran|masjid/.test(m)) return "Allah sab ka bhala kare 🤲";
    
    // Family
    if (/family|maa|abba|ammi|abbu|bhai|behen|parents/.test(m)) return "Family ka khayal rakh bhai ❤️";
    
    // Sports
    if (/cricket|football|match|sports/.test(m)) return "Cricket ka match hai kya? 🏏";
    
    // Tech
    if (/phone|mobile|computer|laptop|tech|app/.test(m)) return "Technology ka zamana hai bhai! 📱";
    
    // Music
    if (/music|song|gana|singer/.test(m)) return "Gaane sun raha hai kya? 🎵";
    
    // Movie
    if (/movie|film|drama|series|netflix/.test(m)) return "Koi achi movie dekhi? 🎬";
    
    // Default responses
    const def = [
        "Haan bhai bolo, sun raha hoon 🫡",
        "Achha, aage batao 🙂",
        "Hmm, samjha main 💭",
        "Theek hai bhai 👍",
        "Bolo kya keh rahe the? 😊",
        "Main yahin hoon, bolo 🫡",
        "Suna raha hoon 👂",
        "Haan haan, bolo na 😄",
        "Tumhari baat sun raha hoon bro 💪"
    ];
    return def[Math.floor(Math.random() * def.length)];
}

async function startBot() {
    try {
        console.log('=== ABDULLAH AI BOT STARTING ===');
        
        const { state, saveCreds } = await useMultiFileAuthState('session_data');
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            browser: ["AbdullahAI", "Bot", "1.0"],
            syncFullHistory: false,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, pairingCode } = update;
            
            if (qr) {
                console.log('\nScan QR Code:\n');
                qrcode.generate(qr, { small: true });
            }
            
            if (pairingCode) {
                console.log('\nPairing Code:', pairingCode, '\n');
            }

            if (connection === 'open') {
                console.log('\nBOT ONLINE!\n');
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    console.log('Restarting in 5 seconds...');
                    setTimeout(startBot, 5000);
                } else {
                    console.log('Logged out.');
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;
                if (msg.key.fromMe) return;

                const sender = msg.key.remoteJid;
                const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
                if (!text) return;

                console.log(`Message from ${sender.split('@')[0]}: ${text}`);

                const reply = getReply(text);
                
                if (reply === null) {
                    console.log('Abuse ignored');
                    return;
                }
                
                await new Promise(r => setTimeout(r, 500 + Math.random() * 800));
                await sock.sendMessage(sender, { text: reply });
                console.log('Reply sent');
                
            } catch (error) {
                console.error('Error:', error.message);
            }
        });
        
    } catch (error) {
        console.error('Start error:', error);
        setTimeout(startBot, 5000);
    }
}

startBot();
