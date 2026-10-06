$headers = @{
    "Authorization" = "Bearer rnd_vxTzXEhN0NeqQA49Lmzkg5zKffjn"
    "Accept"        = "application/json"
}

try {
    $deploys = Invoke-RestMethod -Uri "https://api.render.com/v1/services/srv-db0ni8lg1s2s73esfjng/deploys?limit=1" -Headers $headers
    $d = $deploys[0].deploy
    Write-Output "ID: $($d.id)"
    Write-Output "Status: $($d.status)"
    Write-Output "Commit: $($d.commit.message)"
} catch {
    Write-Output "Error: $_"
}
