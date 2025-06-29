import { chromium } from 'playwright';

interface FlightPriceResult {
  outbound: {
    price: number;
    date: string;
    alternatives?: AlternativeDate[];
  };
  return: {
    price: number;
    date: string;
    alternatives?: AlternativeDate[];
  };
}

interface AlternativeDate {
  date: string;
  price: number | null;
  available: boolean;
  dayOfWeek: string;
  dayOfMonth: string;
  month: string;
}

// Configuración de divisas
const CURRENCY_CONFIG = {
  PLN_TO_EUR_RATE: 4.20, // Ajusta esta tasa según necesites
  EUR_TO_EUR_RATE: 1.0
};

// Función para detectar divisa por código de aeropuerto
function getCurrencyByAirport(airportCode: string): 'EUR' | 'PLN' {
  const polishAirports = ['KRK', 'WAW', 'GDN', 'WRO', 'POZ', 'KTW', 'RZE', 'BZG', 'LUZ', 'SZZ'];
  return polishAirports.includes(airportCode) ? 'PLN' : 'EUR';
}

// Función para convertir precio a EUR y formatear
function convertToEUR(price: number, fromCurrency: 'EUR' | 'PLN'): number {
  let convertedPrice = price;
  
  if (fromCurrency === 'PLN') {
    convertedPrice = price / CURRENCY_CONFIG.PLN_TO_EUR_RATE;
  }
  
  // Redondear a 2 decimales
  return Math.round(convertedPrice * 100) / 100;
}

export async function getFlightPrice(): Promise<FlightPriceResult> {
  const origin = 'ALC'; // Alicante
  const destination = 'KRK'; // Cracovia
  
  // Fechas objetivo
  const outboundDate = new Date('2025-11-26');
  const returnDate = new Date('2025-11-29'); // 6 días después, ajustar según necesites
  
  const outboundDateStr = outboundDate.toISOString().slice(0, 10);
  const returnDateStr = returnDate.toISOString().slice(0, 10);
  
  console.log(`[Scraper] Buscando vuelo de ida: ${outboundDateStr} y vuelta: ${returnDateStr}`);
  
  // Generar rangos de fechas (±6 días para cada tramo)
  const outboundRange = generateDateRange(outboundDate, 6);
  const returnRange = generateDateRange(returnDate, 6);
  
  console.log(`[Scraper] Rango ida: ${outboundRange[0]} a ${outboundRange[outboundRange.length-1]}`);
  console.log(`[Scraper] Rango vuelta: ${returnRange[0]} a ${returnRange[returnRange.length-1]}`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });

  try {
    // Primero buscar vuelo de IDA (ALC -> KRK)
    console.log(`[Scraper] === BUSCANDO VUELO DE IDA (${origin} -> ${destination}) ===`);
    const outboundResult = await searchFlightLeg(
      page, 
      origin, 
      destination, 
      outboundDateStr, 
      outboundRange,
      'outbound'
    );
    
    // Luego buscar vuelo de VUELTA (KRK -> ALC)
    console.log(`[Scraper] === BUSCANDO VUELO DE VUELTA (${destination} -> ${origin}) ===`);
    const returnResult = await searchFlightLeg(
      page, 
      destination, 
      origin, 
      returnDateStr, 
      returnRange,
      'return'
    );

    console.log(`[Scraper] Resultado completo:`);
    console.log(`[Scraper] Ida: ${outboundResult.date} - €${outboundResult.price}`);
    console.log(`[Scraper] Vuelta: ${returnResult.date} - €${returnResult.price}`);
    console.log(`[Scraper] Total: €${(outboundResult.price + returnResult.price).toFixed(2)}`);
    
    return {
      outbound: outboundResult,
      return: returnResult
    };

  } catch (error) {
    console.error(`[Scraper] Error durante el scraping:`, error);
    throw error;
  } finally {
    await browser.close();
    console.log(`[Scraper] Browser cerrado`);
  }
}

