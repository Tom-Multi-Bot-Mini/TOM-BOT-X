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
        printQRInTerminal: false, // QR চাইলে এখানে true করে দিবে
        mobile: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        connectTimeoutMs: 120000, 
        defaultQueryTimeoutMs: 120000,
        keepAliveIntervalMs: 30000,
        generateHighQualityLinkPreview: true,
        patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(
                message.buttonsMessage ||
                message.templateMessage ||
                message.listMessage
            );
            if (requiresPatch) {
                message = {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadata: {},
                                deviceListMetadataVersion: 2,
                            },
                            ...message,
                        },
                    },
                };
            }
            return message;
        },
    });

    sock.ev.on('creds.update', saveCreds);

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
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log("DEBUG: সংযোগ বিচ্ছিন্ন হয়েছে। কারণ কোড: ", lastDisconnect?.error?.output?.statusCode);
                if (shouldReconnect) startTomBot();
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
}

startTomBot();
