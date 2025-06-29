import { Bot } from "gramio";
import { config } from "./config.ts";
import { insertarUsuario } from "./db/queries";

export const bot = new Bot(config.BOT_TOKEN)
	.command("start", (context) => {
		// Guardar usuario en la base de datos
		const chatId = context.chat.id;
		const chatTitle = context.chat.title ?? null;
		insertarUsuario({ chat_id: chatId, chat_title: chatTitle });
		context.send(`Hola!`);
	})
	.onStart(({ info }) => console.log(`✨ Bot ${info.username} ${info.id} was started!`));