async function searchFlightLeg(
  page: any,
  origin: string,
  destination: string,
  targetDateStr: string,
  dateRange: string[],
  legType: 'outbound' | 'return'
): Promise<{ price: number; date: string; alternatives: AlternativeDate[] }> {
  
  // Detectar divisa basada en el aeropuerto de origen (donde se muestra el precio)
  const sourceCurrency = getCurrencyByAirport(origin);
  console.log(`[Scraper] Divisa detectada para ${origin}: ${sourceCurrency}`);
  
  const url = `https://www.ryanair.com/es/es/trip/flights/select?adults=1&dateOut=${targetDateStr}&originIata=${origin}&destinationIata=${destination}&isConnectedFlight=false`;
  
  console.log(`[Scraper] Navegando a: ${url}`);
  
  // Navegar a la página
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log(`[Scraper] Página cargada para ${legType}`);
  
  // Aceptar cookies si aparece el modal (solo en la primera vez)
  if (legType === 'outbound') {
    try {
      await page.waitForSelector('button:has-text("Sí, acepto")', { timeout: 5000 });
      await page.click('button:has-text("Sí, acepto")');
      console.log(`[Scraper] Cookies aceptadas`);
    } catch (e) {
      console.log(`[Scraper] No se encontró modal de cookies`);
    }
  }

  // Esperar a que cargue el carrusel de fechas
  await page.waitForSelector('[data-e2e="date-item"]', { timeout: 30000 });
  console.log(`[Scraper] Carrusel de fechas cargado para ${legType}`);
  
  await page.waitForTimeout(3000);

  // Obtener información de todas las fechas del carrusel
  const alternatives: AlternativeDate[] = [];
  let targetPrice: number | null = null;
  
  console.log(`[Scraper] Analizando fechas en el carrusel para ${legType}...`);
  
  for (const dateStr of dateRange) {
    try {
      const dateSelector = `[data-ref="${dateStr}"]`;
      const dateElement = page.locator(dateSelector);
      
      if (await dateElement.count() > 0) {
        const isDisabled = await dateElement.evaluate((el: any) => 
          el.classList.contains('date-item--disabled')
        );
        
        const dayOfMonth = await dateElement.locator('.date-item__day-of-month').textContent() || '';
        const month = await dateElement.locator('.date-item__month').textContent() || '';
        const dayOfWeek = await dateElement.locator('.date-item__day-of-week').textContent() || '';
        
        let price: number | null = null;
        
        if (!isDisabled) {
          try {
            const priceIntegersElement = dateElement.locator('.price__integers');
            if (await priceIntegersElement.count() > 0) {
              const priceIntegers = await priceIntegersElement.textContent();
              const priceDecimalsElement = dateElement.locator('.price__decimals');
              
              let decimals = '00';
              if (await priceDecimalsElement.count() > 0) {
                decimals = await priceDecimalsElement.textContent() || '00';
              }
              
              if (priceIntegers) {
                const rawPrice = parseFloat(`${priceIntegers.trim()}.${decimals.trim()}`);
                price = convertToEUR(rawPrice, sourceCurrency);
                console.log(`[Scraper] Precio ${legType} encontrado para ${dateStr}: ${rawPrice} ${sourceCurrency} -> €${price}`);
              }
            }
          } catch (e) {
            console.log(`[Scraper] No se pudo extraer precio del carrusel para ${dateStr} (${legType})`);
          }
        }
        
        const alternative: AlternativeDate = {
          date: dateStr,
          price: price,
          available: !isDisabled,
          dayOfWeek: dayOfWeek.trim(),
          dayOfMonth: dayOfMonth.trim(),
          month: month.trim()
        };
        
        alternatives.push(alternative);
        
        if (dateStr === targetDateStr) {
          targetPrice = price;
        }
        
      } else {
        console.log(`[Scraper] Fecha ${dateStr} no encontrada en carrusel (${legType})`);
      }
    } catch (e) {
      console.log(`[Scraper] Error procesando fecha ${dateStr} (${legType}):`, e);
    }
  }

  // Si no tenemos precio para la fecha objetivo, intentar hacer clic
  if (targetPrice === null) {
    console.log(`[Scraper] Intentando obtener precio detallado para ${legType} ${targetDateStr}`);
    
    const targetDateSelector = `[data-ref="${targetDateStr}"]`;
    const targetDateElement = page.locator(targetDateSelector);
    
    if (await targetDateElement.count() > 0) {
      const isDisabled = await targetDateElement.evaluate((el: any) => 
        el.classList.contains('date-item--disabled')
      );
      
      if (!isDisabled) {
        await targetDateElement.click();
        console.log(`[Scraper] Clic realizado en fecha ${legType} ${targetDateStr}`);
        
        await page.waitForTimeout(5000);
        
        try {
          await page.waitForSelector('[data-e2e="flight-card-price"]', { timeout: 20000 });
          
          const priceElement = page.locator('[data-e2e="flight-card-price"] flights-price-simple').first();
          const priceText = await priceElement.textContent();
          
          if (priceText) {
            console.log(`[Scraper] Texto de precio detallado (${legType}): "${priceText}"`);
            
            // Limpiar texto y extraer número
            const cleanPriceText = priceText.replace(/\s+/g, '').replace(/€|zł/g, '');
            const priceMatch = cleanPriceText.match(/(\d+(?:[,.]?\d+)?)/);
            
            if (priceMatch) {
              const rawPrice = parseFloat(priceMatch[1].replace(',', '.'));
              targetPrice = convertToEUR(rawPrice, sourceCurrency);
              console.log(`[Scraper] Precio detallado ${legType} extraído: ${rawPrice} ${sourceCurrency} -> €${targetPrice}`);
              
              // Actualizar alternativa correspondiente
              const targetAlternative = alternatives.find(alt => alt.date === targetDateStr);
              if (targetAlternative) {
                targetAlternative.price = targetPrice;
              }
            }
          }
        } catch (e) {
          console.log(`[Scraper] Error obteniendo precio detallado (${legType}):`, e);
        }
      } else {
        console.log(`[Scraper] Fecha ${legType} ${targetDateStr} no está disponible`);
      }
    }
  }

  // Verificar que tenemos un precio válido
  if (targetPrice === null || targetPrice <= 0) {
    const availableAlternatives = alternatives.filter(alt => alt.available && alt.price && alt.price > 0);
    
    if (availableAlternatives.length > 0) {
      const targetDate = new Date(targetDateStr);
      availableAlternatives.sort((a, b) => {
        const diffA = Math.abs(new Date(a.date).getTime() - targetDate.getTime());
        const diffB = Math.abs(new Date(b.date).getTime() - targetDate.getTime());
        return diffA - diffB;
      });
      
      const closestAlternative = availableAlternatives[0];
      //@ts-ignore
      console.log(`[Scraper] Fecha ${legType} no disponible, usando alternativa: ${closestAlternative.date} (€${closestAlternative.price})`);
      
      return {
        //@ts-ignore
        price: closestAlternative.price!,
        //@ts-ignore
        date: closestAlternative.date,
        alternatives
      };
    } else {
      throw new Error(`No se encontraron vuelos ${legType} disponibles en el rango de fechas`);
    }
  }

  console.log(`[Scraper] Resultado ${legType} - Fecha: ${targetDateStr}, Precio: €${targetPrice}`);
  
  return {
    price: targetPrice,
    date: targetDateStr,
    alternatives
  };
}

