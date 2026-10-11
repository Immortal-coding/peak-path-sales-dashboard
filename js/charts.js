const DASHBOARD_CHART_COLORS = [
    "#3568d4",
    "#18845b",
    "#f79009",
    "#7a5af8",
    "#e04f5f",
    "#06aed4",
    "#667085",
    "#d444a1",
];

// Make sure a chart container has a message element available for empty data.
function getChartEmptyStateElement(canvas) {
    const container = canvas.closest(".chart-container");
    if (!container) {
        return null;
    }

    let message = container.querySelector(".chart-empty-state");
    if (!message) {
        message = document.createElement("p");
        message.className = "chart-empty-state";
        message.setAttribute("role", "status");
        message.style.position = "absolute";
        message.style.inset = "0";
        message.style.display = "none";
        message.style.placeItems = "center";
        message.style.margin = "0";
        message.style.padding = "1rem";
        message.style.color = "#667085";
        message.style.textAlign = "center";
        container.appendChild(message);
    }

    return message;
}

// Show a helpful message in the chart's own container when there is no data to plot.
function showChartEmptyState(canvas, text) {
    const chart = Chart.getChart(canvas);
    if (chart) {
        chart.destroy();
    }

    const message = getChartEmptyStateElement(canvas);
    canvas.hidden = true;
    if (message) {
        message.textContent = text;
        message.hidden = false;
        message.style.display = "grid";
    }
}

// Leave the chart area clear when there is no close-rate data to display.
function clearChartArea(canvas) {
    const chart = Chart.getChart(canvas);
    if (chart) {
        chart.destroy();
    }

    const container = canvas.closest(".chart-container");
    const message = container?.querySelector(".chart-empty-state");
    if (message) {
        message.remove();
    }
    canvas.hidden = false;
}

// Restore the canvas when new data is available after an empty state.
function prepareChartCanvas(canvas) {
    const message = getChartEmptyStateElement(canvas);
    canvas.hidden = false;
    if (message) {
        message.hidden = true;
        message.style.display = "none";
    }
}

// Update an existing chart when possible, instead of creating duplicates.
function renderOrUpdateChart(canvas, configuration) {
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
        existingChart.data = configuration.data;
        existingChart.options = configuration.options;
        existingChart.update();
        return existingChart;
    }

    return new Chart(canvas, configuration);
}

// Create consistent responsive chart options with readable titles and tooltips.
function createBaseChartOptions(title, tooltipLabel) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: "nearest",
            intersect: false,
        },
        events: ["mousemove", "mouseout", "click", "touchstart", "touchmove"],
        hover: {
            mode: "nearest",
            intersect: false,
        },
        plugins: {
            title: {
                display: true,
                text: title,
                color: "#182230",
                font: { size: 15, weight: "600" },
                padding: { bottom: 16 },
            },
            legend: {
                labels: {
                    color: "#344054",
                    padding: 14,
                    usePointStyle: true,
                },
            },
            tooltip: {
                enabled: true,
                mode: "nearest",
                intersect: false,
                callbacks: {
                    label: tooltipLabel,
                },
            },
        },
    };
}

// Render lead counts for each funnel stage in the lead funnel bar chart.
function renderLeadFunnelChart(metrics) {
    if (typeof Chart === "undefined") {
        console.error("Chart.js is not available; the lead funnel chart cannot be rendered.");
        return;
    }

    const canvas = document.getElementById("lead-funnel-canvas");
    if (!canvas) {
        console.error('Chart canvas "lead-funnel-canvas" was not found.');
        return;
    }

    const funnel = Array.isArray(metrics?.funnel) ? metrics.funnel : [];
    if (funnel.length === 0) {
        showChartEmptyState(canvas, "No lead stage data is available yet.");
        return;
    }

    const container = canvas.closest(".chart-container");
    if (container) {
        container.style.height = `${Math.max(280, funnel.length * 32 + 100)}px`;
    }

    prepareChartCanvas(canvas);
    const options = createBaseChartOptions(
        "Lead Funnel by Stage",
        (context) => {
            const stage = context.chart.data.labels[context.dataIndex] || "Unknown Stage";
            const count = context.parsed.x;
            return `${stage}: ${count} leads`;
        },
    );
    options.indexAxis = "y";
    options.events = ["mousemove", "mouseout", "click", "touchstart", "touchmove"];
    options.interaction = { mode: "nearest", intersect: true };
    options.hover = { mode: "nearest", intersect: true };
    options.plugins.tooltip = {
        enabled: true,
        mode: "nearest",
        intersect: true,
        callbacks: {
            label: (context) => {
                const stage = context.chart.data.labels[context.dataIndex] || "Unknown Stage";
                return `${stage}: ${context.parsed.x} leads`;
            },
        },
    };
    options.scales = {
        x: {
            beginAtZero: true,
            title: { display: true, text: "Number of leads", color: "#475467" },
            ticks: { color: "#475467", precision: 0 },
            grid: { color: "#e4e9f0" },
        },
        y: {
            title: { display: false },
            ticks: { color: "#475467", autoSkip: false, crossAlign: "far", padding: 8 },
            grid: { display: false },
        },
    };
    options.layout = { padding: { left: 12 } };

    renderOrUpdateChart(canvas, {
        type: "bar",
        data: {
            labels: funnel.map((item) => item.stage || "Unknown Stage"),
            datasets: [{
                label: "Leads",
                data: funnel.map((item) => item.count),
                backgroundColor: funnel.map((item, index) =>
                    item.isUnknown ? "#98a2b3" : DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length],
                ),
                borderRadius: 5,
                maxBarThickness: 52,
            }],
        },
        options,
    });
}

