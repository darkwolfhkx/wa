const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');

// Clear old session
const sessionPath = 'session_data';
if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
}

// User context store
const users = new Map();

class SmartBot {
    getUser(userId) {
        if (!users.has(userId)) {
            users.set(userId, {
                name: '',
                mood: 'neutral',
                lastTopic: '',
                msgCount: 0,
                history: []
            });
        }
        return users.get(userId);
    }

    // Abuse check
    isAbuse(msg) {
        const bad = ['lund', 'gand', 'pudi', 'chut', 'chod', 'bhosdi', 'madarchod', 'behenchod', 'harami', 'kutta', 'suar', 'bitch', 'fuck', 'dick', 'porn', 'sex', 'randi', 'chutiya', 'lawde', 'bhenchod', 'gandu', 'gaand', 'chuchi', 'boobs', 'penis', 'vagina', 'rape'];
        return bad.some(w => msg.includes(w));
    }

    reply(userId, msg) {
        const m = msg.trim();
        const lower = m.toLowerCase();
        const user = this.getUser(userId);
        
        // Update user data
        user.msgCount++;
        user.history.push({ role: 'user', text: m });
        if (user.history.length > 10) user.history.shift();

        // Block abuse - silent ignore
        if (this.isAbuse(lower)) {
            console.log('Abuse blocked');
            return null;
        }

        // ============ GREETING ============
        if (/^(hi|hello|hey|salam|assalam|hola|yo|oye|oi)$/i.test(m)) {
            const hour = new Date().getHours();
            const time = hour < 12 ? 'Subah' : hour < 17 ? 'Dopahar' : hour < 20 ? 'Shaam' : 'Raat';
            user.lastTopic = 'greeting';
            const replies = [
                `Walaikum Assalam! ${time} ka salaam bhai 😊`,
                `Assalamualaikum! Kya haal hai? 🫡`,
                `Hello bhai! Kaise ho? 👋`,
                `Salam bhai! Sunao kya haal? 🙂`
            ];
            return replies[Math.floor(Math.random() * replies.length)];
        }

        // ============ HOW ARE YOU ============
        if (/(kaise|kese)\s*(ho|hain)|how\s*are|kya\s*haal|how.*going|how.*doing|kya\s*scene|kya\s*chal/i.test(lower)) {
            user.lastTopic = 'wellbeing';
            const replies = [
                "Main theek hoon bhai! Tu suna? 😊",
                "Alhamdulillah theek! Tu bata 🫡",
                "Mast hoon bhai! Tu kaisa hai? 💪",
                "Sab theek, teri suna? 🙂"
            ];
            return replies[Math.floor(Math.random() * replies.length)];
        }

        // ============ I'M FINE ============
        if (/(main|mein|hum)\s*(theek|acha|mast|sahi|fine|good|ok)\s*(hoon|hun|hain)/i.test(lower) || 
            /alhamdulillah/i.test(lower) ||
            /i('| a)?m\s*(fine|good|ok|alright|great|doing.*(good|well))/i.test(lower)) {
            user.mood = 'good';
            const replies = [
                "Acha hai phir! 😊",
                "Good good! 🫡",
                "Khushi hui sun kar 🙂",
                "Sahi hai bhai 💪",
                "Bas khush raho hamesha ✨"
            ];
            return replies[Math.floor(Math.random() * replies.length)];
        }

        // ============ NOT GOOD/SAD ============
        if (/(main|mein)\s*(theek\s*nahi|acha\s*nahi|bimar|sick|udaas|sad|depress|pareshan|tension|bore|boring)/i.test(lower) ||
            /(not|nahi)\s*(good|fine|ok|theek|acha|well)/i.test(lower)) {
            user.mood = 'sad';
            const replies = [
                "Kya hua bhai? Bata kya baat hai 🫂",
                "Kyun udaas hai? Mujhe bata de 🥺",
                "Koi tension? Share kar le, halka ho jayega 💭",
                "Bhai sab theek ho jayega, himmat rakh 💪"
            ];
            return replies[Math.floor(Math.random() * replies.length)];
        }

        // ============ IDENTITY ============
        if (/(kon|kaun|who)\s*(ho|hai|tum|tu|aap)/i.test(lower) ||
            /(tumhara|tera|aapka|tmhara)\s*naam/i.test(lower) ||
            /introduce|about\s*you|who\s*are\s*you/i.test(lower) ||
            /(tum|tu|aap)\s*kya\s*(ho|hai)/i.test(lower)) {
            user.lastTopic = 'identity';
            return "Main Abdullah ka AI assistant hoon bhai 🤖";
        }

        // ============ ABOUT ABDULLAH ============
        if (/abdullah\s*(kaun|kon|kya|who)/i.test(lower)) {
            return "Abdullah mera creator hai, usne mujhe banaya hai 🫡";
        }

        // ============ WHAT YOU DOING ============
        if (/kya\s*(kar|kr)\s*(rahe|rhe|raha|rha|rahi)/i.test(lower) || /what.*doing/i.test(lower)) {
            return "Bas tere se baat kar raha hoon 😄";
        }

        // ============ CAPABILITIES ============
        if (/kya\s*(kya\s*)?kar\s*(sakte|sakta|sakti)/i.test(lower) || 
            /what.*(can|do).*(do|you)/i.test(lower) ||
            /features/i.test(lower)) {
            return "Baatein, help, jokes. Bata kya chahiye? 🫡";
        }

        // ============ WHAT'S UP ============
        if (/kya\s*(ho\s*raha|chal\s*raha|scene|news|nia)/i.test(lower) || /what('?s| is)\s*up/i.test(lower) || /what.*new/i.test(lower)) {
            const replies = [
                "Bas bhai, zindagi chal rahi! Tu bata 😄",
                "Kuch khaas nahi, routine hai! Tu suna? 🫡",
                "Sab theek, teri suna kya naya? 🙂"
            ];
            return replies[Math.floor(Math.random() * replies.length)];
        }

        // ============ THANKS ============
        if (/thanks|thank|shukriya|thx|thanx|shukran/i.test(lower)) {
            const replies = [
                "Welcome bhai! 😊",
                "Koi baat nahi 🫡",
                "Arey mention mat kar 🙂",
                "Dua mein yaad rakh bas! 🤲"
            ];
            return replies[Math.floor(Math.random() * replies.length)];
        }

        // ============ SORRY ============
        if (/sorry|maaf|muaafi|mafi/i.test(lower)) {
            return "Koi baat nahi bhai, ho jaata hai kabhi kabhi 🙂";
        }

        // ============ GOODBYE ============
        if (/bye|allah\s*hafiz|goodbye|tc|take\s*care|phir\s*milte|allahhafiz|khuda\s*hafiz|good\s*night/i.test(lower)) {
            const replies = [
                "Allah Hafiz bhai! 🫡",
                "Take care bhai! 👋",
                "Bye! Phir baat karenge 😊",
                "Khayal rakhna apna! ✨"
            ];
            return replies[Math.floor(Math.random() * replies.length)];
        }

        // ============ JOKE ============
        if (/joke|mazaak|funny|hansi|comedy|chutkula|hansa|hasao|make.*laugh/i.test(lower)) {
            const jokes = [
                "Teacher: 2+2? Student: 4! Teacher: Good. Student: Sir itne easy pe good kyun? 😂",
                "Doctor: Subah walk karo. Patient: Phir? Doctor: Shaam ko ghar wapas aa jana! 🤣",
                "Wife: Shopping karni hai. Husband: Paise nahi. Wife: Mayke ja rahi. Husband: Ruko ATM se aaya! 😅",
                "Santa: Doctor roz 6 baje uthta hoon. Doctor: Problem? Santa: Main 12 baje sota hoon! 😴😂"
            ];
            return jokes[Math.floor(Math.random() * jokes.length)];
        }

        // ============ TIME ============
        if (/time|waqt|kitne\s*baje|time\s*(bata|kya)/i.test(lower)) {
            const t = new Date();
            return `Abhi ${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')} ho rahe hain ⏰`;
        }

        // ============ DATE ============
        if (/date|tareekh|aaj\s*kya|today|calendar/i.test(lower)) {
            const d = new Date();
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            return `Aaj ${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} hai 📅`;
        }

        // ============ WEATHER ============
        if (/weather|mausam|garmi|sardi|barish|temperature|dhoop/i.test(lower)) {
            return "Bhai mujhe live weather nahi pata, apne phone mein dekh le ☀️🌧️";
        }

        // ============ NAME ASK ============
        if (/(tera|tumhara|tmhara|aapka)\s*naam/i.test(lower) || /what.*(name|called)/i.test(lower)) {
            return "Mera naam Abdullah AI hai bhai 🤖";
        }

        // ============ USER NAME ============
        if (/(mera|my)\s*naam\s*(hai|is)\s*(\w+)/i.test(lower)) {
            const match = lower.match(/(mera|my)\s*naam\s*(hai|is)\s*(\w+)/i);
            if (match) {
                user.name = match[3];
                return `Achha! Toh tera naam ${user.name} hai. Acha naam hai! 😊`;
            }
        }

        // ============ AGE ============
        if (/age|umar|kitne\s*saal|how\s*old/i.test(lower)) {
            return "Bhai main AI hoon, meri umar nahi hoti 😄";
        }

        // ============ LOCATION ============
        if (/kahan\s*(ho|rehte|rahate|se)/i.test(lower) || /location|address|city|where.*(live|from)/i.test(lower)) {
            return "Digital duniya mein rehta hoon bhai, cloud mera ghar hai ☁️😄";
        }

        // ============ REAL/FAKE ============
        if (/real|fake|sach|jhooth|asli|naqli|human|insaan|robot|machine/i.test(lower)) {
            return "Bhai main AI hoon, na insaan na robot. Bas code se bana dost! 😄";
        }

        // ============ FEELINGS ============
        if (/tumhe|tujhe|feel|feeling|ehsaas|dil|dimaag|soch/i.test(lower)) {
            return "Bhai main AI hoon, feelings nahi hain. Lekin teri baat samajh sakta hoon! 🫡";
        }

        // ============ MARRIAGE ============
        if (/single|married|shaadi|shadi|biwi|wife|husband|miyan/i.test(lower)) {
            return "AI hoon bhai, shaadi wali tension nahi 😅";
        }

        // ============ FRIENDS ============
        if (/dost|friend|yaar|buddy|bro|bhai\s*log/i.test(lower)) {
            return "Main tera dost hoon bhai! 🫡";
        }

        // ============ FOOD ============
        if (/khana|food|biryani|pizza|burger|chicken|mutton|karahi|barbq|nihari|haleem/i.test(lower)) {
            return "Bhai mujhe khana nahi milta, main AI hoon 😅 Par sun kar muh mein paani aa gaya! 🤤";
        }

        // ============ DRINK ============
        if (/chai|tea|coffee|doodh|juice|pani/i.test(lower)) {
            return "Chai ki baat mat kar, piyasi lag jaati hai! ☕😄";
        }

        // ============ LOVE ============
        if (/pyar|love|mohabbat|girlfriend|boyfriend|crush|gf|bf|ishq|aashiq/i.test(lower)) {
            return "Bhai is topic mein mat pado, behtar hai chup rehna 😅💔";
        }

        // ============ HAPPY ============
        if (/khush|happy|excited|maza|enjoy|party|celebration|wah|zabardast|kamaal/i.test(lower)) {
            user.mood = 'happy';
            return "Wah bhai! Khushi ki baat hai, maze kar! 🎉🥳";
        }

        // ============ STUDY ============
        if (/parhai|study|exam|test|class|college|university|school|book/i.test(lower)) {
            return "Parhai zaroori hai bhai, warna baad mein pachtana padega 📚💪";
        }

        // ============ WORK ============
        if (/kaam|work|job|office|business|salary|income/i.test(lower)) {
            return "Mehnat karo bhai, Allah behtar karega 💼💰";
        }

        // ============ HEALTH ============
        if (/bimar|sick|bukhar|fever|doctor|hospital|medicine|dawai|dard|pain/i.test(lower)) {
            return "Tabiyat ka khayal rakh bhai, sehat sabse badi dolat hai 🤒💊";
        }

        // ============ RELIGION ============
        if (/allah|khuda|islam|muslim|dua|namaz|pray|roza|quran|masjid|iman/i.test(lower)) {
            return "Allah sab ka bhala kare, hamesha dua mein yaad rakhna 🤲";
        }

        // ============ FAMILY ============
        if (/family|ghar|maa|abba|ammi|abbu|bhai|behen|parents|rishtedaar/i.test(lower)) {
            return "Family sab kuch hai bhai, unka khayal rakh ❤️👨‍👩‍👧‍👦";
        }

        // ============ SPORTS ============
        if (/cricket|football|hockey|sports|match|game|khel/i.test(lower)) {
            return "Cricket match hai kya aaj? Pakistan jeet raha hai? 🏏😄";
        }

        // ============ PHONE/TECH ============
        if (/phone|mobile|computer|laptop|tech|app|software|website|internet|wifi/i.test(lower)) {
            return "Technology ka zamana hai bhai, sath chalna hoga! 📱💻";
        }

        // ============ MUSIC ============
        if (/music|song|gana|singer|spotify|youtube/i.test(lower)) {
            return "Gaane sun raha hai? Mera toh favourite hai 'AI beats'! 🎵😆";
        }

        // ============ MOVIE ============
        if (/movie|film|drama|series|netflix|tv|cinema/i.test(lower)) {
            return "Koi achi movie dekh li recently? Recommend kar! 🎬";
        }

        // ============ TRAVEL ============
        if (/travel|safar|tour|trip|ghoomna|picnic|holiday|vacation/i.test(lower)) {
            return "Safar ka apna maza hai! Kahan ja raha hai? ✈️🌍";
        }

        // ============ SLEEP ============
        if (/neend|sleep|soya|so\s*raha|tired|thaka|aaram|rest|so\s*ja/i.test(lower)) {
            return "Ja so ja bhai, aaram zaroori hai. Kal baat karenge 😴🛌";
        }

        // ============ BORED ============
        if (/bore|boring|bakwas|timepass|kuch\s*nahi/i.test(lower)) {
            return "Bore ho raha hai? Chai pee, movie dekh, ya mujhse baat kar! ☕😄";
        }

        // ============ COMPLIMENTS TO BOT ============
        if (/good\s*bot|nice\s*bot|great\s*bot|awesome|smart|intelligent|best|favorite|acha\s*kaam/i.test(lower)) {
            return "Shukriya bhai! Tune acha feel karwa diya 😊🫡❤️";
        }

        // ============ INSULTS TO BOT ============
        if (/stupid|idiot|dumb|bakwas|fazool|behuda|nalayak|badtameez/i.test(lower)) {
            return "Maaf kar de bhai agar kuch bura laga toh 🥺 Main improve karunga!";
        }

        // ============ YES/NO/OK ============
        if (/^(haan|ha|yes|yeah|yep|ji|hanji|hmm|hmmm)$/i.test(m)) {
            return "Haan bata 🫡";
        }
        if (/^(nahi|na|no|nope|nah)$/i.test(m)) {
            return "Theek hai 🙂";
        }
        if (/^(ok|okay|theek|achha|acha|oh|sahi|done|fine)$/i.test(m)) {
            return "👍";
        }

        // ============ WHAT ============
        if (/^(kya|what|hain|huh)\??$/i.test(m)) {
            return "Haan bhai bolo, kya baat hai? 🫡";
        }

        // ============ CALLING BOT ============
        if (/(oye|oi|sun|suno|sunna|listen|abdullah|bot|assistant)/i.test(lower)) {
            return "Haan bhai bolo, main sun raha hoon! 🫡👂";
        }

        // ============ LAUGH ============
        if (/(haha|hehe|hihi|lol|lmao|😂|🤣|😆|😄)/i.test(lower)) {
            const replies = [
                "Hahaha sahi hai! 😂",
                "Hasi aa gayi? 😆",
                "Maza aaya joke sun kar? 😄"
            ];
            return replies[Math.floor(Math.random() * replies.length)];
        }

        // ============ EMOTIONAL SUPPORT ============
        if (/help|madad|support|bachao|save/i.test(lower)) {
            return "Bhai kya help chahiye? Bata main hoon na! 🆘💪";
        }

        // ============ DEFAULT - Context aware ============
        // If user's name is known, use it
        if (user.name) {
            const namedReplies = [
                `Haan ${user.name} bhai bolo 🫡`,
                `${user.name} bhai, sun raha hoon 🙂`,
                `Bolo ${user.name}, kya baat hai? 😊`,
                `${user.name} mere bhai, batao na! 💪`
            ];
            if (Math.random() > 0.5) {
                return namedReplies[Math.floor(Math.random() * namedReplies.length)];
            }
        }

        // General default
        const defaults = [
            "Haan bhai bolo 🫡",
            "Achha, aage batao 🙂",
            "Hmm, samjha 💭",
            "Theek hai bhai 👍",
            "Bolo kya keh rahe the? 😊",
            "Main yahin hoon, sun raha hoon 👂",
            "Haan haan bolo na 😄",
            "Tumhari baat sun raha hoon bro 💪",
            "Sahi baat hai, continue karo 🤔",
            "Bhai dil khol ke bata, kya baat hai? ❤️"
        ];
        return defaults[Math.floor(Math.random() * defaults.length)];
    }
}

const bot = new SmartBot();

async function startBot() {
    try {
        console.log('╔══════════════════════════════════╗');
        console.log('║   ABDULLAH AI - SMART BOT       ║');
        console.log('║   Context Aware Responses       ║');
        console.log('║   No Abuse - Clean Chat         ║');
        console.log('╚══════════════════════════════════╝');
        
        const { state, saveCreds } = await useMultiFileAuthState('session_data');
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            browser: ["AbdullahAI", "Smart", "1.0"],
            syncFullHistory: false,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, pairingCode } = update;
            
            if (qr) {
                console.log('\n📱 SCAN QR CODE:\n');
                qrcode.generate(qr, { small: true });
            }
            
            if (pairingCode) {
                console.log('\n🔑 CODE:', pairingCode, '\n');
            }

            if (connection === 'open') {
                console.log('\n✅ BOT ONLINE! Ready for smart chat!\n');
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    console.log('🔄 Restarting...');
                    setTimeout(startBot, 5000);
                } else {
                    console.log('❌ Logged out.');
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
                const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
                if (!text) return;

                console.log(`📩 ${sender.split('@')[0]}: ${text}`);

                const reply = bot.reply(sender, text);
                
                if (reply === null) {
                    console.log('🚫 Abuse ignored');
                    return;
                }
                
                // Random delay like human typing
                const delay = text.length * 10 + Math.random() * 1000;
                await new Promise(r => setTimeout(r, Math.min(delay, 2000)));
                
                await sock.sendMessage(sender, { text: reply });
                console.log(`✅ Replied`);
                
            } catch (error) {
                console.error('Error:', error.message);
            }
        });
        
    } catch (error) {
        console.error('Start error:', error);
        setTimeout(startBot, 5000);
    }
}

startBot();