function generateDateRange(centerDate: Date, daysRange: number): string[] {
  const dates: string[] = [];
  
  for (let i = -daysRange; i <= daysRange; i++) {
    const date = new Date(centerDate);
    date.setDate(centerDate.getDate() + i);
    dates.push(date.toISOString().slice(0, 10));
  }
  
  return dates;
}

// Función helper para obtener resumen completo
export function getFlightSummary(result: FlightPriceResult): void {
  console.log('\n=== RESUMEN COMPLETO DE VUELOS ===');
  
  // Resumen general
  const totalPrice = result.outbound.price + result.return.price;
  console.log(`🛫 Ida: ${result.outbound.date} - €${result.outbound.price}`);
  console.log(`🛬 Vuelta: ${result.return.date} - €${result.return.price}`);
  console.log(`💰 Total: €${totalPrice.toFixed(2)}`);
  
  // Alternativas de ida
  console.log('\n--- ALTERNATIVAS DE IDA ---');
  if (result.outbound.alternatives) {
    const availableOutbound = result.outbound.alternatives.filter(alt => alt.available && alt.price);
    if (availableOutbound.length > 0) {
      availableOutbound.sort((a, b) => (a.price || 0) - (b.price || 0));
      availableOutbound.forEach(alt => {
        const diff = (alt.price || 0) - result.outbound.price;
        const diffText = diff > 0 ? ` (+€${diff.toFixed(2)})` : 
                        diff < 0 ? ` (-€${Math.abs(diff).toFixed(2)})` : '';
        console.log(`${alt.date} (${alt.dayOfWeek}): €${alt.price?.toFixed(2)}${diffText}`);
      });
    } else {
      console.log('No hay alternativas disponibles');
    }
  }
  
  // Alternativas de vuelta
  console.log('\n--- ALTERNATIVAS DE VUELTA ---');
  if (result.return.alternatives) {
    const availableReturn = result.return.alternatives.filter(alt => alt.available && alt.price);
    if (availableReturn.length > 0) {
      availableReturn.sort((a, b) => (a.price || 0) - (b.price || 0));
      availableReturn.forEach(alt => {
        const diff = (alt.price || 0) - result.return.price;
        const diffText = diff > 0 ? ` (+€${diff.toFixed(2)})` : 
                        diff < 0 ? ` (-€${Math.abs(diff).toFixed(2)})` : '';
        console.log(`${alt.date} (${alt.dayOfWeek}): €${alt.price?.toFixed(2)}${diffText}`);
      });
    } else {
      console.log('No hay alternativas disponibles');
    }
  }
}