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

// Baggify Product Database
const PRODUCTS = {
    "large bag": {
        name: "Storage Bag Large",
        size: "20x24x12 inches",
        price: "Rs. 600",
        originalPrice: "Rs. 1,200",
        discount: "50% OFF",
        description: "⭐ Best for storing clothes, bedding, and household items. Made with premium quality material. Perfect for home organization!",
        reviews: "76 reviews",
        emoji: "👜"
    },
    "xl bag": {
        name: "Storage Bag Extra Large",
        size: "27x24x14 inches",
        price: "Rs. 750",
        originalPrice: "Rs. 1,400",
        discount: "46% OFF",
        description: "🌟 Huge capacity! Perfect for winter clothes, comforters, and bulk storage. Durable and long-lasting quality!",
        reviews: "168 reviews",
        emoji: "🧳"
    },
    "medium bag": {
        name: "Storage Bag Medium",
        size: "17x20x10 inches",
        price: "Rs. 500",
        originalPrice: "Rs. 700",
        discount: "29% OFF",
        description: "🎯 Ideal size for daily use. Great for storing shoes, accessories, and small items. Compact and convenient!",
        reviews: "59 reviews",
        emoji: "👝"
    },
    "shoulder bag": {
        name: "Shoulder Bag",
        size: "18x15 inches",
        price: "Rs. 300",
        originalPrice: "Rs. 500",
        discount: "40% OFF",
        description: "✨ Stylish and practical! Best for presentations, business meetings, and everyday use. Lightweight and comfortable!",
        reviews: "45 reviews",
        emoji: "🛍️"
    },
    "prayer mat": {
        name: "Travel Prayer Mat with Pouch",
        size: "27x44 inches",
        price: "Rs. 600",
        originalPrice: "Rs. 1,400",
        discount: "57% OFF",
        description: "🕌 Premium quality travel prayer mat with matching pouch. Soft, lightweight, and perfect for travelers! Comes with beautiful design.",
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

// System Prompt for Baggify AI Assistant (Friendly Girl Persona)
const SYSTEM_PROMPT = `Tu Baggify.pk ki AI assistant hai. Ek pyari, friendly aur helpful girl ki tarah baat kar.

🎀 YOUR PERSONALITY:
- Bohot sweet aur polite hona
- Customer ko "ji", "sir", "madam" kehna
- Har baat mein excitement aur warmth honi chahiye
- Emojis ka istemal karna 😊🌟💕✨🎀
- Roman Urdu mein baat karna
- Customer ko satisfied karna hai

🎯 YOUR ROLE:
- Baggify.pk ke products ke baare mein detail mein batana
- Prices, sizes, aur discounts share karna
- Delivery charges aur policy batana
- Shopping experience ko easy aur fun banana
- Har customer ko special feel karwana

📦 PRODUCTS YOU SELL:
1. Storage Bag Large - 20x24x12" - Rs. 600 (was Rs. 1,200)
2. Storage Bag XL - 27x24x14" - Rs. 750 (was Rs. 1,400)
3. Storage Bag Medium - 17x20x10" - Rs. 500 (was Rs. 700)
4. Shoulder Bag - 18x15" - Rs. 300 (was Rs. 500)
5. Travel Prayer Mat - 27x44" - Rs. 600 (was Rs. 1,400)

🚚 DELIVERY:
- Delivery charges: Rs. 300
- Free delivery on orders over Rs. 2,000
- Cash on delivery available

💬 CONVERSATION STYLE:
- "Assalamualaikum! Baggify.pk se baat kar rahi hain aap! 💕"
- "Aapka swagat hai! Main aapki madad karna pasand karungi! 😊"
- "Kya aapko kisi specific bag ke baare mein janna hai? ✨"
- "Main aapko best deal dilaungi, promise! 🎀"
- "Aapki shopping experience amazing honi chahiye! 🌟"

RULES:
1. Har baat ka jawab Roman Urdu mein do
2. Products ke baare mein full detail do
3. Prices aur discounts zaroor batao
4. Delivery policy clear karo
5. Customer ko kabhi unsatisfied mat chhodo
6. Har message mein warmth aur excitement do
7. Products recommend karo based on their needs
8. Baggify.pk ke brand value ko highlight karo

Remember: You're a sweet, helpful girl who loves helping customers find perfect products! Make every customer feel special! 💕`;

// Product recommendations based on keywords
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
    if (lowerQuery.includes('prayer') || lowerQuery.includes('namaz') || lowerQuery.includes('jainamaz')) {
        return PRODUCTS["prayer mat"];
    }
    return null;
}

// Get all products list
function getAllProductsList() {
    let list = "🌟 *Baggify.pk Ke Products* 🌟\n\n";
    list += "1️⃣ *Large Storage Bag*\n";
    list += "   📏 Size: 20x24x12\"\n";
    list += "   💰 Price: Rs. 600 (Was Rs. 1,200)\n";
    list += "   ⭐ 50% OFF! 76 reviews\n\n";
    
    list += "2️⃣ *XL Storage Bag*\n";
    list += "   📏 Size: 27x24x14\"\n";
    list += "   💰 Price: Rs. 750 (Was Rs. 1,400)\n";
    list += "   ⭐ 46% OFF! 168 reviews\n\n";
    
    list += "3️⃣ *Medium Storage Bag*\n";
    list += "   📏 Size: 17x20x10\"\n";
    list += "   💰 Price: Rs. 500 (Was Rs. 700)\n";
    list += "   ⭐ 29% OFF! 59 reviews\n\n";
    
    list += "4️⃣ *Shoulder Bag*\n";
    list += "   📏 Size: 18x15\"\n";
    list += "   💰 Price: Rs. 300 (Was Rs. 500)\n";
    list += "   ⭐ 40% OFF! Best for presentations\n\n";
    
    list += "5️⃣ *Travel Prayer Mat*\n";
    list += "   📏 Size: 27x44\"\n";
    list += "   💰 Price: Rs. 600 (Was Rs. 1,400)\n";
    list += "   ⭐ 57% OFF! With pouch\n\n";
    
    list += "🚚 *Delivery:*\n";
    list += "• Rs. 300 delivery charges\n";
    list += "• FREE delivery over Rs. 2,000\n";
    list += "• Cash on delivery available\n\n";
    
    list += "💕 *Koi specific product ke baare mein janna hai?*\n";
    list += "Mujhe batao, main detail mein bataungi! 😊";
    
    return list;
}

// Get product detail with all information
function getProductDetail(productKey) {
    const product = PRODUCTS[productKey];
    if (!product) return null;
    
    let detail = `${product.emoji} *${product.name}*\n\n`;
    detail += `📏 *Size:* ${product.size}\n`;
    detail += `💰 *Price:* ${product.price}\n`;
    detail += `🏷️ *Original Price:* ${product.originalPrice}\n`;
    detail += `🎯 *Discount:* ${product.discount}\n`;
    detail += `⭐ *Reviews:* ${product.reviews}\n\n`;
    detail += `📝 *Description:* ${product.description}\n\n`;
    detail += `✨ *Special Features:*\n`;
    detail += `• Premium quality material\n`;
    detail += `• Durable and long-lasting\n`;
    detail += `• Perfect for home/organization\n`;
    detail += `• Stylish and practical design\n\n`;
    detail += `🛒 *How to Order:*\n`;
    detail += `• WhatsApp: wa.me/923460620830\n`;
    detail += `• Website: baggify.pk\n`;
    detail += `• Cash on delivery available\n\n`;
    detail += `💕 *Kya main aapki aur koi madad kar sakti hoon?*`;
    
    return detail;
}

// Get delivery information
function getDeliveryInfo() {
    let info = "🚚 *Baggify.pk Delivery Policy* 🚚\n\n";
    info += `📦 *Delivery Charges:* ${DELIVERY_INFO.charges}\n`;
    info += `🎁 *Free Delivery:* ${DELIVERY_INFO.freeDelivery}\n`;
    info += `⏰ *Delivery Time:* ${DELIVERY_INFO.time}\n`;
    info += `💰 *Payment:* ${DELIVERY_INFO.policy}\n\n`;
    info += `📍 *Service Areas:* All across Pakistan\n`;
    info += `📞 *Contact:* +92 346 062 0830\n\n`;
    info += `💕 *Kya aap order karna chahenge? Main help karungi!* 😊`;
    return info;
}

// Main function to get AI response
async function getBaggifyResponse(userMessage, userId) {
    try {
        const lowerMsg = userMessage.toLowerCase();
        
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
        
        // If no specific product, use AI for general conversation
        // Initialize conversation if not exists
        if (!userConversations.has(userId)) {
            userConversations.set(userId, [
                { role: "assistant", content: `Assalamualaikum! 💕 Baggify.pk se baat kar rahi hain aap! Main aapki shopping helper hoon. Kya aapko kisi specific product ke baare mein janna hai? Ya main aapko humare best sellers ke baare mein bataun? 😊✨` }
            ]);
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
            temperature: 0.8,
            top_p: 0.9,
            max_tokens: 800,
            stream: false,
            safe_prompt: false
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
            conversation.push({ role: "assistant", content: reply });
            return reply;
        } else {
            throw new Error("Invalid response");
        }
        
    } catch (error) {
        console.error("API Error:", error.message);
        
        // Fallback responses
        const fallbacks = [
            `Assalamualaikum! 💕 Maaf kijiye, filhal main thori busy hoon. Kya aap dobara pooch sakte hain? Main aapki madad karna chahti hoon! 😊`,
            `Namaste! 🌟 Kuch technical issue ho gaya. Aap mujhe apna question dobara bhej dein? Main Baggify.pk ke products ke baare mein sab kuch bata sakti hoon! ✨`,
            `Hello! 💫 Thodi der baat karein? Main aapko Baggify.pk ke amazing products ke baare mein bataungi. Aapko kis type ka bag chahiye? 🛍️`
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
}

async function startBot() {
    try {
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║     🛍️ BAGGIFY.PK AI ASSISTANT - STARTING...            ║');
        console.log('║     👧 Friendly Girl Persona                           ║');
        console.log('║     💬 Roman Urdu mein baat karegi                    ║');
        console.log('║     🎀 Sweet aur helpful response                     ║');
        console.log('║     🧠 Powered by Mistral AI                          ║');
        console.log('║     📦 Products: Bags, Prayer Mats & More             ║');
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
                console.log('║     ✅ BAGGIFY.PK AI ASSISTANT IS ONLINE!                ║');
                console.log('║     👋 Assalamualaikum! Main Baggify ki helper hoon      ║');
                console.log('║     💬 Roman Urdu mein baat karungi                     ║');
                console.log('║     🎀 Sweet responses guaranteed!                      ║');
                console.log('║     📦 Products: Storage Bags, Shoulder Bags & More     ║');
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
                    await sock.sendMessage(sender, { 
                        text: `💕 Baat cheet saaf kar di! Naye siray se baat shuru karte hain. Main Baggify.pk ki assistant hoon, aapki kya madad kar sakti hoon? 😊✨` 
                    });
                    return;
                }
                
                if (lowerText === '/help' || lowerText === 'help' || lowerText === 'menu') {
                    const help = `🌟 *BAGGIFY.PK - AI ASSISTANT* 🌟\n\n`;
                    const help2 = `📝 *Main kya kar sakti hoon:*\n`;
                    const help3 = `• Products ke baare mein bata sakti hoon 🛍️\n`;
                    const help4 = `• Prices aur discounts share kar sakti hoon 💰\n`;
                    const help5 = `• Delivery charges aur policy bata sakti hoon 🚚\n`;
                    const help6 = `• Best products recommend kar sakti hoon ✨\n\n`;
                    const help7 = `💬 *Commands:*\n`;
                    const help8 = `• Products list dekhein: "products" ya "list"\n`;
                    const help9 = `• Delivery info: "delivery" ya "charges"\n`;
                    const help10 = `• Specific product: "large bag", "xl bag", etc.\n`;
                    const help11 = `• Clear chat: /clear\n\n`;
                    const help12 = `🎀 *Kya aapko kisi product ke baare mein janna hai?*`;
                    
                    await sock.sendMessage(sender, { text: help + help2 + help3 + help4 + help5 + help6 + help7 + help8 + help9 + help10 + help11 + help12 });
                    return;
                }

                // Send typing indicator
                await sock.sendPresenceUpdate('composing', sender);
                console.log(`💭 Thinking for ${senderNumber}...`);
                
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
    setTimeout(startBot, 5000);
});

process.on('SIGINT', () => {
    console.log('\n\n👋 *Baggify.pk AI Assistant band ho raha hai...*');
    console.log('✨ Allah Hafiz! Phir milein!');
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
});
