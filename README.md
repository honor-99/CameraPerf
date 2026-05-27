# CameraPerf

> AI-powered Camera performance analysis — specialized trace analysis for Android Camera preview, recording, and multi-output scenarios.

[![License: AGPL-3.0-or-later](https://img.shields.io/github/license/honor-99/CameraPerf)](LICENSE)
[![Node.js 24 LTS](https://img.shields.io/badge/Node.js-24%20LTS-brightgreen)](package.json)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6)](backend/tsconfig.json)
[![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ed)](docker-compose.yml)

CameraPerf is a streamlined derivative of [CameraPerf](https://github.com/honor-99/CameraPerf), focused exclusively on Android Camera performance analysis. It retains CameraPerf's Skill engine, trace_processor shell communication, and AI analysis runtime while stripping away all non-Camera analysis domains.

## What CameraPerf Analyzes

| Problem Domain | Analysis |
|---|---|
| **Preview jank** | Frame drops, V-sync misalignment, buffer stuffing |
| **Recording frame loss** | Encoder back-pressure, thermal throttling, I/O pressure |
| **Multi-output back-pressure** | Concurrent preview + recording + analysis pipeline contention |
| **Thermal degradation** | DVFS throttling, CPU cluster migration, GPU frequency collapse |
| **Camera pipeline latency** | Release fence delays, sensor trigger alignment, Binder IPC overhead |

## Quick Start

```bash
# Clone
git clone git@github.com:honor-99/CameraPerf.git
cd CameraPerf

# Configure AI provider
cp backend/.env.example backend/.env
# Edit backend/.env → set ANTHROPIC_API_KEY

# Run with Docker
docker compose up -d

# Health check
curl http://localhost:3000/health
```

## Architecture

```
Trace (.perfetto-trace)
        │
        ▼
trace_processor_shell  ──  SQL queries
        │
        ▼
Skill Engine (YAML DSL)
  ├── camera_pipeline.skill.yaml    ← Camera rendering path
  ├── composite/{cpu,gpu,thermal,...}.skill.yaml
  ├── atomic/{fence,vsync,frame,...}.skill.yaml
  └── modules/{cpu,gpu,thermal,...}
        │
        ▼
Claude Agent SDK  ──  Analysis + report generation
```

## Retained Assets (from CameraPerf)

- **43 Skills**: camera_pipeline + 11 atomic (frame/vsync/fence) + 17 composite (cpu/gpu/thermal/binder) + 10 modules + 2 deep
- **22 Strategies**: general, pipeline, arch-standard + knowledge templates + prompt templates
- **Skill Engine**: full YAML DSL execution runtime
- **trace_processor_shell**: communication layer + SQL knowledge base
- **Agent v3 runtime**: Claude Agent SDK integration

## Removed

- All non-Camera domain knowledge: scrolling, launch, ANR, Flutter, Compose, WebView, game engines
- Agent v2 architecture (~120 files)
- Self-improve system (~40 files)
- Frontend UI (CameraPerf is API-only)
- Rust flamegraph analyzer

## API

Coming soon — trace upload, camera analysis, and report generation endpoints.

## License

AGPL-3.0-or-later. Original Gracker copyright retained — see [LICENSE](LICENSE).
