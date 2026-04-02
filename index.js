const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');

// Clear old session to force fresh start
const sessionPath = 'session_data';
if (fs.existsSync(sessionPath)) {
    console.log('🗑️ Removing old session data...');
    fs.rmSync(sessionPath, { recursive: true, force: true });
}

// ============================================
// YOUR LONG CAT API CONFIGURATION
// ============================================
const API_KEY = "ak_2jA9Ct99M7fv0b18Hl2Zu24y2iI1Y";
const BASE_URL = "https://api.longcat.chat/openai/v1/chat/completions";
const MODEL_NAME = "LongCat-Flash-Chat";

// Store conversation history for each user
const userConversations = new Map();

// System prompt for AI
const SYSTEM_PROMPT = {
    role: "system",
    content: "You are a friendly, helpful AI assistant named LongCat. Respond in a natural, conversational manner. Be warm and engaging in your responses."
};

// Function to get AI response from LongCat API
async function getLongCatResponse(userMessage, userId) {
    try {
        // Get or create conversation history for this user
        if (!userConversations.has(userId)) {
            userConversations.set(userId, [
                { role: "assistant", content: "👋 Hello! I'm LongCat AI Assistant! How can I help you today?" }
            ]);
        }
        
        const conversation = userConversations.get(userId);
        
        // Add user message to conversation
        conversation.push({ role: "user", content: userMessage });
        
        // Keep only last 20 messages to avoid token limits
        if (conversation.length > 20) {
            const recentMsgs = conversation.slice(-20);
            userConversations.set(userId, recentMsgs);
        }
        
        // Prepare messages for API
        const apiMessages = [
            SYSTEM_PROMPT,
            ...conversation.map(msg => ({ role: msg.role, content: msg.content }))
        ];
        
        const requestBody = {
            model: MODEL_NAME,
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 1000,
            stream: false
        };
        
        console.log(`🤖 Calling LongCat API for user ${userId}...`);
        
        const response = await axios.post(BASE_URL, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            timeout: 30000
        });
        
        if (response.data && response.data.choices && response.data.choices[0]) {
            const assistantReply = response.data.choices[0].message.content;
            // Save assistant response to conversation
            conversation.push({ role: "assistant", content: assistantReply });
            return assistantReply;
        } else {
            throw new Error("Invalid API response structure");
        }
        
    } catch (error) {
        console.error("LongCat API Error:", error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            return "❌ API key error. Please check your LongCat API key configuration.";
        } else if (error.response?.status === 429) {
            return "⏰ Rate limit exceeded. Please try again in a moment.";
        } else if (error.code === 'ECONNABORTED') {
            return "⏱️ Request timeout. Please try again.";
        }
        
        return "🤖 Sorry, I'm having trouble connecting to my AI brain right now. Please try again in a moment.";
    }
}

// Clear conversation history for a user
function clearConversation(userId) {
    userConversations.set(userId, [
        { role: "assistant", content: "👋 Hello! I'm LongCat AI Assistant! How can I help you today?" }
    ]);
    return "🧹 Conversation cleared! You can start fresh with me now. ✨";
}

// Get conversation info
function getConversationInfo(userId) {
    const conv = userConversations.get(userId);
    if (!conv) {
        return "📭 No active conversation. Start chatting with me!";
    }
    const messageCount = conv.length;
    return `📊 *Conversation Stats*\n\nTotal messages: ${messageCount}\nActive users: ${userConversations.size}\nAI Model: LongCat-Flash-Chat`;
}

