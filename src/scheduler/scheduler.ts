import cron from "node-cron";
import { getFlightPrice } from "../scraper/scraper";
import { insertarPrecio, consultarPrecioPorFecha } from "../db/queries";
import { obtenerTodosLosUsuarios } from "../db/queries";
import { evaluatePriceRules } from "../notifier/priceRules";
import { sendNotification } from "../notifier/notifier";

/**
 * Configuración: días en el futuro para buscar el vuelo.
 * Por defecto, 7 días desde hoy.
 */
const DAYS_AHEAD = 7;

/**
 * Simulación de usuario receptor de notificaciones.
 */
import { config } from "../config";

/**
 * Orquestador diario: ejecuta el scrapper, guarda el precio, consulta histórico,
 * evalúa reglas y simula notificación si corresponde.
 */
export function startDailyScheduler() {
  // Ejecutar todos los días a las 09:00 (hora del servidor)
  cron.schedule("0 9 * * *", async () => {
    console.log("[Scheduler] Iniciando tarea diaria...");

    // Calcular la fecha objetivo
    const today = new Date();
    const flightDate = new Date(today);
    flightDate.setDate(today.getDate() + DAYS_AHEAD);
    const flightDateStr = flightDate.toISOString().slice(0, 10);

    try {
      // 1. Scrapping del precio
      const result = await getFlightPrice(flightDateStr);
      console.log(`[Scheduler] Precio obtenido para ${flightDateStr}: ${result.price}€`);

      // 2. Guardar en base de datos
      const now = new Date().toISOString();
      insertarPrecio({
        fecha_consulta: now,
        fecha_vuelo: result.date,
        precio: result.price,
        origen: "ALC-WMI",
      });

      // 3. Consultar histórico de precios para la fecha objetivo
      const historico = consultarPrecioPorFecha(flightDateStr);
      if (historico.length < 2) {
        console.log("[Scheduler] No hay suficiente histórico para aplicar reglas.");
        return;
      }

      // Construir el objeto PriceHistory
      //@ts-ignore
      const current = historico[0].precio;
      const yesterday = historico[1]?.precio ?? current;
      const lastWeek = historico.slice(1, 8).map((h) => h.precio);

      const priceHistory = { current, yesterday, lastWeek };

      // 4. Evaluar reglas de notificación
      const evalResult = evaluatePriceRules(priceHistory);

      if (evalResult.shouldNotify && evalResult.message) {
        // 5. Simular envío de notificación
        const usuarios = obtenerTodosLosUsuarios();
        for (const usuario of usuarios) {
          await sendNotification({
            userId: usuario.chat_id,
            message: evalResult.message,
          });
        }
        console.log(`[Scheduler] Notificación enviada a usuarios registrados: ${usuarios.map(u => u.chat_id).join(", ")}`);
      } else {
        console.log("[Scheduler] No se cumplen reglas de notificación.");
      }
    } catch (err) {
      console.error("[Scheduler] Error en la tarea diaria:", err);
    }
  });

  console.log("[Scheduler] Tarea diaria programada (09:00).");
}
