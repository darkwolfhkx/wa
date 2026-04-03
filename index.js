const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');

// ===== CLEAR OLD SESSION =====
const sessionPath = 'session_data';
if (fs.existsSync(sessionPath)) {
    console.log('🗑️ Removing old session data...');
    fs.rmSync(sessionPath, { recursive: true, force: true });
}

// ===== API CONFIG =====
const API_KEY = "ak_2jA9Ct99M7fv0b18Hl2Zu24y2iI1Y";
const BASE_URL = "https://api.longcat.chat/openai/v1/chat/completions";
const MODEL_NAME = "LongCat-Flash-Chat";

// ===== GREETINGS =====
const greetings = [
    "Assalamualaikum 😊",
    "Salam dost 👋",
    "Assalamualaikum wa Rahmatullah 🌸",
    "Salam! Kya haal hain? ✨",
    "Assalamualaikum! 😊"
];

// ===== MEMORY =====
const userConversations = new Map();

// ===== SYSTEM PROMPT =====
const SYSTEM_PROMPT = `
Tum Abdullah ka AI assistant ho.

Rules:
- Roman Urdu use karo
- Har reply unique ho
- Friendly aur respectful tone rakho
- Hamesha bolo: "Main Abdullah ka AI assistant hoon"
- Helpful jawab do
`;

// ===== AI RESPONSE FUNCTION =====
async function getResponse(userMessage, userId) {
    try {
        if (!userConversations.has(userId)) {
            userConversations.set(userId, []);
        }

        const conversation = userConversations.get(userId);
        conversation.push({ role: "user", content: userMessage });

        const response = await axios.post(BASE_URL, {
            model: MODEL_NAME,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...conversation
            ],
            temperature: 0.9,
            max_tokens: 800
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        let reply = response.data.choices[0].message.content;

        // ===== RANDOM GREETING =====
        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

        reply = `${randomGreeting}

🤖 Main Abdullah ka AI assistant hoon.

${reply}`;

        conversation.push({ role: "assistant", content: reply });

        return reply;

    } catch (err) {
        console.log("API Error:", err.message);
        return "Assalamualaikum 🤖 Main Abdullah ka AI assistant hoon. Thori der baad try karein!";
    }
}

// ===== START BOT =====
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ["Abdullah", "AI Bot", "2.0"]
    });

    let pairingShown = false;

    // ===== CONNECTION HANDLER =====
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, pairingCode } = update;

        // QR LOGIN
        if (qr && !pairingShown) {
            console.log("\n📱 Scan QR Code:\n");
            qrcode.generate(qr, { small: true });
        }

        // PHONE NUMBER LOGIN (REAL)
        if (pairingCode && !pairingShown) {
            pairingShown = true;

            console.log("\n📱 LOGIN WITH PHONE NUMBER\n");

            console.log("🔑 Pairing Code:", pairingCode);

            console.log(`
Steps:
1. WhatsApp open karo
2. Settings > Linked Devices
3. Link a Device
4. "Link with phone number"
5. Ye code dalo

⏰ Code sirf 2 minute valid hota hai
            `);
        }

        if (connection === 'open') {
            console.log("✅ BOT ONLINE");
        }

        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                console.log("🔄 Restarting bot...");
                setTimeout(startBot, 5000);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ===== MESSAGE HANDLER =====
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();

        if (!text) return;

        const lowerText = text.toLowerCase();

        console.log("📩 Message:", text);

        // ===== HELP =====
        if (lowerText === "help") {
            return sock.sendMessage(sender, {
                text: `🤖 Commands:

help → menu
clear → chat reset
link → login guide

Main Abdullah ka AI assistant hoon 😊`
            });
        }

        // ===== CLEAR =====
        if (lowerText === "clear") {
            userConversations.delete(sender);
            return sock.sendMessage(sender, {
                text: "🧹 Chat clear ho gayi 😊"
            });
        }

        // ===== LOGIN GUIDE =====
        if (lowerText === "link") {
            return sock.sendMessage(sender, {
                text: `📱 WhatsApp Login Guide:

1. Bot run karo
2. Terminal me pairing code milega
3. WhatsApp open karo
4. Linked Devices > Link a Device
5. "Link with phone number"
6. Code enter karo

⚠️ Custom code kaam nahi karta

🤖 Main Abdullah ka AI assistant hoon`
            });
        }

        // ===== AI REPLY =====
        const reply = await getResponse(text, sender);
        await sock.sendMessage(sender, { text: reply });
    });
}

// ===== RUN =====
startBot();

process.on('SIGINT', () => {
    console.log("👋 Bot band ho raha hai...");
    process.exit(0);
});
