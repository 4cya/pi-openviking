export interface AddSkillResult {
  rootUri: string;
  uri: string;
  name: string;
  auxiliaryFiles: number;
}

export interface SkillData {
  name: string;
  description: string;
  content?: string;
  allowedTools?: string[];
  tags?: string[];
}

export interface AddSkillOptions {
  wait?: boolean;
  timeout?: number;
}

export interface SkillStore {
  addSkill(
    data: string | SkillData,
    options?: AddSkillOptions,
    signal?: AbortSignal,
  ): Promise<AddSkillResult>;
}
