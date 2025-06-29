import cron from "node-cron";
import { getFlightPrice } from "../scraper/scraper";
import { 
  insertarPrecio, 
  consultarVueloCompleto, 
  obtenerEstadisticasPrecios,
} from "../db/queries";
import { obtenerTodosLosUsuarios } from "../db/queries";
import { evaluatePriceRules } from "../notifier/priceRules";
import { sendNotification } from "../notifier/notifier";

/**
 * Configuración de rutas
 */
const RUTAS = {
  IDA: 'ALC-KRK',
  VUELTA: 'KRK-ALC'
};

/**
 * Orquestador diario actualizado para manejar vuelos de ida y vuelta
 */
export function startDailyScheduler() {
  // Ejecutar todos los días a las 8:00 y 16:00
  cron.schedule("0 8,16 * * *", async () => {
    console.log("[Scheduler] Iniciando tarea diaria de monitoreo ida y vuelta...");
    
    try {
      // 1. Scrapping de precios (ida y vuelta)
      const result = await getFlightPrice();
      console.log(`[Scheduler] Resultado obtenido:`);
      console.log(`[Scheduler] - Ida: ${result.outbound.date} €${result.outbound.price}`);
      console.log(`[Scheduler] - Vuelta: ${result.return.date} €${result.return.price}`);
      console.log(`[Scheduler] - Total: €${result.outbound.price + result.return.price}`);

      const now = new Date().toISOString();

      // 2. Guardar precios principales en base de datos
      
      // Guardar precio de ida
      insertarPrecio({
        fecha_consulta: now,
        fecha_vuelo: result.outbound.date,
        precio: result.outbound.price,
        origen: "ALC",
        tipo_vuelo: "ida",
        ruta: RUTAS.IDA
      });

      // Guardar precio de vuelta
      insertarPrecio({
        fecha_consulta: now,
        fecha_vuelo: result.return.date,
        precio: result.return.price,
        origen: "KRK",
        tipo_vuelo: "vuelta",
        ruta: RUTAS.VUELTA
      });

      console.log(`[Scheduler] Precios principales guardados en BD`);

      // 3. Guardar alternativas de ida
      if (result.outbound.alternatives && result.outbound.alternatives.length > 0) {
        const outboundAlternatives = result.outbound.alternatives.filter(alt => 
          alt.available && alt.price !== null && alt.price > 0
        );
        
        console.log(`[Scheduler] Guardando ${outboundAlternatives.length} alternativas de ida`);
        
        for (const alternative of outboundAlternatives) {
          insertarPrecio({
            fecha_consulta: now,
            fecha_vuelo: alternative.date,
            precio: alternative.price!,
            origen: "ALC",
            tipo_vuelo: "ida",
            ruta: RUTAS.IDA
          });
        }
      }

      // 4. Guardar alternativas de vuelta
      if (result.return.alternatives && result.return.alternatives.length > 0) {
        const returnAlternatives = result.return.alternatives.filter(alt => 
          alt.available && alt.price !== null && alt.price > 0
        );
        
        console.log(`[Scheduler] Guardando ${returnAlternatives.length} alternativas de vuelta`);
        
        for (const alternative of returnAlternatives) {
          insertarPrecio({
            fecha_consulta: now,
            fecha_vuelo: alternative.date,
            precio: alternative.price!,
            origen: "KRK",
            tipo_vuelo: "vuelta",
            ruta: RUTAS.VUELTA
          });
        }
      }

      // 5. Consultar histórico para evaluación de reglas de notificación
      const historicoCompleto = consultarVueloCompleto(
        result.outbound.date,
        result.return.date,
        RUTAS.IDA,
        RUTAS.VUELTA
      );

      console.log(`[Scheduler] Histórico obtenido - Ida: ${historicoCompleto.ida.length} registros, Vuelta: ${historicoCompleto.vuelta.length} registros`);

      // 6. Evaluar reglas para vuelo de ida
      let notificationMessages: string[] = [];
      
      if (historicoCompleto.ida.length >= 2) {
        const idaHistory = {
          //@ts-ignore
          current: historicoCompleto.ida[0].precio,
          //@ts-ignore
          yesterday: historicoCompleto.ida[1]?.precio ?? historicoCompleto.ida[0].precio,
          lastWeek: historicoCompleto.ida.slice(1, 8).map(h => h.precio)
        };

        const idaEvalResult = evaluatePriceRules(idaHistory);
        
        if (idaEvalResult.shouldNotify && idaEvalResult.message) {
          let idaMessage = `🛫 VUELO DE IDA (${result.outbound.date})\n${idaEvalResult.message}`;
          
          // Enriquecer con alternativas de ida
          if (result.outbound.alternatives) {
            const availableIdaAlts = result.outbound.alternatives.filter(alt => 
              alt.available && alt.price !== null && alt.price > 0
            );
            
            if (availableIdaAlts.length > 0) {
              const cheapestIdaAlt = availableIdaAlts.reduce((min, alt) => 
                (alt.price! < min.price!) ? alt : min
              );
              
              const idaSavings = result.outbound.price - cheapestIdaAlt.price!;
              
              if (idaSavings > 0) {
                idaMessage += `\n\n💡 Mejor alternativa de ida:\n` +
                  `📅 ${cheapestIdaAlt.date} (${cheapestIdaAlt.dayOfWeek})\n` +
                  `💰 €${cheapestIdaAlt.price} (Ahorro: €${idaSavings.toFixed(2)})`;
              }
            }
          }
          
          notificationMessages.push(idaMessage);
        }
      }

      // 7. Evaluar reglas para vuelo de vuelta
      if (historicoCompleto.vuelta.length >= 2) {
        const vueltaHistory = {
          //@ts-ignore
          current: historicoCompleto.vuelta[0].precio,
          //@ts-ignore
          yesterday: historicoCompleto.vuelta[1]?.precio ?? historicoCompleto.vuelta[0].precio,
          lastWeek: historicoCompleto.vuelta.slice(1, 8).map(h => h.precio)
        };

        const vueltaEvalResult = evaluatePriceRules(vueltaHistory);
        
        if (vueltaEvalResult.shouldNotify && vueltaEvalResult.message) {
          let vueltaMessage = `🛬 VUELO DE VUELTA (${result.return.date})\n${vueltaEvalResult.message}`;
          
          // Enriquecer con alternativas de vuelta
          if (result.return.alternatives) {
            const availableVueltaAlts = result.return.alternatives.filter(alt => 
              alt.available && alt.price !== null && alt.price > 0
            );
            
            if (availableVueltaAlts.length > 0) {
              const cheapestVueltaAlt = availableVueltaAlts.reduce((min, alt) => 
                (alt.price! < min.price!) ? alt : min
              );
              
              const vueltaSavings = result.return.price - cheapestVueltaAlt.price!;
              
              if (vueltaSavings > 0) {
                vueltaMessage += `\n\n💡 Mejor alternativa de vuelta:\n` +
                  `📅 ${cheapestVueltaAlt.date} (${cheapestVueltaAlt.dayOfWeek})\n` +
                  `💰 €${cheapestVueltaAlt.price} (Ahorro: €${vueltaSavings.toFixed(2)})`;
              }
            }
          }
          
          notificationMessages.push(vueltaMessage);
        }
      }

      // 8. Evaluar si hay cambios significativos en el precio total
      if (historicoCompleto.ida.length >= 2 && historicoCompleto.vuelta.length >= 2) {
        const totalActual = result.outbound.price + result.return.price;
        //@ts-ignore
        const totalAnterior = historicoCompleto.ida[1].precio + historicoCompleto.vuelta[1].precio;
        const diferencia = totalActual - totalAnterior;
        const porcentajeCambio = (diferencia / totalAnterior) * 100;

        // Notificar si hay cambio significativo en el total (±5% o ±20€)
        if (Math.abs(porcentajeCambio) >= 5 || Math.abs(diferencia) >= 20) {
          const emoji = diferencia < 0 ? '📉' : '📈';
          const cambioTexto = diferencia < 0 ? 'BAJADA' : 'SUBIDA';
          const ahorroTexto = diferencia < 0 ? `Ahorro: €${Math.abs(diferencia).toFixed(2)}` : `Incremento: €${diferencia.toFixed(2)}`;
          
          const totalMessage = `${emoji} ${cambioTexto} EN PRECIO TOTAL\n\n` +
            `💰 Precio actual: €${totalActual.toFixed(2)}\n` +
            `📊 Precio anterior: €${totalAnterior.toFixed(2)}\n` +
            `📈 Cambio: ${porcentajeCambio.toFixed(1)}% (${ahorroTexto})\n\n` +
            `🛫 Ida: €${result.outbound.price}\n` +
            `🛬 Vuelta: €${result.return.price}`;
          
          notificationMessages.push(totalMessage);
        }
      }

      // 9. Crear resumen diario si no hay alertas específicas
      if (notificationMessages.length === 0) {
        const totalPrice = result.outbound.price + result.return.price;
        
        // Obtener estadísticas para contexto
        const statsIda = obtenerEstadisticasPrecios(result.outbound.date, 'ida', RUTAS.IDA, 30);
        const statsVuelta = obtenerEstadisticasPrecios(result.return.date, 'vuelta', RUTAS.VUELTA, 30);
        
        let dailySummary = `📊 RESUMEN DIARIO DE PRECIOS\n\n` +
          `🛫 Ida (${result.outbound.date}): €${result.outbound.price}\n` +
          `🛬 Vuelta (${result.return.date}): €${result.return.price}\n` +
          `💰 Total: €${totalPrice.toFixed(2)}`;

        // Añadir contexto estadístico si está disponible
        if (statsIda && statsVuelta) {
          const totalPromedio = statsIda.promedio + statsVuelta.promedio;
          const diferenciaPromedio = totalPrice - totalPromedio;
          const emoji = diferenciaPromedio < 0 ? '👍' : '👎';
          
          dailySummary += `\n\n📈 Promedio 30 días: €${totalPromedio.toFixed(2)}` +
            `\n${emoji} Diferencia: €${diferenciaPromedio.toFixed(2)}`;
        }

        // Solo enviar resumen diario los lunes (día 1) para no saturar
        const today = new Date();
        if (today.getDay() === 1) { // Lunes
          notificationMessages.push(dailySummary);
        }
      }

      // 10. Enviar notificaciones si hay mensajes
      if (notificationMessages.length > 0) {
        const usuarios = obtenerTodosLosUsuarios();
        
        for (const usuario of usuarios) {
          for (const message of notificationMessages) {
            await sendNotification({
              userId: usuario.chat_id,
              message: message,
            });
            
            // Pequeña pausa entre mensajes para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        console.log(`[Scheduler] ${notificationMessages.length} notificaciones enviadas a ${usuarios.length} usuarios`);
      } else {
        console.log("[Scheduler] No se generaron notificaciones");
      }

      // 11. Log de resumen final
      console.log("[Scheduler] Tarea completada exitosamente");
      console.log(`[Scheduler] Alternativas ida disponibles: ${result.outbound.alternatives?.filter(alt => alt.available).length || 0}`);
      console.log(`[Scheduler] Alternativas vuelta disponibles: ${result.return.alternatives?.filter(alt => alt.available).length || 0}`);

    } catch (err) {
      console.error("[Scheduler] Error en la tarea diaria:", err);
      
      // Notificar error a usuarios
      try {
        const usuarios = obtenerTodosLosUsuarios();
        const errorMessage = `⚠️ ERROR EN MONITOREO DE VUELOS\n\n` +
          `Ha ocurrido un problema al consultar los precios de vuelos de ida y vuelta.\n\n` +
          `🔄 Próximo intento: Mañana a las 22:05\n` +
          `📧 Si el problema persiste, contacta con el administrador.`;
          
        for (const usuario of usuarios) {
          await sendNotification({
            userId: usuario.chat_id,
            message: errorMessage,
          });
        }
        console.log(`[Scheduler] Notificación de error enviada a usuarios`);
      } catch (notificationError) {
        console.error("[Scheduler] Error enviando notificación de error:", notificationError);
      }
    }
  });

  console.log("[Scheduler] ✅ Tarea diaria programada para las 8:00 y 16:00 (ida y vuelta)");
}

/**
 * Función auxiliar para ejecutar tarea manualmente (para testing)
 */
export async function runManualCheck(): Promise<void> {
  console.log("[Manual] Ejecutando verificación manual...");
  
  try {
    const result = await getFlightPrice();
    
    console.log("=== RESULTADO MANUAL ===");
    console.log(`Ida: ${result.outbound.date} - €${result.outbound.price}`);
    console.log(`Vuelta: ${result.return.date} - €${result.return.price}`);
    console.log(`Total: €${result.outbound.price + result.return.price}`);
    
    if (result.outbound.alternatives) {
      console.log(`Alternativas ida: ${result.outbound.alternatives.filter(alt => alt.available).length}`);
    }
    
    if (result.return.alternatives) {
      console.log(`Alternativas vuelta: ${result.return.alternatives.filter(alt => alt.available).length}`);
    }
    
  } catch (error) {
    console.error("[Manual] Error en verificación manual:", error);
  }
}