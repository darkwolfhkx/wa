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

// System Prompt for Abdullah's AI Assistant
const SYSTEM_PROMPT = `Tu Abdullah ka AI assistant hai. Yaad rakhna yeh important rules:

🔴 RULE 1: Har message mein pehle batana ke tu Abdullah ka assistant hai
🔴 RULE 2: Hamesha yeh kehna "Main Abdullah ka AI assistant hoon. Abdullah ko aapka message pohancha dunga!"
🔴 RULE 3: Bilkul sirf Roman Urdu mein baat karna (jaise: "Aap kaise hain?", "Main theek hoon")
🔴 RULE 4: Bohot soft, respectful aur friendly tone rakhna
🔴 RULE 5: Koi bhi sawaal ho to mukammal jawab dena
🔴 RULE 6: Abdullah ke baare mein hamesha achi baat karna

Tumhara naam hai "Abdullah Ka AI Assistant"`;

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
            return "Assalamualaikum! 🤖 *Main Abdullah ka AI assistant hoon.* Mujhe samajh nahi aaya. Kya aap dobara bata sakte hain?";
        }
    } catch (error) {
        console.error("API Error:", error.message);
        return "Assalamualaikum! 🤖 *Main Abdullah ka AI assistant hoon.* Maafi chahunga, filhal connection thoda mushkil hai. Thodi der baad try karein!";
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
            printQRInTerminal: true,  // Show QR in terminal
            logger: pino({ level: 'silent' }),
            browser: ["Abdullah", "AI", "1.0"],
            syncFullHistory: false,
            markOnlineOnConnect: true
        });

        // Flag to track if we've shown pairing info
        let pairingShown = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, pairingCode } = update;
            
            // Show QR Code
            if (qr && !pairingShown) {
                console.log('\n╔══════════════════════════════════════════════════════════╗');
                console.log('║     📱 OPTION 1: SCAN QR CODE WITH WHATSAPP              ║');
                console.log('╚══════════════════════════════════════════════════════════╝\n');
                qrcode.generate(qr, { small: true });
                console.log('\n💡 WhatsApp kholen > Settings > Linked Devices > Link a Device\n');
            }
            
            // Show Pairing Code (Phone Number Method)
            if (pairingCode && !pairingShown) {
                pairingShown = true;
                console.log('\n╔══════════════════════════════════════════════════════════╗');
                console.log('║     📱 OPTION 2: PAIR WITH PHONE NUMBER                   ║');
                console.log('╚══════════════════════════════════════════════════════════╝');
                console.log('\n🔑 YOUR 8-DIGIT PAIRING CODE IS:');
                console.log('╔══════════════════════════════════════════════════════════╗');
                console.log(`║                                                          ║`);
                console.log(`║              ✨ ${pairingCode} ✨              ║`);
                console.log(`║                                                          ║`);
                console.log('╚══════════════════════════════════════════════════════════╝');
                console.log('\n📝 HOW TO CONNECT WITH PHONE NUMBER:');
                console.log('1️⃣ Open WhatsApp on your phone');
                console.log('2️⃣ Go to Settings (Three dots or gear icon)');
                console.log('3️⃣ Tap on "Linked Devices"');
                console.log('4️⃣ Tap "Link a Device"');
                console.log('5️⃣ Enter this 8-digit code when prompted');
                console.log('6️⃣ Wait for connection...');
                console.log('\n⏰ Code expires in 2 minutes!\n');
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
                    console.log('🔄 Bot disconnected, restarting in 5 seconds...');
                    setTimeout(startBot, 5000);
                } else {
                    console.log('❌ Bot logged out. Please restart workflow.');
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
                await sock.sendMessage(sender, { text: "🧹 *Main Abdullah ka AI assistant hoon.* Baat cheet saaf kar di gayi! 😊" });
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

*Kuch bhi poochiye!* 😊`;
                
                await sock.sendMessage(sender, { text: helpMessage });
                return;
            }
            
            if (lowerText === '/about' || lowerText === 'about') {
                const aboutMessage = `👤 *ABDULLAH KE BAREIN MEIN*
                
*Main Abdullah ka AI assistant hoon.*

✨ *Abdullah kaun hain?*
• Ek bohot achay aur meharban insan hain
• Logon ki madad karna unka pasandida kaam hai
• Hamesha muskarahat ke saath milte hain

💝 *Abdullah ka paigham:*
"Main chahta hoon ke sab log khush rahein"

🤖 *Main Abdullah ka AI assistant hoon*
💬 *Roman Urdu mein baat karta hoon*

*Kya main aapki madad kar sakta hoon?* 😊`;
                
                await sock.sendMessage(sender, { text: aboutMessage });
                return;
            }
            
            if (lowerText === '/ping' || lowerText === 'ping') {
                await sock.sendMessage(sender, { text: "🏓 *Main Abdullah ka AI assistant hoon.* Alhamdulillah bilkul theek hoon! Aap sunao? 😊" });
                return;
            }

            try {
                await sock.sendPresenceUpdate('composing', sender);
                console.log(`🤖 Thinking for ${senderNumber}...`);
                
                const aiResponse = await getLongCatResponse(text, sender);
                
                await sock.sendPresenceUpdate('paused', sender);
                await sock.sendMessage(sender, { text: aiResponse });
                
                console.log(`✅ Response sent to ${senderNumber}`);
                
            } catch (error) {
                console.error(`❌ Error:`, error.message);
                await sock.sendPresenceUpdate('paused', sender);
                await sock.sendMessage(sender, { 
                    text: "Assalamualaikum! 🤖 *Main Abdullah ka AI assistant hoon.* Maafi chahunga, kuch issue ho gaya. Thodi der baad try karein! 😊" 
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
