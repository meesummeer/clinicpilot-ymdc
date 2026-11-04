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

// The ONE per-doctor calculation. The Hub cards, 3-month chart, Doctors list,
// Financial Report, DRC page and a doctor's own revenue page all call this, so
// they can't drift apart. `rows` / `costs` may be a wider set (every doctor's);
// they are filtered to this doctor here.
//
//   net          = gross - costs
//   doctorShare  = net x doctor%          (per-invoice overrides honoured, see splitRevenue)
//   ymdcShare    = net x YMDC%
//
// Material costs (doctor_costs):
//   normal doctor (keeps_material_cost = false):
//     payout = doctorShare + costs          (the cost is passed through to the doctor)
//     ymdcIncome = ymdcShare
//   aesthetic doctor (keeps_material_cost = true): YMDC bought the material and
//     the cost is charged back to the doctor, so YMDC keeps it:
//     materialKept = costs
//     payout = doctorShare only
//     ymdcIncome = ymdcShare + materialKept
//
// Service categories (X-Ray, Ultrasound...) carry no costs and never keep any.
// Everything is calculated live from stored invoices and costs; nothing stored
// is ever adjusted, so flipping the flag applies retroactively.
export function computeDoctorFigures({ doctor, rows, costs }) {
  const isService = doctor.is_service_category === true;
  const doctorRows = rows.filter((r) => r.doctor_id === doctor.id);
  const costsList = isService
    ? []
    : costs.filter((c) => c.doctor_id === doctor.id).sort((a, b) => (a.cost_date < b.cost_date ? 1 : -1));
  const totalCosts = costsList.reduce((s, c) => s + Number(c.amount), 0);
  const split = splitRevenue(doctorRows, doctor.split_percentage, totalCosts);
  const keepsMaterialCost = !isService && doctor.keeps_material_cost === true;
  const materialKept = keepsMaterialCost ? totalCosts : 0;
  return {
    doctor,
    isService,
    transactionCount: doctorRows.length,
    gross: split.gross,
    costsList,
    totalCosts,
    net: split.net,
    doctorShare: split.entityShare,
    ymdcShare: split.centreShare,
    effectiveSplitPct: split.effectiveSplitPct,
    keepsMaterialCost,
    materialKept,
    doctorPayout: split.entityShare + (keepsMaterialCost ? 0 : totalCosts),
    ymdcIncome: split.centreShare + materialKept,
  };
}
