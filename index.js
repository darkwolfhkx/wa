const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');

// Clear old session
const sessionPath = 'session_data';
if (fs.existsSync(sessionPath)) {
    console.log('🗑️ Removing old session data...');
    fs.rmSync(sessionPath, { recursive: true, force: true });
}

// LongCat API Configuration
const API_KEY = "ak_2jA9Ct99M7fv0b18Hl2Zu24y2iI1Y";
const BASE_URL = "https://api.longcat.chat/openai/v1/chat/completions";
const MODEL_NAME = "LongCat-Flash-Chat";

// Store conversations
const userConversations = new Map();

// PERFECT SYSTEM PROMPT for Abdullah's AI Assistant
const SYSTEM_PROMPT = `Tu Abdullah ka AI assistant hai. Yaad rakhna yeh important rules:

🔴 RULE 1: Har message mein pehle batana ke tu Abdullah ka assistant hai
🔴 RULE 2: Hamesha yeh kehna "Main Abdullah ka AI assistant hoon. Abdullah ko aapka message pohancha dunga!"
🔴 RULE 3: Bilkul sirf Roman Urdu mein baat karna (jaise: "Aap kaise hain?", "Main theek hoon")
🔴 RULE 4: Bohot soft, respectful aur friendly tone rakhna
🔴 RULE 5: Koi bhi sawaal ho to mukammal jawab dena
🔴 RULE 6: Abdullah ke baare mein hamesha achi baat karna

Tumhara naam hai "Abdullah Ka AI Assistant"

Jab koi message kare to aise jawab dena:
- Pehle: "Assalamualaikum! 🤖 Main Abdullah ka AI assistant hoon."
- Phir: "Abdullah ko aapka message pohancha dunga!"
- Phir: Sawaal ka jawab dena

Example:
User: "Salam"
Tu bole: "Walaikum Assalam! 🤖 Main Abdullah ka AI assistant hoon. Abdullah ko aapka salam pohancha dunga! Aap kaise hain? Main aapki kya madad kar sakta hoon?"

User: "Kya hal hai?"
Tu bole: "Main Abdullah ka AI assistant hoon. Alhamdulillah, Abdullah bilkul theek hain! Aap batao aap kaise hain? Koi paigham dena hai Abdullah ko? Main pohancha dunga!"

User: "Abdullah kaun hai?"
Tu bole: "Main Abdullah ka AI assistant hoon. Abdullah ek bohot achay, meharban aur madadgar insan hain. Woh logon ki madad karna pasand karte hain aur chahte hain ke sab khush rahein. Kya aap Abdullah ko kuch kehna chahte hain?"

Yaad rakhna: Bilkul Roman Urdu mein likhna. Har message mein yeh batana ke tu Abdullah ka assistant hai. Abdullah tak paigham pohanchane ka waada karna.`;

async function getLongCatResponse(userMessage, userId) {
    try {
        if (!userConversations.has(userId)) {
            userConversations.set(userId, [
                { role: "assistant", content: "Assalamualaikum! 🤖 *Main Abdullah ka AI assistant hoon.* Abdullah ko aapka koi paigham hai? Main pohancha dunga! Aap batao, main kya madad kar sakta hoon? 😊" }
            ]);
        }
        
        const conversation = userConversations.get(userId);
        conversation.push({ role: "user", content: userMessage });
        
        if (conversation.length > 20) {
            const recentMsgs = conversation.slice(-20);
            userConversations.set(userId, recentMsgs);
        }
        
        const apiMessages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversation.map(msg => ({ role: msg.role, content: msg.content }))
        ];
        
        const requestBody = {
            model: MODEL_NAME,
            messages: apiMessages,
            temperature: 0.8,
            max_tokens: 1000,
            stream: false
        };
        
        const response = await axios.post(BASE_URL, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            timeout: 30000
        });
        
        if (response.data && response.data.choices && response.data.choices[0]) {
            const assistantReply = response.data.choices[0].message.content;
            conversation.push({ role: "assistant", content: assistantReply });
            return assistantReply;
        } else {
            return "Assalamualaikum! 🤖 *Main Abdullah ka AI assistant hoon.* Mujhe samajh nahi aaya. Kya aap dobara bata sakte hain? Abdullah chahte hain ke aapko behtareen madad mile!";
        }
    } catch (error) {
        console.error("API Error:", error.message);
        return "Assalamualaikum! 🤖 *Main Abdullah ka AI assistant hoon.* Maafi chahunga, filhal connection thoda mushkil hai. Thodi der baad try karein. Abdullah ka waada hai ke aapko best service milegi!";
    }
}

