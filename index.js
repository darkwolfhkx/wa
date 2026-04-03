const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');

// ===== CONFIG =====
const API_KEY = "ak_2jA9Ct99M7fv0b18Hl2Zu24y2iI1Y";
const BASE_URL = "https://api.longcat.chat/openai/v1/chat/completions";
const MODEL_NAME = "LongCat-Flash-Chat";

// ===== CLEAR SESSION =====
if (fs.existsSync('session_data')) {
    fs.rmSync('session_data', { recursive: true, force: true });
}

// ===== GREETINGS =====
const greetings = [
    "Assalamualaikum 😊",
    "Salam dost 👋",
    "Assalamualaikum wa Rahmatullah 🌸",
    "Salam! Kya haal hain? ✨"
];

// ===== MEMORY =====
const userConversations = new Map();

// ===== SYSTEM PROMPT =====
const SYSTEM_PROMPT = `
Tum Abdullah ka AI assistant ho.
Roman Urdu use karo.
Friendly tone rakho.
Har reply unique ho.
`;

// ===== AI =====
async function getResponse(userMessage, userId) {
    try {
        if (!userConversations.has(userId)) {
            userConversations.set(userId, []);
        }

        const msgs = userConversations.get(userId);
        msgs.push({ role: "user", content: userMessage });

        const res = await axios.post(BASE_URL, {
            model: MODEL_NAME,
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...msgs],
            temperature: 0.9
        }, {
            headers: {
                Authorization: `Bearer ${API_KEY}`
            }
        });

        let reply = res.data.choices[0].message.content;

        const greet = greetings[Math.floor(Math.random() * greetings.length)];

        reply = `${greet}

🤖 Main Abdullah ka AI assistant hoon

${reply}`;

        msgs.push({ role: "assistant", content: reply });

        return reply;

    } catch {
        return "Assalamualaikum 🤖 Main Abdullah ka AI assistant hoon. Error aa gaya!";
    }
}

// ===== START =====
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    // 🔥 FORCE PAIRING CODE
    setTimeout(async () => {
        try {
            const code = await sock.requestPairingCode("923360059371"); // ← apna number yahan

            console.log("\n📱 LOGIN WITH PHONE NUMBER");
            console.log("🔑 Pairing Code:", code);

            console.log(`
Steps:
1. WhatsApp open karo
2. Linked Devices
3. Link a Device
4. "Link with phone number"
5. Ye code dalo
            `);

        } catch (err) {
            console.log("❌ Pairing error:", err.message);
        }
    }, 3000);

    // CONNECTION
    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;

        if (qr) {
            console.log("\n📱 Scan QR Code:\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log("✅ BOT CONNECTED");
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // MESSAGES
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (!text) return;

        const reply = await getResponse(text, sender);
        await sock.sendMessage(sender, { text: reply });
    });
}

startBot();
