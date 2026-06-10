/**
 * Adapter for OV skills API (POST /api/v1/skills).
 *
 * See OV 04-skills.md.
 */
import type { Transport } from "./transport";
import { toAddSkillResult } from "./mappers/ov-mappers";
import type { SkillStore, AddSkillResult, SkillData, AddSkillOptions } from "../../../domain/ports/skill-store";
import type { OVAddSkillResponse } from "./types/ov-skills";

export class SkillStoreAdapter implements SkillStore {
  constructor(private readonly transport: Transport) {}

  async addSkill(
    data: string | SkillData,
    options?: AddSkillOptions,
    signal?: AbortSignal,
  ): Promise<AddSkillResult> {
    const body: Record<string, unknown> = { data };

    if (options?.wait) body.wait = true;
    if (options?.timeout !== undefined) body.timeout = options.timeout;

    const raw = await this.transport.request<OVAddSkillResponse>(
      "SkillStore.addSkill",
      "/api/v1/skills",
      { method: "POST", body: JSON.stringify(body) },
      signal,
    );

    return toAddSkillResult(raw);
  }
}