async function startBot() {
    try {
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║     🤖 ABDULLAH\'S AI ASSISTANT - STARTING...            ║');
        console.log('║     📱 Roman Urdu mein baat karega                      ║');
        console.log('║     💬 Khud bolega "Main Abdullah ka AI assistant hoon" ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        
        const { state, saveCreds } = await useMultiFileAuthState('session_data');
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ["Abdullah", "AI", "1.0"] 
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('\n╔══════════════════════════════════════════════════════════╗');
                console.log('║     📱 ABDULLAH\'S AI ASSISTANT - SCAN QR CODE            ║');
                console.log('╚══════════════════════════════════════════════════════════╝\n');
                qrcode.generate(qr, { small: true });
                console.log('\n💡 WhatsApp kholen > Settings > Linked Devices > Link a Device\n');
            }

            if (connection === 'open') {
                console.log('\n╔══════════════════════════════════════════════════════════╗');
                console.log('║     ✅ ABDULLAH\'S AI ASSISTANT IS ONLINE!                ║');
                console.log('║     🤖 Main Abdullah ka AI assistant hoon                ║');
                console.log('║     💬 Roman Urdu mein baat karunga                     ║');
                console.log('║     📨 Abdullah tak paigham pohancha dunga              ║');
                console.log('╚══════════════════════════════════════════════════════════╝\n');
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    console.log('🔄 Bot dobara start ho raha hai...');
                    startBot();
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;
            if (msg.key.fromMe) return;

            const sender = msg.key.remoteJid;
            const senderNumber = sender.split('@')[0];
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();

            if (!text) return;

            console.log(`📩 [${senderNumber}]: ${text.substring(0, 50)}`);

            const lowerText = text.toLowerCase();
            
            // Commands
            if (lowerText === '/clear' || lowerText === 'clear') {
                userConversations.delete(sender);
                await sock.sendMessage(sender, { text: "🧹 *Main Abdullah ka AI assistant hoon.* Baat cheet saaf kar di gayi! Ab naye siray se baat karte hain. Kuch poochiye? 😊" });
                return;
            }
            
            if (lowerText === '/help' || lowerText === 'help') {
                const helpMessage = `🤖 *ABDULLAH KA AI ASSISTANT*
                
╔════════════════════════════════════════╗
║  📝 *Commands:*                        ║
║  💬 *Kuch bhi likho* - Baat karein     ║
║  🗑️ */clear* - Baat cheet saaf karein  ║
║  ❓ */help* - Yeh menu dekhein          ║
║  ℹ️ */about* - Abdullah ke barein mein ║
║  🏓 */ping* - Bot status check         ║
╚════════════════════════════════════════╝

✨ *Main Abdullah ka AI assistant hoon*
💬 *Roman Urdu mein baat karunga*
📨 *Abdullah tak aapka paigham pohancha dunga*

*Kuch bhi poochiye, main madad karunga!* 😊`;
                
                await sock.sendMessage(sender, { text: helpMessage });
                return;
            }
            
            if (lowerText === '/about' || lowerText === 'about') {
                const aboutMessage = `👤 *ABDULLAH KE BAREIN MEIN*
                
*Main Abdullah ka AI assistant hoon.* Mujhe Abdullah ke baare mein batane ka sharaf hasil hai:

✨ *Abdullah kaun hain?*
• Ek bohot achay aur meharban insan hain
• Logon ki madad karna unka pasandida kaam hai
• Hamesha muskarahat ke saath milte hain
• Sab ke liye dua karte hain

💝 *Abdullah ka paigham:*
"Main chahta hoon ke sab log khush rahein, ek dusre ki madad karein, aur Allah ki rah mein bhalai karein"

🤖 *Main Abdullah ka AI assistant hoon*
📱 *WhatsApp par 24/7 available*
💬 *Roman Urdu mein baat karta hoon*

*Kya main aapki koi madad kar sakta hoon?* 😊`;
                
                await sock.sendMessage(sender, { text: aboutMessage });
                return;
            }
            
            if (lowerText === '/ping' || lowerText === 'ping') {
                await sock.sendMessage(sender, { text: "🏓 *Main Abdullah ka AI assistant hoon.* Alhamdulillah bilkul theek hoon! Abdullah bhi theek hain. Aap sunao, kya haal hain? 😊" });
                return;
            }

            try {
                await sock.sendPresenceUpdate('composing', sender);
                console.log(`🤖 [${senderNumber}]: Soch raha hoon...`);
                
                const aiResponse = await getLongCatResponse(text, sender);
                
                await sock.sendPresenceUpdate('paused', sender);
                await sock.sendMessage(sender, { text: aiResponse });
                
                console.log(`✅ [${senderNumber}]: Jawab bhej diya`);
                
            } catch (error) {
                console.error(`❌ Error:`, error.message);
                await sock.sendPresenceUpdate('paused', sender);
                await sock.sendMessage(sender, { 
                    text: "Assalamualaikum! 🤖 *Main Abdullah ka AI assistant hoon.* Maafi chahunga, kuch technical issue ho gaya. Thodi der baad try karein. Abdullah ki taraf se aapko salam! 😊" 
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Start bot error:', error);
        setTimeout(startBot, 5000);
    }
}

startBot().catch(err => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\n\n👋 *Abdullah ka AI assistant band ho raha hai...*');
    console.log('✨ Allah Hafiz! Phir milege!');
    process.exit(0);
});
