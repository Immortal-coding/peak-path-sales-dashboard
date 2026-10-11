const REQUIRED_LEAD_COLUMNS = [
	"name",
	"source",
	"stage",
	"score",
	"rep",
	"deal_value",
	"created",
];

// Parse CSV character by character so commas and line breaks inside quotes stay
// part of their field, and doubled quotes become a single quote.
function parseCsvRecords(csvText) {
	const records = [];
	let fields = [];
	let field = "";
	let insideQuotes = false;
	let afterQuote = false;
	let line = 1;
	let recordStartLine = 1;

	function addField() {
		fields.push(field.trim());
		field = "";
		afterQuote = false;
	}

	function addRecord() {
		addField();
		// Ignore blank lines, but keep records that contain explicitly separated empty fields.
		if (fields.length > 1 || fields[0] !== "") {
			records.push({ fields, line: recordStartLine });
		}
		fields = [];
		recordStartLine = line + 1;
	}

	for (let index = 0; index < csvText.length; index += 1) {
		const character = csvText[index];

		if (insideQuotes) {
			if (character === '"') {
				if (csvText[index + 1] === '"') {
					field += '"';
					index += 1;
				} else {
					insideQuotes = false;
					afterQuote = true;
				}
			} else {
				field += character;
				if (character === "\r") {
					if (csvText[index + 1] === "\n") {
						field += "\n";
						index += 1;
					}
					line += 1;
				} else if (character === "\n") {
					line += 1;
				}
			}
			continue;
		}

		if (afterQuote) {
			if (character === ",") {
				addField();
			} else if (character === "\r" || character === "\n") {
				addRecord();
				if (character === "\r" && csvText[index + 1] === "\n") {
					index += 1;
				}
				line += 1;
				recordStartLine = line;
			} else if (character !== " " && character !== "\t") {
				throw new Error(`Malformed CSV on line ${line}: unexpected character after a closing quote.`);
			}
			continue;
		}

		if (character === '"') {
			if (field.trim() !== "") {
				throw new Error(`Malformed CSV on line ${line}: quote found inside an unquoted field.`);
			}
			field = "";
			insideQuotes = true;
		} else if (character === ",") {
			addField();
		} else if (character === "\r" || character === "\n") {
			addRecord();
			if (character === "\r" && csvText[index + 1] === "\n") {
				index += 1;
			}
			line += 1;
			recordStartLine = line;
		} else {
			field += character;
		}
	}

	if (insideQuotes) {
		throw new Error(`Malformed CSV on line ${recordStartLine}: quoted field was not closed.`);
	}

	if (fields.length > 0 || field !== "" || afterQuote) {
		addRecord();
	}

	return records;
}

// Fetch the CSV, validate its header and return each lead as a plain object.
async function fetchLeadsFromCsv() {
	const response = await fetch("data/leads.csv");
	if (!response.ok) {
		throw new Error(
			`Could not load lead data from data/leads.csv (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}).`,
		);
	}

	const csvText = await response.text();
	if (csvText.trim() === "") {
		return [];
	}

	const records = parseCsvRecords(csvText);
	if (records.length === 0) {
		return [];
	}

	// The first CSV record is the header; trim names and remove a possible UTF-8 BOM.
	const headers = records[0].fields.map((header, index) =>
		index === 0 ? header.replace(/^\uFEFF/, "").trim() : header.trim(),
	);

	const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
	if (duplicateHeaders.length > 0) {
		throw new Error(`Malformed CSV header: duplicate column name "${duplicateHeaders[0]}".`);
	}

	const missingColumns = REQUIRED_LEAD_COLUMNS.filter((column) => !headers.includes(column));
	if (missingColumns.length > 0) {
		throw new Error(`Lead CSV is missing required column(s): ${missingColumns.join(", ")}.`);
	}

	return records.slice(1).map((record) => {
		if (record.fields.length !== headers.length) {
			throw new Error(
				`Malformed CSV record on line ${record.line}: expected ${headers.length} fields, but found ${record.fields.length}.`,
			);
		}

		return Object.fromEntries(headers.map((header, index) => [header, record.fields[index].trim()]));
	});
}

// Classic scripts share top-level function declarations, so later deferred
// dashboard scripts can call fetchLeadsFromCsv directly.