const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const config = require("./config");

async function startTomBot() {
    console.log("DEBUG: সেশন লোড হচ্ছে...");
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ["Mac OS", "Chrome", "122.0.6261.111"]
    });

    sock.ev.on('creds.update', saveCreds);

    // Pairing Code System (DEBUG LOGS সহ)
    if (!sock.authState.creds.registered) {
        console.log("DEBUG: পেয়ারিং কোডের জন্য সংযোগ অপেক্ষা করছে...");
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'connecting') {
                console.log("DEBUG: হোয়াটসঅ্যাপ সার্ভারের সাথে সংযোগ স্থাপন হচ্ছে...");
            } else if (connection === 'open') {
                console.log("DEBUG: সংযোগ সফল হয়েছে! পেয়ারিং কোড রিকোয়েস্ট করছি...");
                try {
                    const phoneNumber = config.ownerNumber.replace(/[^0-9]/g, '');
                    const code = await sock.requestPairingCode(phoneNumber);
                    console.log(`\n✅ তোমার পেয়ারিং কোড হলো: ${code}\n`);
                } catch (err) {
                    console.log("DEBUG: কোড রিকোয়েস্ট করতে গিয়ে এরর হয়েছে: ", err);
                }
            } else if (connection === 'close') {
                console.log("DEBUG: সংযোগ বিচ্ছিন্ন হয়েছে। কারণ: ", lastDisconnect?.error?.output?.statusCode);
            }
        });
    }

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isCmd = body.startsWith(config.prefix);
        const command = isCmd ? body.slice(config.prefix.length).trim().split(' ')[0].toLowerCase() : "";

        if (command === 'menu') {
            await sock.sendMessage(from, { text: `হ্যালো! আমি ${config.botName}` });
        }
    });

    console.log("DEBUG: বট প্রসেস স্টার্ট হয়েছে...");
}

startTomBot();
