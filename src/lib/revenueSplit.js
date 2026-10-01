// Splits a set of billing_analytics rows' gross revenue between an entity
// (a doctor, or a service-category "doctor" like X-Ray/Ultrasound) and the
// centre (YMDC). Every entity is split the same way — there is no
// hardcoded 100%-centre case here, including for is_service_category
// entities: their share is whatever doctors.split_percentage says, same as
// a regular doctor. Each row uses its own billing.split_percentage_override
// when set (e.g. a Hijama 50/50 invoice), falling back to the entity's
// base split_percentage otherwise, rather than one flat percentage applied
// to the whole total.
//
// Costs aren't invoice-level data, so they're allocated between the two
// sides in proportion to each side's share of gross — an exact
// generalization of "net * splitPct" that reduces to it precisely when
// every row shares one percentage (so passing 0 costs for a service
// category, or a flat-percentage doctor with no overrides, reproduces the
// simple flat-split numbers exactly).
export function splitRevenue(entityRows, baseSplitPct, totalCosts) {
  const gross = entityRows.reduce((s, r) => s + Number(r.amount), 0);
  const net = gross - totalCosts;

  let centreShareOfGross = 0;
  let entityShareOfGross = 0;
  entityRows.forEach((r) => {
    const pct = r.split_percentage_override != null ? Number(r.split_percentage_override) : Number(baseSplitPct);
    const rowGross = Number(r.amount);
    centreShareOfGross += rowGross * (pct / 100);
    entityShareOfGross += rowGross * ((100 - pct) / 100);
  });

  if (gross > 0) {
    return {
      gross,
      net,
      centreShare: centreShareOfGross - totalCosts * (centreShareOfGross / gross),
      entityShare: entityShareOfGross - totalCosts * (entityShareOfGross / gross),
      effectiveSplitPct: (centreShareOfGross / gross) * 100,
    };
  }
  const basePct = Number(baseSplitPct);
  return {
    gross,
    net,
    centreShare: net * (basePct / 100),
    entityShare: net * ((100 - basePct) / 100),
    effectiveSplitPct: basePct,
  };
}
