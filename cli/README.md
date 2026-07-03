# squidlink

SquidVeil CLI — zero-exposure secrets management for SquidCloud.

## Install

```bash
npm install -g squidlink
```

## Usage

```bash
squidlink secrets list
squidlink secrets create <name> <value>
squidlink secrets verify <name> <value>
squidlink init
```

## Commands

| Command | Description |
|---------|-------------|
| `squidlink secrets list` | List all secrets |
| `squidlink secrets create <name> <value>` | Create a new secret |
| `squidlink secrets rename <id> <name>` | Rename a secret |
| `squidlink secrets delete <id>` | Delete a secret |
| `squidlink secrets verify <name> <value>` | Verify a value against a stored secret |
| `squidlink secrets export` | Export as .squidproxy |
| `squidlink secrets init` | Initialize project config files |
| `squidlink whoami` | Show current user |
| `squidlink proxy-gen` | Generate proxy config |
| `squidlink config` | Show current config |

## License

MIT
