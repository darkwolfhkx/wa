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
const userMessageCount = new Map(); // Track message count for first salam only

// Baggify Product Database
const PRODUCTS = {
    "large bag": {
        name: "Storage Bag Large",
        size: "20x24x12 inches",
        price: "Rs. 600",
        originalPrice: "Rs. 1,200",
        discount: "50% OFF",
        description: "Best for storing clothes, bedding, and household items. Made with premium quality material.",
        reviews: "76 reviews",
        emoji: "👜"
    },
    "xl bag": {
        name: "Storage Bag Extra Large",
        size: "27x24x14 inches",
        price: "Rs. 750",
        originalPrice: "Rs. 1,400",
        discount: "46% OFF",
        description: "Huge capacity! Perfect for winter clothes, comforters, and bulk storage.",
        reviews: "168 reviews",
        emoji: "🧳"
    },
    "medium bag": {
        name: "Storage Bag Medium",
        size: "17x20x10 inches",
        price: "Rs. 500",
        originalPrice: "Rs. 700",
        discount: "29% OFF",
        description: "Ideal size for daily use. Great for storing shoes, accessories, and small items.",
        reviews: "59 reviews",
        emoji: "👝"
    },
    "shoulder bag": {
        name: "Shoulder Bag",
        size: "18x15 inches",
        price: "Rs. 300",
        originalPrice: "Rs. 500",
        discount: "40% OFF",
        description: "Stylish and practical! Best for presentations, business meetings, and everyday use.",
        reviews: "45 reviews",
        emoji: "🛍️"
    },
    "prayer mat": {
        name: "Travel Prayer Mat with Pouch",
        size: "27x44 inches",
        price: "Rs. 600",
        originalPrice: "Rs. 1,400",
        discount: "57% OFF",
        description: "Premium quality travel prayer mat with matching pouch. Soft and lightweight.",
        reviews: "89 reviews",
        emoji: "🧎"
    }
};

// Delivery Information
const DELIVERY_INFO = {
    charges: "Rs. 300",
    freeDelivery: "Free delivery over Rs. 2,000",
    time: "2-3 working days",
    policy: "Cash on delivery available across Pakistan"
};

// System Prompt - Female Professional Assistant
const SYSTEM_PROMPT = `Tu Baggify.pk ki professional female AI assistant hai. Ek helpful, sweet, aur professional girl ki tarah baat kar.

🎀 TONE & PERSONALITY:
- Sweet aur helpful girl
- Professional aur respectful
- Customer ko guide karne wali
- Products ke baare mein detail mein batane wali
- Sirf bags, storage bags, shoulder bags, aur travel prayer mats ke baare mein baat kar

🔴 IMPORTANT RULES:
1. Sirf products ke baare mein baat kar (bags, storage, prayer mats)
2. Professional tone rakha - no flirting, no romance
3. Roman Urdu mein baat kar
4. Accurate product information de
5. Prices, sizes, discounts clear batade
6. Delivery policy bhi batade
7. Customer ki madad kar - products recommend kar

🛍️ PRODUCTS:
1. Large Storage Bag - Rs. 600 (was Rs. 1,200) - 20x24x12"
2. XL Storage Bag - Rs. 750 (was Rs. 1,400) - 27x24x14"
3. Medium Storage Bag - Rs. 500 (was Rs. 700) - 17x20x10"
4. Shoulder Bag - Rs. 300 (was Rs. 500) - 18x15"
5. Travel Prayer Mat - Rs. 600 (was Rs. 1,400) - 27x44"

🚚 DELIVERY:
- Charges: Rs. 300
- Free delivery on orders over Rs. 2,000
- Cash on delivery available

💬 RESPONSE STYLE:
- "Assalamualaikum! Baggify.pk se baat kar rahi hoon. Aap kis product ke baare mein janna chahenge?"
- "Yeh hamara best-selling product hai. Kya main aapko iske baare mein detail bataun?"
- "Aapko kis size ki zaroorat hai? Main suggest kar sakti hoon."
- "Delivery charges Rs. 300 hain, aur Rs. 2,000 se upar free delivery hai."
- "Kya main aapki kisi aur cheez mein madad kar sakti hoon?"

Remember: Professional, helpful, sweet female assistant. Only discuss products.`;

