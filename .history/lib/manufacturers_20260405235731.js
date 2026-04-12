// ============================================================
// Manufacturer logo mapping
// Uses Google's favicon service — free, reliable, no auth
// Returns brand logos for major manufacturers
// ============================================================

const MANUFACTURER_DOMAINS = {
  'Acura':        'acura.com',
  'Aston Martin': 'astonmartin.com',
  'Audi':         'audi.com',
  'BMW':          'bmw.com',
  'Cadillac':     'cadillac.com',
  'Chevrolet':    'chevrolet.com',
  'Dallara':      'dallara.it',
  'Ferrari':      'ferrari.com',
  'Ford':         'ford.com',
  'Honda':        'honda.com',
  'Hyundai':      'hyundai.com',
  'Lamborghini':  'lamborghini.com',
  'McLaren':      'mclaren.com',
  'Mercedes-AMG': 'mercedes-amg.com',
  'Mercedes':     'mercedes-benz.com',
  'Porsche':      'porsche.com',
}

/**
 * Returns a Google favicon URL for a given car name.
 * Matches by checking if the car name contains a known manufacturer name.
 * e.g. "Porsche 911 GT3 R (992)" → Google favicon for porsche.com
 */
export function getManufacturerLogo(carName) {
  if (!carName) return null
  const lower = carName.toLowerCase()

  // Check Mercedes-AMG before Mercedes to get the right brand
  for (const [manufacturer, domain] of Object.entries(MANUFACTURER_DOMAINS)) {
    if (lower.includes(manufacturer.toLowerCase())) {
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    }
  }
  return null
}