const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const axios = require('axios');

// 🔑 OPENROUTER API KEY (from your HTML file)
const OPENROUTER_API_KEY = "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";
const AI_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Store conversation history for each user
const userConversations = new Map();

// Default system prompt for AI - Friendly assistant
const SYSTEM_PROMPT = {
  role: "system",
  content: "You are a helpful, concise, and friendly assistant. Answer clearly and keep responses warm but professional. You can help with coding, ideas, explanations, and general questions. Keep responses natural and conversational."
};

// Function to get AI response from OpenRouter
async function getAIResponse(userMessage, userId) {
  try {
    // Get or create conversation history for this user
    if (!userConversations.has(userId)) {
      userConversations.set(userId, [
        SYSTEM_PROMPT,
        { role: "assistant", content: "👋 Hi there! I'm your AI assistant powered by OpenRouter. Ask me anything - coding help, general questions, or just have a chat! How can I help you today?" }
      ]);
    }
    
    const conversation = userConversations.get(userId);
    
    // Add user message to conversation
    conversation.push({ role: "user", content: userMessage });
    
    // Keep only last 15 messages to avoid token limits
    if (conversation.length > 17) {
      const systemMsg = conversation[0];
      const welcomeMsg = conversation[1];
      const recentMsgs = conversation.slice(-15);
      userConversations.set(userId, [systemMsg, welcomeMsg, ...recentMsgs]);
    }
    
    const requestBody = {
      model: "openai/gpt-3.5-turbo",  // Default model
      messages: conversation,
      max_tokens: 800,
      temperature: 0.7,
      top_p: 0.9,
      stream: false,
    };

    const response = await axios.post(AI_API_URL, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://github.com/javagoat',
        'X-Title': 'JavaGoat WhatsApp AI Bot'
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
    console.error("OpenRouter API Error:", error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return "❌ API key error. Please check the OpenRouter API key configuration.";
    } else if (error.response?.status === 429) {
      return "⏰ Rate limit exceeded. Please try again in a moment.";
    } else if (error.code === 'ECONNABORTED') {
      return "⏱️ Request timeout. Please try again.";
    }
    return "🤖 Sorry, I'm having trouble connecting right now. Please try again in a moment.";
  }
}

// Clear conversation history for a user
function clearConversation(userId) {
  userConversations.set(userId, [
    SYSTEM_PROMPT,
    { role: "assistant", content: "👋 Hi there! I'm your AI assistant powered by OpenRouter. Ask me anything - coding help, general questions, or just have a chat! How can I help you today?" }
  ]);
  return "🧹 Conversation history cleared! You can start fresh with me now.";
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session_data');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ["JavaGoat", "AI", "1.0"] 
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.clear(); 
      console.log('\n╔══════════════════════════════════════════════════════════╗');
      console.log('║     📱 SCAN THIS QR CODE WITH WHATSAPP                    ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log('║                                                          ║');
      qrcode.generate(qr, { small: true });
      console.log('║                                                          ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log('║  💡 Open WhatsApp > Settings > Linked Devices            ║');
      console.log('║  📱 Tap "Link a Device" and scan this QR code            ║');
      console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    if (connection === 'open') {
      console.log('\n✅ JAVAGOAT AI BOT IS ONLINE!');
      console.log('🤖 AI Model: OpenRouter (GPT-3.5 Turbo)');
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

    console.log(`📩 [${senderNumber}]: ${text.substring(0, 60)}${text.length > 60 ? '...' : ''}`);

    const lowerText = text.toLowerCase();
    
    // --- COMMANDS ---
    if (lowerText === '/clear' || lowerText === '/reset' || lowerText === 'clear chat' || lowerText === 'clear') {
      const response = clearConversation(sender);
      await sock.sendMessage(sender, { text: response });
      console.log(`🤖 [${senderNumber}]: Cleared conversation`);
      return;
    }
    
    if (lowerText === '/help' || lowerText === 'help' || lowerText === 'commands') {
      const helpMessage = `🤖 *JavaGoat AI Bot Commands*
        
┌─────────────────────────────────┐
│  💬 *Just type anything* - Chat with AI  │
│  🗑️ */clear* - Reset conversation       │
│  ❓ */help* - Show this menu           │
│  ℹ️ */about* - Bot information         │
│  🏓 */ping* - Check bot status         │
└─────────────────────────────────┘

✨ *Features:*
• Remembers our conversation
• Powered by OpenRouter AI (GPT-3.5)
• Ask anything - coding, questions, chat!

💡 *Try asking me something now!*`;
      
      await sock.sendMessage(sender, { text: helpMessage });
      return;
    }
    
    if (lowerText === '/about' || lowerText === 'about') {
      const aboutMessage = `🤖 *JavaGoat AI WhatsApp Bot*
      
╔══════════════════════════════╗
║  🤖 *AI Engine:* OpenRouter   ║
║  🧠 *Model:* GPT-3.5 Turbo    ║
║  💬 *Type:* Conversational AI  ║
║  📱 *Platform:* WhatsApp       ║
║  🌐 *Status:* Online           ║
╚══════════════════════════════╝

💡 *Features:*
• Natural conversations
• Remembers chat history
• Fast responses
• Free to use

Type */help* for commands`;
      
      await sock.sendMessage(sender, { text: aboutMessage });
      return;
    }
    
    if (lowerText === '/ping' || lowerText === 'ping') {
      await sock.sendMessage(sender, { text: "🏓 Pong! Bot is alive and responding quickly!" });
      return;
    }

    // --- AI RESPONSE FOR EVERYTHING ELSE ---
    try {
      // Show typing indicator
      await sock.sendPresenceUpdate('composing', sender);
      
      console.log(`🤖 [${senderNumber}]: Thinking...`);
      
      // Get AI response
      const aiResponse = await getAIResponse(text, sender);
      
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
console.log('\n🚀 Starting JavaGoat AI WhatsApp Bot...\n');
startBot().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Bot shutting down gracefully...');
  process.exit(0);
});
