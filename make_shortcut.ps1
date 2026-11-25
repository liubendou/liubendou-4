$WshShell = New-Object -ComObject WScript.Shell
$desktop = "C:\Users\Administrator\Desktop"
$shortcutPath = Join-Path $desktop "六本豆4.1.lnk"
$targetPath = Join-Path $desktop "六本豆4.1\六本豆.exe"

$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $targetPath
$Shortcut.WorkingDirectory = (Join-Path $desktop "六本豆4.1")
$Shortcut.Description = "六本豆 4.1 · 10亿旗舰心理分析对话模型桌面端"
$Shortcut.Save()

Write-Output ("Saved: " + (Test-Path $shortcutPath))