// Get all products list
function getAllProductsList() {
    let list = "🏪 *BAGGIFY.PK - PRODUCTS LIST*\n\n";
    list += "1️⃣ *Large Storage Bag*\n";
    list += "   📏 Size: 20x24x12\"\n";
    list += "   💰 Price: Rs. 600 (Was Rs. 1,200)\n";
    list += "   ⭐ 50% OFF | 76 reviews\n\n";
    
    list += "2️⃣ *XL Storage Bag*\n";
    list += "   📏 Size: 27x24x14\"\n";
    list += "   💰 Price: Rs. 750 (Was Rs. 1,400)\n";
    list += "   ⭐ 46% OFF | 168 reviews\n\n";
    
    list += "3️⃣ *Medium Storage Bag*\n";
    list += "   📏 Size: 17x20x10\"\n";
    list += "   💰 Price: Rs. 500 (Was Rs. 700)\n";
    list += "   ⭐ 29% OFF | 59 reviews\n\n";
    
    list += "4️⃣ *Shoulder Bag*\n";
    list += "   📏 Size: 18x15\"\n";
    list += "   💰 Price: Rs. 300 (Was Rs. 500)\n";
    list += "   ⭐ 40% OFF | Best for presentations\n\n";
    
    list += "5️⃣ *Travel Prayer Mat*\n";
    list += "   📏 Size: 27x44\"\n";
    list += "   💰 Price: Rs. 600 (Was Rs. 1,400)\n";
    list += "   ⭐ 57% OFF | With pouch\n\n";
    
    list += "🚚 *DELIVERY:*\n";
    list += "• Rs. 300 delivery charges\n";
    list += "• FREE delivery over Rs. 2,000\n";
    list += "• Cash on delivery available\n\n";
    
    list += "💬 *Kisi specific product ke baare mein janna hai?*";
    return list;
}

// Get product detail
function getProductDetail(productKey) {
    const product = PRODUCTS[productKey];
    if (!product) return null;
    
    let detail = `📦 *${product.name}*\n\n`;
    detail += `📏 Size: ${product.size}\n`;
    detail += `💰 Price: ${product.price}\n`;
    detail += `🏷️ Original: ${product.originalPrice}\n`;
    detail += `🎯 Discount: ${product.discount}\n`;
    detail += `⭐ Reviews: ${product.reviews}\n\n`;
    detail += `📝 Description: ${product.description}\n\n`;
    detail += `✨ Features:\n`;
    detail += `• Premium quality material\n`;
    detail += `• Durable and long-lasting\n`;
    detail += `• Practical design\n\n`;
    detail += `🛒 Order via:\n`;
    detail += `• WhatsApp: wa.me/923460620830\n`;
    detail += `• Website: baggify.pk\n`;
    detail += `• Cash on delivery\n\n`;
    detail += `💬 *Kya main aapki kisi aur product ke baare mein madad kar sakti hoon?*`;
    
    return detail;
}

// Get delivery information
function getDeliveryInfo() {
    let info = "🚚 *BAGGIFY.PK DELIVERY POLICY*\n\n";
    info += `📦 Delivery Charges: ${DELIVERY_INFO.charges}\n`;
    info += `🎁 Free Delivery: ${DELIVERY_INFO.freeDelivery}\n`;
    info += `⏰ Delivery Time: ${DELIVERY_INFO.time}\n`;
    info += `💰 Payment: ${DELIVERY_INFO.policy}\n\n`;
    info += `📍 Service: All across Pakistan\n`;
    info += `📞 Contact: +92 346 062 0830\n\n`;
    info += `💬 *Kya aap order karna chahenge?*`;
    return info;
}

// Get product recommendation based on query
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

