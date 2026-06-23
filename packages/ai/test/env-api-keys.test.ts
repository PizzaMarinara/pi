import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findEnvKeys, getEnvApiKey } from "../src/env-api-keys.ts";

const originalCopilotGitHubToken = process.env.COPILOT_GITHUB_TOKEN;
const originalGhToken = process.env.GH_TOKEN;
const originalGitHubToken = process.env.GITHUB_TOKEN;
const originalZaiCodingCnApiKey = process.env.ZAI_CODING_CN_API_KEY;

afterEach(() => {
	if (originalCopilotGitHubToken === undefined) {
		delete process.env.COPILOT_GITHUB_TOKEN;
	} else {
		process.env.COPILOT_GITHUB_TOKEN = originalCopilotGitHubToken;
	}

	if (originalGhToken === undefined) {
		delete process.env.GH_TOKEN;
	} else {
		process.env.GH_TOKEN = originalGhToken;
	}

	if (originalGitHubToken === undefined) {
		delete process.env.GITHUB_TOKEN;
	} else {
		process.env.GITHUB_TOKEN = originalGitHubToken;
	}

	if (originalZaiCodingCnApiKey === undefined) {
		delete process.env.ZAI_CODING_CN_API_KEY;
	} else {
		process.env.ZAI_CODING_CN_API_KEY = originalZaiCodingCnApiKey;
	}
});

describe("environment API keys", () => {
	it("does not treat generic GitHub tokens as GitHub Copilot credentials", () => {
		delete process.env.COPILOT_GITHUB_TOKEN;
		process.env.GH_TOKEN = "gh-token";
		process.env.GITHUB_TOKEN = "github-token";

		expect(findEnvKeys("github-copilot")).toBeUndefined();
		expect(getEnvApiKey("github-copilot")).toBeUndefined();
	});

	it("resolves GitHub Copilot credentials from COPILOT_GITHUB_TOKEN", () => {
		process.env.COPILOT_GITHUB_TOKEN = "copilot-token";
		process.env.GH_TOKEN = "gh-token";
		process.env.GITHUB_TOKEN = "github-token";

		expect(findEnvKeys("github-copilot")).toEqual(["COPILOT_GITHUB_TOKEN"]);
		expect(getEnvApiKey("github-copilot")).toBe("copilot-token");
	});

	it("resolves ZAI China Coding Plan credentials from ZAI_CODING_CN_API_KEY", () => {
		process.env.ZAI_CODING_CN_API_KEY = "zai-coding-cn-token";

		expect(findEnvKeys("zai-coding-cn")).toEqual(["ZAI_CODING_CN_API_KEY"]);
		expect(getEnvApiKey("zai-coding-cn")).toBe("zai-coding-cn-token");
	});
});

describe("Google Vertex ADC detection", () => {
	const VERTEX_ENV_VARS = [
		"GOOGLE_CLOUD_PROJECT",
		"GCLOUD_PROJECT",
		"GOOGLE_CLOUD_LOCATION",
		"GOOGLE_APPLICATION_CREDENTIALS",
		"GOOGLE_CLOUD_API_KEY",
	];
	const originalVertexEnv = Object.fromEntries(VERTEX_ENV_VARS.map((name) => [name, process.env[name]]));

	beforeEach(() => {
		// Isolate from the host's real Google credentials so detection is deterministic.
		for (const name of VERTEX_ENV_VARS) delete process.env[name];
	});

	afterEach(() => {
		for (const name of VERTEX_ENV_VARS) {
			const value = originalVertexEnv[name];
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	});

	// A credentials-file path that does not exist: on GCE / Workload Identity the
	// metadata server (resolved by @google/genai at request time) provides ADC,
	// so availability detection must not require a local credentials file.
	const noCredFile = {
		GOOGLE_APPLICATION_CREDENTIALS: "/nonexistent/pi-test/application_default_credentials.json",
	};

	it("treats Vertex as authenticated from project + location without a local credentials file", () => {
		const env = { ...noCredFile, GOOGLE_CLOUD_PROJECT: "my-project", GOOGLE_CLOUD_LOCATION: "us-central1" };

		expect(getEnvApiKey("google-vertex", env)).toBe("<authenticated>");
	});

	it("does not authenticate Vertex when project is missing", () => {
		const env = { ...noCredFile, GOOGLE_CLOUD_LOCATION: "us-central1" };

		expect(getEnvApiKey("google-vertex", env)).toBeUndefined();
	});

	it("does not authenticate Vertex when location is missing", () => {
		const env = { ...noCredFile, GOOGLE_CLOUD_PROJECT: "my-project" };

		expect(getEnvApiKey("google-vertex", env)).toBeUndefined();
	});

	it("resolves an explicit Vertex API key from GOOGLE_CLOUD_API_KEY", () => {
		const env = { GOOGLE_CLOUD_API_KEY: "vertex-api-key" };

		expect(findEnvKeys("google-vertex", env)).toEqual(["GOOGLE_CLOUD_API_KEY"]);
		expect(getEnvApiKey("google-vertex", env)).toBe("vertex-api-key");
	});
});
