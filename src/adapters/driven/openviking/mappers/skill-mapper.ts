/**
 * Mapper for OV skills API response.
 *
 * See OV 04-skills.md.
 */
import type { AddSkillResult } from "../../../../domain/ports/skill-store";
import type { OVAddSkillResponse } from "../types/ov-skills";

export function toAddSkillResult(raw: OVAddSkillResponse): AddSkillResult {
  return {
    rootUri: raw.root_uri,
    uri: raw.uri,
    name: raw.name,
    auxiliaryFiles: raw.auxiliary_files,
  };
}