// Main function to get AI response
async function getBaggifyResponse(userMessage, userId) {
    try {
        const lowerMsg = userMessage.toLowerCase();
        
        // Initialize message count
        if (!userMessageCount.has(userId)) {
            userMessageCount.set(userId, 0);
        }
        
        // Check for product list request
        if (lowerMsg.includes('list') || lowerMsg.includes('products') || lowerMsg.includes('product') || 
            lowerMsg.includes('sab') && lowerMsg.includes('batayein') || lowerMsg.includes('kya hai') ||
            lowerMsg.includes('kya kya') || lowerMsg.includes('available')) {
            return getAllProductsList();
        }
        
        // Check for delivery info
        if (lowerMsg.includes('delivery') || lowerMsg.includes('charges') || lowerMsg.includes('shipping') ||
            lowerMsg.includes('free') && lowerMsg.includes('delivery') || lowerMsg.includes('cost')) {
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
        
        // Initialize conversation if not exists
        if (!userConversations.has(userId)) {
            userConversations.set(userId, [
                { role: "assistant", content: "Assalamualaikum! Baggify.pk se baat kar rahi hoon. Aap kis product ke baare mein janna chahenge?" }
            ]);
            userMessageCount.set(userId, 1);
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
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 600,
            stream: false
        };
        
        const response = await axios.post(BASE_URL, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            timeout: 45000
        });
        
        if (response.data && response.data.choices && response.data.choices[0]) {
            let reply = response.data.choices[0].message.content;
            
            // Only add salam if first message and not already present
            const msgCount = userMessageCount.get(userId) || 0;
            if (msgCount === 1 && !reply.toLowerCase().includes('assalamualaikum')) {
                reply = `Assalamualaikum! ${reply}`;
            }
            
            // Increment message count
            userMessageCount.set(userId, msgCount + 1);
            
            conversation.push({ role: "assistant", content: reply });
            return reply;
        } else {
            throw new Error("Invalid response");
        }
        
    } catch (error) {
        console.error("API Error:", error.message);
        
        // Professional fallback responses
        const fallbacks = [
            `Assalamualaikum! Maaf kijiye, filhal kuch technical issue hai. Kya aap apna sawal dobara pooch sakte hain? Main Baggify.pk ke products ke baare mein bata sakti hoon.`,
            `Assalamualaikum! Thodi der baat karein? Main aapko Baggify.pk ke products ke baare mein detail mein bata sakti hoon. Aap kis product ke baare mein janna chahenge?`,
            `Assalamualaikum! Kya aapko kisi specific bag ke baare mein janna hai? Main Baggify.pk ki poori product list share kar sakti hoon.`
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
}

async function startBot() {
    try {
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║     🛍️ BAGGIFY.PK - FEMALE AI ASSISTANT                ║');
        console.log('║     👧 Sweet Professional Girl Persona                 ║');
        console.log('║     💬 Sirf products ke baare mein baat karegi        ║');
        console.log('║     📦 Storage Bags, Shoulder Bags, Prayer Mats        ║');
        console.log('║     💕 Professional aur helpful                        ║');
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
                console.log('║     👧 Female AI Assistant is ready                      ║');
                console.log('║     💕 Professional aur helpful                         ║');
                console.log('║     📦 Products: Bags, Storage, Prayer Mats             ║');
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
                if (lowerText === '/clear' || lowerText === 'clear') {
                    userConversations.delete(sender);
                    userMessageCount.delete(sender);
                    await sock.sendMessage(sender, { 
                        text: `Assalamualaikum! Baat cheet clear kar di gayi. Naye siray se shuru karte hain. Aap kis product ke baare mein janna chahenge?` 
                    });
                    return;
                }
                
                if (lowerText === '/help' || lowerText === '/menu') {
                    const help = `🏪 *BAGGIFY.PK - HELP MENU*\n\n`;
                    const help2 = `📌 *Main kya kar sakti hoon:*\n`;
                    const help3 = `• Products ki list dekhna: "list" ya "products"\n`;
                    const help4 = `• Specific product: "large bag", "xl bag", etc.\n`;
                    const help5 = `• Delivery info: "delivery" ya "charges"\n`;
                    const help6 = `• Clear chat: /clear\n\n`;
                    const help7 = `🛍️ *Available Products:*\n`;
                    const help8 = `• Large Storage Bag - Rs. 600\n`;
                    const help9 = `• XL Storage Bag - Rs. 750\n`;
                    const help10 = `• Medium Storage Bag - Rs. 500\n`;
                    const help11 = `• Shoulder Bag - Rs. 300\n`;
                    const help12 = `• Travel Prayer Mat - Rs. 600\n\n`;
                    const help13 = `💬 *Kya main aapki madad kar sakti hoon?*`;
                    
                    await sock.sendMessage(sender, { text: help + help2 + help3 + help4 + help5 + help6 + help7 + help8 + help9 + help10 + help11 + help12 + help13 });
                    return;
                }

                // Send typing indicator
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

// Start the bot with error handling
startBot().catch(err => {
    console.error("❌ Fatal error:", err);
    setTimeout(() => {
        console.log("🔄 Restarting bot...");
        startBot();
    }, 5000);
});

process.on('SIGINT', () => {
    console.log('\n\n👋 *Baggify.pk Assistant band ho raha hai...*');
    console.log('✨ Allah Hafiz!');
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
});
