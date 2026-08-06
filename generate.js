const fs = require('fs');

async function run() {
	try {
		// 1. Odczytujemy plik config.json
		const configData = fs.readFileSync('config.json', 'utf8');
		const config = JSON.parse(configData);

		// 2. Pobieramy dane z oficjalnego API GitHuba
		const response = await fetch(`https://api.github.com/users/${config.username}`);
		if (!response.ok) {
			throw new Error(`Nie udało się pobrać danych użytkownika: ${response.statusText}`);
		}
		const data = await response.json();

		// 3. Budujemy zawartość pliku SVG w czystym kodzie XML/SVG
		let svgContent = `
		<svg width="400" height="180" viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg">
		<style>
		.bg { fill: #161b22; stroke: #30363d; stroke-width: 1; rx: 12px; }
		.text-title { fill: #f0f6fc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 16px; font-weight: bold; }
		.text-sub { fill: #8b949e; font-family: sans-serif; font-size: 13px; }
		.text-stat { fill: #c9d1d9; font-family: sans-serif; font-size: 14px; }
		</style>

		<!-- Tło karty -->
		<rect width="400" height="180" class="bg" />
		`;

		// Nagłówek (Imię i login)
		if (config.showName) {
			const displayName = data.name || data.login;
			svgContent += `
			<text x="24" y="38" class="text-title">${displayName}</text>
			<text x="24" y="58" class="text-sub">@${data.login}</text>
			`;
		}

		// Dynamiczne dodawanie statystyk w zależności od config.json
		let currentY = 95;

		if (config.showRepos) {
			svgContent += `    <text x="24" y="${currentY}" class="text-stat">📦 Publiczne repozytoria: ${data.public_repos}</text>\n`;
			currentY += 24;
		}

		if (config.showFollowers) {
			svgContent += `    <text x="24" y="${currentY}" class="text-stat">👥 Obserwujący: ${data.followers}</text>\n`;
			currentY += 24;
		}

		if (config.showFollowing) {
			svgContent += `    <text x="24" y="${currentY}" class="text-stat">👤 Obserwowani: ${data.following}</text>\n`;
		}

		svgContent += `</svg>`;

		// 4. Zapisujemy gotowy SVG do pliku stats.svg w repozytorium
		fs.writeFileSync('stats.svg', svgContent.trim());
		console.log("Plik stats.svg został pomyślnie wygenerowany!");

	} catch (error) {
		console.error("Błąd podczas generowania SVG:", error);
		process.exit(1);
	}
}

run();
