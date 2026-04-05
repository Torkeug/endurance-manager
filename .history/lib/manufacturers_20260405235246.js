// ============================================================
// Manufacturer logo mapping
// Uses Clearbit Logo API — free, no auth required
// Falls back to null if manufacturer not found
// ============================================================

const MANUFACTURER_DOMAINS = {
  'Acura':          'acura.com',
  'Aston Martin':   'astonmartin.com',
  'Audi':           'audi.com',
  'BMW':            'bmw.com',
  'Cadillac':       'cadillac.com',
  'Chevrolet':      'chevrolet.com',
  'Dallara':        'dallara.it',
  'Ferrari':        'ferrari.com',
  'Ford':           'ford.com',
  'Honda':          'honda.com',
  'Hyundai':        'hyundai.com',
  'Lamborghini':    'lamborghini.com',
  'McLaren':        'mclaren.com',
  'Mercedes-AMG':   'mercedes-amg.com',
  'Mercedes':       'mercedes-benz.com',
  'Porsche':        'porsche.com',
}

/**
 * Returns a Clearbit logo URL for a given car name.
 * Matches by checking if the car name contains a known manufacturer name.
 * e.g. "Porsche 911 GT3 R (992)" → "https://logo.clearbit.com/porsche.com"
 */
export function getManufacturerLogo(carName) {
  if (!carName) return null
  const lower = carName.toLowerCase()

  // Check Mercedes-AMG first (before Mercedes) to get the right brand
  for (const [manufacturer, domain] of Object.entries(MANUFACTURER_DOMAINS)) {
    if (lower.includes(manufacturer.toLowerCase())) {
      return `https://logo.clearbit.com/${domain}`
    }
  }
  return null
}