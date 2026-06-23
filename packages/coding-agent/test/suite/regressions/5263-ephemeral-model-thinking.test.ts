/**
 * Regression for #5263: in-session model and thinking-level changes are
 * ephemeral by default. They update the live session and append session
 * transcript entries (so `/resume` restores them), but must NOT write the
 * global defaults in `~/.pi/agent/settings.json`. Only callers that pass
 * `{ persist: true }` (the `/settings` UI and the post-auth onboarding flow)
 * update `defaultProvider` / `defaultModel` / `defaultThinkingLevel`.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../harness.ts";

describe("issue #5263 ephemeral in-session model/thinking changes", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	async function createTwoModelHarness(): Promise<Harness> {
		const harness = await createHarness({
			models: [
				{ id: "faux-1", name: "One", reasoning: true },
				{ id: "faux-2", name: "Two", reasoning: true },
			],
		});
		harnesses.push(harness);
		return harness;
	}

	it("setModel without persist leaves the global default model untouched", async () => {
		const harness = await createTwoModelHarness();
		const initialModel = harness.settingsManager.getDefaultModel();
		const initialProvider = harness.settingsManager.getDefaultProvider();

		await harness.session.setModel(harness.getModel("faux-2")!);

		expect(harness.session.model?.id).toBe("faux-2");
		expect(harness.settingsManager.getDefaultModel()).toBe(initialModel);
		expect(harness.settingsManager.getDefaultProvider()).toBe(initialProvider);
	});

	it("setModel with persist:true updates the global default model", async () => {
		const harness = await createTwoModelHarness();
		const target = harness.getModel("faux-2")!;

		await harness.session.setModel(target, { persist: true });

		expect(harness.session.model?.id).toBe("faux-2");
		expect(harness.settingsManager.getDefaultModel()).toBe(target.id);
		expect(harness.settingsManager.getDefaultProvider()).toBe(target.provider);
	});

	it("cycleModel does not persist by default", async () => {
		const harness = await createTwoModelHarness();
		const initialModel = harness.settingsManager.getDefaultModel();
		const initialProvider = harness.settingsManager.getDefaultProvider();

		await harness.session.cycleModel();

		expect(harness.session.model?.id).not.toBe("faux-1");
		expect(harness.settingsManager.getDefaultModel()).toBe(initialModel);
		expect(harness.settingsManager.getDefaultProvider()).toBe(initialProvider);
	});

	it("setThinkingLevel without persist leaves the global thinking level untouched", async () => {
		const harness = await createTwoModelHarness();
		const initial = harness.settingsManager.getDefaultThinkingLevel();

		harness.session.setThinkingLevel("high");

		expect(harness.session.thinkingLevel).toBe("high");
		expect(harness.settingsManager.getDefaultThinkingLevel()).toBe(initial);
	});

	it("setThinkingLevel with persist:true updates the global thinking level", async () => {
		const harness = await createTwoModelHarness();
		// Establish a known baseline ephemerally so the persisted call is a real change.
		harness.session.setThinkingLevel("low");
		expect(harness.settingsManager.getDefaultThinkingLevel()).toBeUndefined();

		harness.session.setThinkingLevel("high", { persist: true });

		expect(harness.session.thinkingLevel).toBe("high");
		expect(harness.settingsManager.getDefaultThinkingLevel()).toBe("high");
	});

	it("cycleThinkingLevel does not persist by default", async () => {
		const harness = await createTwoModelHarness();
		// Establish a known starting in-session level without persisting.
		harness.session.setThinkingLevel("low");
		const initial = harness.settingsManager.getDefaultThinkingLevel();

		const next = harness.session.cycleThinkingLevel();

		expect(next).toBeDefined();
		expect(harness.session.thinkingLevel).toBe(next);
		expect(harness.settingsManager.getDefaultThinkingLevel()).toBe(initial);
	});

	it("still records in-session model/thinking changes in the session transcript", async () => {
		// /resume relies on transcript entries even though settings are untouched.
		const harness = await createTwoModelHarness();

		await harness.session.setModel(harness.getModel("faux-2")!);
		harness.session.setThinkingLevel("high");

		const entries = harness.sessionManager.getEntries();
		expect(entries.some((entry) => entry.type === "model_change")).toBe(true);
		expect(entries.some((entry) => entry.type === "thinking_level_change")).toBe(true);
	});
});
