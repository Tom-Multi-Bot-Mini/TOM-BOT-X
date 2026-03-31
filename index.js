const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const config = require("./config");

async function startTomBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // Pairing Code System (সঠিকভাবে যোগ করা হয়েছে)
    if (!sock.authState.creds.registered) {
        console.log("---------- কানেকশন তৈরি হচ্ছে... অপেক্ষা করুন ----------");
        
        // কানেকশন চেক করে কোড রিকোয়েস্ট করা
        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                try {
                    const phoneNumber = config.ownerNumber.replace(/[^0-9]/g, '');
                    const code = await sock.requestPairingCode(phoneNumber);
                    console.log(`\n✅ তোমার পেয়ারিং কোড হলো: ${code}\n`);
                } catch (err) {
                    console.log("কোড পেতে সমস্যা হচ্ছে, আবার চেষ্টা করা হচ্ছে...");
                }
            }
        });
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isCmd = body.startsWith(config.prefix);
        const command = isCmd ? body.slice(config.prefix.length).trim().split(' ')[0].toLowerCase() : "";

        // Menu Command
        if (command === 'menu') {
            const menuText = `*হ্যালো! আমি ${config.botName}* 🤖\n\n` +
                             `*কমান্ডসমূহ:*\n` +
                             `• ${config.prefix}menu - মেনু দেখার জন্য\n` +
                             `• ${config.prefix}tagall - গ্রুপে সবাইকে মেনশন করতে\n\n` +
                             `_মালিক: ${config.ownerName}_`;
            await sock.sendMessage(from, { text: menuText });
        }

        // TagAll Command
        if (command === 'tagall' && from.endsWith('@g.us')) {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants;
            let mentions = [];
            let text = `*📢 গ্রুপ ঘোষণা (Tag All)*\n\n`;
            
            for (let mem of participants) {
                text += `@${mem.id.split('@')[0]} `;
                mentions.push(mem.id);
            }
            
            await sock.sendMessage(from, { text: text, mentions: mentions });
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startTomBot();
        } else if (connection === 'open') {
            console.log('✅ TOM-MD অনলাইনে আছে!');
        }
    });
}

startTomBot();
