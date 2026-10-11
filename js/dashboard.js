const dashboardCurrencyFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});

const dashboardPercentFormatter = new Intl.NumberFormat("en-US", {
	style: "percent",
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

const dashboardTimestampFormatter = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeStyle: "short",
});

let allDashboardLeads = [];

// Find a required dashboard element and report a clear error if the HTML is incomplete.
function getDashboardElement(id) {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`The dashboard is missing the required "${id}" element.`);
	}
	return element;
}

// Format a conversion rate, using a dash when it cannot be calculated.
function formatDashboardRate(rate) {
	return typeof rate === "number" && Number.isFinite(rate)
		? dashboardPercentFormatter.format(rate)
		: "—";
}

// Update the six KPI cards with values returned by the metrics function.
function renderDashboardKpis(metrics) {
	getDashboardElement("total-leads").textContent = String(metrics.totalLeads);
	getDashboardElement("booked-calls").textContent = String(metrics.bookedCalls);
	getDashboardElement("won-deals").textContent = String(metrics.wonDeals);
	getDashboardElement("total-revenue").textContent = dashboardCurrencyFormatter.format(metrics.totalRevenue);
	getDashboardElement("lead-to-booked").textContent = formatDashboardRate(metrics.leadToBookedConversion);
	getDashboardElement("booked-to-won").textContent = formatDashboardRate(metrics.bookedToWonConversion);
}

// Normalize dropdown values for consistent comparison without changing their display labels.
function getDashboardFilterKey(value) {
	return String(value ?? "").trim().toLocaleLowerCase();
}

// Populate a filter from cleaned data while retaining a still-valid selection.
function populateDashboardFilter(select, values, defaultLabel) {
	const previousValue = select.value;
	const uniqueValues = new Map();

	for (const value of values) {
		const label = String(value ?? "").trim();
		if (!label) {
			continue;
		}
		const key = getDashboardFilterKey(label);
		if (!uniqueValues.has(key)) {
			uniqueValues.set(key, label);
		}
	}

	const sortedValues = Array.from(uniqueValues.values()).sort((first, second) =>
		first.localeCompare(second, undefined, { sensitivity: "base" }),
	);
	const defaultOption = document.createElement("option");
	defaultOption.value = "";
	defaultOption.textContent = defaultLabel;
	select.replaceChildren(defaultOption);

	for (const value of sortedValues) {
		const option = document.createElement("option");
		option.value = value;
		option.textContent = value;
		select.appendChild(option);
	}

	const matchingOption = Array.from(select.options).find(
		(option) => getDashboardFilterKey(option.value) === getDashboardFilterKey(previousValue),
	);
	select.value = matchingOption ? matchingOption.value : "";
}

// Fill source, representative, and stage choices from the current full dataset.
function populateDashboardFilters(leads) {
	populateDashboardFilter(
		getDashboardElement("filter-source"),
		leads.map((lead) => lead.source || "Unknown Source"),
		"All Sources",
	);
	populateDashboardFilter(
		getDashboardElement("filter-rep"),
		leads.map((lead) => lead.rep || "Unassigned"),
		"All Representatives",
	);
	populateDashboardFilter(
		getDashboardElement("filter-stage"),
		leads.map((lead) => lead.stage || "Unknown Stage"),
		"All Stages",
	);
}

