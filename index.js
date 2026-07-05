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

// Mistral AI API Configuration
const API_KEY = "fdqIlxit8LcF24wdGrhIHqGbtTJGYpGi";
const BASE_URL = "https://api.mistral.ai/v1/chat/completions";
const MODEL_NAME = "mistral-tiny";

// Store conversations
const userConversations = new Map();
const userMessageCount = new Map();

// Baggify Product Database
const PRODUCTS = {
    "large bag": {
        name: "Large Storage Bag",
        size: "20x24x12 inches",
        price: "Rs. 600",
        originalPrice: "Rs. 1,200",
        discount: "50% OFF",
        description: "Best for storing clothes, bedding, and household items. Made with premium quality material.",
        reviews: "76 reviews"
    },
    "xl bag": {
        name: "XL Storage Bag",
        size: "27x24x14 inches",
        price: "Rs. 750",
        originalPrice: "Rs. 1,400",
        discount: "46% OFF",
        description: "Huge capacity. Perfect for winter clothes, comforters, and bulk storage.",
        reviews: "168 reviews"
    },
    "medium bag": {
        name: "Medium Storage Bag",
        size: "17x20x10 inches",
        price: "Rs. 500",
        originalPrice: "Rs. 700",
        discount: "29% OFF",
        description: "Ideal size for daily use. Great for storing shoes, accessories, and small items.",
        reviews: "59 reviews"
    },
    "shoulder bag": {
        name: "Shoulder Bag",
        size: "18x15 inches",
        price: "Rs. 300",
        originalPrice: "Rs. 500",
        discount: "40% OFF",
        description: "Stylish and practical. Best for presentations, business meetings, and everyday use.",
        reviews: "45 reviews"
    },
    "prayer mat": {
        name: "Travel Prayer Mat with Pouch",
        size: "27x44 inches",
        price: "Rs. 600",
        originalPrice: "Rs. 1,400",
        discount: "57% OFF",
        description: "Premium quality travel prayer mat with matching pouch. Soft and lightweight.",
        reviews: "89 reviews"
    }
};

// System Prompt - Professional, No Emotions
const SYSTEM_PROMPT = `Tu Baggify.pk ki professional assistant hai. Sirf products ke baare mein information de.

STRICT RULES:
1. Sirf bags, storage bags, shoulder bags, travel prayer mats ke baare mein baat kar
2. Kisi bhi type ki emotional, friendly, ya personal baat mat kar
3. "dost", "friend", "available", "khushi", "pyar", "romance" jaise words use mat kar
4. Sirf products, prices, sizes, delivery ke baare mein information de
5. Roman Urdu mein baat kar lekin professional tone mein
6. Customer jo poochhe wohi jawab de - zyada mat bolo
7. Har message mein salam mat karo - sirf pehle message mein

PRODUCTS:
1. Large Storage Bag - Rs. 600 (was Rs. 1,200) - 20x24x12"
2. XL Storage Bag - Rs. 750 (was Rs. 1,400) - 27x24x14"
3. Medium Storage Bag - Rs. 500 (was Rs. 700) - 17x20x10"
4. Shoulder Bag - Rs. 300 (was Rs. 500) - 18x15"
5. Travel Prayer Mat - Rs. 600 (was Rs. 1,400) - 27x44"

DELIVERY:
- Charges: Rs. 300
- Free delivery on orders over Rs. 2,000
- Cash on delivery

RESPONSE STYLE:
- Seedha aur simple jawab
- Sirf product information
- Koi extra emojis nahi (sirf basic formatting)
- Professional tone
- Customer ke sawal ka exact jawab`;

