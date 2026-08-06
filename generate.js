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

async function generateLanguageChart(config, token) {
	const languages = await fetchAllLanguages(config.username, token);

	if (Object.keys(languages).length === 0) {
		return `<text x="${config.width - 150}" y="${config.height - 30}" fill="#ff0000" font-family="sans-serif" font-size="12">Brak danych o językach</text>`;
	}

	const sortedLanguages = Object.entries(languages).sort((a, b) => b[1] - a[1]);

	let finalLanguages = sortedLanguages;
	if (sortedLanguages.length >= 7) {
		const topLanguages = sortedLanguages.slice(0, 6);
		const otherLanguages = sortedLanguages.slice(6);

		const otherBytes = otherLanguages.reduce((sum, [, bytes]) => sum + bytes, 0);

		finalLanguages = [...topLanguages, ["Other", otherBytes]];
	}

	const totalBytes = finalLanguages.reduce((sum, [, bytes]) => sum + bytes, 0);

	const radius = 45;
	const circumference = 2 * Math.PI * radius;
	let accumulatedOffset = 0;

	const colors = ["#58a6ff", "#3fb950", "#d29922", "#f85149", "#a371f7", "#db6d28", "#8b949e"];
	let colorIndex = 0;

	const chartCenterX = config.width - 70;
	const chartCenterY = config.height - 70;

	let chartSvg = `<g>\n`;

	chartSvg += `    <g transform="translate(${chartCenterX}, ${chartCenterY})">\n`;
	chartSvg += `        <circle cx="0" cy="0" r="${radius}" fill="none" stroke="#21262d" stroke-width="14" />\n`;

	for (const [lang, bytes] of finalLanguages) {
		const percentage = bytes / totalBytes;
		const strokeLength = circumference * percentage;

		const color = (lang === "Other") ? "#8b949e" : colors[colorIndex % (colors.length - 1)];

		chartSvg += `        <circle cx="0" cy="0" r="${radius}" fill="none" stroke="${color}" stroke-width="14" stroke-dasharray="${strokeLength} ${circumference - strokeLength}" stroke-dashoffset="${-accumulatedOffset}" />\n`;

		accumulatedOffset += strokeLength;
		if (lang !== "Other") colorIndex++;
	}
	chartSvg += `    </g>\n`;

	let legendX = chartCenterX - 180;
	let legendY = chartCenterY - (finalLanguages.length * 9);
	if (legendY < 20) legendY = 20;

	colorIndex = 0;
	for (const [lang, bytes] of finalLanguages) {
		const color = (lang === "Other") ? "#8b949e" : colors[colorIndex % (colors.length - 1)];
		const percent = ((bytes / totalBytes) * 100).toFixed(1);

		chartSvg += `    <!-- Legenda: ${lang} -->\n`;
		chartSvg += `    <rect x="${legendX}" y="${legendY}" width="10" height="10" rx="2" fill="${color}" />\n`;
		chartSvg += `    <text x="${legendX + 16}" y="${legendY + 9}" class="lang-text">${lang} (${percent}%)</text>\n`;

		legendY += 18;
		if (lang !== "Other") colorIndex++;
	}

	chartSvg += `</g>`;
	return chartSvg;
}

async function run() {
	try {
		const configData = fs.readFileSync('config.json', 'utf8');
		const config = JSON.parse(configData);

		const response = await fetch(`https://api.github.com/users/${config.username}`);
		if (!response.ok) {
			throw new Error(`Cannot get user data: ${response.statusText}`);
		}
		const data = await response.json(),
		avatarRes = await fetch(data.avatar_url),
		avatarBuffer = await avatarRes.arrayBuffer(),
		avatarBase64 = Buffer.from(avatarBuffer).toString('base64'),
		avatarDataUrl = `data:image/png;base64,${avatarBase64}`;

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
		.displayName {
			fill: #${config.colors.display_name};
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			font-size: 16px;
			font-weight: bold;
		}
		.login {
			fill: #${config.colors.login};
			font-family: sans-serif;
			font-size: 12px;
		}
		.bio {
			fill: #${config.colors.bio};
			font-family: sans-serif;
			font-size: 12px;
		}
		.text-stat {
			fill: #${config.colors.stats};
			font-family: sans-serif;
			font-size: 14px;
		}
		.lang-text {
			fill: #${config.colors.stats};
			font-family: sans-serif;
			font-size: 12px;
		}
		</style>

		<rect x="${config.sizes.background_frame}" y="${config.sizes.background_frame}" width="${config.width}" height="${config.height}" class="bg"/>
		`;
		let x = 24, y = 24;
		if (config.show.profile) {
			svgContent += `
			<defs>
			<clipPath id="avatar-clip">
			<circle cx="${x + config.sizes.profile_radius}" cy="${y + config.sizes.profile_radius}" r="${config.sizes.profile_radius}"/>
			</clipPath>
			</defs>
			<circle cx="${x + config.sizes.profile_radius}" cy="${y + config.sizes.profile_radius}" r="${config.sizes.profile_radius}" fill="none" stroke="#${config.colors.profile_frame}" stroke-width="${config.sizes.profile_frame_size}"/>
			<image
			href="${avatarDataUrl}"
			x="${x}" y="${y}"
			width="${config.sizes.profile_radius * 2}" height="${config.sizes.profile_radius * 2}"
			clip-path="url(#avatar-clip)"
			/>
			`;
			x += config.sizes.profile_radius * 2 + 20;
		}
		if (config.show.name) {
			y += 16;
			const displayName = data.name || data.login;
			svgContent += `\t<text x="${x}" y="${y}" class="displayName">${displayName}</text>\n`;
			y += 16;
			svgContent += `\t<text x="${x}" y="${y}" class="login">@${data.login}</text>\n`;
			y += 16;
		}
		if (config.show.bio) {
			const userBio = data.bio || config.null.bio;
			svgContent += `\t<text x="${x}" y="${y}" class="bio">${userBio}</text>\n`;
			y += 16;
		}

		x = 24
		if (config.show.profile) { y = config.sizes.profile_radius * 3; }
		if (config.show.repo_count) {
			svgContent += `\t<text x="${x}" y="${y}" class="text-stat">${config.texts.repos}${data.public_repos}</text>\n`;
			y += 24;
		}
		if (config.show.followers_count) {
			svgContent += `\t<text x="${x}" y="${y}" class="text-stat">${config.texts.followers}${data.followers}</text>\n`;
			y += 24;
		}
		if (config.show.following_count) {
			svgContent += `\t<text x="${x}" y="${y}" class="text-stat">${config.texts.following}${data.following}</text>\n`;
			y += 24;
		}

		const languageChartSvg = await generateLanguageChart(config, process.env.GH_TOKEN);
		svgContent += languageChartSvg;

		svgContent += `</svg>`;
		fs.writeFileSync('stats.svg', svgContent.trim());
		console.log("File 'stats.svg' generated successfully!");

	} catch (error) {
		console.error("Error: ", error);
		process.exit(1);
	}
}

run();
