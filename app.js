import { Configuration, OpenAIApi } from "openai";
import dotenv from "dotenv";
import { Telegraf } from "telegraf";
import { pipeline } from "node:stream/promises";
import { createWriteStream, unlink } from "node:fs";
import { Readable } from "stream";
import got from "got";
import { fileURLToPath } from "url";
import path from "path";
import { getMessageFromContext } from "./utils/helper.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

if (
  !process.env.OPENAI_API_KEY ||
  !process.env.BOT_TOKEN ||
  !process.env.NARAKEET_API_KEY
) {
  console.log("Error: missing key or token");
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);
const voice = "mickey";
const voiceFile = path.join(__dirname, "result.m4a");

bot.start((ctx) => {
  ctx.reply(`Welcome ${ctx.from.first_name}, how can i assist you today?`);
  ctx.reply(
    "helpful commands: \n /start - bot starts \n /help - see commands \n /gpt {prompt} - ask midGPT \n /gptvoice {prompt} - voice response"
  );
});

bot.help((ctx) => {
  ctx.reply(
    "helpful commands: \n /start - bot starts \n /help - see commands \n /gpt {prompt} - ask midGPT \n /gptvoice {prompt} - voice response"
  );
});

bot.command(["gpt", "Gpt", "GPt", "GPT"], gptTextResponse);

bot.command(["gptvoice", "Gptvoice", "GPtvoice", "GPTvoice"], gptVoiceResponse);

bot.on(["sticker", "photo"], (ctx) => ctx.reply("Cool!"));

bot.launch({ skipUpdates: true });

async function gptTextResponse(ctx) {
  const message = getMessageFromContext(ctx);
  if (message) {
    try {
      const botResponse = await getOpenAiResponse(message);
      await bot.telegram.sendMessage(ctx.chat.id, botResponse);
    } catch (error) {
      console.error("Error", error);
    }
  } else {
    bot.telegram.sendMessage(
      ctx.chat.id,
      `${ctx.chat.first_name} write a prompt for midGPT!`
    );
  }
}

async function gptVoiceResponse(ctx) {
  const message = getMessageFromContext(ctx);
  if (message) {
    try {
      const botResponse = await getOpenAiResponse(message, 50);
      await createVoiceResponse(botResponse);
      await ctx.replyWithAudio({ source: voiceFile });
      unlink(voiceFile, () => {
        console.log("File deleted successfully");
      });
    } catch (error) {
      console.error("Error:", error);
    }
  } else {
    bot.telegram.sendMessage(
      ctx.chat.id,
      `${ctx.chat.first_name} write a prompt for midGPT!`
    );
  }
}

async function getOpenAiResponse(message, maxTokens = 100) {
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: message }],
    max_tokens: maxTokens,
  });
  return completion.data.choices[0].message.content;
}

async function createVoiceResponse(text) {
  await pipeline(
    Readable.from(text),
    got.stream.post(
      `https://api.narakeet.com/text-to-speech/m4a?voice=${voice}`,
      {
        headers: {
          accept: "application/octet-stream",
          "x-api-key": process.env.NARAKEET_API_KEY,
          "content-type": "text/plain",
        },
      }
    ),
    createWriteStream(voiceFile)
  );
}