// Get all products list
function getAllProductsList() {
    return `BAGGIFY.PK PRODUCTS:

1. Large Storage Bag
   Size: 20x24x12"
   Price: Rs. 600 (Was Rs. 1,200)
   50% OFF | 76 reviews

2. XL Storage Bag
   Size: 27x24x14"
   Price: Rs. 750 (Was Rs. 1,400)
   46% OFF | 168 reviews

3. Medium Storage Bag
   Size: 17x20x10"
   Price: Rs. 500 (Was Rs. 700)
   29% OFF | 59 reviews

4. Shoulder Bag
   Size: 18x15"
   Price: Rs. 300 (Was Rs. 500)
   40% OFF | 45 reviews

5. Travel Prayer Mat
   Size: 27x44"
   Price: Rs. 600 (Was Rs. 1,400)
   57% OFF | 89 reviews

DELIVERY:
- Rs. 300 charges
- Free delivery over Rs. 2,000
- Cash on delivery

Kisi specific product ke baare mein janna hai?`;

function getProductDetail(productKey) {
    const product = PRODUCTS[productKey];
    if (!product) return null;
    
    return `${product.name}
Size: ${product.size}
Price: ${product.price}
Original Price: ${product.originalPrice}
Discount: ${product.discount}
Reviews: ${product.reviews}

Description: ${product.description}

Order: wa.me/923460620830 or baggify.pk`;

function getDeliveryInfo() {
    return `BAGGIFY.PK DELIVERY:

Delivery Charges: Rs. 300
Free Delivery: Over Rs. 2,000
Delivery Time: 2-3 working days
Payment: Cash on delivery

Contact: +92 346 062 0830`;
}

// Get product recommendation
function getProductRecommendation(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('large') || lowerQuery.includes('bari') || lowerQuery.includes('big')) {
        return PRODUCTS["large bag"];
    }
    if (lowerQuery.includes('xl') || lowerQuery.includes('extra') || lowerQuery.includes('bohat bari')) {
        return PRODUCTS["xl bag"];
    }
    if (lowerQuery.includes('medium') || lowerQuery.includes('darmiyani') || lowerQuery.includes('choti')) {
        return PRODUCTS["medium bag"];
    }
    if (lowerQuery.includes('shoulder') || lowerQuery.includes('kandhay') || lowerQuery.includes('presentation')) {
        return PRODUCTS["shoulder bag"];
    }
    if (lowerQuery.includes('prayer') || lowerQuery.includes('namaz') || lowerQuery.includes('jainamaz') || lowerQuery.includes('mat')) {
        return PRODUCTS["prayer mat"];
    }
    return null;
}

// Main function to get response
async function getBaggifyResponse(userMessage, userId) {
    try {
        const lowerMsg = userMessage.toLowerCase();
        
        // Initialize
        if (!userMessageCount.has(userId)) {
            userMessageCount.set(userId, 0);
        }
        
        // Check for product list
        if (lowerMsg.includes('list') || lowerMsg.includes('products') || lowerMsg.includes('product') || 
            lowerMsg.includes('sab') || lowerMsg.includes('batayein') || lowerMsg.includes('kya hai') ||
            lowerMsg.includes('kya kya') || lowerMsg.includes('available')) {
            return getAllProductsList();
        }
        
        // Check for delivery info
        if (lowerMsg.includes('delivery') || lowerMsg.includes('charges') || lowerMsg.includes('shipping') ||
            lowerMsg.includes('free') || lowerMsg.includes('cost')) {
            return getDeliveryInfo();
        }
        
        // Check for specific product
        const product = getProductRecommendation(userMessage);
        if (product) {
            const productKey = Object.keys(PRODUCTS).find(key => PRODUCTS[key] === product);
            if (productKey) {
                return getProductDetail(productKey);
            }
        }
        
        // Check for product by name
        for (const [key, value] of Object.entries(PRODUCTS)) {
            if (lowerMsg.includes(key) || lowerMsg.includes(value.name.toLowerCase())) {
                return getProductDetail(key);
            }
        }
        
        // For other queries, use AI
        if (!userConversations.has(userId)) {
            userConversations.set(userId, [
                { role: "assistant", content: "Assalamualaikum! Baggify.pk se baat kar rahi hoon. Aap kis product ke baare mein janna chahenge?" }
            ]);
            userMessageCount.set(userId, 1);
            return userConversations.get(userId)[0].content;
        }
        
        const conversation = userConversations.get(userId);
        conversation.push({ role: "user", content: userMessage });
        
        if (conversation.length > 20) {
            userConversations.set(userId, conversation.slice(-20));
        }
        
        const apiMessages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversation.map(msg => ({ role: msg.role, content: msg.content }))
        ];
        
        const requestBody = {
            model: MODEL_NAME,
            messages: apiMessages,
            temperature: 0.3,
            top_p: 0.7,
            max_tokens: 300,
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
            let reply = response.data.choices[0].message.content;
            
            // Remove any salam if not first message
            const msgCount = userMessageCount.get(userId) || 0;
            if (msgCount > 1) {
                reply = reply.replace(/Assalamualaikum!?\s*/i, '').trim();
                reply = reply.replace(/السلام علیکم!?\s*/i, '').trim();
                reply = reply.replace(/Wa Alaikum Assalam!?\s*/i, '').trim();
                reply = reply.replace(/وعلیکم السلام!?\s*/i, '').trim();
            }
            
            // Remove emotional words
            const emotionalWords = ['dost', 'friend', 'khushi', 'pyar', 'romance', 'available', 'hamesha', 'available hoon'];
            for (const word of emotionalWords) {
                reply = reply.replace(new RegExp(word, 'gi'), '');
            }
            
            // Remove extra emojis
            reply = reply.replace(/[😊😃😄😁😆🤗🤩🥰😍💕💖✨🌟⭐🎀🌸🌺💫]/g, '').trim();
            
            userMessageCount.set(userId, msgCount + 1);
            conversation.push({ role: "assistant", content: reply });
            return reply || "Kya main aapki kisi aur product ke baare mein madad kar sakti hoon?";
        } else {
            throw new Error("Invalid response");
        }
        
    } catch (error) {
        console.error("API Error:", error.message);
        return "Maaf kijiye, technical issue hai. Kya aap apna sawal dobara pooch sakte hain?";
    }
}

