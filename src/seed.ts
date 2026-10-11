import type { Board, Folder } from "./types";
import { emptyNote } from "./types";
import { flowTemplates, toMermaid } from "./flow";

// Seeded from the first two Study OS notes so the board isn't empty on first run.
export const seedFolders: Folder[] = [
  { id: "f-ddia", name: "Designing Data-Intensive Applications", kind: "book" },
  { id: "f-aws", name: "AWS course", kind: "course" },
  { id: "f-yt", name: "YouTube", kind: "video" },
];

const model = flowTemplates["Operational vs analytical"]();

export const seedBoards: Board[] = [
  {
    id: "b-ddia-ch1",
    folderId: "f-ddia",
    name: "Ch 1 · Operational vs analytical",
    nodes: [
      { id: "l1", type: "label", position: { x: 0, y: -60 }, data: { text: "Operational vs analytical systems" } },
      {
        id: "n-oltp",
        type: "note",
        position: { x: 0, y: 20 },
        data: {
          ...emptyNote(),
          title: "Operational Systems (OLTP)",
          sentence:
            "Backend code and data infrastructure that creates and retrieves a few records at a time (usually by key) to serve user-facing applications.",
          problem: "Lets many users concurrently make frequent reads and writes against current data.",
          how: "Backend code reads/writes individual records from user input over HTTP or web-sockets. Fixed queries keep retrieval simple and low-latency.",
          gains: "Quick access to a few records, CRUD enforces consistency, known access patterns allow effective caching.",
          costs: "Overwrites old values (no history), slow scans over large datasets, analytical queries hurt live performance.",
          useWhen: "A client app needs high small-transaction throughput.",
          avoidWhen: "Aggregating large record sets for business decisions.",
          example: "An API for a TODO list application.",
          recall:
            "1. A PM wants average weekly workout time by country — which system, and why not the other?\n2. Why fixed queries rather than custom SQL?\n3. Why not run analytics on an operational system?",
          unclear: "Trade-offs of using an operational system tbd.",
          confidence: 3,
        },
      },
      {
        id: "n-olap",
        type: "note",
        position: { x: 560, y: 20 },
        data: {
          ...emptyNote(),
          title: "Analytical Systems (OLAP)",
          sentence:
            "Large retrieval of records transformed into aggregated statistics, used by BAs and data scientists to drive decisions and data-driven features.",
          problem: "Lets professionals analyse large sets of historical data to find insights.",
          how: "Complex custom SQL scans large record sets and computes aggregates rather than returning individual records.",
          gains: "Historical retrieval, valuable insight, optimised for aggregations.",
          costs: "Computationally expensive, read-only access.",
          useWhen: "Retrieving historical data for business decision support.",
          avoidWhen: "Serving frequent live traffic from many users.",
          example: "BA analyses the volume change in banana sales during a promotion.",
          recall:
            "1. Total sales per country in 2024 — which system?\n2. Problems with analytics on an operational system?\n3. When do you need to separate the two?",
          confidence: 3,
        },
      },
      {
        id: "d1",
        type: "diagram",
        position: { x: 560, y: 520 },
        style: { width: 520, height: 520 },
        data: { title: "How data flows between them", code: toMermaid(model), model },
      },
      {
        id: "s1",
        type: "scratch",
        position: { x: 1120, y: 40 },
        data: {
          text: "Data warehousing\nSeparate analytical copy so queries don't compete with live traffic. Fed by ETL. Need to dig into how fresh it is — batch vs streaming?",
        },
      },
      { id: "b1", type: "board", position: { x: 1120, y: 300 }, data: { title: "Data warehousing deep-dive", boardId: "" } },
    ],
    edges: [
      { id: "e1", source: "n-oltp", target: "n-olap", sourceHandle: "r", targetHandle: "l", label: "ETL copies data into" },
      { id: "e2", source: "n-olap", target: "d1", sourceHandle: "b", targetHandle: "t", label: "illustrated by" },
    ],
  },
  { id: "b-aws-1", folderId: "f-aws", name: "Notes", nodes: [], edges: [] },
  { id: "b-yt-1", folderId: "f-yt", name: "Notes", nodes: [], edges: [] },
];
