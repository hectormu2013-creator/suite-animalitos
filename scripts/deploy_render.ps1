$headers = @{
    "Authorization" = "Bearer rnd_vxTzXEhN0NeqQA49Lmzkg5zKffjn"
    "Accept"        = "application/json"
    "Content-Type"  = "application/json"
}

try {
    $res = Invoke-RestMethod -Uri "https://api.render.com/v1/services/srv-db0ni8lg1s2s73esfjng/deploys" -Method Post -Headers $headers -Body "{}"
    Write-Output "=== RENDER DEPLOY DISPARADO CON EXITO ==="
    Write-Output "Deploy ID: $($res.id)"
    Write-Output "Status:    $($res.status)"
    Write-Output "Commit:    $($res.commit.id) - $($res.commit.message)"
} catch {
    Write-Output "Error disparando deploy: $_"
}
