import { Client, GatewayIntentBits } from 'discord.js';
import { Rcon } from 'rcon-client';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on("ready", () => {
  console.log(`Bot je online jako ${client.user.tag}`);
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!rcon ")) return;

  const cmd = message.content.replace("!rcon ", "");

  try {
    const rcon = await Rcon.connect({
      host: process.env.RCON_HOST,
      port: Number(process.env.RCON_PORT),
      password: process.env.RCON_PASSWORD
    });

    const response = await rcon.send(cmd);
    await rcon.end();

    message.reply("```" + response + "```");

  } catch (err) {
    console.error(err);
    message.reply("❌ RCON chyba");
  }
});

client.login(process.env.DISCORD_TOKEN);
