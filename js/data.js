const CANONICAL_LEAD_STAGES = new Map([
	["new lead", "New Lead"],
	["contacted", "Contacted"],
	["call booked", "Call Booked"],
	["no show", "No Show"],
	["won", "Won"],
	["lost", "Lost"],
]);

// Trim text and standardize separators for matching known source and stage names.
function getNormalizedLabelKey(value) {
	return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

// Give unrecognized stages a readable label without hiding their original meaning.
function toReadableLabel(value) {
	return value
		.trim()
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.replace(/\b\w/g, (character) => character.toUpperCase());
}

// Convert numeric text only when it represents a finite number; blank stays distinct.
function parseLeadNumber(value) {
	const trimmedValue = String(value ?? "").trim();
	if (trimmedValue === "") {
		return null;
	}

	const number = Number(trimmedValue);
	return Number.isFinite(number) ? number : null;
}

// Parse a date into a valid Date object, or return null for blank or invalid input.
function parseLeadDate(value) {
	const trimmedValue = String(value ?? "").trim();
	if (trimmedValue === "") {
		return null;
	}

	const timestamp = Date.parse(trimmedValue);
	return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

// Clean raw CSV lead records into safe, consistently labeled dashboard data.
function cleanLeadData(rawLeads) {
	if (!Array.isArray(rawLeads)) {
		throw new TypeError("Lead data must be an array of records.");
	}

	return rawLeads.map((rawLead, index) => {
		if (rawLead === null || typeof rawLead !== "object" || Array.isArray(rawLead)) {
			throw new TypeError(`Lead record ${index + 1} must be an object.`);
		}

		// Copy and trim text so cleaning never changes the original CSV record.
		const name = String(rawLead.name ?? "").trim() || "Unknown Lead";
		const rawSource = String(rawLead.source ?? "").trim();
		const rawStage = String(rawLead.stage ?? "").trim();
		const rep = String(rawLead.rep ?? "").trim() || "Unassigned";

		// Match known source names without regard to capitalization or separators.
		const sourceKey = getNormalizedLabelKey(rawSource);
		const source = !rawSource
			? "Unknown Source"
			: sourceKey === "meta ads"
				? "Meta Ads"
				: sourceKey === "instagram"
					? "Instagram"
					: sourceKey === "referral"
						? "Referral"
						: rawSource;

		// Map known stages to canonical names and clearly flag any unrecognized stage.
		const stageKey = getNormalizedLabelKey(rawStage);
		const isKnownStage = CANONICAL_LEAD_STAGES.has(stageKey);
		const stage = isKnownStage
			? CANONICAL_LEAD_STAGES.get(stageKey)
			: rawStage
				? toReadableLabel(rawStage)
				: "";

		// Missing scores remain null; blank deal values count as zero for revenue.
		const score = parseLeadNumber(rawLead.score);
		const rawDealValue = String(rawLead.deal_value ?? "").trim();
		const parsedDealValue = parseLeadNumber(rawDealValue);
		const dealValue = rawDealValue === "" ? 0 : parsedDealValue;

		// Keep the trimmed date text for display and add a safe parsed value for sorting.
		const created = String(rawLead.created ?? "").trim();
		const createdDate = parseLeadDate(created);

		return {
			...rawLead,
			name,
			source,
			stage,
			stageIsKnown: isKnownStage,
			isUnknownStage: Boolean(rawStage) && !isKnownStage,
			score,
			rep,
			deal_value: dealValue,
			dealValueIsValid: rawDealValue === "" || parsedDealValue !== null,
			created,
			createdDate,
			createdDateIsValid: created === "" || createdDate !== null,
		};
	});
}