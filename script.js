async function loadGitHubStats() {
	try {
		const configResponse = await fetch('config.json');
		if (!configResponse.ok) throw new Error("Nie udało się wczytać pliku config.json");
		const config = await configResponse.json();

		const apiResponse = await fetch(`https://api.github.com/users/${config.username}`);
		if (!apiResponse.ok) throw new Error("Nie znaleziono takiego użytkownika na GitHubie!");
		const data = await apiResponse.json();

		const headerSection = document.getElementById('headerSection');
		if (!config.showAvatar && !config.showName) {
			headerSection.classList.add('hidden');
		} else {
			if (config.showAvatar) {
				document.getElementById('userAvatar').src = data.avatar_url;
			} else {
				document.getElementById('userAvatar').classList.add('hidden');
			}

			if (config.showName) {
				document.getElementById('userName').textContent = data.name || data.login;
				document.getElementById('userLogin').textContent = `@${data.login}`;
			} else {
				document.getElementById('userName').classList.add('hidden');
				document.getElementById('userLogin').classList.add('hidden');
			}
		}

		const repoRow = document.getElementById('repoRow');
		if (config.showRepos) {
			document.getElementById('repoCount').textContent = data.public_repos;
		} else {
			repoRow.classList.add('hidden');
		}

		const followersRow = document.getElementById('followersRow');
		if (config.showFollowers) {
			document.getElementById('followersCount').textContent = data.followers;
		} else {
			followersRow.classList.add('hidden');
		}

		const followingRow = document.getElementById('followingRow');
		if (config.showFollowing) {
			document.getElementById('followingCount').textContent = data.following;
		} else {
			followingRow.classList.add('hidden');
		}

	} catch (error) {
		console.error("Błąd:", error.message);
		document.getElementById('statsCard').innerHTML = `<p style="color: #f85149;">Błąd: ${error.message}</p>`;
	}
}

loadGitHubStats();
