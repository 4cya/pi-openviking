import type { KnowledgeItem } from "../../knowledge/model/knowledge-item";

export interface RecallItem {
  item: KnowledgeItem;
  score: number;
  source: "search" | "graph";
}
