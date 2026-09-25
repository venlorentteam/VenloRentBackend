const SCORE_WEIGHTS = {
  locationMatch: 40,   // property's town/state is in the user's chosen locations
  categoryMatch: 30,   // listing_type matches onboarding category
  houseTypeMatch: 20,  // property_type or bedrooms matches a selected house type
  recencyBonus: 10,    // posted within the last 7 days
}

const scoreProperty = (property, onboarding) => {
  let score = 0

  const userLocations = [...onboarding.locations, onboarding.otherLocation].filter(Boolean).map((l) => l.toLowerCase())
  const propTown = (property.location?.town || "").toLowerCase()
  const propState = (property.location?.state || "").toLowerCase()
  if (userLocations.some((loc) => propTown.includes(loc) || propState.includes(loc))) {
    score += SCORE_WEIGHTS.locationMatch
  }

  const wantedCategory = CATEGORY_MAP[onboarding.category]
  if (wantedCategory && property.listing_type === wantedCategory) {
    score += SCORE_WEIGHTS.categoryMatch
  }

  const matchesHouseType = onboarding.houseTypes.some((ht) => {
    const target = HOUSE_TYPE_MAP[ht]
    if (!target) return false
    if (target.property_type && property.property_type === target.property_type) return true
    if (target.bedrooms && property.bedrooms === target.bedrooms) return true
    return false
  })
  if (matchesHouseType) score += SCORE_WEIGHTS.houseTypeMatch

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  if (new Date(property.createdAt).getTime() >= sevenDaysAgo) {
    score += SCORE_WEIGHTS.recencyBonus
  }

  return score
}

module.exports = { scoreProperty }