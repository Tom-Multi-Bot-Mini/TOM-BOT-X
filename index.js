const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const config = require("./config");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startTomBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('তোমার হোয়াটসঅ্যাপ নম্বর দাও (যেমন: 88017xxxx): ');
        const code = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
        console.log(`\nতোমার পেয়ারিং কোড হলো: ${code}\n`);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        if (text === ".menu") {
            await sock.sendMessage(from, { text: `হ্যালো, আমি ${config.botName}! \n\nকমান্ডসমূহ:\n.menu - মেনু দেখার জন্য\n.tagall - গ্রুপে সবাইকে মেনশন করার জন্য` });
        }

        if (text === ".tagall") {
            if (!from.endsWith('@g.us')) return;
            const metadata = await sock.groupMetadata(from);
            let message = "📢 *সবাইকে মেনশন করছি:*\n\n";
            let mentions = [];
            for (let member of metadata.participants) {
                message += `@${member.id.split('@')[0]} `;
                mentions.push(member.id);
            }
            await sock.sendMessage(from, { text: message, mentions: mentions });
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') console.log('✅ Tom Bot চালু হয়েছে!');
    });
}
startTomBot();
