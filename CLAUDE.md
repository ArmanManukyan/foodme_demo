# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Claude Code specific

- The deployed monitoring stack exposes a Grafana MCP server, so Claude can query Prometheus metrics and Loki logs. Add it with:
  ```bash
  claude mcp add foodme-grafana -- npx -y mcp-remote \
    https://foodme-monitoring-<hash>.onrender.com/mcp
  ```
  The endpoint needs no auth and has admin-level Grafana access (see `infra/monitoring/README.md`).
- Put guidance that applies to every agent in `AGENTS.md`, not here.
