// ============================================================
// Manufacturer logo mapping
// Source: filippofilip95/car-logos-dataset (MIT license)
// Direct GitHub raw URLs — stable and reliable
// ============================================================

const BASE = 'https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/thumb'

const MANUFACTURER_LOGOS = {
  'Acura':        `${BASE}/acura.png`,
  'Aston Martin': `${BASE}/aston-martin.png`,
  'Audi':         `${BASE}/audi.png`,
  'BMW':          `${BASE}/bmw.png`,
  'Cadillac':     `${BASE}/cadillac.png`,
  'Chevrolet':    `${BASE}/chevrolet.png`,
  'Dallara':      null,  // not in dataset, will show nothing
  'Ferrari':      `${BASE}/ferrari.png`,
  'Ford':         `${BASE}/ford.png`,
  'Honda':        `${BASE}/honda.png`,
  'Hyundai':      `${BASE}/hyundai.png`,
  'Lamborghini':  `${BASE}/lamborghini.png`,
  'McLaren':      `${BASE}/mclaren.png`,
  'Mercedes-AMG': `${BASE}/mercedes-benz.png`,
  'Mercedes':     `${BASE}/mercedes-benz.png`,
  'Porsche':      `${BASE}/porsche.png`,
}

// Match order matters — check longer/specific names first
const MATCH_ORDER = [
  'Mercedes-AMG', 'Aston Martin',
  'Acura', 'Audi', 'BMW', 'Cadillac', 'Chevrolet', 'Dallara',
  'Ferrari', 'Ford', 'Honda', 'Hyundai', 'Lamborghini',
  'McLaren', 'Mercedes', 'Porsche',
]

/**
 * Returns a logo URL for a given car name.
 * e.g. "Porsche 911 GT3 R (992)" → porsche.png URL
 */
export function getManufacturerLogo(carName) {
  if (!carName) return null
  const lower = carName.toLowerCase()
  for (const manufacturer of MATCH_ORDER) {
    if (lower.includes(manufacturer.toLowerCase())) {
      return MANUFACTURER_LOGOS[manufacturer] || null
    }
  }
  return null
}