// Return a sortable date-only value, or null when a lead's date is missing or invalid.
function getLeadDateFilterValue(lead) {
	if (lead.createdDate instanceof Date && Number.isFinite(lead.createdDate.getTime())) {
		return lead.createdDate.toISOString().slice(0, 10);
	}

	const created = String(lead.created ?? "").trim();
	const timestamp = created ? Date.parse(created) : Number.NaN;
	return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

// Apply every selected control to the full dataset so filtering never loses records.
function getFilteredDashboardLeads() {
	const source = getDashboardElement("filter-source").value;
	const rep = getDashboardElement("filter-rep").value;
	const stage = getDashboardElement("filter-stage").value;
	const startDate = getDashboardElement("filter-start-date").value;
	const endDate = getDashboardElement("filter-end-date").value;
	const hasDateFilter = Boolean(startDate || endDate);

	return allDashboardLeads.filter((lead) => {
		if (source && getDashboardFilterKey(lead.source) !== getDashboardFilterKey(source)) {
			return false;
		}
		if (rep && getDashboardFilterKey(lead.rep) !== getDashboardFilterKey(rep)) {
			return false;
		}
		if (stage && getDashboardFilterKey(lead.stage || "Unknown Stage") !== getDashboardFilterKey(stage)) {
			return false;
		}

		if (hasDateFilter) {
			const leadDate = getLeadDateFilterValue(lead);
			if (!leadDate || (startDate && leadDate < startDate) || (endDate && leadDate > endDate)) {
				return false;
			}
		}

		return true;
	});
}

// Recalculate and render KPIs and charts from the leads matching current filters.
function updateDashboardForCurrentFilters() {
	const errorMessage = document.getElementById("error-message");
	if (errorMessage) {
		errorMessage.hidden = true;
		errorMessage.textContent = "";
	}

	try {
		const filteredLeads = getFilteredDashboardLeads();
		const metrics = calculateDashboardMetrics(filteredLeads);
		renderDashboardKpis(metrics);

		try {
			if (typeof Chart === "undefined") {
				throw new Error("Chart.js is unavailable.");
			}
			renderDashboardCharts(metrics);
		} catch (chartError) {
			console.error("Unable to render dashboard charts:", chartError);
			if (errorMessage) {
				errorMessage.textContent = "Lead data loaded, but the charts could not be displayed.";
				errorMessage.hidden = false;
			}
		}
	} catch (error) {
		console.error("Unable to update the dashboard for the selected filters:", error);
		if (errorMessage) {
			errorMessage.textContent = "The selected filters could not be applied.";
			errorMessage.hidden = false;
		}
	}
}

// Connect filter controls and actions once during page initialization.
function attachDashboardFilterListeners() {
	for (const id of ["filter-source", "filter-rep", "filter-stage", "filter-start-date", "filter-end-date"]) {
		getDashboardElement(id).addEventListener("change", updateDashboardForCurrentFilters);
	}

	getDashboardElement("reset-filters-button").addEventListener("click", () => {
		getDashboardElement("filter-source").value = "";
		getDashboardElement("filter-rep").value = "";
		getDashboardElement("filter-stage").value = "";
		getDashboardElement("filter-start-date").value = "";
		getDashboardElement("filter-end-date").value = "";
		updateDashboardForCurrentFilters();

		const refreshStatus = document.getElementById("refresh-status");
		if (refreshStatus) {
			refreshStatus.textContent = "Filters reset.";
		}
	});

	getDashboardElement("refresh-data-button").addEventListener("click", refreshDashboardData);
}

// Update the last-updated display after data has loaded and dashboard processing succeeds.
function updateDashboardTimestamp() {
	const lastUpdated = getDashboardElement("last-updated");
	const now = new Date();
	lastUpdated.dateTime = now.toISOString();
	lastUpdated.textContent = dashboardTimestampFormatter.format(now);
}

// Reload the CSV while preserving any selected filters that still have matching options.
async function refreshDashboardData() {
	const button = getDashboardElement("refresh-data-button");
	const status = getDashboardElement("refresh-status");
	const errorMessage = document.getElementById("error-message");

	button.disabled = true;
	status.textContent = "Refreshing lead data…";

	try {
		const rawLeads = await fetchLeadsFromCsv();
		const refreshedLeads = cleanLeadData(rawLeads);
		allDashboardLeads = refreshedLeads;
		populateDashboardFilters(allDashboardLeads);
		updateDashboardForCurrentFilters();
		updateDashboardTimestamp();
		status.textContent = "Lead data refreshed successfully.";
		if (errorMessage) {
			errorMessage.hidden = true;
			errorMessage.textContent = "";
		}
	} catch (error) {
		console.error("Unable to refresh dashboard data:", error);
		status.textContent = "Unable to refresh lead data. Please try again.";
		if (errorMessage) {
			errorMessage.textContent = "Dashboard data could not be refreshed. Please try again later.";
			errorMessage.hidden = false;
		}
	} finally {
		button.disabled = false;
	}
}

// Load the CSV and update the dashboard; report failures without exposing stack traces.
async function initializeDashboard() {
	const loadingMessage = document.getElementById("loading-message");
	const errorMessage = document.getElementById("error-message");

	if (loadingMessage) {
		loadingMessage.hidden = false;
	}
	if (errorMessage) {
		errorMessage.hidden = true;
		errorMessage.textContent = "";
	}

	attachDashboardFilterListeners();

	try {
		const rawLeads = await fetchLeadsFromCsv();
		allDashboardLeads = cleanLeadData(rawLeads);
		populateDashboardFilters(allDashboardLeads);
		updateDashboardForCurrentFilters();
		updateDashboardTimestamp();
	} catch (error) {
		console.error("Unable to load or render dashboard data:", error);
		if (errorMessage) {
			errorMessage.textContent =
				"Dashboard data could not be loaded or displayed. Please try again later.";
			errorMessage.hidden = false;
		}
	} finally {
		if (loadingMessage) {
			loadingMessage.hidden = true;
		}
	}
}

// Deferred scripts run after the HTML is parsed; this check also supports other script placement.
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeDashboard, { once: true });
} else {
	initializeDashboard();
}