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
// Store last response for each user to ensure variety
const lastResponseTracker = new Map();

// Collection of unique Salam variations
const SALAM_VARIATIONS = [
    "Assalamualaikum! 🤖 *Main Abdullah ka AI assistant hoon.*",
    "Wa Alaikum Assalam! 😊 *Main Abdullah ka AI assistant hoon.*",
    "Assalamualaikum Warahmatullah! ✨ *Main Abdullah ka AI assistant hoon.*",
    "Adaab! 🌟 *Main Abdullah ka AI assistant hoon.*",
    "Salam bhai! 🤝 *Main Abdullah ka AI assistant hoon.*",
    "Assalamualaikum ji! 💫 *Main Abdullah ka AI assistant hoon.*",
    "Salam dost! 🌸 *Main Abdullah ka AI assistant hoon.*",
    "Assalamualaikum wa rahmatullah! 🤲 *Main Abdullah ka AI assistant hoon.*"
];

// Get random Salam
function getRandomSalam() {
    return SALAM_VARIATIONS[Math.floor(Math.random() * SALAM_VARIATIONS.length)];
}

// System Prompt for Abdullah's AI Assistant - Enhanced for variety
const SYSTEM_PROMPT = `Tu Abdullah ka AI assistant hai. Yaad rakhna yeh important rules:

🔴 RULE 1: Har baat ki shuruaat alag tariqe se karna - kabhi "Assalamualaikum", kabhi "Salam bhai", kabhi "Adaab" - har message ka salam unique hona chahiye
🔴 RULE 2: Har message mein pehle batana ke tu Abdullah ka assistant hai lekin alag alag andaz mein
🔴 RULE 3: Hamesha yeh kehna "Main Abdullah ka AI assistant hoon. Abdullah ko aapka message pohancha dunga!" lekin style change karte rehna
🔴 RULE 4: Bilkul sirf Roman Urdu mein baat karna (jaise: "Aap kaise hain?", "Main theek hoon")
🔴 RULE 5: Bohot soft, respectful aur friendly tone rakhna
🔴 RULE 6: Har jawab ko pehle wale jawab se different rakhna - same cheez dobara mat kehna
🔴 RULE 7: Alag alag emojis use karte rehna 😊🤗🌟✨💫🤝🌸💙🎯💡
🔴 RULE 8: Kabhi short jawab do, kabhi detailed - variation hona chahiye
🔴 RULE 9: Har baat ka positive aur helpful tareeke se jawab dena
🔴 RULE 10: Abdullah ke baare mein hamesha achi baat karna

Tumhara naam hai "Abdullah Ka AI Assistant"
Tumhari personality: Friendly, Helpful, Respectful, Unique har baar, Creative responses`;

// Function to ensure response variety
function getVarietyGreeting(userId) {
    const lastGreeting = lastResponseTracker.get(userId) || '';
    let availableSalams = SALAM_VARIATIONS.filter(s => s !== lastGreeting);
    if (availableSalams.length === 0) availableSalams = [...SALAM_VARIATIONS];
    const selected = availableSalams[Math.floor(Math.random() * availableSalams.length)];
    lastResponseTracker.set(userId, selected);
    return selected;
}

async function getLongCatResponse(userMessage, userId) {
    try {
        // Initialize conversation with a unique greeting if not exists
        if (!userConversations.has(userId)) {
            const uniqueGreeting = getVarietyGreeting(userId);
            userConversations.set(userId, [
                { role: "assistant", content: `${uniqueGreeting} Abdullah ko aapka koi paigham hai? Main pohancha dunga! Aap batao, main kya madad kar sakta hoon? 😊` }
            ]);
        }
        
        const conversation = userConversations.get(userId);
        conversation.push({ role: "user", content: userMessage });
        
        // Keep last 15 messages for better memory but ensure variety
        if (conversation.length > 15) {
            const recentMsgs = conversation.slice(-15);
            userConversations.set(userId, recentMsgs);
        }
        
        const apiMessages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversation.map(msg => ({ role: msg.role, content: msg.content }))
        ];
        
        const requestBody = {
            model: MODEL_NAME,
            messages: apiMessages,
            temperature: 0.9, // Increased for more variety
            top_p: 0.95,      // Added for diversity
            frequency_penalty: 0.5, // Penalize repetition
            presence_penalty: 0.5,   // Encourage new topics
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
            let assistantReply = response.data.choices[0].message.content;
            
            // Ensure the response includes a greeting if it's missing
            const hasGreeting = /salam|assalam|adaab|salamualikum|wa alaikum/i.test(assistantReply);
            if (!hasGreeting && conversation.length > 1) {
                const randomSalam = getRandomSalam();
                assistantReply = `${randomSalam} ${assistantReply}`;
            }
            
            conversation.push({ role: "assistant", content: assistantReply });
            return assistantReply;
        } else {
            const fallbackSalam = getRandomSalam();
            return `${fallbackSalam} Mujhe samajh nahi aaya. Kya aap dobara bata sakte hain? Main Abdullah tak zaroor pohancha dunga! 🤗`;
        }
    } catch (error) {
        console.error("API Error:", error.message);
        const fallbackSalam = getRandomSalam();
        return `${fallbackSalam} Maafi chahunga, filhal connection thoda mushkil hai. Thodi der baad try karein! Abdullah ko aapki fikar hai 💙`;
    }
}

