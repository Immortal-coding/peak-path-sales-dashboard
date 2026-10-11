const BOOKED_CALL_STAGES = new Set(["call booked", "no show", "won", "lost"]);
const KNOWN_LEAD_STAGES = new Set(["new lead", ...BOOKED_CALL_STAGES]);

// Compare labels without being affected by capitalization or surrounding spaces.
function getMetricLabelKey(value) {
	return String(value ?? "").trim().toLowerCase();
}

// Return null when a conversion rate's denominator is zero.
function calculateConversionRate(numerator, denominator) {
	return denominator === 0 ? null : numerator / denominator;
}

// Check that deal values are numbers, rather than numeric-looking text or invalid values.
function isFiniteNumericValue(value) {
	return typeof value === "number" && Number.isFinite(value);
}

// Booked calls include Call Booked, No Show, Won, and Lost stages.
// Wins include only the Won stage; conversion rates are null when their denominator is zero.
function calculateDashboardMetrics(leads) {
	if (!Array.isArray(leads)) {
		throw new TypeError("Dashboard metrics require an array of leads.");
	}

	let bookedCalls = 0;
	let wonDeals = 0;
	let totalRevenue = 0;

	const funnelCounts = new Map();
	const sourceCounts = new Map();
	const repCounts = new Map();

	for (const lead of leads) {
		if (lead === null || typeof lead !== "object" || Array.isArray(lead)) {
			throw new TypeError("Each lead must be an object.");
		}

		const rawStage = String(lead.stage ?? "").trim();
		const stage = rawStage || "Unknown Stage";
		const stageKey = getMetricLabelKey(stage);
		const isUnknownStage = Boolean(rawStage) && !KNOWN_LEAD_STAGES.has(stageKey);

		// Keep blank and unrecognized stages in the funnel instead of dropping them.
		if (!funnelCounts.has(stageKey)) {
			funnelCounts.set(stageKey, {
				stage,
				count: 0,
				isUnknown: isUnknownStage,
			});
		}
		const funnelEntry = funnelCounts.get(stageKey);
		funnelEntry.count += 1;
		funnelEntry.isUnknown = funnelEntry.isUnknown || isUnknownStage;

		if (BOOKED_CALL_STAGES.has(stageKey)) {
			bookedCalls += 1;
		}
		if (stageKey === "won") {
			wonDeals += 1;
		}

		// Invalid values do not add revenue; cleaned blank deal values are zero.
		if (lead.dealValueIsValid !== false && isFiniteNumericValue(lead.deal_value)) {
			totalRevenue += lead.deal_value;
		}

		// Group source labels case-insensitively while preserving a readable label.
		const source = String(lead.source ?? "").trim() || "Unknown Source";
		const sourceKey = getMetricLabelKey(source);
		if (sourceCounts.has(sourceKey)) {
			sourceCounts.get(sourceKey).count += 1;
		} else {
			sourceCounts.set(sourceKey, { source, count: 1 });
		}

		// Keep representatives separate regardless of capitalization; omit unassigned leads.
		const rep = String(lead.rep ?? "").trim();
		if (rep && getMetricLabelKey(rep) !== "unassigned") {
			const repKey = getMetricLabelKey(rep);
			if (!repCounts.has(repKey)) {
				repCounts.set(repKey, { rep, wins: 0, bookedCalls: 0 });
			}

			const repMetrics = repCounts.get(repKey);
			if (BOOKED_CALL_STAGES.has(stageKey)) {
				repMetrics.bookedCalls += 1;
			}
			if (stageKey === "won") {
				repMetrics.wins += 1;
			}
		}
	}

	const totalLeads = leads.length;
	const closeRateByRep = Array.from(
		repCounts.values(),
		({ rep, wins, bookedCalls: repBookedCalls }) => ({
			rep,
			wins,
			bookedCalls: repBookedCalls,
			rate: calculateConversionRate(wins, repBookedCalls),
			canCalculateRate: repBookedCalls > 0,
		}),
	);

	return {
		totalLeads,
		bookedCalls,
		wonDeals,
		totalRevenue,
		leadToBookedConversion: calculateConversionRate(bookedCalls, totalLeads),
		bookedToWonConversion: calculateConversionRate(wonDeals, bookedCalls),
		funnel: Array.from(funnelCounts.values()),
		leadsBySource: Array.from(sourceCounts.values()),
		closeRateByRep,
	};
}
