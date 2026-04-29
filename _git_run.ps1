Set-Location $PSScriptRoot
git status -sb | Out-File "_git_before.txt" -Encoding utf8
git add -A 2>&1 | Out-File "_git_add_err.txt" -Encoding utf8
git diff --cached --quiet | Out-Null
$exit = $LASTEXITCODE
# git: 0 = no diff, 1 = has staged diff
$hasStaged = ($exit -eq 1)
if ($hasStaged) {
  git commit -m "fix(ui): largura das abas Individual; botão remover foto (hover/contraste)" 2>&1 | Out-File "_git_commit.txt" -Encoding utf8
} else {
  "no staged changes" | Out-File "_git_commit.txt" -Encoding utf8
}
git push origin master 2>&1 | Out-File "_git_push.txt" -Encoding utf8
git status -sb | Out-File "_git_after.txt" -Encoding utf8
"ok" | Out-File "_git_done.txt" -Encoding utf8
