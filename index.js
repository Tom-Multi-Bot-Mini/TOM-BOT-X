const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require('fs');
const config = require("./config");

async function startTomBot() {
    console.log("DEBUG: সেশন চেক হচ্ছে...");
    
    // ১. GitHub Secret বা Environment Variable থেকে সেশন রিস্টোর (যদি থাকে)
    if (process.env.SESSION_DATA && !fs.existsSync('./session/creds.json')) {
        if (!fs.existsSync('./session')) fs.mkdirSync('./session');
        fs.writeFileSync('./session/creds.json', Buffer.from(process.env.SESSION_DATA, 'base64').toString());
        console.log("✅ GitHub Secret থেকে সেশন রিস্টোর করা হয়েছে।");
    }

    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        printQRInTerminal: true, // ২. এটি টার্মিনালে QR Code দেখাবে
        browser: ["Tom-Prime-X", "Chrome", "20.0.04"],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
    });

    // ৩. ফোন নাম্বার দিয়ে পেয়ারিং কোড সিস্টেম (যদি আগে লিঙ্ক না থাকে)
    if (!sock.authState.creds.registered) {
        const phoneNumber = config.ownerNumber.replace(/[^0-9]/g, '');
        if (phoneNumber) {
            console.log(`\nDEBUG: ${phoneNumber} নাম্বারের জন্য পেয়ারিং কোড জেনারেট হচ্ছে...\n`);
            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(phoneNumber);
                    console.log(`\n👉 তোমার হোয়াটসঅ্যাপ কোড: ${code}\n`);
                    console.log("এই কোডটি তোমার হোয়াটসঅ্যাপ 'Link with phone number' অপশনে বসাও।\n");
                } catch (e) {
                    console.log("❌ পেয়ারিং কোড এরর! তুমি টার্মিনালের QR Code টি স্ক্যান করো।");
                }
            }, 5000); // ৫ সেকেন্ড অপেক্ষা করে রিকোয়েস্ট করবে
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("DEBUG: কানেকশন বিচ্ছিন্ন! পুনরায় চেষ্টা চলছে...");
            if (shouldReconnect) startTomBot();
        } else if (connection === 'open') {
            console.log("✅ অভিনন্দন! TOM-BOT এখন অনলাইনে আছে।");
            
            // সেশন আইডি জেনারেট করা (এটি কপি করে GitHub Secret-এ রাখতে পারো)
            const sessionData = Buffer.from(fs.readFileSync('./session/creds.json')).toString('base64');
            console.log("\n--- তোমার সেশন ডাটা (SESSION_DATA) ---");
            console.log(sessionData);
            console.log("--------------------------------------\n");
        }
    });
}

startTomBot();
