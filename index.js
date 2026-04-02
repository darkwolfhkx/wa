const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');

console.log('🚀 Bot starting...');

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

async function getLongCatResponse(userMessage, userId) {
    try {
        if (!userConversations.has(userId)) {
            userConversations.set(userId, [
                { role: "assistant", content: "👋 Hello! I'm LongCat AI Assistant! How can I help you today?" }
            ]);
        }
        
        const conversation = userConversations.get(userId);
        conversation.push({ role: "user", content: userMessage });
        
        if (conversation.length > 20) {
            const recentMsgs = conversation.slice(-20);
            userConversations.set(userId, recentMsgs);
        }
        
        const apiMessages = [
            { role: "system", content: "You are a friendly, helpful AI assistant named LongCat. Respond in a natural, conversational manner." },
            ...conversation.map(msg => ({ role: msg.role, content: msg.content }))
        ];
        
        const requestBody = {
            model: MODEL_NAME,
            messages: apiMessages,
            temperature: 0.7,
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
            return "Sorry, I didn't understand that. Please try again.";
        }
    } catch (error) {
        console.error("API Error:", error.message);
        return "🤖 Sorry, I'm having trouble connecting right now. Please try again.";
    }
}

async function startBot() {
    try {
        console.log('✅ Starting WhatsApp bot...');
        
        const { state, saveCreds } = await useMultiFileAuthState('session_data');
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ["LongCat", "AI", "1.0"] 
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('\n📱 SCAN THIS QR CODE WITH WHATSAPP:\n');
                qrcode.generate(qr, { small: true });
                console.log('\n💡 Open WhatsApp > Settings > Linked Devices > Link a Device\n');
            }

            if (connection === 'open') {
                console.log('\n✅ LONG CAT AI BOT IS ONLINE!');
                console.log('🐱 Bot is ready to chat!\n');
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    console.log('🔄 Bot disconnected, restarting...');
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

            // Simple commands
            if (text.toLowerCase() === '/clear') {
                userConversations.delete(sender);
                await sock.sendMessage(sender, { text: "🧹 Conversation cleared!" });
                return;
            }
            
            if (text.toLowerCase() === '/help') {
                await sock.sendMessage(sender, { text: "🐱 *LongCat AI Bot*\n\nJust type any message to chat with AI!\n\n*/clear* - Reset conversation\n*/help* - Show this menu" });
                return;
            }

            try {
                await sock.sendPresenceUpdate('composing', sender);
                const aiResponse = await getLongCatResponse(text, sender);
                await sock.sendPresenceUpdate('paused', sender);
                await sock.sendMessage(sender, { text: aiResponse });
                console.log(`✅ [${senderNumber}]: Response sent`);
            } catch (error) {
                console.error(`❌ Error:`, error.message);
                await sock.sendMessage(sender, { text: "❌ Sorry, something went wrong. Please try again." });
            }
        });
        
    } catch (error) {
        console.error('❌ Start bot error:', error);
        setTimeout(startBot, 5000);
    }
}

// Start the bot
startBot().catch(err => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
});
