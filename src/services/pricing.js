function normalizeDistance(distanceKm) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance <= 0) return 3;
  return Math.min(distance, 80);
}

function normalizeVolume(volume) {
  if (typeof volume === 'number') {
    if (volume <= 1.1) return 'petit';
    if (volume <= 1.6) return 'moyen';
    if (volume <= 2.3) return 'grand';
    return 'extra';
  }

  const value = String(volume || '').toLowerCase();
  if (value.includes('extra') || value.includes('tres')) return 'extra';
  if (value.includes('grand') || value === '2.2') return 'grand';
  if (value.includes('moyen') || value === '1.5') return 'moyen';
  return 'petit';
}

function normalizeWeight(poids) {
  if (typeof poids === 'number') {
    if (poids <= 1.1) return 'leger';
    if (poids <= 1.4) return 'moyen';
    if (poids <= 1.9) return 'lourd';
    return 'tres_lourd';
  }

  const value = String(poids || '').toLowerCase();
  if (value.includes('tres') || value.includes('très')) return 'tres_lourd';
  if (value.includes('lourd') || value === '1.8') return 'lourd';
  if (value.includes('moyen') || value === '1.3') return 'moyen';
  return 'leger';
}

function roundToNearest(value, step) {
  return Math.round(value / step) * step;
}

function calculateDeliveryPrice(input = {}) {
  const distanceKm = normalizeDistance(input.distanceKm ?? input.distance_km);
  const volume = normalizeVolume(input.volume);
  const poids = normalizeWeight(input.poids ?? input.weight);

  const basePrice = 750;
  const includedKm = 2;
  const pricePerExtraKm = 100;
  const volumeCharges = {
    petit: 0,
    moyen: 100,
    grand: 200,
    extra: 350
  };
  const weightCharges = {
    leger: 0,
    moyen: 100,
    lourd: 250,
    tres_lourd: 400
  };

  const distanceCharge = Math.max(0, distanceKm - includedKm) * pricePerExtraKm;
  const volumeCharge = volumeCharges[volume];
  const weightCharge = weightCharges[poids];
  const rawPrice = basePrice + distanceCharge + volumeCharge + weightCharge;

  let finalPrice = roundToNearest(rawPrice, 50);
  const isStandardUrbanDelivery = distanceKm <= 8 && volume !== 'extra' && poids !== 'tres_lourd';

  finalPrice = Math.max(finalPrice, 1000);
  if (isStandardUrbanDelivery) {
    finalPrice = Math.min(finalPrice, 1500);
  }

  const commissionLivoo = Math.round(finalPrice * 0.10);
  const commissionAgence = Math.round(finalPrice * 0.05);
  const totalCommission = commissionLivoo + commissionAgence;

  return {
    basePrice,
    includedKm,
    distanceKm,
    distanceCharge: Math.round(distanceCharge),
    volume,
    volumeCharge,
    poids,
    weightCharge,
    prixFinal: finalPrice,
    commissionLivoo,
    commissionAgence,
    totalCommission,
    livreurGain: finalPrice - totalCommission
  };
}

module.exports = {
  calculateDeliveryPrice
};
