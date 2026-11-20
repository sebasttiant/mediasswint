#!/usr/bin/env bash
#
# Asks GitHub whether the main CI workflow finished green for one commit.
#
#   bash scripts/ci-status.sh <40-hex sha>
#
# Green means: the newest run of the CI (main) workflow for that exact commit
# is completed with conclusion success, and every job of its latest attempt
# concluded success (skipped or cancelled jobs are not green). Prints
# "run=<id> url=<html_url> jobs=<n>" and exits 0; anything else exits 1.
#
#   DEPLOY_GITHUB_TOKEN   read-only token; required for a private repository
#                         (fine-grained: this repo only, Actions read + Metadata read)
#   DEPLOY_GITHUB_REPO    owner/name (default: parsed from git remote origin)
#   DEPLOY_GITHUB_API     default https://api.github.com
#   DEPLOY_CI_WORKFLOW    workflow file, default ci-main.yml
set -euo pipefail

fail() { printf 'ci-status: %s\n' "$*" >&2; exit 1; }

sha="${1:-}"
[[ "${sha}" =~ ^[0-9a-f]{40}$ ]] || fail "expected a 40-hex commit sha (got '${sha}')"
command -v curl >/dev/null || fail "curl is required"
command -v jq >/dev/null || fail "jq is required (sudo apt install jq)"

api="${DEPLOY_GITHUB_API:-https://api.github.com}"
workflow="${DEPLOY_CI_WORKFLOW:-ci-main.yml}"
repo="${DEPLOY_GITHUB_REPO:-}"
if [ -z "${repo}" ]; then
  origin="$(git config --get remote.origin.url 2>/dev/null || true)"
  [[ "${origin}" =~ github\.com[:/]([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)$ ]] ||
    fail "cannot tell the GitHub repository from origin '${origin}'; set DEPLOY_GITHUB_REPO=owner/name"
  repo="${BASH_REMATCH[1]%.git}"
fi
[[ "${repo}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail "DEPLOY_GITHUB_REPO must be owner/name"

# The token goes through a curl config on a file descriptor, never argv.
get() {
  local out code
  out="$(curl -sS --max-time 20 -w '\n%{http_code}' \
    -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    --config <(if [ -n "${DEPLOY_GITHUB_TOKEN:-}" ]; then
      printf 'header = "Authorization: Bearer %s"\n' "${DEPLOY_GITHUB_TOKEN}"
    fi) \
    "${api}$1")" || fail "cannot reach ${api}"
  code="${out##*$'\n'}"
  case "${code}" in
    200) printf '%s' "${out%$'\n'*}" ;;
    401) fail "GitHub rejected DEPLOY_GITHUB_TOKEN (401): it is wrong or expired" ;;
    403) fail "GitHub refused the request (403): token without Actions read access, or rate limit" ;;
    404) fail "GitHub does not show ${repo} (404): a private repository needs DEPLOY_GITHUB_TOKEN with access to it" ;;
    *) fail "GitHub answered ${code} for $1" ;;
  esac
}

runs="$(get "/repos/${repo}/actions/workflows/${workflow}/runs?head_sha=${sha}&per_page=50")"
run="$(jq -c --arg sha "${sha}" '
  [.workflow_runs[]? | select(.head_sha == $sha)] | sort_by(.created_at) | last // empty' <<<"${runs}")"
[ -n "${run}" ] || fail "no ${workflow} run for ${sha} on GitHub yet"

id="$(jq -r '.id' <<<"${run}")"
url="$(jq -r '.html_url' <<<"${run}")"
status="$(jq -r '.status' <<<"${run}")"
conclusion="$(jq -r '.conclusion // "none"' <<<"${run}")"
[ "${status}" = completed ] || fail "CI for ${sha} is still ${status}: ${url}"
[ "${conclusion}" = success ] || fail "CI for ${sha} finished with ${conclusion}: ${url}"

jobs="$(get "/repos/${repo}/actions/runs/${id}/jobs?filter=latest&per_page=100")"
total="$(jq '[.jobs[]?] | length' <<<"${jobs}")"
[ "${total}" -gt 0 ] || fail "CI run ${id} has no jobs: ${url}"
not_green="$(jq -r '.jobs[] | select(.conclusion != "success") | "\(.name)=\(.conclusion // .status)"' <<<"${jobs}")"
[ -z "${not_green}" ] || fail "CI run ${id} has jobs that are not green: $(tr '\n' ' ' <<<"${not_green}")${url}"

printf 'run=%s url=%s jobs=%s\n' "${id}" "${url}" "${total}"
