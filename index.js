const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const config = require("./config");

async function startTomBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    });

    // Pairing Code System (Directly uses number from config.js)
    if (!sock.authState.creds.registered) {
        console.log("---------- TOM-MD PAIRING ----------");
        const phoneNumber = config.ownerNumber.replace(/[^0-9]/g, '');
        setTimeout(async () => {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\nYOUR PAIRING CODE: ${code}\n`);
        }, 3000);
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
            const menuText = `*Hello! I am ${config.botName}* 🤖\n\n` +
                             `*Commands:*\n` +
                             `• ${config.prefix}menu\n` +
                             `• ${config.prefix}tagall\n\n` +
                             `_Owner: ${config.ownerName}_`;
            await sock.sendMessage(from, { text: menuText });
        }

        // TagAll Command
        if (command === 'tagall' && from.endsWith('@g.us')) {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants;
            let mentions = [];
            let text = `*📢 Group Announcement*\n\n`;
            
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
            console.log('TOM-MD IS ONLINE! ✅');
        }
    });
}

startTomBot();
