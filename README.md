# Atlas

Graph-style study boards. One folder per resource (book, course, video), one board per
chapter/topic, and each board is a canvas of atomic notes, diagrams and scratch thoughts
wired together.

Local-first on purpose: your notes live in the browser and are backed up by a small local service.

```bash
pnpm install
pnpm dev        # http://localhost:5180
```

## What's on the canvas

| Node | For |
|---|---|
| **Note** | Atomic note in the Study OS template (sentence, problem, how, gains/costs, use/avoid, example, recall, unclear, confidence 1–5) |
| **Scratch** | Dictation / rough thoughts. *Promote to atomic note* turns it into a Note |
| **Diagram** | Mermaid source, rendered live, resizable |
| **Sub-board** | Link to another board in the same resource: the mind-map-of-mind-maps |
| **Label** | Section headings |

- Double-click empty canvas: new note. Drag from a card edge to another card: link. Select a link to label it.
- **Paste note**: paste a Study OS page copied from Notion; it's split into fields.
- A note's *Copy as Study OS markdown* sends it back the other way.
- **Keyboard:** press `?` for the full list. `N S D B L` add cards, `E` cycles a note's size, `1`-`5` set confidence, `⌘D` duplicates, `⌘K` jumps to a board, `T` starts/pauses the timer, `⌘Z` / `⌘⇧Z` undo and redo.
- Undo/redo covers everything on the boards (including deleted cards and whole resources) but lives in memory, so it resets when you reload.
- Data is in `localStorage` (`atlas:v1`). **Export / Import** (sidebar footer) is the backup. Clearing browser data wipes boards, so export now and then.

## Running it locally (the setup in use)

```bash
scripts/install-local.sh     # build, install, start at login
scripts/uninstall-local.sh   # remove the service
```

Serves the built app on **http://localhost:5181**, bound to 127.0.0.1 only (nothing else on the network can reach it),
restarted automatically at login. Files live in `~/.local/share/atlas`. Re-run the install script after changing
the code to update it. Then install it as an app from the browser (Chrome/Edge: install icon in the address bar;
Safari: File -> Add to Dock) and it also works offline from its own cache, even if the service is stopped.

### Backups

The service also keeps your boards on disk and the app saves to it as you edit (status line in the sidebar):

| Where | What |
|---|---|
| `~/.local/share/atlas-data/atlas.json` | the live copy; the app loads from here, so a browser losing its storage costs nothing |
| `~/.local/share/atlas-data/snapshots/` | one file per day for 90 days, plus hourly for 48h (undo a bad hour) |
| `iCloud Drive/Atlas Backups/` | one file per day for 90 days, synced off the machine (`ATLAS_BACKUP_DIR` to change) |

Restore: Import the JSON from either folder (sidebar, Import). If the browser and server disagree, the newer one wins,
so edits made while the service was down are pushed up when it returns. Last write wins between two open tabs.

Boards are stored per browser *and per address*: `localhost:5181` has its own boards, separate from the dev server
on `:5180`. Use Export / Import to move boards across.

## Read-only MCP server (fact-check and critique your notes)

`mcp/` is a small MCP server that lets an assistant **read** your notes so it can check and critique them. It returns
your words verbatim and generates nothing. It has no write path at all: the only file call is `readFile`, every tool is
marked read-only, and its instructions tell the client to critique and never rewrite.

```bash
cd mcp && pnpm install
pnpm smoke      # 17 checks against a throwaway fixture, including "the data file is byte-for-byte unchanged"
claude mcp add --scope user atlas-notes -- node ~/development/atlas/mcp/server.mjs
```

| Tool | Returns |
|---|---|
| `list_resources`, `list_boards` | what exists, with counts |
| `list_notes` | one line per note; filter by `max_confidence`, `has_unclear`, resource, board. Pick what to check first |
| `get_note` | one note, every field verbatim, plus its links and your link labels |
| `get_board` | a whole board verbatim, for checking notes against each other |
| `get_diagram` | Mermaid source and, for visual flowcharts, steps and connections in words |
| `search` | case-insensitive across notes, scratch, labels, diagrams |

It reads `~/.local/share/atlas-data/atlas.json` (override with `ATLAS_DATA`), the copy the Atlas service saves as you edit,
so it sees your notes as of your last save. Try: *"fact-check my OLTP note"*, *"which of my notes is weakest and why"*.

## Not built yet

Sync between devices, recall/quiz mode over the Recall questions, search, auto-layout, image nodes, Notion sync, cloud persistence.
