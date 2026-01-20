import { eventHandler } from "h3";
import { getState } from "../utils/state";

type ReleaseTrackerState = {
	repoGraph: Record<
		string,
		{
			upstream_edge: string | null;
			downstream_edges: string[];
		}
	>;
	repoStates: Record<
		string,
		{
			merged_features: string[];
			queued_features: string[];
			upstream_features: string[];
		}
	>;
};

export default eventHandler(async (event) => {
	// Get state directly from the state module
	const env = event.context.cloudflare?.env;
	const state: ReleaseTrackerState = await getState(env);

	// Group repo states by repo name to display latest version per repo
	const reposByRepo: Record<
		string,
		Array<{ version: string; state: ReleaseTrackerState["repoStates"][string] }>
	> = {};

	if (state) {
		for (const [key, repoState] of Object.entries(state.repoStates)) {
			const match = key.match(/^(.+)@(.+)$/);
			if (match) {
				const [, repoName, version] = match;
				if (!reposByRepo[repoName]) {
					reposByRepo[repoName] = [];
				}
				reposByRepo[repoName].push({ version, state: repoState });
			}
		}

		// Sort by version (simple semver sort)
		for (const repoName of Object.keys(reposByRepo)) {
			reposByRepo[repoName].sort((a, b) => {
				const aParts = a.version.split(".").map(Number);
				const bParts = b.version.split(".").map(Number);
				for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
					const aPart = aParts[i] || 0;
					const bPart = bParts[i] || 0;
					if (aPart !== bPart) return bPart - aPart;
				}
				return 0;
			});
		}
	}

	const renderTable = () => {
		if (Object.keys(reposByRepo).length === 0) {
			return `<p class="empty">No repos have been tracked yet. State is ready and waiting for events.</p>`;
		}

		let html = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Repo</th>
              <th>Version</th>
              <th>Merged Features</th>
              <th>Queued Features</th>
              <th>Upstream Features</th>
            </tr>
          </thead>
          <tbody>
    `;

		for (const [repoName, versions] of Object.entries(reposByRepo)) {
			// Show the latest version
			const latest = versions[0];
			const repoState = latest.state;

			const formatFeatures = (features: string[]) => {
				if (features.length === 0) return "";
				return features.map((f) => `"${f}"`).join(", ");
			};

			html += `
        <tr>
          <td><strong>${repoName}</strong></td>
          <td>${latest.version}</td>
          <td>${formatFeatures(repoState.merged_features)}</td>
          <td>${formatFeatures(repoState.queued_features)}</td>
          <td>${formatFeatures(repoState.upstream_features)}</td>
        </tr>
      `;
		}

		html += `
          </tbody>
        </table>
      </div>
    `;

		return html;
	};

	return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Release Tracker</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
          }
          .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 30px;
          }
          h1 {
            margin-bottom: 10px;
            color: #2c3e50;
            font-size: 2rem;
          }
          .subtitle {
            color: #7f8c8d;
            margin-bottom: 30px;
          }
          .table-container {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            margin-top: 20px;
            border: 1px solid #ecf0f1;
            border-radius: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            min-width: 800px; /* Force horizontal scroll on small screens */
          }
          thead {
            background: #34495e;
            color: white;
          }
          th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #2c3e50;
            white-space: nowrap;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #ecf0f1;
            vertical-align: top;
          }
          tbody tr:hover {
            background: #f8f9fa;
          }
          tbody tr:last-child td {
            border-bottom: none;
          }
          td:nth-child(3),
          td:nth-child(4),
          td:nth-child(5) {
            font-size: 0.9em;
            color: #555;
            min-width: 200px;
            white-space: pre-wrap;
          }
          .empty {
            color: #95a5a6;
            font-style: italic;
            text-align: center;
            padding: 20px;
          }
          @media (max-width: 768px) {
            body {
              padding: 10px;
            }
            .container {
              padding: 15px;
            }
            h1 {
              font-size: 1.5rem;
            }
            .subtitle {
              margin-bottom: 20px;
              font-size: 0.9rem;
            }
            th, td {
              padding: 8px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Release Tracker</h1>
          <p class="subtitle">Tracking feature releases across the tscircuit pipeline</p>
          ${renderTable()}
        </div>
      </body>
    </html>
  `;
});
