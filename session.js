const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require('fs');
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('./temp_session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: true, // কিউআর কোডও দেখাবে ব্যাকআপ হিসেবে
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        console.log("\n--- TOM-BOT-X SESSION GENERATOR ---");
        let phoneNumber = await question('তোমার নাম্বারটি লিখো (880XXXXXXXXXX format): ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        try {
            await delay(2000);
            let code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n✅ তোমার পেয়ারিং কোড: ${code}`);
            console.log("হোয়াটসঅ্যাপে গিয়ে 'Link with phone number' এ এই কোডটি দাও।\n");
        } catch (error) {
            console.log("\n❌ পেয়ারিং কোড এই মুহূর্তে কাজ করছে না। দয়া করে টার্মিনালের QR Code স্ক্যান করো।");
        }
    }

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", async (update) => {
        const { connection } = update;
        if (connection === "open") {
            await delay(5000);
            const creds = fs.readFileSync('./temp_session/creds.json');
            const sessionID = Buffer.from(creds).toString('base64');
            console.log(`\n🚀 সেশন সফলভাবে তৈরি হয়েছে!\n\nID: TOM-BOT-X~${sessionID}\n`);
            console.log("এটি কপি করে গিটহাব Secrets-এ বসিয়ে দাও।");
            process.exit(0);
        }
    });
}

start();
