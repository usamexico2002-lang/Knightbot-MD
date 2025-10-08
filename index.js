/**
 * Knight Bot - A WhatsApp Bot
 * Configurado para Render
 */

require('./settings');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const chalk = require('chalk');
const FileType = require('file-type');
const path = require('path');
const axios = require('axios');
const express = require('express');
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif');
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc');
const {
    default: makeWASocket,
    useSingleFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");
const readline = require("readline");

// Import lightweight store
const store = require('./lib/lightweight_store');
store.readFromFile();
const settings = require('./settings');
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);

// Express endpoint para mantener bot activo en Render
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🤖 KnightBot MD activo en Fly.io!'));
app.listen(port, () => console.log(`Servidor web escuchando en el puerto ${port}`));

// Memory optimization
setInterval(() => { if (global.gc) { global.gc(); console.log('🧹 Garbage collection completed'); } }, 60000);
setInterval(() => { const used = process.memoryUsage().rss / 1024 / 1024; if (used > 400) { console.log('⚠️ RAM too high (>400MB), restarting bot...'); process.exit(1); } }, 30000);

let phoneNumber = "911234567890";
let owner = JSON.parse(fs.readFileSync('./data/owner.json'));
global.botname = "KNIGHT BOT";
global.themeemoji = "•";
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");

const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
const question = (text) => rl ? new Promise(resolve => rl.question(text, resolve)) : Promise.resolve(settings.ownerNumber || phoneNumber);

async function startXeonBotInc() {
    let { version } = await fetchLatestBaileysVersion();
    const { state, saveState } = useSingleFileAuthState('./session.json');
    const msgRetryCounterCache = new NodeCache();

    const XeonBotInc = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: state,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        getMessage: async (key) => { let jid = jidNormalizedUser(key.remoteJid); let msg = await store.loadMessage(jid, key.id); return msg?.message || ""; },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    });

    store.bind(XeonBotInc.ev);

    // Manejo de mensajes
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(XeonBotInc, chatUpdate);
                return;
            }
            if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;
            if (XeonBotInc?.msgRetryCounterCache) XeonBotInc.msgRetryCounterCache.clear();
            try { await handleMessages(XeonBotInc, chatUpdate, true); } catch (err) { console.error("Error en handleMessages:", err); }
        } catch (err) { console.error("Error en messages.upsert:", err); }
    });

    XeonBotInc.ev.on('creds.update', saveState);

    XeonBotInc.ev.on('group-participants.update', async (update) => { await handleGroupParticipantUpdate(XeonBotInc, update); });
    XeonBotInc.ev.on('messages.upsert', async (m) => { if (m.messages[0].key && m.messages[0].key.remoteJid === 'status@broadcast') await handleStatus(XeonBotInc, m); });
    XeonBotInc.ev.on('status.update', async (status) => { await handleStatus(XeonBotInc, status); });
    XeonBotInc.ev.on('messages.reaction', async (status) => { await handleStatus(XeonBotInc, status); });

    return XeonBotInc;
}

// Start bot
startXeonBotInc().catch(error => { console.error('Fatal error:', error); process.exit(1); });
process.on('uncaughtException', err => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));

let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.redBright(`Update ${__filename}`));
    delete require.cache[file];
    require(file);
});
