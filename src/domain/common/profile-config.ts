import type { RecallConfig } from "./recall-config";

/**
 * Overridable RecallConfig fields that a ProfileBehavior can set.
 * Each field is optional — undefined means "use the base config value".
 */
type OverridableFields = "targetUri" | "topN" | "scoreThreshold" | "searchMode" | "expandGraph" | "autoRecall";
export type ProfileBehavior = Partial<Pick<RecallConfig, OverridableFields>>;

/**
 * Domain-facing profile configuration interface.
 *
 * Describes one named config preset with optional behavioral overrides.
 * Infra Zod schema (ProfileConfigSchema, ProfileBehaviorSchema) produces
 * structurally compatible types; binding layer validates assignability.
 */
export interface ProfileConfig {
  readonly name: string;
  readonly description: string;
  readonly behavior: ProfileBehavior;
}