async function startBot() {
    try {
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║     🤖 ABDULLAH\'S AI ASSISTANT - STARTING...            ║');
        console.log('║     📱 Roman Urdu mein baat karega                      ║');
        console.log('║     💬 Har message unique hoga                         ║');
        console.log('║     🌟 Har baar salam change hoga                      ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        
        const { state, saveCreds } = await useMultiFileAuthState('session_data');
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            browser: ["Abdullah", "AI", "1.0"],
            syncFullHistory: false,
            markOnlineOnConnect: true
        });

        let pairingShown = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, pairingCode } = update;
            
            if (qr && !pairingShown) {
                console.log('\n╔══════════════════════════════════════════════════════════╗');
                console.log('║     📱 OPTION 1: SCAN QR CODE WITH WHATSAPP              ║');
                console.log('╚══════════════════════════════════════════════════════════╝\n');
                qrcode.generate(qr, { small: true });
                console.log('\n💡 WhatsApp kholen > Settings > Linked Devices > Link a Device\n');
            }
            
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
                console.log('║     💬 Har message unique hoga!                         ║');
                console.log('║     🌟 Har baar naya salam milega!                      ║');
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
                lastResponseTracker.delete(sender);
                const clearSalam = getRandomSalam();
                await sock.sendMessage(sender, { text: `${clearSalam} Baat cheet saaf kar di gayi! Ab naye siray se baat karte hain 😊 Abdullah ko aapki baat pohancha dunga! ✨` });
                return;
            }
            
            if (lowerText === '/help' || lowerText === 'help') {
                const helpMessage = `🌟 *ABDULLAH KA AI ASSISTANT* 🌟
                
╔════════════════════════════════════════════════╗
║  📝 *Commands:*                                ║
║  💬 *Kuch bhi likho* - Unique jawab milega    ║
║  🗑️ */clear* - Baat cheet saaf karein          ║
║  ❓ */help* - Yeh menu dekhein                  ║
║  ℹ️ */about* - Abdullah ke barein mein         ║
║  🏓 */ping* - Bot status check                 ║
║  🔄 */new* - Nayi conversation start karein    ║
╚════════════════════════════════════════════════╝

✨ *Khas baatein:* 
• Har baar naya salam milega
• Har jawab unique hoga
• Kabhi repeat nahi hoga

💬 *Roman Urdu mein baat karein*
📨 *Abdullah tak aapka paigham pohancha dunga*

*Poochiye kuch bhi!* 🤗`;
                
                await sock.sendMessage(sender, { text: helpMessage });
                return;
            }
            
            if (lowerText === '/about' || lowerText === 'about') {
                const aboutMessages = [
                    `👤 *ABDULLAH KE BAREIN MEIN*
                    
✨ *Abdullah kaun hain?*
• Ek bohot achay aur meharban insan hain
• Logon ki madad karna unka pasandida kaam hai
• Hamesha muskarahat ke saath milte hain

💝 *Abdullah ka paigham:*
"Main chahta hoon ke sab log khush rahein"

🤖 *Main Abdullah ka AI assistant hoon*
💬 *Roman Urdu mein baat karta hoon*

*Kya main aapki madad kar sakta hoon?* 😊`,
                    
                    `💙 *ABDULLAH - Ek Meharban Insan*
                    
Abdullah sirf ek naam nahi, ek pehchan hai:
🌟 *Meharbani* - Sab se achay se pesh aana
🤝 *Madadgaar* - Mushkil mein kaam aana
😊 *Khushdil* - Sab ko khush rakhna

*Main unhi ka AI assistant hoon*
*Aapko kisi bhi cheez mein madad chahiye?* ✨`
                ];
                const randomAbout = aboutMessages[Math.floor(Math.random() * aboutMessages.length)];
                await sock.sendMessage(sender, { text: randomAbout });
                return;
            }
            
            if (lowerText === '/ping' || lowerText === 'ping') {
                const pingResponses = [
                    "🏓 *Main Abdullah ka AI assistant hoon.* Alhamdulillah bilkul theek hoon! Aap sunao? 😊",
                    "⚡ *Abdullah ka assistant hoon main!* Mast hoon bhai, aap batao kya haal? ✨",
                    "🎯 *Present!* Abdullah ko aapki baat pohancha dunga! Kya haal chaal? 🤗"
                ];
                const randomPing = pingResponses[Math.floor(Math.random() * pingResponses.length)];
                await sock.sendMessage(sender, { text: randomPing });
                return;
            }
            
            if (lowerText === '/new' || lowerText === 'new') {
                userConversations.delete(sender);
                lastResponseTracker.delete(sender);
                const newSalam = getRandomSalam();
                await sock.sendMessage(sender, { text: `${newSalam} Naye siray se baat shuru karte hain! Main Abdullah ka AI assistant hoon. Bataaiye kya madad chahiye? 🌟` });
                return;
            }

            try {
                await sock.sendPresenceUpdate('composing', sender);
                console.log(`🤖 Thinking unique response for ${senderNumber}...`);
                
                const aiResponse = await getLongCatResponse(text, sender);
                
                await sock.sendPresenceUpdate('paused', sender);
                await sock.sendMessage(sender, { text: aiResponse });
                
                console.log(`✅ Unique response sent to ${senderNumber}`);
                
            } catch (error) {
                console.error(`❌ Error:`, error.message);
                await sock.sendPresenceUpdate('paused', sender);
                const errorSalam = getRandomSalam();
                await sock.sendMessage(sender, { 
                    text: `${errorSalam} Maafi chahunga, kuch issue ho gaya. Thodi der baad try karein! Abdullah ko aapki fikar hai, main message pohancha dunga 😊` 
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
