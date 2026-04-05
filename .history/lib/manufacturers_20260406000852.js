// ============================================================
// Manufacturer logo mapping
// Source: avto-dev/vehicle-logotypes via imgix CDN
// Full color logos, reliable CDN
// ============================================================

const MANUFACTURER_LOGOS = {
  'Acura':        'https://vl.imgix.net/img/acura-logo.png',
  'Aston Martin': 'https://vl.imgix.net/img/aston-martin-logo.png',
  'Audi':         'https://vl.imgix.net/img/audi-logo.png',
  'BMW':          'https://vl.imgix.net/img/bmw-logo.png',
  'Cadillac':     'https://vl.imgix.net/img/cadillac-logo.png',
  'Chevrolet':    'https://vl.imgix.net/img/chevrolet-logo.png',
  'Dallara':      null,
  'Ferrari':      'https://vl.imgix.net/img/ferrari-logo.png',
  'Ford':         'https://vl.imgix.net/img/ford-logo.png',
  'Honda':        'https://vl.imgix.net/img/honda-logo.png',
  'Hyundai':      'https://vl.imgix.net/img/hyundai-logo.png',
  'Lamborghini':  'https://vl.imgix.net/img/lamborghini-logo.png',
  'McLaren':      'https://vl.imgix.net/img/mclaren-logo.png',
  'Mercedes-AMG': 'https://vl.imgix.net/img/mercedes-benz-logo.png',
  'Mercedes':     'https://vl.imgix.net/img/mercedes-benz-logo.png',
  'Porsche':      'https://vl.imgix.net/img/porsche-logo.png',
}

const MATCH_ORDER = [
  'Mercedes-AMG', 'Aston Martin',
  'Acura', 'Audi', 'BMW', 'Cadillac', 'Chevrolet', 'Dallara',
  'Ferrari', 'Ford', 'Honda', 'Hyundai', 'Lamborghini',
  'McLaren', 'Mercedes', 'Porsche',
]

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