import { bot } from "./bot.ts";
import { config } from "./config.ts";
import { startDailyScheduler } from "./scheduler/scheduler.js";

const signals = ["SIGINT", "SIGTERM"];

for (const signal of signals) {
	process.on(signal, async () => {
		console.log(`Received ${signal}. Initiating graceful shutdown...`);
		await bot.stop();
		process.exit(0);
	});
}

process.on("uncaughtException", (error) => {
	console.error(error);
});

process.on("unhandledRejection", (error) => {
	console.error(error);
});
startDailyScheduler();

await bot.start();
