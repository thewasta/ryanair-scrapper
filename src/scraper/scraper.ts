import { chromium } from 'playwright';

export interface FlightPriceResult {
  price: number;
  date: string;
}

/**
 * Obtiene el precio de un vuelo de Alicante a Varsovia para una fecha dada usando Ryanair.
 * @param flightDate Fecha del vuelo en formato 'YYYY-MM-DD'
 * @returns { price, date } o lanza un error si no se encuentra el precio
 */
export async function getFlightPrice(flightDate: string): Promise<FlightPriceResult> {
  const origin = 'ALC'; // Alicante
  const destination = 'WMI'; // Varsovia Modlin (puedes cambiar a WAW si prefieres Chopin)
  const url = `https://www.ryanair.com/es/es/trip/flights/select?adults=1&dateOut=${flightDate}&originIata=${origin}&destinationIata=${destination}&isConnectedFlight=false`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();


  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.pause();

    // Esperar a que aparezca el selector de precios
    await page.waitForSelector('[data-ref="flight-card-price__price"]', { timeout: 30000 });

    // Extraer el precio del primer vuelo disponible
    const priceText = await page.locator('[data-ref="flight-card-price__price"]').first().innerText();
    // El precio suele venir como "39,99 €" o similar
    const priceMatch = priceText.replace('.', '').replace(',', '.').match(/[\d.]+/);
    if (!priceMatch) {
      throw new Error('No se pudo extraer el precio del vuelo');
    }
    const price = parseFloat(priceMatch[0]);

    // Confirmar la fecha encontrada (puede ser útil si Ryanair muestra varias opciones)
    // Aquí simplemente devolvemos la fecha solicitada
    return {
      price,
      date: flightDate,
    };
  } finally {
    await browser.close();
  }
}