async function startBot() {
    // Check if API key is present
    if (!API_KEY || API_KEY === "ak_2jA9Ct99M7fv0b18Hl2Zu24y2iI1Y") {
        console.error('\n❌ ERROR: LongCat API key is missing!\n');
        console.log('📝 Please add your API key in the code\n');
        process.exit(1);
    }
    
    console.log('\n✅ LongCat API Key loaded successfully');
    console.log(`🤖 AI Model: ${MODEL_NAME}`);
    console.log(`🔗 API Endpoint: ${BASE_URL}`);

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
            console.clear(); 
            console.log('\n╔══════════════════════════════════════════════════════════╗');
            console.log('║     📱 SCAN THIS QR CODE WITH WHATSAPP                    ║');
            console.log('╚══════════════════════════════════════════════════════════╝\n');
            qrcode.generate(qr, { small: true });
            console.log('\n💡 Open WhatsApp > Settings > Linked Devices > Link a Device\n');
        }

        if (connection === 'open') {
            console.log('\n✅ LONG CAT AI BOT IS ONLINE!');
            console.log('🐱 AI Engine: LongCat-Flash-Chat');
            console.log('💬 Bot is ready to chat on WhatsApp!\n');
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

        console.log(`📩 [${senderNumber}]: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);

        const lowerText = text.toLowerCase();
        
        // ========== COMMANDS ==========
        
        // Clear conversation
        if (lowerText === '/clear' || lowerText === '/reset' || lowerText === 'clear chat' || lowerText === 'clear') {
            const response = clearConversation(sender);
            await sock.sendMessage(sender, { text: response });
            console.log(`🧹 [${senderNumber}]: Conversation cleared`);
            return;
        }
        
        // Help command
        if (lowerText === '/help' || lowerText === 'help' || lowerText === 'commands') {
            const helpMessage = `🐱 *LongCat AI Bot Commands*
        
┌─────────────────────────────────┐
│  💬 *Just type anything* - Chat with AI  │
│  🗑️ */clear* - Reset conversation       │
│  📊 */stats* - Conversation stats       │
│  ❓ */help* - Show this menu           │
│  ℹ️ */about* - Bot information         │
│  🏓 */ping* - Check bot status         │
└─────────────────────────────────┘

✨ *Features:*
• Remembers our conversation
• Powered by LongCat AI
• Ask anything - coding, questions, chat!

💡 *Try asking me something now!*`;
            
            await sock.sendMessage(sender, { text: helpMessage });
            return;
        }
        
        // Stats command
        if (lowerText === '/stats' || lowerText === 'stats') {
            const stats = getConversationInfo(sender);
            await sock.sendMessage(sender, { text: stats });
            return;
        }
        
        // About command
        if (lowerText === '/about' || lowerText === 'about') {
            const aboutMessage = `🐱 *LongCat AI WhatsApp Bot*
      
╔══════════════════════════════╗
║  🐱 *AI Engine:* LongCat      ║
║  🧠 *Model:* Flash-Chat       ║
║  💬 *Type:* Conversational AI  ║
║  📱 *Platform:* WhatsApp       ║
║  🌐 *Status:* Online           ║
╚══════════════════════════════╝

💡 *Features:*
• Natural conversations
• Remembers chat history
• Fast responses
• Powered by LongCat API

Type */help* for commands`;
            
            await sock.sendMessage(sender, { text: aboutMessage });
            return;
        }
        
        // Ping command
        if (lowerText === '/ping' || lowerText === 'ping') {
            await sock.sendMessage(sender, { text: "🏓 Pong! Bot is alive and responding quickly!" });
            return;
        }

        // ========== AI RESPONSE FOR EVERYTHING ELSE ==========
        try {
            // Show typing indicator
            await sock.sendPresenceUpdate('composing', sender);
            
            console.log(`🤖 [${senderNumber}]: Thinking with LongCat AI...`);
            
            // Get AI response from LongCat
            const aiResponse = await getLongCatResponse(text, sender);
            
            // Stop typing indicator
            await sock.sendPresenceUpdate('paused', sender);
            
            // Send AI response
            await sock.sendMessage(sender, { text: aiResponse });
            
            console.log(`✅ [${senderNumber}]: Response sent (${aiResponse.length} chars)`);
            
        } catch (error) {
            console.error(`❌ Error processing message from ${senderNumber}:`, error.message);
            await sock.sendPresenceUpdate('paused', sender);
            await sock.sendMessage(sender, { 
                text: "❌ Sorry, something went wrong. Please try again in a moment." 
            });
        }
    });
}

// Start the bot
console.log('\n🚀 Starting LongCat AI WhatsApp Bot...');
console.log('🐱 AI Model: LongCat-Flash-Chat');
console.log('💬 Pure AI Chat Mode - No food ordering\n');

startBot().catch(err => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 LongCat Bot shutting down gracefully...');
    process.exit(0);
});