// Render the lead counts by source in a doughnut chart.
function renderLeadsBySourceChart(metrics) {
    if (typeof Chart === "undefined") {
        console.error("Chart.js is not available; the leads-by-source chart cannot be rendered.");
        return;
    }

    const canvas = document.getElementById("leads-by-source-canvas");
    if (!canvas) {
        console.error('Chart canvas "leads-by-source-canvas" was not found.');
        return;
    }

    const sources = Array.isArray(metrics?.leadsBySource) ? metrics.leadsBySource : [];
    if (sources.length === 0) {
        showChartEmptyState(canvas, "No lead source data is available yet.");
        return;
    }

    prepareChartCanvas(canvas);
    const options = createBaseChartOptions(
        "Leads by Source",
        (context) => {
            const source = context.chart.data.labels[context.dataIndex] || "Unknown Source";
            const count = context.dataset.data[context.dataIndex];
            return `${source}: ${count} leads`;
        },
    );
    options.cutout = "58%";
    options.events = ["mousemove", "mouseout", "click", "touchstart", "touchmove"];
    options.interaction = { mode: "nearest", intersect: true };
    options.hover = { mode: "nearest", intersect: true };
    options.plugins.tooltip = {
        enabled: true,
        mode: "nearest",
        intersect: true,
        callbacks: {
            label: (context) => {
                const source = context.chart.data.labels[context.dataIndex] || "Unknown Source";
                return `${source}: ${context.parsed} leads`;
            },
        },
    };

    renderOrUpdateChart(canvas, {
        type: "doughnut",
        data: {
            labels: sources.map((item) => item.source || "Unknown Source"),
            datasets: [{
                label: "Leads",
                data: sources.map((item) => item.count),
                backgroundColor: sources.map((_, index) =>
                    DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length],
                ),
                borderColor: "#ffffff",
                borderWidth: 2,
            }],
        },
        options,
    });
}

// Render each representative's close rate, omitting rates that cannot be calculated.
function renderCloseRateByRepChart(metrics) {
    if (typeof Chart === "undefined") {
        console.error("Chart.js is not available; the close-rate chart cannot be rendered.");
        return;
    }

    const canvas = document.getElementById("close-rate-by-rep-canvas");
    if (!canvas) {
        console.error('Chart canvas "close-rate-by-rep-canvas" was not found.');
        return;
    }

    const reps = Array.isArray(metrics?.closeRateByRep) ? metrics.closeRateByRep : [];
    const calculableRates = reps.filter(
        (item) => item.canCalculateRate === true && typeof item.rate === "number" && Number.isFinite(item.rate),
    );
    if (calculableRates.length === 0) {
        clearChartArea(canvas);
        return;
    }

    prepareChartCanvas(canvas);
    const options = createBaseChartOptions(
        "Close Rate by Sales Rep",
        (context) => {
            const representative = context.chart.data.labels[context.dataIndex];
            const rate = context.dataset.data[context.dataIndex];
            return `${representative}: ${Number(rate).toFixed(1)}%`;
        },
    );
    options.events = ["mousemove", "mouseout", "click", "touchstart", "touchmove"];
    options.interaction = { mode: "nearest", intersect: true };
    options.hover = { mode: "nearest", intersect: true };
    options.plugins.tooltip = {
        enabled: true,
        mode: "nearest",
        intersect: true,
        callbacks: {
            label: (context) => {
                const representative = context.chart.data.labels[context.dataIndex];
                const rate = context.parsed.y;
                return `${representative}: ${rate.toFixed(1)}%`;
            },
        },
    };
    options.scales = {
        x: {
            title: { display: true, text: "Sales representative", color: "#475467" },
            ticks: { color: "#475467" },
            grid: { display: false },
        },
        y: {
            beginAtZero: true,
            max: 100,
            title: { display: true, text: "Close rate", color: "#475467" },
            ticks: {
                color: "#475467",
                callback: (value) => `${value}%`,
            },
            grid: { color: "#e4e9f0" },
        },
    };

    renderOrUpdateChart(canvas, {
        type: "bar",
        data: {
            labels: calculableRates.map((item) => item.rep),
            datasets: [{
                label: "Close rate",
                data: calculableRates.map((item) => item.rate * 100),
                backgroundColor: calculableRates.map((_, index) =>
                    DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length],
                ),
                borderRadius: 5,
                maxBarThickness: 52,
            }],
        },
        options,
    });
}

// Render all three dashboard charts from the same calculated metrics object.
function renderDashboardCharts(metrics) {
    if (typeof Chart === "undefined") {
        console.error("Chart.js is not available; dashboard charts cannot be rendered.");
        return;
    }

    renderLeadFunnelChart(metrics);
    renderLeadsBySourceChart(metrics);
    renderCloseRateByRepChart(metrics);
}