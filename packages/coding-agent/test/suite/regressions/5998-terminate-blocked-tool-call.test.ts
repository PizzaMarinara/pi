import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../harness.ts";

describe("tool_call block with terminate (#5998)", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	it("ends the turn after a blocked tool call when the handler sets terminate", async () => {
		let executed = false;
		const echoTool: AgentTool = {
			name: "echo",
			label: "Echo",
			description: "Echo text back",
			parameters: Type.Object({ text: Type.String() }),
			execute: async () => {
				executed = true;
				return { content: [{ type: "text", text: "should not run" }], details: {} };
			},
		};
		let providerCalls = 0;
		const harness = await createHarness({
			tools: [echoTool],
			extensionFactories: [
				(pi) => {
					pi.on("tool_call", async () => ({ block: true, reason: "Blocked by guard", terminate: true }));
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([
			() => {
				providerCalls++;
				return fauxAssistantMessage([fauxToolCall("echo", { text: "hello" })], { stopReason: "toolUse" });
			},
			() => {
				providerCalls++;
				return fauxAssistantMessage("should not be requested");
			},
		]);

		await harness.session.prompt("hi");

		expect(providerCalls).toBe(1);
		expect(executed).toBe(false);
		const toolResult = harness.session.messages.find((message) => message.role === "toolResult");
		expect(toolResult?.role).toBe("toolResult");
		if (toolResult?.role === "toolResult") {
			expect(toolResult.isError).toBe(true);
			expect(toolResult.content).toEqual([{ type: "text", text: "Blocked by guard" }]);
		}
	});
});
