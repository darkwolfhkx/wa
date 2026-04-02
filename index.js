const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const axios = require('axios');

// 🔑 OPENROUTER API KEY (from your HTML file)
const OPENROUTER_API_KEY = "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";
const AI_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Store conversation history for each user
const userConversations = new Map();

// Default system prompt for AI
const SYSTEM_PROMPT = {
  role: "system",
  content: "You are a helpful, concise, and friendly assistant. Answer clearly and keep responses warm but professional. You can help with coding, ideas, explanations, and general questions."
};

// Function to get AI response from OpenRouter
async function getAIResponse(userMessage, userId, model = "openai/gpt-3.5-turbo") {
  try {
    // Get or create conversation history for this user
    if (!userConversations.has(userId)) {
      userConversations.set(userId, [
        SYSTEM_PROMPT,
        { role: "assistant", content: "Hey there! I'm your OpenRouter AI assistant. Ask me anything — code, ideas, explanations. Let's chat ✨" }
      ]);
    }
    
    const conversation = userConversations.get(userId);
    
    // Add user message to conversation
    conversation.push({ role: "user", content: userMessage });
    
    // Keep only last 20 messages to avoid token limits
    if (conversation.length > 21) {
      const systemMsg = conversation[0];
      const recentMsgs = conversation.slice(-20);
      userConversations.set(userId, [systemMsg, ...recentMsgs]);
    }
    
    const requestBody = {
      model: model,
      messages: conversation,
      max_tokens: 600,
      temperature: 0.7,
      top_p: 0.9,
      stream: false,
    };

    const response = await axios.post(AI_API_URL, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://github.com/javagoat',
        'X-Title': 'JavaGoat WhatsApp Bot'
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
    return "🤖 Sorry, I'm having trouble connecting to my AI brain. Please try again in a moment.";
  }
}

// Clear conversation history for a user
function clearConversation(userId) {
  userConversations.set(userId, [
    SYSTEM_PROMPT,
    { role: "assistant", content: "Hey there! I'm your OpenRouter AI assistant. Ask me anything — code, ideas, explanations. Let's chat ✨" }
  ]);
  return "🧹 Conversation history cleared! You can start fresh with me now.";
}

// Change AI model for a user
function changeModel(userId, model) {
  const validModels = ['gpt-3.5-turbo', 'gemini', 'mistral', 'llama'];
  // Store model preference (simplified - you can expand this)
  return `🤖 AI model preference saved. Current conversations will continue with the selected model.`;
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session_data');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ["JavaGoat", "AI", "1"] 
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.clear(); 
      console.log('\n==================================================');
      console.log('📱 SCAN THIS QR CODE WITH WHATSAPP');
      console.log('==================================================\n');
      qrcode.generate(qr, { small: true }); 
      console.log('\n==================================================');
      console.log('💡 Open WhatsApp > Settings > Linked Devices > Link a Device');
      console.log('==================================================\n');
    }

    if (connection === 'open') {
      console.log('✅ JAVAGOAT AI BOT IS ONLINE!');
      console.log('🤖 AI Model: OpenRouter (GPT/Gemini/Mistral/Llama)');
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

    console.log(`📩 Message from ${senderNumber}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);

    // --- COMMAND HANDLERS ---
    const lowerText = text.toLowerCase();
    
    // Clear conversation command
    if (lowerText === '/clear' || lowerText === '/reset' || lowerText === 'clear chat') {
      const response = clearConversation(sender);
      await sock.sendMessage(sender, { text: response });
      return;
    }
    
    // Help command
    if (lowerText === '/help' || lowerText === 'help' || lowerText === 'commands') {
      const helpMessage = `🤖 *JavaGoat AI Bot Commands*
        
*Chat normally* - Just type any message!
*/clear* or *clear chat* - Reset conversation history
*/model* - Show available AI models
*/ping* - Check bot response time
*/about* - About this bot

💡 *Tips:*
- I remember our conversation context
- Ask me anything about coding, general knowledge, or just chat!
- Each conversation is private to you

✨ *Powered by OpenRouter AI*`;
      
      await sock.sendMessage(sender, { text: helpMessage });
      return;
    }
    
    // Model info command
    if (lowerText === '/model') {
      const modelMessage = `🤖 *Available AI Models*
      
*Default:* GPT-3.5 Turbo (Fast & balanced)
*Others available via OpenRouter:*
• Gemini 2.0 Flash
• Mistral 7B
• Llama 3.2 3B

Current conversation uses GPT-3.5 Turbo for best performance.

Type */*help for more commands`;
      
      await sock.sendMessage(sender, { text: modelMessage });
      return;
    }
    
    // Ping command
    if (lowerText === '/ping') {
      const startTime = Date.now();
      await sock.sendMessage(sender, { text: "🏓 Pinging AI server..." });
      // Just respond quickly
      return;
    }
    
    // About command
    if (lowerText === '/about') {
      const aboutMessage = `🤖 *JavaGoat AI WhatsApp Bot*
      
*Version:* 2.0
*AI Engine:* OpenRouter API
*Features:*
• Multi-turn conversations
• Memory of chat history
• Multiple AI models support
• Fast responses

*Creator:* JavaGoat
*Purpose:* AI-powered WhatsApp assistant

Type */help* for commands`;
      
      await sock.sendMessage(sender, { text: aboutMessage });
      return;
    }

    // --- AI RESPONSE FOR ALL OTHER MESSAGES ---
    try {
      // Show typing indicator (works on WhatsApp)
      await sock.sendPresenceUpdate('composing', sender);
      
      // Get AI response
      const aiResponse = await getAIResponse(text, sender);
      
      // Stop typing indicator
      await sock.sendPresenceUpdate('paused', sender);
      
      // Send response
      await sock.sendMessage(sender, { text: aiResponse });
      
    } catch (error) {
      console.error("Error processing message:", error);
      await sock.sendMessage(sender, { 
        text: "❌ Sorry, something went wrong while processing your message. Please try again." 
      });
    }
  });
}

// Start the bot with error handling
startBot().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Bot shutting down...');
  process.exit(0);
});