async function startBot() {
    try {
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║     🛍️ BAGGIFY.PK - PROFESSIONAL ASSISTANT             ║');
        console.log('║     💬 Sirf product information                        ║');
        console.log('║     📦 No emotional responses                          ║');
        console.log('║     🧠 Powered by Mistral AI                          ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        
        const { state, saveCreds } = await useMultiFileAuthState('session_data');
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            browser: ["Baggify", "AI", "1.0"],
            syncFullHistory: false,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000
        });

        let pairingShown = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, pairingCode } = update;
            
            if (qr && !pairingShown) {
                console.log('\n╔══════════════════════════════════════════════════════════╗');
                console.log('║     📱 SCAN QR CODE WITH WHATSAPP                        ║');
                console.log('╚══════════════════════════════════════════════════════════╝\n');
                qrcode.generate(qr, { small: true });
                console.log('\n💡 WhatsApp > Settings > Linked Devices > Link a Device\n');
            }
            
            if (pairingCode && !pairingShown) {
                pairingShown = true;
                console.log('\n╔══════════════════════════════════════════════════════════╗');
                console.log('║     📱 PAIR WITH PHONE NUMBER                             ║');
                console.log('╚══════════════════════════════════════════════════════════╝');
                console.log('\n🔑 YOUR 8-DIGIT PAIRING CODE:');
                console.log('╔══════════════════════════════════════════════════════════╗');
                console.log(`║                                                          ║`);
                console.log(`║              ✨ ${pairingCode} ✨              ║`);
                console.log(`║                                                          ║`);
                console.log('╚══════════════════════════════════════════════════════════╝');
                console.log('\n📝 HOW TO CONNECT:');
                console.log('1️⃣ Open WhatsApp on your phone');
                console.log('2️⃣ Settings > Linked Devices');
                console.log('3️⃣ Link a Device');
                console.log('4️⃣ Enter this 8-digit code');
                console.log('\n⏰ Code expires in 2 minutes!\n');
            }

            if (connection === 'open') {
                console.log('\n╔══════════════════════════════════════════════════════════╗');
                console.log('║     ✅ BAGGIFY.PK IS ONLINE!                             ║');
                console.log('║     💬 Professional product assistant                   ║');
                console.log('║     📦 No emotional responses                          ║');
                console.log('║     🚚 Free delivery over Rs. 2,000                    ║');
                console.log('╚══════════════════════════════════════════════════════════╝\n');
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    console.log('🔄 Bot disconnected, restarting in 5 seconds...');
                    setTimeout(startBot, 5000);
                } else {
                    console.log('❌ Bot logged out. Please restart.');
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
                const senderNumber = sender.split('@')[0];
                const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();

                if (!text) return;

                console.log(`📩 [${senderNumber}]: ${text.substring(0, 50)}`);

                const lowerText = text.toLowerCase();
                
                // Commands
                if (lowerText === '/clear') {
                    userConversations.delete(sender);
                    userMessageCount.delete(sender);
                    await sock.sendMessage(sender, { 
                        text: `Baat cheet clear kar di gayi. Naye siray se shuru karte hain.` 
                    });
                    return;
                }
                
                if (lowerText === '/help' || lowerText === '/menu') {
                    const help = `BAGGIFY.PK - HELP

Commands:
• "list" - Products ki list
• "large bag", "xl bag", etc. - Specific product detail
• "delivery" - Delivery information
• "/clear" - Clear chat

Products:
• Large Storage Bag - Rs. 600
• XL Storage Bag - Rs. 750
• Medium Storage Bag - Rs. 500
• Shoulder Bag - Rs. 300
• Travel Prayer Mat - Rs. 600`;
                    
                    await sock.sendMessage(sender, { text: help });
                    return;
                }

                await sock.sendPresenceUpdate('composing', sender);
                console.log(`💭 Processing request for ${senderNumber}...`);
                
                const response = await getBaggifyResponse(text, sender);
                
                await sock.sendPresenceUpdate('paused', sender);
                await sock.sendMessage(sender, { text: response });
                
                console.log(`✅ Response sent to ${senderNumber}`);
                
            } catch (error) {
                console.error(`❌ Error:`, error.message);
                try {
                    await sock.sendPresenceUpdate('paused', sender);
                } catch (e) {}
            }
        });
        
    } catch (error) {
        console.error('❌ Start bot error:', error);
        setTimeout(startBot, 5000);
    }
}

startBot().catch(err => {
    console.error("❌ Fatal error:", err);
    setTimeout(() => {
        console.log("🔄 Restarting bot...");
        startBot();
    }, 5000);
});

process.on('SIGINT', () => {
    console.log('\n\n👋 Baggify.pk Assistant band ho raha hai...');
    console.log('✨ Allah Hafiz!');
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
});
