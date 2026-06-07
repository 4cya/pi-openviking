import type { SkillStore, AddSkillResult, SkillData, AddSkillOptions } from "../ports/skill-store";

export class SkillService {
  constructor(private readonly store: SkillStore) {}

  async addSkill(
    data: string | SkillData,
    options?: AddSkillOptions,
    signal?: AbortSignal,
  ): Promise<AddSkillResult> {
    return this.store.addSkill(data, options, signal);
  }
}
