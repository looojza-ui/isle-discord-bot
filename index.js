import { Client, GatewayIntentBits } from 'discord.js';
import { Rcon } from 'rcon-client';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("clientReady", () => {
  console.log(`Bot je online jako ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  console.log("MSG:", message.content, "OD:", message.author.tag);

  if (message.author.bot) return;

  if (!message.content.toLowerCase().startsWith("!rcon")) return;

  const cmd = message.content.slice(5).trim();

  if (!cmd) {
    return message.reply("❌ Zadej příkaz po !rcon");
  }

  try {
    console.log("Připojuji se na RCON...");

    const rcon = await Rcon.connect({
      host: process.env.RCON_HOST,
      port: Number(process.env.RCON_PORT),
      password: process.env.RCON_PASSWORD
    });

    console.log("RCON připojeno, posílám příkaz:", cmd);

    const response = await rcon.send(cmd);
    await rcon.end();

    message.reply("```\n" + response + "\n```");

  } catch (err) {
    console.error("RCON ERROR:", err);
    message.reply("❌ RCON chyba – zkontroluj Railway logs.");
  }
});

client.login(process.env.DISCORD_TOKEN);
