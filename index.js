import { Client, GatewayIntentBits } from "discord.js";
import { Rcon } from "rcon-client";
import SFTPClient from "ssh2-sftp-client";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const sftp = new SFTPClient();
const LOG_PATH = "logs/latest.log";

// kolik znaků max pošleme v jedné zprávě (Discord limit je 2000)
const DISCORD_MAX = 1800;

let lastSize = 0;
let lastSentAt = 0;
let buffer = "";

function chunkAndSend(channel, text) {
  // rozdělí text na části do 1800 znaků
  const parts = [];
  let t = text;
  while (t.length > 0) {
    parts.push(t.slice(0, DISCORD_MAX));
    t = t.slice(DISCORD_MAX);
  }
  return Promise.all(parts.map(p => channel.send("```" + p + "```")));
}

async function connectSftp() {
  await sftp.connect({
    host: process.env.SFTP_HOST,
    port: Number(process.env.SFTP_PORT || 22),
    username: process.env.SFTP_USER,
    password: process.env.SFTP_PASS,
  });
  console.log("SFTP připojeno");
}

async function initLogOffset() {
  const stats = await sftp.stat(LOG_PATH);
  // začneme od konce, ať ti to nenasype celý log
  lastSize = stats.size;
  console.log("Log offset nastaven na:", lastSize);
}

async function pollLog() {
  try {
    const channelId = process.env.DISCORD_CONSOLE_CHANNEL_ID;
    if (!channelId) return;

    const channel = await client.channels.fetch(channelId);
    if (!channel) return;

    const stats = await sftp.stat(LOG_PATH);

    // log se mohl rotovat / zmenšit
    if (stats.size < lastSize) lastSize = 0;

    if (stats.size === lastSize) return;

    // stáhneme celý soubor a vezmeme jen nové bajty (jednoduché a spolehlivé)
    const full = await sftp.get(LOG_PATH);
    const text = full.toString("utf8");

    const newPart = text.slice(lastSize);
    lastSize = stats.size;

    if (!newPart.trim()) return;

    // buffer + throttling proti spamu
    buffer += newPart;

    const now = Date.now();
    const shouldFlush = (now - lastSentAt) > 2500 || buffer.length > 1200;

    if (shouldFlush) {
      lastSentAt = now;

      // pošleme posledních ~30 řádků z bufferu
      const lines = buffer.split("\n").slice(-30).join("\n").trim();
      buffer = ""; // vyprázdnit

      if (lines) {
        await chunkAndSend(channel, lines);
      }
    }
  } catch (err) {
    console.error("LOG ERROR:", err?.message || err);
  }
}

client.once("clientReady", async () => {
  console.log(`Bot je online jako ${client.user.tag}`);

  await connectSftp();
  await initLogOffset();

  // každé 2s zkontroluje nové řádky
  setInterval(pollLog, 2000);
});

// volitelné: !rcon příkazy (pozor: u Evrimy nemusí fungovat)
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (!message.content.toLowerCase().startsWith("!rcon")) return;
  const cmd = message.content.slice(5).trim();
  if (!cmd) return message.reply("❌ Zadej příkaz po !rcon");

  try {
    const rcon = await Rcon.connect({
      host: process.env.RCON_HOST,
      port: Number(process.env.RCON_PORT),
      password: process.env.RCON_PASSWORD,
    });

    const response = await rcon.send(cmd);
    await rcon.end();

    return message.reply("```\n" + (response || "OK") + "\n```");
  } catch (err) {
    console.error("RCON ERROR:", err?.message || err);
    return message.reply("❌ RCON chyba (Evrima může být nekompatibilní). Koukněte do logs.");
  }
});

client.login(process.env.DISCORD_TOKEN);
