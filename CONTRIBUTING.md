# Fluxo de trabalho

## Branches

| Branch | Papel |
|---|---|
| `main` | Integração. Recebe PR das branches de trabalho. |
| `production` | Versões lançadas. Só recebe PR vindo da `main`. Cada merge vira uma tag `vX.Y.Z`. |
| `feat/*`, `fix/*`, `chore/*` | Trabalho. Saem da `main` e voltam para ela via PR. |

As duas branches protegidas só aceitam PR com o check `ci` verde. Push direto e force push são bloqueados.

## Dia a dia

```bash
git switch main && git pull
git switch -c feat/minha-coisa
# commits pequenos, um por mudança (conventional commits)
git push -u origin feat/minha-coisa
gh pr create --base main --fill
gh pr merge --merge --delete-branch
```

## Lançar versão

```bash
# 1. subir a versão na main
git switch main && git pull
git switch -c chore/release-0.2.0
npm version 0.2.0 --no-git-tag-version
git commit -am "chore(release): v0.2.0"
git push -u origin chore/release-0.2.0
gh pr create --base main --fill && gh pr merge --merge --delete-branch

# 2. promover main -> production
gh pr create --base production --head main --title "release: v0.2.0" --body "Release v0.2.0"
gh pr merge --merge

# 3. tag no topo da production
git fetch origin
git tag v0.2.0 origin/production
git push origin v0.2.0
```

A tag dispara `.github/workflows/release.yml`. Ele confere se a tag está na `production` e se bate com o `package.json`. Depois gera o AppImage e publica o GitHub Release.

Acompanhar: `gh run watch` e `gh release view v0.2.0`.
