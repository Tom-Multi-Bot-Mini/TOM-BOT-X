const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const fs = require('fs');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function generateSession() {
    console.log("\n--- TOM-BOT-X UNIQUE SESSION GENERATOR ---");
    console.log("সেশন ডাটা তৈরি করার জন্য নিচের ধাপগুলো অনুসরণ করো।\n");

    const { state, saveCreds } = await useMultiFileAuthState('./temp_session');

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Tom-Prime-X", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        let phoneNumber = await question('তোমার হোয়াটসঅ্যাপ নাম্বারটি লিখো (যেমন: 88017XXXXXXXX): ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        if (phoneNumber.length < 10) {
            console.log("❌ ভুল নাম্বার! আবার চেষ্টা করো।");
            process.exit(0);
        }

        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n✅ তোমার পেয়ারিং কোড হলো: ${code}`);
                console.log("তোমার হোয়াটসঅ্যাপে গিয়ে Link Device -> Link with phone number-এ এই কোডটি বসাও।\n");
            } catch (error) {
                console.log("❌ কোড জেনারেট করতে সমস্যা হয়েছে। আবার ট্রাই করো।");
                process.exit(0);
            }
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection } = update;
        if (connection === "open") {
            await delay(5000);
            const sessionData = Buffer.from(fs.readFileSync('./temp_session/creds.json')).toString('base64');
            
            console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("✅ কানেকশন সফল! তোমার ইউনিক সেশন আইডি নিচে দেওয়া হলো:");
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
            console.log(`TOM-SESSION~${sessionData}\n`);
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("এই আইডিটি কপি করে তোমার বটের SESSION_ID অপশনে বসাও।\n");
            
            // টেম্পোরারি ফাইল মুছে ফেলা
            fs.rmSync('./temp_session', { recursive: true, force: true });
            process.exit(0);
        }
    });
}

generateSession();
