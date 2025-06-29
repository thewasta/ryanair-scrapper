/**
 * notifier.ts
 * Estructura para enviar mensajes a usuarios usando gramio.
 */

import { config } from "../config";
import { Bot } from "gramio";

export interface NotifierOptions {
  userId: number | string;
  message: string;
  // Puedes agregar más opciones en el futuro (por ejemplo, parse_mode, reply_markup, etc.)
}

const bot = new Bot(config.BOT_TOKEN);

/**
 * Envía un mensaje a un usuario usando gramio.
 * @param options - Opciones para el envío de notificación.
 */
export async function sendNotification(options: NotifierOptions): Promise<void> {
  try {
    await bot.api.sendMessage({
      chat_id: Number(options.userId),
      text: options.message,
    });
  } catch (error) {
    console.error(`[Notifier] Error enviando mensaje a ${options.userId}:`, error);
  }
}

/**
 * Envía un mensaje a un usuario usando gramio.
 * @param options - Opciones para el envío de notificación.
 */