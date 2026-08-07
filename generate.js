const fs = require('fs');

async function fetchAllLanguages(username, token) {
	const headers = {};
	if (token) {
		headers["Authorization"] = `token ${token}`;
	}

	try {
		const reposRes = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, { headers });
		if (!reposRes.ok) throw new Error("Nie udało się pobrać repozytoriów");
		const repos = await reposRes.json();

		const allLanguages = {};

		for (const repo of repos) {
			const langRes = await fetch(repo.languages_url, { headers });
			if (langRes.ok) {
				const languages = await langRes.json();
				for (const [lang, bytes] of Object.entries(languages)) {
					allLanguages[lang] = (allLanguages[lang] || 0) + bytes;
				}
			}
		}

		return allLanguages;
	} catch (error) {
		console.error("Błąd podczas pobierania języków:", error);
		return {};
	}
}

async function getSortedLanguageStats(username, token) {
	const allLanguages = await fetchAllLanguages(username, token);
	const totalBytes = Object.values(allLanguages).reduce((a, b) => a + b, 0);

	if (totalBytes === 0) return [];

	let sorted = Object.entries(allLanguages).sort((a, b) => b[1] - a[1]);

	if (sorted.length > 5) {
		const top = sorted.slice(0, 4);
		const otherBytes = sorted.slice(4).reduce((sum, [, bytes]) => sum + bytes, 0);
		sorted = [...top, ["Other", otherBytes]];
	}

	const stats = sorted.map(([name, bytes]) => ({
		name: name,
		bytes: bytes,
		percentage: parseFloat(((bytes / totalBytes) * 100).toFixed(1))
	}));

	return stats;
}

function drawArc(x, y, radius, startPercent, endPercent, color, thickness = 14) {
	const circumference = 2 * Math.PI * radius;
	const length = (endPercent - startPercent) * circumference;
	const offset = startPercent * circumference;

	return `
	<circle
	cx="${x}" cy="${y}" r="${radius}"
	fill="none"
	stroke="${color}"
	stroke-width="${thickness}"
	stroke-dasharray="${length} ${circumference}"
	stroke-dashoffset="${-offset}"
	transform="rotate(-90 ${x} ${y})"
	/>`;
}

function drawText(x, y, size, color, name, percentageText) {
	const rectSize = size * 0.8, rectY = y - rectSize + 2;
	return `
	<g>
	<rect x="${x}" y="${rectY}" width="${rectSize}" height="${rectSize}" rx="2" fill="${color}" />
	<text x="${x + rectSize + 8}" y="${y}" font-family="monospace" font-size="${size}" fill="${color}">${name}</text>
	<text x="${x + 80}" y="${y}" font-family="monospace" font-size="${size}" fill="${color}">${percentageText}</text>
	</g>
	`;
}

async function run() {
	try {
		const configData = fs.readFileSync('config.json', 'utf8');
		const config = JSON.parse(configData);

		const response = await fetch(`https://api.github.com/users/${config.username}`);
		if (!response.ok) {
			throw new Error(`Cannot get user data: ${response.statusText}`);
		}
		const data = await response.json();

		let w = config.width + config.sizes.background_frame * 2,
		h = config.height + config.sizes.background_frame * 2,
		svgContent = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
		<style>
		.bg {
			fill: #${config.colors.background};
			stroke: #${config.colors.background_frame};
			stroke-width: ${config.sizes.background_frame};
			rx: 12px;
		}
		</style>

		<rect x="${config.sizes.background_frame}" y="${config.sizes.background_frame}" width="${config.width}" height="${config.height}" class="bg"/>
		`;

		const stats = await getSortedLanguageStats(config.username, process.env.GH_TOKEN);

		let currentStart = 0;
		let chartSvg = `<g>`;

		const colors = ["#58a6ff", "#3fb950", "#d29922", "#f85149", "#a371f7", "#db6d28", "#8b949e"];
		const radius = 45;
		const chartCenterX = config.width / 2;
		const chartCenterY = radius + 30;
		let ty = 35 + radius * 2;

		chartSvg += `<circle cx="${chartCenterX}" cy="${chartCenterY}" r="${radius}" fill="none" stroke="#21262d" stroke-width="14" />`;

		stats.forEach((stat, index) => {
			const color = (stat.name === "Other") ? "#8b949e" : colors[index % (colors.length - 1)];
			const endPercent = currentStart + (stat.percentage / 100);
			chartSvg += drawArc(chartCenterX, chartCenterY, radius, currentStart, endPercent, color);
			currentStart = endPercent;
			chartSvg += drawText(40, ty, 10, color, stat.name, `(${stat.percentage}%)`);
			ty += 14;
		});

		chartSvg += `</g>`;
		svgContent += chartSvg;

		svgContent += `</svg>`;
		fs.writeFileSync('stats.svg', svgContent.trim());
		console.log("File 'stats.svg' generated successfully!");

	} catch (error) {
		console.error("Error: ", error);
		process.exit(1);
	}
}

run();
