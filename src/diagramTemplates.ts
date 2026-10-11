// Non-flowchart starters. These stay as Mermaid text (the visual editor handles flowcharts).
export const diagramTemplates: Record<string, string> = {
  Sequence: `sequenceDiagram
  autonumber
  participant C as Client
  participant S as Server
  participant D as Database
  C->>S: request
  S->>D: query
  D-->>S: rows
  S-->>C: response`,
  "Mind map": `mindmap
  root((Topic))
    Idea one
      Detail
      Detail
    Idea two
      Detail
    Idea three`,
  "ER model": `erDiagram
  USER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "appears in"`,
  "State machine": `stateDiagram-v2
  [*] --> Idle
  Idle --> Working: start
  Working --> Idle: done
  Working --> Failed: error
  Failed --> Idle: retry`,
};
